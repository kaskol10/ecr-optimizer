package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ecr"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

type ImageInfo struct {
	RepositoryName string     `json:"repositoryName"`
	ImageTag       string     `json:"imageTag"`
	ImageDigest    string     `json:"imageDigest"`
	ImageSize      int64      `json:"imageSize"`
	ImagePushedAt  time.Time  `json:"imagePushedAt"`
	ImagePullCount int64      `json:"imagePullCount"`
	LastPullDate   *time.Time `json:"lastPullDate,omitempty"`
}

type DeleteRequest struct {
	RepositoryName string   `json:"repositoryName"`
	ImageDigests   []string `json:"imageDigests"`
}

type DeleteByDateRequest struct {
	RepositoryName string   `json:"repositoryName"`
	DaysOld        int      `json:"daysOld"`
	ImageDigests   []string `json:"imageDigests,omitempty"` // Optional: if provided, delete only these specific images
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var ecrClient *ecr.ECR

type cachedGlobalStats struct {
	stats     GlobalStats
	expiresAt time.Time
	mu        sync.RWMutex
}

var globalStatsCache = &cachedGlobalStats{}

func init() {
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(getAWSRegion()),
	})
	if err != nil {
		log.Fatalf("Failed to create AWS session: %v", err)
	}
	ecrClient = ecr.New(sess)
}

func getAWSRegion() string {
	if region := os.Getenv("AWS_REGION"); region != "" {
		return region
	}
	return "us-east-1" // default
}

func listRepositories(w http.ResponseWriter, r *http.Request) {
	var allRepos []string
	var nextToken *string

	for {
		describeInput := &ecr.DescribeRepositoriesInput{
			MaxResults: aws.Int64(100),
		}
		if nextToken != nil {
			describeInput.NextToken = nextToken
		}

		result, err := ecrClient.DescribeRepositories(describeInput)
		if err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to list repositories: %v", err))
			return
		}

		for _, repo := range result.Repositories {
			allRepos = append(allRepos, *repo.RepositoryName)
		}

		if result.NextToken == nil {
			break
		}
		nextToken = result.NextToken
	}

	respondJSON(w, http.StatusOK, allRepos)
}

type RepositoryStats struct {
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	ImageCount int    `json:"imageCount"`
}

type GlobalStats struct {
	TotalRepositories     int               `json:"totalRepositories"`
	TotalImages           int               `json:"totalImages"`
	TotalSize             int64             `json:"totalSize"`
	TopRepositoriesBySize []RepositoryStats `json:"topRepositoriesBySize"`
}

func getGlobalStats(w http.ResponseWriter, r *http.Request) {
	// Check cache first
	globalStatsCache.mu.RLock()
	if !globalStatsCache.expiresAt.IsZero() && time.Now().Before(globalStatsCache.expiresAt) {
		// Cache is valid, return cached stats
		cachedStats := globalStatsCache.stats
		globalStatsCache.mu.RUnlock()
		log.Printf("Returning cached global stats (expires at %v)", globalStatsCache.expiresAt)
		respondJSON(w, http.StatusOK, cachedStats)
		return
	}
	globalStatsCache.mu.RUnlock()

	// Cache expired or doesn't exist, calculate fresh stats
	log.Printf("Calculating fresh global stats...")

	var allRepos []string
	var nextToken *string

	// Fetch all repositories with pagination
	for {
		describeInput := &ecr.DescribeRepositoriesInput{
			MaxResults: aws.Int64(100),
		}
		if nextToken != nil {
			describeInput.NextToken = nextToken
		}

		result, err := ecrClient.DescribeRepositories(describeInput)
		if err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to list repositories: %v", err))
			return
		}

		for _, repo := range result.Repositories {
			allRepos = append(allRepos, *repo.RepositoryName)
		}

		if result.NextToken == nil {
			break
		}
		nextToken = result.NextToken
	}

	totalImages := 0
	var totalSize int64 = 0
	reposProcessed := 0
	reposWithErrors := 0
	repoStats := make([]RepositoryStats, 0, len(allRepos))

	// Iterate through all repositories and aggregate stats
	for _, repoName := range allRepos {
		images, err := fetchImages(repoName)
		if err != nil {
			log.Printf("Warning: Failed to fetch images for repository %s: %v", repoName, err)
			reposWithErrors++
			continue
		}
		reposProcessed++
		imageCount := len(images)
		var repoSize int64 = 0
		for _, img := range images {
			repoSize += img.ImageSize
			totalSize += img.ImageSize
		}
		totalImages += imageCount

		// Track repository stats for top 10 list
		repoStats = append(repoStats, RepositoryStats{
			Name:       repoName,
			Size:       repoSize,
			ImageCount: imageCount,
		})

		if reposProcessed%50 == 0 {
			log.Printf("Processed %d/%d repositories, %d images so far...", reposProcessed, len(allRepos), totalImages)
		}
	}

	// Sort repositories by size (descending) - return all for frontend filtering
	sort.Slice(repoStats, func(i, j int) bool {
		return repoStats[i].Size > repoStats[j].Size
	})

	log.Printf("Global stats calculation complete: %d repos processed, %d repos with errors, %d total images, %d total size",
		reposProcessed, reposWithErrors, totalImages, totalSize)

	stats := GlobalStats{
		TotalRepositories:     len(allRepos),
		TotalImages:           totalImages,
		TotalSize:             totalSize,
		TopRepositoriesBySize: repoStats,
	}

	// Cache the results for 12 hours
	globalStatsCache.mu.Lock()
	globalStatsCache.stats = stats
	globalStatsCache.expiresAt = time.Now().Add(12 * time.Hour)
	globalStatsCache.mu.Unlock()

	log.Printf("Global stats cached until %v", globalStatsCache.expiresAt)
	respondJSON(w, http.StatusOK, stats)
}

func getImages(w http.ResponseWriter, r *http.Request) {
	repoName := r.URL.Query().Get("repository")
	if repoName == "" {
		respondError(w, http.StatusBadRequest, "repository parameter is required")
		return
	}

	images, err := fetchImages(repoName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch images: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, images)
}

// getMostDownloaded returns images sorted by last_recorded_pulltime (most recently pulled first)
// Note: Despite the name, this endpoint sorts by last pull time, not pull count,
// since ECR doesn't provide per-image pull counts
func getMostDownloaded(w http.ResponseWriter, r *http.Request) {
	repoName := r.URL.Query().Get("repository")
	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	images, err := fetchImages(repoName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch images: %v", err))
		return
	}

	// Sort by last pull time (most recently pulled first)
	sortedImages := sortByLastPullTime(images)
	if limit > 0 && limit < len(sortedImages) {
		sortedImages = sortedImages[:limit]
	}

	respondJSON(w, http.StatusOK, sortedImages)
}

func getLargestImages(w http.ResponseWriter, r *http.Request) {
	repoName := r.URL.Query().Get("repository")
	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	images, err := fetchImages(repoName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch images: %v", err))
		return
	}

	// Sort by size (descending)
	sortedImages := sortBySize(images)
	if limit > 0 && limit < len(sortedImages) {
		sortedImages = sortedImages[:limit]
	}

	respondJSON(w, http.StatusOK, sortedImages)
}

func deleteImages(w http.ResponseWriter, r *http.Request) {
	var req DeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if req.RepositoryName == "" || len(req.ImageDigests) == 0 {
		respondError(w, http.StatusBadRequest, "repositoryName and imageDigests are required")
		return
	}

	// ECR BatchDeleteImage has a limit of 100 images per request
	// Split into batches of 100
	batchSize := 100
	totalDeleted := 0
	var errors []string

	for i := 0; i < len(req.ImageDigests); i += batchSize {
		end := i + batchSize
		if end > len(req.ImageDigests) {
			end = len(req.ImageDigests)
		}

		batch := req.ImageDigests[i:end]
		imageIds := make([]*ecr.ImageIdentifier, len(batch))
		for j, digest := range batch {
			imageIds[j] = &ecr.ImageIdentifier{
				ImageDigest: aws.String(digest),
			}
		}

		result, err := ecrClient.BatchDeleteImage(&ecr.BatchDeleteImageInput{
			RepositoryName: aws.String(req.RepositoryName),
			ImageIds:       imageIds,
		})

		if err != nil {
			errorMsg := fmt.Sprintf("Failed to delete batch %d-%d: %v", i+1, end, err)
			log.Printf("Error: %s", errorMsg)
			errors = append(errors, errorMsg)
			continue
		}

		// Count successfully deleted images
		deletedInBatch := 0
		if result.ImageIds != nil {
			deletedInBatch = len(result.ImageIds)
			totalDeleted += deletedInBatch
		}

		// Check for failures (images that couldn't be deleted)
		if result.Failures != nil && len(result.Failures) > 0 {
			for _, failure := range result.Failures {
				errorMsg := fmt.Sprintf("Failed to delete image %s: %s",
					aws.StringValue(failure.ImageId.ImageDigest),
					aws.StringValue(failure.FailureReason))
				log.Printf("Warning: %s", errorMsg)
				errors = append(errors, errorMsg)
			}
		}

		log.Printf("Deleted batch %d-%d: %d succeeded, %d failed (out of %d total)",
			i+1, end, deletedInBatch, len(result.Failures), len(batch))
	}

	if len(errors) > 0 {
		respondJSON(w, http.StatusPartialContent, map[string]interface{}{
			"message": fmt.Sprintf("Partially completed: %d images deleted, but encountered %d errors", totalDeleted, len(errors)),
			"deleted": totalDeleted,
			"errors":  errors,
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Images deleted successfully",
		"deleted": totalDeleted,
	})
}

func deleteImagesByDate(w http.ResponseWriter, r *http.Request) {
	var req DeleteByDateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if req.RepositoryName == "" {
		respondError(w, http.StatusBadRequest, "repositoryName is required")
		return
	}

	var imagesToDelete []string

	// If specific image digests are provided, use those directly (from preview)
	// Otherwise, filter by date criteria
	if len(req.ImageDigests) > 0 {
		imagesToDelete = req.ImageDigests
		log.Printf("Deleting %d specific images provided in request", len(imagesToDelete))
	} else {
		// Fallback to date-based filtering
		if req.DaysOld <= 0 {
			respondError(w, http.StatusBadRequest, "daysOld (> 0) is required when imageDigests is not provided")
			return
		}

		images, err := fetchImages(req.RepositoryName)
		if err != nil {
			respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch images: %v", err))
			return
		}

		cutoffDate := time.Now().AddDate(0, 0, -req.DaysOld)

		// Delete images based on last_recorded_pulltime (same logic as ECR lifecycle policies)
		// https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html
		// Images whose last_recorded_pulltime is older than the cutoff date will be deleted
		// If an image was never pulled, LastPullDate will be set to ImagePushedAt
		for _, img := range images {
			if img.LastPullDate != nil && img.LastPullDate.Before(cutoffDate) {
				imagesToDelete = append(imagesToDelete, img.ImageDigest)
			}
		}
		log.Printf("Filtered %d images by date criteria (older than %d days)", len(imagesToDelete), req.DaysOld)
	}

	if len(imagesToDelete) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "No images found matching criteria",
			"deleted": 0,
		})
		return
	}

	// ECR BatchDeleteImage has a limit of 100 images per request
	// Split into batches of 100
	batchSize := 100
	totalDeleted := 0
	var errors []string

	for i := 0; i < len(imagesToDelete); i += batchSize {
		end := i + batchSize
		if end > len(imagesToDelete) {
			end = len(imagesToDelete)
		}

		batch := imagesToDelete[i:end]
		imageIds := make([]*ecr.ImageIdentifier, len(batch))
		for j, digest := range batch {
			imageIds[j] = &ecr.ImageIdentifier{
				ImageDigest: aws.String(digest),
			}
		}

		result, err := ecrClient.BatchDeleteImage(&ecr.BatchDeleteImageInput{
			RepositoryName: aws.String(req.RepositoryName),
			ImageIds:       imageIds,
		})

		if err != nil {
			errorMsg := fmt.Sprintf("Failed to delete batch %d-%d: %v", i+1, end, err)
			log.Printf("Error: %s", errorMsg)
			errors = append(errors, errorMsg)
			continue
		}

		// Count successfully deleted images
		deletedInBatch := 0
		if result.ImageIds != nil {
			deletedInBatch = len(result.ImageIds)
			totalDeleted += deletedInBatch
		}

		// Check for failures (images that couldn't be deleted)
		if result.Failures != nil && len(result.Failures) > 0 {
			for _, failure := range result.Failures {
				errorMsg := fmt.Sprintf("Failed to delete image %s: %s",
					aws.StringValue(failure.ImageId.ImageDigest),
					aws.StringValue(failure.FailureReason))
				log.Printf("Warning: %s", errorMsg)
				errors = append(errors, errorMsg)
			}
		}

		log.Printf("Deleted batch %d-%d: %d succeeded, %d failed (out of %d total)",
			i+1, end, deletedInBatch, len(result.Failures), len(batch))
	}

	if len(errors) > 0 {
		respondJSON(w, http.StatusPartialContent, map[string]interface{}{
			"message": fmt.Sprintf("Partially completed: %d images deleted, but encountered %d errors", totalDeleted, len(errors)),
			"deleted": totalDeleted,
			"errors":  errors,
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Images deleted successfully",
		"deleted": totalDeleted,
	})
}

func fetchImages(repoName string) ([]ImageInfo, error) {
	var allImages []ImageInfo
	var nextToken *string
	pageCount := 0

	for {
		describeInput := &ecr.DescribeImagesInput{
			RepositoryName: aws.String(repoName),
			MaxResults:     aws.Int64(100),
		}
		if nextToken != nil {
			describeInput.NextToken = nextToken
		}

		result, err := ecrClient.DescribeImages(describeInput)
		if err != nil {
			return nil, fmt.Errorf("failed to describe images for repo %s: %w", repoName, err)
		}

		pageCount++

		for _, img := range result.ImageDetails {
			imageInfo := ImageInfo{
				RepositoryName: repoName,
				ImageDigest:    *img.ImageDigest,
				ImageSize:      *img.ImageSizeInBytes,
				ImagePushedAt:  *img.ImagePushedAt,
			}

			if len(img.ImageTags) > 0 && img.ImageTags[0] != nil {
				imageInfo.ImageTag = *img.ImageTags[0]
			}

			// Use last_recorded_pulltime from ECR (as per lifecycle policy documentation)
			// https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html
			// If an image was never pulled, ECR uses pushed_at_time instead
			// If an image was archived and restored but never pulled since restoration,
			// ECR uses last_activated_at instead
			if img.LastRecordedPullTime != nil {
				lastPull := *img.LastRecordedPullTime
				imageInfo.LastPullDate = &lastPull
			} else {
				// Fallback to pushed date if image was never pulled
				// This matches ECR lifecycle policy behavior
				imageInfo.LastPullDate = &imageInfo.ImagePushedAt
			}

			// Pull count is deprecated - we use LastPullDate for sorting instead
			imageInfo.ImagePullCount = 0

			allImages = append(allImages, imageInfo)
		}

		if result.NextToken == nil {
			break
		}
		nextToken = result.NextToken
	}

	return allImages, nil
}

func sortByLastPullTime(images []ImageInfo) []ImageInfo {
	// Create a copy to avoid modifying original
	sorted := make([]ImageInfo, len(images))
	copy(sorted, images)

	// Sort by last pull time (most recently pulled first)
	// Images never pulled (LastPullDate = pushed date) go to the end
	sort.Slice(sorted, func(i, j int) bool {
		// Handle nil cases
		if sorted[i].LastPullDate == nil && sorted[j].LastPullDate == nil {
			return false
		}
		if sorted[i].LastPullDate == nil {
			return false // nil goes to end
		}
		if sorted[j].LastPullDate == nil {
			return true // nil goes to end
		}

		// Most recently pulled first
		return sorted[i].LastPullDate.After(*sorted[j].LastPullDate)
	})
	return sorted
}

func sortBySize(images []ImageInfo) []ImageInfo {
	// Create a copy to avoid modifying original
	sorted := make([]ImageInfo, len(images))
	copy(sorted, images)

	// Use Go's sort package for better performance
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ImageSize > sorted[j].ImageSize
	})
	return sorted
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, ErrorResponse{Error: message})
}

func main() {
	router := mux.NewRouter()

	// API routes
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/repositories", listRepositories).Methods("GET")
	api.HandleFunc("/global-stats", getGlobalStats).Methods("GET")
	api.HandleFunc("/images", getImages).Methods("GET")
	api.HandleFunc("/images/most-downloaded", getMostDownloaded).Methods("GET")
	api.HandleFunc("/images/largest", getLargestImages).Methods("GET")
	api.HandleFunc("/images/delete", deleteImages).Methods("POST")
	api.HandleFunc("/images/delete-by-date", deleteImagesByDate).Methods("POST")

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}).Methods("GET")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type"},
	})

	handler := c.Handler(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
