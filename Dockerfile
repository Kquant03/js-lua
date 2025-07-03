# Multi-stage build for production
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies - use npm install instead of npm ci to handle package.json changes
FROM base AS dependencies
RUN npm install && npm cache clean --force

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S dreammaker -u 1001

# Copy ALL dependencies
COPY --from=dependencies --chown=dreammaker:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=dreammaker:nodejs . .

# Create required directories
RUN mkdir -p /app/uploads /app/logs /app/backups && \
    chown -R dreammaker:nodejs /app/uploads /app/logs /app/backups

# Set user
USER dreammaker

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["npm", "start"]
