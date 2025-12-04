# ECR Optimizer Backend

Go backend service for ECR image management.

## Setup

1. Install dependencies:
```bash
go mod download
```

2. Configure AWS credentials (one of):
   - Set environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Use AWS credentials file: `~/.aws/credentials`
   - Use IAM role (if running on EC2)

3. Run the server:
```bash
go run main.go
```

The server will start on `http://localhost:8081`

## API Endpoints

- `GET /api/repositories` - List all ECR repositories
- `GET /api/global-stats` - Get aggregate statistics across all repositories (total repos, total images, total size)
- `GET /api/images?repository=<name>` - Get all images in a repository
- `GET /api/images/most-downloaded?repository=<name>&limit=10` - Get most recently pulled images
- `GET /api/images/largest?repository=<name>&limit=10` - Get largest images
- `POST /api/images/delete` - Delete specific images
- `POST /api/images/delete-by-date` - Delete images older than X days since last pull

## Environment Variables

- `PORT` - Server port (default: 8080)
- `AWS_REGION` - AWS region (default: us-east-1)

