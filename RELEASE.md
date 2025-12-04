# Release Guide

This guide explains how to create releases for ECR Optimizer, which automatically builds Docker images and publishes Helm charts.

## Prerequisites

- Push access to the repository
- GitHub Actions enabled (enabled by default)

## Release Process

### 1. Update Version Numbers

Before creating a release, update version numbers in:

- `helm/ecr-optimizer/Chart.yaml` - Update `version` and `appVersion`
- Consider updating `README.md` if there are breaking changes

### 2. Create a Release Tag

Create and push a version tag following [Semantic Versioning](https://semver.org/):

```bash
# For a major release (breaking changes)
git tag -a v1.0.0 -m "Release version 1.0.0"

# For a minor release (new features, backward compatible)
git tag -a v1.1.0 -m "Release version 1.1.0"

# For a patch release (bug fixes)
git tag -a v1.0.1 -m "Release version 1.0.1"

# Push the tag
git push origin v1.0.0
```

### 3. Automatic Release Process

Once you push a tag, GitHub Actions will automatically:

1. **Build Docker Images** (`.github/workflows/docker.yml`)
   - Builds backend and frontend images
   - Tags images with: `v1.0.0`, `1.0.0`, `1.0`, `1`, and `latest` (if main branch)
   - Pushes to GitHub Container Registry: `ghcr.io/YOUR_USERNAME/ecr-optimizer/backend` and `ghcr.io/YOUR_USERNAME/ecr-optimizer/frontend`

2. **Package Helm Chart** (`.github/workflows/helm.yml`)
   - Lints the Helm chart
   - Packages the chart as a `.tgz` file
   - Updates Chart.yaml version if needed

3. **Create GitHub Release** (`.github/workflows/release.yml`)
   - Waits for Docker images and Helm chart to be ready
   - Creates a GitHub Release with:
     - Release notes
     - Helm chart package attached
     - Links to Docker images

### 4. Verify Release

After the workflows complete:

1. Check GitHub Releases page: `https://github.com/YOUR_USERNAME/ecr-optimizer/releases`
2. Verify Docker images are available:
   ```bash
   docker pull ghcr.io/YOUR_USERNAME/ecr-optimizer/backend:v1.0.0
   docker pull ghcr.io/YOUR_USERNAME/ecr-optimizer/frontend:v1.0.0
   ```
3. Download and verify Helm chart:
   ```bash
   helm install test-release https://github.com/YOUR_USERNAME/ecr-optimizer/releases/download/v1.0.0/ecr-optimizer-1.0.0.tgz --dry-run
   ```

## Manual Release (Optional)

If you need to manually trigger a release without a tag:

1. Go to Actions → "Package and Publish Helm Chart"
2. Click "Run workflow"
3. Optionally specify a version number

## Docker Image Tags

Images are tagged with multiple versions for flexibility:

- `v1.0.0` - Full semantic version with 'v' prefix
- `1.0.0` - Full semantic version
- `1.0` - Major.minor version
- `1` - Major version only
- `latest` - Latest release (only on main branch)
- `main-<sha>` - Branch-based tags for main branch

## Helm Chart Installation

After a release, users can install the Helm chart:

```bash
# Download from release
helm install ecr-optimizer \
  https://github.com/YOUR_USERNAME/ecr-optimizer/releases/download/v1.0.0/ecr-optimizer-1.0.0.tgz \
  --set image.backend.repository=ghcr.io/YOUR_USERNAME/ecr-optimizer/backend \
  --set image.frontend.repository=ghcr.io/YOUR_USERNAME/ecr-optimizer/frontend \
  --set aws.region=us-east-1
```

## Troubleshooting

### Images not appearing in GitHub Container Registry

- Check workflow logs for errors
- Ensure `GITHUB_TOKEN` has `packages:write` permission (automatic for Actions)
- Verify the repository name matches your GitHub username/org

### Helm chart not packaging correctly

- Check Chart.yaml syntax
- Verify all required files are present in `helm/ecr-optimizer/`
- Review workflow logs for linting errors

### Release not created

- Ensure all workflows completed successfully
- Check that the tag follows the `v*.*.*` pattern
- Verify GitHub Actions are enabled for the repository

## Best Practices

1. **Version Numbers**: Follow semantic versioning (MAJOR.MINOR.PATCH)
2. **Release Notes**: Update CHANGELOG.md or release notes before tagging
3. **Testing**: Test the Helm chart locally before releasing
4. **Documentation**: Update README.md with new features or breaking changes
5. **Security**: Review Docker images for vulnerabilities before release

