# Contributing to ECR Optimizer

Thank you for your interest in contributing to ECR Optimizer! This document provides guidelines for contributing.

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Development Setup

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

## Code Style

- **Go**: Follow standard Go formatting (`go fmt`)
- **JavaScript/React**: Follow ESLint rules (run `npm run lint` in frontend directory)
- **Commits**: Use clear, descriptive commit messages

## Testing

Before submitting a PR:
- Test your changes locally
- Ensure the backend compiles (`go build`)
- Ensure the frontend builds (`npm run build`)
- Test with actual AWS ECR repositories if possible

## Reporting Issues

When reporting issues, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Go version, Node version)
- Relevant error messages or logs

## Feature Requests

Feature requests are welcome! Please open an issue describing:
- The feature you'd like to see
- Use case or problem it solves
- Any implementation ideas (optional)

## Questions?

Feel free to open an issue for questions or discussions.

