# Build stage
FROM node:18-alpine AS builder

# Install build essentials and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    # Security scanning tools
    trivy \
    snyk

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies including development tools
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src ./src

# Run TypeScript compilation
RUN npm run build

# Run tests
RUN npm run test

# Run security scanning
RUN trivy filesystem --exit-code 1 --severity HIGH,CRITICAL .
RUN snyk test --severity-threshold=high

# Production stage
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Set secure file permissions
RUN chown -R nodejs:nodejs /app && \
    chmod -R 644 /app && \
    find /app -type d -exec chmod 755 {} \;

# Switch to non-root user
USER nodejs

# Configure environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Edge function specific configurations
ENV EDGE_FUNCTION_TIMEOUT=10000
ENV EDGE_FUNCTION_MEMORY=128

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose service port
EXPOSE ${PORT}

# Configure edge function runtime
CMD ["node", "--max-old-space-size=128", "--enable-source-maps", "dist/index.js"]

# Security headers and configurations
ENV NODE_OPTIONS="--security-revert=CVE-2023-23918 --disable-proto=throw"

# Edge function optimization flags
ENV NODE_NO_WARNINGS=1
ENV NODE_OPTIONS="${NODE_OPTIONS} --experimental-fetch --no-warnings"

# Configure error handling and logging
ENV NODE_OPTIONS="${NODE_OPTIONS} --unhandled-rejections=strict"

# Set up production-grade logging
ENV NODE_OPTIONS="${NODE_OPTIONS} --trace-warnings --trace-uncaught"

# Enable source maps for better error tracking
ENV NODE_OPTIONS="${NODE_OPTIONS} --enable-source-maps"

# Configure memory limits for edge functions
ENV NODE_OPTIONS="${NODE_OPTIONS} --max-old-space-size=128"

# Set up cold start optimization
ENV NODE_OPTIONS="${NODE_OPTIONS} --experimental-vm-modules"

# Configure graceful shutdown
ENV NODE_OPTIONS="${NODE_OPTIONS} --exit-on-uncaught-exception"