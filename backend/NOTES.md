# Implementation Notes

## Pull Activity Tracking

**Note**: AWS ECR does not provide per-image pull count metrics. Instead, the application uses `last_recorded_pulltime` to show when images were last pulled.

### Current Implementation

The "Recently Pulled" view (formerly "Most Downloaded") sorts images by `last_recorded_pulltime`:
- Images are sorted by most recently pulled first
- Images that were never pulled use their `pushed_at_time` instead
- This provides accurate information about image usage recency

The UI displays:
- **Last Pull**: Shows when the image was last pulled (or "Never" if never pulled)
- Relative time formatting (e.g., "5 days ago", "2 weeks ago") for easy reading

### Why Not Pull Counts?

AWS ECR only provides repository-level pull metrics via CloudWatch, not per-image counts. To get actual pull counts, you would need to implement:
1. **CloudWatch Logs Insights**: Query ECR API logs to track pull events per image
2. **CloudTrail Analysis**: Parse CloudTrail logs to extract pull events
3. **Custom Analytics**: Implement application-level tracking

## Last Pull Date

The implementation now uses ECR's `last_recorded_pulltime` field (exposed as `LastRecordedPullTime` in the API), which is the same field used by ECR lifecycle policies.

According to [AWS ECR Lifecycle Policies documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html):
- If an image was never pulled, the image's `pushed_at_time` is used instead
- If an image was archived and then restored but never pulled since restoration, the image's `last_activated_at` is used instead
- ECR refreshes the `last_recorded_pulltime` timestamp at least once every 24 hours

The current implementation:
- Uses `LastRecordedPullTime` when available (from `DescribeImages` API)
- Falls back to `ImagePushedAt` if the image was never pulled

## Image Deletion

The delete-by-date feature uses the `LastPullDate` field, which is populated from ECR's `last_recorded_pulltime` (same as lifecycle policies use). This provides accurate deletion based on actual pull times, matching ECR lifecycle policy behavior with `countType = sinceImagePulled`.

**Important**: Always verify images before bulk deletion. Consider implementing:
- Dry-run mode
- Confirmation prompts
- Backup/archive before deletion

### SBOM Deletion

**Critical**: When you delete an image from ECR, the associated Software Bill of Materials (SBOM) is also permanently deleted. SBOMs contain important security and dependency information about the image components.

- SBOMs are tied to the image digest and cannot be recovered after image deletion
- If you need to preserve SBOM data, export or backup it before deleting images
- Consider archiving images instead of deleting if SBOM retention is required
