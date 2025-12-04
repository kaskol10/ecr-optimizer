# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

Please report (suspected) security vulnerabilities to **[security@yourdomain.com]** or by opening a GitHub Security Advisory. 

You will receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible depending on complexity but historically within a few days.

## Security Best Practices

When using ECR Optimizer:

1. **AWS Credentials**: Never commit AWS credentials to the repository. Use IAM roles, environment variables, or Kubernetes secrets.

2. **Network Security**: Deploy behind a firewall or use Kubernetes network policies to restrict access.

3. **Image Pull Secrets**: If using private container registries, ensure proper authentication is configured.

4. **RBAC**: Use Kubernetes RBAC to restrict who can access the ECR Optimizer deployment.

5. **Regular Updates**: Keep the application and dependencies up to date to receive security patches.

6. **Audit Logs**: Enable AWS CloudTrail to audit ECR operations performed by the tool.

## Known Security Considerations

- ECR Optimizer requires AWS credentials with ECR read/write permissions
- The tool performs destructive operations (image deletion)
- Always review images before bulk deletion
- Consider using read-only credentials for initial exploration

## Disclosure Policy

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide an initial assessment within 7 days
- We will keep you informed of our progress every 7 days
- We will notify you when the vulnerability is fixed
- We will credit you in the release notes (unless you prefer to remain anonymous)

