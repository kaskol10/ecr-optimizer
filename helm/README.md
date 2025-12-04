# ECR Optimizer Helm Chart

Helm chart for deploying ECR Optimizer on Kubernetes.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- AWS credentials configured (via IAM Role for Service Account or secrets)

## Installation

### Quick Start

```bash
# Install with default values
helm install ecr-optimizer ./helm/ecr-optimizer

# Install with custom values
helm install ecr-optimizer ./helm/ecr-optimizer -f my-values.yaml

# Install in specific namespace
helm install ecr-optimizer ./helm/ecr-optimizer -n ecr-optimizer --create-namespace
```

### Using IAM Role for Service Account (IRSA) - Recommended for EKS

IRSA allows pods to assume an IAM role without storing credentials. The Helm chart automatically configures the ServiceAccount.

1. **Create IAM Role** with ECR permissions and trust policy for your EKS cluster's OIDC provider
2. **Install with IRSA**:

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.useIRSA=true \
  --set aws.roleArn=arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role \
  --set aws.region=us-east-1
```

**Or using values.yaml:**

```yaml
aws:
  useIRSA: true
  roleArn: arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role
  region: us-east-1
```

The chart will automatically:
- Create a ServiceAccount with the `eks.amazonaws.com/role-arn` annotation
- Configure the pod with `AWS_ROLE_ARN` and `AWS_WEB_IDENTITY_TOKEN_FILE` environment variables
- Mount the service account token for AWS SDK to use

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for detailed IRSA setup instructions.

### Using AWS Credentials Secret

```bash
# Create secret with AWS credentials
kubectl create secret generic aws-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=your-access-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-secret-key

# Install with credentials secret
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.credentialsSecret=aws-credentials \
  --set aws.region=us-east-1
```

## Configuration

### Deployment Patterns

The chart supports two deployment patterns:

1. **Sidecar** (default): Backend and frontend run in the same pod
   ```yaml
   deploymentPattern: "sidecar"
   ```

2. **Separate**: Backend and frontend run in separate deployments
   ```yaml
   deploymentPattern: "separate"
   ```

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `deploymentPattern` | Deployment pattern: "sidecar" or "separate" | `"sidecar"` |
| `aws.region` | AWS region | `"us-east-1"` |
| `aws.useIRSA` | Use IAM Role for Service Account | `false` |
| `aws.roleArn` | IAM role ARN for IRSA (required when useIRSA=true) | `""` |
| `aws.credentialsSecret` | Secret name containing AWS credentials | `""` |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `ingress.enabled` | Enable ingress | `false` |
| `replicaCount` | Number of replicas | `1` |
| `resources.backend` | Backend resource limits/requests | See values.yaml |
| `resources.frontend` | Frontend resource limits/requests | See values.yaml |

## Building Docker Images

### Backend

```bash
cd backend
docker build -t ecr-optimizer-backend:latest .
```

### Frontend

```bash
cd frontend
docker build -t ecr-optimizer-frontend:latest .
```

## Examples

### Basic Installation

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set aws.region=us-east-1 \
  --set aws.credentialsSecret=aws-credentials
```

### With Ingress

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=ecr-optimizer.example.com \
  --set ingress.className=nginx
```

### With Autoscaling

```bash
helm install ecr-optimizer ./helm/ecr-optimizer \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=10
```

### Production Values

```yaml
replicaCount: 3

aws:
  region: us-east-1
  useIRSA: true
  roleArn: arn:aws:iam::ACCOUNT_ID:role/ecr-optimizer-role

resources:
  backend:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi
  frontend:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: ecr-optimizer.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ecr-optimizer-tls
      hosts:
        - ecr-optimizer.example.com
```

## Uninstallation

```bash
helm uninstall ecr-optimizer
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

# Frontend logs (if sidecar)
kubectl logs -l app.kubernetes.io/component=backend -c frontend
```

### Test Backend

```bash
kubectl port-forward svc/ecr-optimizer-backend 8081:8081
curl http://localhost:8081/health
```

