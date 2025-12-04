# Build stage
FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Using npm install with --legacy-peer-deps for compatibility
# Note: For production, consider using npm ci once lock file is fully synced
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Production stage
FROM nginx:1.29-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy nginx config template (nginx will auto-process templates in /etc/nginx/templates/)
# Templates ending in .template are automatically processed by nginx's entrypoint
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built app from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Create entrypoint script to inject runtime environment variables
RUN echo '#!/bin/sh' > /docker-entrypoint-env.sh && \
    echo 'set -e' >> /docker-entrypoint-env.sh && \
    echo '' >> /docker-entrypoint-env.sh && \
    echo '# Inject REACT_APP_API_URL into index.html' >> /docker-entrypoint-env.sh && \
    echo 'if [ -n "$REACT_APP_API_URL" ]; then' >> /docker-entrypoint-env.sh && \
    echo '  sed -i "s|</head>|<script>window.__ENV__ = window.__ENV__ || {}; window.__ENV__.REACT_APP_API_URL = \"$REACT_APP_API_URL\";</script></head>|g" /usr/share/nginx/html/index.html' >> /docker-entrypoint-env.sh && \
    echo 'fi' >> /docker-entrypoint-env.sh && \
    echo '' >> /docker-entrypoint-env.sh && \
    echo '# Execute nginx entrypoint' >> /docker-entrypoint-env.sh && \
    echo 'exec /docker-entrypoint.sh "$@"' >> /docker-entrypoint-env.sh && \
    chmod +x /docker-entrypoint-env.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Set default backend URLs (can be overridden via environment variables in Kubernetes)
ENV BACKEND_API_URL=http://localhost:8081
ENV REACT_APP_API_URL=""

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint-env.sh"]
CMD ["nginx", "-g", "daemon off;"]

