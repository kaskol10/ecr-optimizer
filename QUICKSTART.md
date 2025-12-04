# Quick Start Guide

## Prerequisites

1. **Go 1.21+** installed
2. **Node.js 18+** and npm installed
3. **AWS Credentials** configured (one of):
   - AWS CLI configured (`aws configure`)
   - Environment variables set:
     ```bash
     export AWS_ACCESS_KEY_ID=your-access-key
     export AWS_SECRET_ACCESS_KEY=your-secret-key
     export AWS_REGION=us-east-1
     ```
   - IAM role (if running on EC2)

## Installation & Running

### Option 1: Using Makefile

```bash
# Install dependencies
make install-backend
make install-frontend

# Run both servers (in separate terminals)
make run-backend    # Terminal 1: Backend on http://localhost:8080
make run-frontend   # Terminal 2: Frontend on http://localhost:3000
```

### Option 2: Manual

**Terminal 1 - Backend:**
```bash
cd backend
go mod download
go run main.go
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm start
```

## Usage

1. Open your browser to `http://localhost:3000`
2. Select a repository from the sidebar
3. Navigate between views:
   - **Dashboard**: Overview with stats and top images
   - **Most Downloaded**: Images sorted by pull count
   - **Largest Images**: Images sorted by size
4. Delete images:
   - Click "Delete" on any image for on-demand deletion
   - Use the delete modal to delete by date criteria

## Troubleshooting

### Backend won't start
- Check AWS credentials are configured
- Verify AWS_REGION is set (defaults to us-east-1)
- Check port 8080 is available

### Frontend won't connect to backend
- Ensure backend is running on port 8080
- Check CORS settings in `backend/main.go` if using different ports

### No repositories showing
- Verify AWS credentials have ECR read permissions
- Check you're in the correct AWS region
- Ensure you have ECR repositories in your account

## AWS IAM Permissions Required

Your AWS credentials need these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:DescribeRepositories",
        "ecr:DescribeImages",
        "ecr:BatchDeleteImage",
        "ecr:ListImages"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

