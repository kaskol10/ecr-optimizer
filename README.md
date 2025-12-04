# ECR Optimizer

A powerful open-source tool to gain visibility into AWS ECR repositories and reduce storage costs by efficiently managing container images. Delete images based on last pull date **without the 90-day waiting period** required by AWS ECR lifecycle policies.

## 🎯 Key Benefits

### vs AWS ECR Lifecycle Policies

- ✅ **No 90-day wait**: Delete images immediately based on last pull date
- ✅ **No archiving required**: Direct deletion without mandatory archive period
- ✅ **Full visibility**: See exactly which images will be deleted before confirming
- ✅ **Immediate cost savings**: Reduce ECR storage costs right away
- ✅ **Better control**: Delete images on-demand or by date criteria with full transparency

### Features

- **Global View**: Overview of all repositories with total images, size, and top 10 largest repositories
- **Repository Insights**: View most recently pulled images and largest images per repository
- **Smart Deletion**: Delete images based on `last_recorded_pulltime` (same field as lifecycle policies)
- **Batch Operations**: Handle large-scale deletions (supports 1000+ images)
- **Safety First**: Preview all images before deletion with detailed confirmation modal
- **SBOM Awareness**: Clear warnings about SBOM deletion before confirming

## 🚀 Why ECR Optimizer?

AWS ECR lifecycle policies require you to:
1. Archive images first
2. Wait up to 90 days before deletion
3. Have limited visibility into what will be deleted

**ECR Optimizer** gives you:
- Immediate deletion based on last pull date
- Full visibility into images before deletion
- No mandatory waiting periods
- Significant cost savings by removing unused images immediately

## Tech Stack

- **Backend**: Go with AWS SDK
- **Frontend**: React with minimalist UI
- **Architecture**: RESTful API

## Setup

### Prerequisites

- Go 1.21+
- Node.js 18+
- AWS credentials configured (via AWS CLI or environment variables)
- For Kubernetes deployment: Kubernetes 1.19+, Helm 3.0+

### Quick Start

Using Makefile:
```bash
make install-backend   # Install Go dependencies
make install-frontend  # Install Node.js dependencies
make run-backend       # Start backend server (port 8081)
make run-frontend      # Start frontend dev server (port 3000)
```

Or manually:

**Backend Setup:**
```bash
cd backend
go mod download
go run main.go
```

The backend will run on `http://localhost:8081`

**Frontend Setup:**
```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## Kubernetes Deployment

### Using Published Docker Images and Helm Chart

The project provides pre-built Docker images on GitHub Container Registry and a Helm chart published with each release.

#### Using Published Images

Docker images are automatically built and published to GitHub Container Registry on every push and release:

- **Backend**: `ghcr.io/kaskol10/ecr-optimizer/backend:latest`
- **Frontend**: `ghcr.io/kaskol10/ecr-optimizer/frontend:latest`

Images are published to `ghcr.io/kaskol10/ecr-optimizer/`.

To pull images (requires authentication for private repos):
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/kaskol10/ecr-optimizer/backend:latest
docker pull ghcr.io/kaskol10/ecr-optimizer/frontend:latest
```

#### Using Published Helm Chart

Install from GitHub Releases:

```bash
# Download the Helm chart from the latest release
helm install ecr-optimizer https://github.com/kaskol10/ecr-optimizer/releases/download/v0.1.0/ecr-optimizer-0.1.0.tgz \
  --set image.backend.repository=ghcr.io/kaskol10/ecr-optimizer/backend \
  --set image.frontend.repository=ghcr.io/kaskol10/ecr-optimizer/frontend \
  --set aws.region=us-east-1 \
  --set aws.credentialsSecret=aws-credentials
```

Or use IAM Role for Service Account (recommended for EKS):
```bash
helm install ecr-optimizer https://github.com/kaskol10/ecr-optimizer/releases/download/v0.1.0/ecr-optimizer-0.1.0.tgz \
  --set image.backend.repository=ghcr.io/kaskol10/ecr-optimizer/backend \
  --set image.frontend.repository=ghcr.io/kaskol10/ecr-optimizer/frontend \
  --set aws.useIRSA=true \
  --set aws.roleArn=arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role
```

**Note**: Make sure to replace `kaskol10` with your actual GitHub username/organization and update the version number in the URL.

### Using Local Helm Chart

The project includes a Helm chart for easy Kubernetes deployment with support for both sidecar and separate deployment patterns.

#### Quick Start

```bash
# Build Docker images locally
make docker-all

# Install with default values (sidecar pattern)
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.region=us-east-1 \
  --set aws.credentialsSecret=aws-credentials

# Or use IAM Role for Service Account (recommended for EKS)
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.useIRSA=true \
  --set aws.roleArn=arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role
```

#### Deployment Patterns

**Sidecar Pattern (default):**
- Backend and frontend run in the same pod
- Frontend nginx proxies API calls to localhost backend
- More efficient resource usage

**Separate Pattern:**
- Backend and frontend run in separate deployments
- Better for scaling independently
- Set `deploymentPattern: "separate"` in values.yaml

#### Configuration

See `helm/ecr-optimizer/values.yaml` for all configuration options.

Key settings:
- `aws.region`: AWS region for ECR access
- `aws.useIRSA`: Use IAM Role for Service Account (recommended for EKS)
- `aws.credentialsSecret`: Kubernetes secret name containing AWS credentials
- `deploymentPattern`: "sidecar" or "separate"
- `ingress.enabled`: Enable ingress for external access

For detailed Helm documentation, see [helm/README.md](helm/README.md).

## Configuration

The backend uses AWS credentials from:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- AWS credentials file (`~/.aws/credentials`)
- IAM role (if running on EC2)

## Usage

1. Start the backend server (`make run-backend` or `cd backend && go run main.go`)
2. Start the frontend development server (`make run-frontend` or `cd frontend && npm start`)
3. Navigate to `http://localhost:3000`
4. Select a repository from the sidebar
5. View dashboard, most downloaded images, or largest images
6. Delete images individually or by date criteria

## Important Notes

### Pull Count Tracking
AWS ECR does not provide per-image pull count metrics. The application uses heuristics based on image scan dates and age. For accurate pull tracking, consider implementing CloudWatch Logs Insights queries or custom analytics.

### Last Pull Date
The app uses ECR's `last_recorded_pulltime` field (same as lifecycle policies use) for accurate pull date tracking. If an image was never pulled, it falls back to the pushed date. See `backend/NOTES.md` for more details.

### Image Deletion
The delete-by-date feature uses ECR's `last_recorded_pulltime` field (same as lifecycle policies) for accurate deletion based on actual pull times. Always verify images before bulk deletion using the preview feature.

## API Endpoints

- `GET /api/repositories` - List all ECR repositories
- `GET /api/global-stats` - Get aggregate statistics across all repositories (total repos, total images, total size)
- `GET /api/images?repository=<name>` - Get all images in a repository
- `GET /api/images/most-downloaded?repository=<name>&limit=10` - Get most recently pulled images
- `GET /api/images/largest?repository=<name>&limit=10` - Get largest images
- `POST /api/images/delete` - Delete specific images by digest
- `POST /api/images/delete-by-date` - Delete images older than X days since last pull

## Releases

Releases are automatically created when you push a version tag (e.g., `v1.0.0`). The release process:

1. **Builds and publishes Docker images** to GitHub Container Registry
2. **Packages and publishes the Helm chart** to GitHub Releases
3. **Creates a GitHub Release** with release notes

To create a release:

```bash
# Tag a new version
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

The GitHub Actions workflows will automatically:
- Build and push Docker images with tags: `v1.0.0`, `1.0.0`, `1.0`, `1`, and `latest`
- Package the Helm chart and attach it to the release
- Create release notes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Building and Testing

```bash
# Run tests
make install-backend
make install-frontend

# Build locally
make build-all

# Build Docker images
make docker-all
```

## Use Cases

- **Cost Optimization**: Reduce AWS ECR storage costs by removing unused images immediately
- **Compliance**: Clean up old images without waiting for lifecycle policy delays
- **Visibility**: Get insights into which images are actually being used
- **Automation**: Integrate into CI/CD pipelines for automated cleanup

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## Disclaimer

This tool performs irreversible deletions. Always review images carefully before deletion. The authors are not responsible for any data loss. Use at your own risk.

