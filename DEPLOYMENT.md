# Kubernetes Deployment Guide

This guide covers deploying ECR Optimizer on Kubernetes using Helm.

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.0+
- kubectl configured to access your cluster
- AWS credentials or IAM role configured

## Building Docker Images

Before deploying, you need to build and push Docker images to a container registry accessible by your Kubernetes cluster.

### Build Images

```bash
# Build backend image
docker build -t ecr-optimizer-backend:latest -f backend/Dockerfile backend/

# Build frontend image
docker build -t ecr-optimizer-frontend:latest -f frontend/Dockerfile frontend/
```

### Push to Registry

```bash
# Tag for your registry (example: ECR)
export REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag ecr-optimizer-backend:latest ${REGISTRY}/ecr-optimizer-backend:latest
docker tag ecr-optimizer-frontend:latest ${REGISTRY}/ecr-optimizer-frontend:latest

docker push ${REGISTRY}/ecr-optimizer-backend:latest
docker push ${REGISTRY}/ecr-optimizer-frontend:latest
```

## AWS Credentials Setup

### Option 1: IAM Role for Service Account (IRSA) - Recommended for EKS

IRSA allows pods to assume an IAM role without storing credentials in Kubernetes. The Helm chart automatically configures the ServiceAccount with the proper annotation.

#### Step 1: Create IAM Role and Trust Policy

1. Create an IAM role with ECR permissions. The role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:DescribeRepositories",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:BatchDeleteImage",
        "ecr:ListImages",
        "ecr:GetLifecyclePolicy",
        "ecr:GetLifecyclePolicyPreview",
        "ecr:DescribeImageScanFindings",
        "ecr:GetRepositoryPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

2. Create a trust policy that allows your EKS cluster's OIDC provider to assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/oidc.eks.REGION.amazonaws.com/id/OIDC_ID"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.REGION.amazonaws.com/id/OIDC_ID:sub": "system:serviceaccount:NAMESPACE:ecr-optimizer",
          "oidc.eks.REGION.amazonaws.com/id/OIDC_ID:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

**Quick Setup with AWS CLI:**

```bash
# Get your cluster's OIDC issuer URL
export CLUSTER_NAME=your-eks-cluster
export REGION=us-east-1
export OIDC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query "cluster.identity.oidc.issuer" --output text | cut -d '/' -f 5)

# Create IAM role with trust policy
aws iam create-role \
  --role-name ecr-optimizer-role \
  --assume-role-policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Principal\": {
        \"Federated\": \"arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/oidc.eks.$REGION.amazonaws.com/id/$OIDC_ID\"
      },
      \"Action\": \"sts:AssumeRoleWithWebIdentity\",
      \"Condition\": {
        \"StringEquals\": {
          \"oidc.eks.$REGION.amazonaws.com/id/$OIDC_ID:sub\": \"system:serviceaccount:default:ecr-optimizer\",
          \"oidc.eks.$REGION.amazonaws.com/id/$OIDC_ID:aud\": \"sts.amazonaws.com\"
        }
      }
    }]
  }"

# Attach ECR permissions policy
aws iam attach-role-policy \
  --role-name ecr-optimizer-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Or create a custom policy with delete permissions
aws iam put-role-policy \
  --role-name ecr-optimizer-role \
  --policy-name ECROptimizerPolicy \
  --policy-document file://ecr-policy.json
```

#### Step 2: Install with IRSA

The Helm chart will automatically create the ServiceAccount with the IRSA annotation:

```bash
# Get the IAM role ARN
export ROLE_ARN=$(aws iam get-role --role-name ecr-optimizer-role --query 'Role.Arn' --output text)

# Install with IRSA
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.useIRSA=true \
  --set aws.roleArn=${ROLE_ARN} \
  --set aws.region=us-east-1 \
  --set image.backend.repository=${REGISTRY}/ecr-optimizer-backend \
  --set image.frontend.repository=${REGISTRY}/ecr-optimizer-frontend
```

**Or using the Helm repository:**

```bash
helm repo add ecr-optimizer https://kaskol10.github.io/ecr-optimizer/charts
helm repo update

helm install ecr-optimizer ecr-optimizer/ecr-optimizer \
  --set aws.useIRSA=true \
  --set aws.roleArn=arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role \
  --set aws.region=us-east-1
```

#### Step 3: Verify IRSA is Working

```bash
# Check ServiceAccount annotation
kubectl get serviceaccount ecr-optimizer -o yaml | grep eks.amazonaws.com/role-arn

# Check pod has the token mounted
kubectl exec -it deployment/ecr-optimizer-backend -- ls -la /var/run/secrets/eks.amazonaws.com/serviceaccount/

# Test AWS credentials in pod
kubectl exec -it deployment/ecr-optimizer-backend -- env | grep AWS
```

### Option 2: AWS Credentials Secret

1. Create a Kubernetes secret with AWS credentials:

```bash
kubectl create secret generic aws-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=your-access-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-secret-key
```

2. Install with credentials secret:

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.credentialsSecret=aws-credentials \
  --set aws.region=us-east-1 \
  --set image.backend.repository=${REGISTRY}/ecr-optimizer-backend \
  --set image.frontend.repository=${REGISTRY}/ecr-optimizer-frontend
```

## Deployment Patterns

### Sidecar Pattern (Default)

Backend and frontend run in the same pod. Frontend nginx proxies API calls to localhost backend.

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set deploymentPattern=sidecar \
  --set image.backend.repository=${REGISTRY}/ecr-optimizer-backend \
  --set image.frontend.repository=${REGISTRY}/ecr-optimizer-frontend
```

**Pros:**
- More efficient resource usage
- Simpler networking (no service discovery needed)
- Better for small to medium deployments

**Cons:**
- Cannot scale frontend and backend independently
- Both containers restart together

### Separate Pattern

Backend and frontend run in separate deployments.

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set deploymentPattern=separate \
  --set image.backend.repository=${REGISTRY}/ecr-optimizer-backend \
  --set image.frontend.repository=${REGISTRY}/ecr-optimizer-frontend
```

**Pros:**
- Independent scaling
- Better for large deployments
- Can update frontend/backend independently

**Cons:**
- More resource usage
- Requires service discovery

## Accessing the Application

### Port Forwarding (Development)

```bash
# For sidecar pattern
kubectl port-forward svc/ecr-optimizer-frontend 8080:80

# For separate pattern
kubectl port-forward svc/ecr-optimizer-frontend 8080:80
```

Access at `http://localhost:8080`

### Ingress (Production)

1. Enable ingress in values.yaml or via helm:

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=ecr-optimizer.example.com \
  --set image.backend.repository=${REGISTRY}/ecr-optimizer-backend \
  --set image.frontend.repository=${REGISTRY}/ecr-optimizer-frontend
```

2. Configure DNS to point to your ingress controller

## Configuration

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `deploymentPattern` | "sidecar" or "separate" | `"sidecar"` |
| `aws.region` | AWS region | `"us-east-1"` |
| `aws.useIRSA` | Use IRSA | `false` |
| `aws.credentialsSecret` | Secret name | `""` |
| `replicaCount` | Number of replicas | `1` |
| `service.type` | Service type | `ClusterIP` |
| `ingress.enabled` | Enable ingress | `false` |

### Resource Limits

Default resource limits:

```yaml
resources:
  backend:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
  frontend:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi
```

### Autoscaling

Enable horizontal pod autoscaling:

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=10 \
  --set autoscaling.targetCPUUtilizationPercentage=70
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=ecr-optimizer
```

### View Logs

```bash
# Backend logs
kubectl logs -l app.kubernetes.io/component=backend

# Frontend logs (sidecar)
kubectl logs -l app.kubernetes.io/component=backend -c frontend

# Frontend logs (separate)
kubectl logs -l app.kubernetes.io/component=frontend
```

### Test Backend Health

```bash
kubectl port-forward svc/ecr-optimizer-backend 8081:8081
curl http://localhost:8081/health
```

### Common Issues

**Pod not starting:**
- Check AWS credentials/IRSA configuration
- Verify image pull secrets if using private registry
- Check resource limits

**API calls failing:**
- Verify REACT_APP_API_URL is set correctly
- Check service endpoints: `kubectl get svc`
- Verify network policies allow traffic

**Permission errors:**
- Verify IAM role has ECR permissions
- Check service account annotations (for IRSA)
- Verify AWS region is correct

## Upgrading

```bash
helm upgrade ecr-optimizer ./helm/ecr-optimizer \
  --set image.backend.tag=v1.1.0 \
  --set image.frontend.tag=v1.1.0
```

## Uninstalling

```bash
helm uninstall ecr-optimizer
```

## Production Recommendations

1. **Use IRSA** for AWS credentials (more secure than secrets)
2. **Enable autoscaling** for high availability
3. **Set resource limits** based on your workload
4. **Use ingress** with TLS for external access
5. **Monitor** pod metrics and logs
6. **Backup** important data before bulk deletions

