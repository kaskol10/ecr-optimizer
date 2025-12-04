.PHONY: help install-backend install-frontend run-backend run-frontend build-backend build-frontend build-all docker-backend docker-frontend docker-all helm-install helm-uninstall helm-upgrade

help:
	@echo "Available targets:"
	@echo "  install-backend   - Install Go dependencies"
	@echo "  install-frontend  - Install Node.js dependencies"
	@echo "  run-backend       - Start backend server (port 8081)"
	@echo "  run-frontend      - Start frontend dev server (port 3000)"
	@echo "  build-backend     - Build Go backend binary"
	@echo "  build-frontend    - Build React frontend"
	@echo "  build-all         - Build both backend and frontend"
	@echo "  docker-backend    - Build backend Docker image"
	@echo "  docker-frontend   - Build frontend Docker image"
	@echo "  docker-all        - Build both Docker images"
	@echo "  helm-install      - Install Helm chart"
	@echo "  helm-uninstall    - Uninstall Helm chart"
	@echo "  helm-upgrade      - Upgrade Helm chart"

# Install targets
install-backend:
	cd backend && go mod download

install-frontend:
	cd frontend && npm install

# Run targets
run-backend:
	cd backend && go run main.go

run-frontend:
	cd frontend && npm start

# Build targets
build-backend:
	cd backend && go build -o ecr-optimizer main.go

build-frontend:
	cd frontend && npm ci && npm run build

build-all: build-backend build-frontend

# Docker targets
docker-backend:
	docker build -t ecr-optimizer-backend:latest -f backend/Dockerfile backend/

docker-frontend:
	docker build -t ecr-optimizer-frontend:latest -f frontend/Dockerfile frontend/

docker-all: docker-backend docker-frontend

# Helm targets
helm-install:
	helm install ecr-optimizer ./helm/ecr-optimizer

helm-uninstall:
	helm uninstall ecr-optimizer

helm-upgrade:
	helm upgrade ecr-optimizer ./helm/ecr-optimizer
