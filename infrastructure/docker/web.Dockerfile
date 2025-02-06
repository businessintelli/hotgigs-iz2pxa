# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY src/web/package.json ./

# Set yarn cache mount for faster builds
VOLUME /usr/local/share/.cache/yarn

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY src/web/ ./

# Validate build arguments
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN test -n "$VITE_API_URL" && \
    test -n "$VITE_SUPABASE_URL" && \
    test -n "$VITE_SUPABASE_ANON_KEY"

# Set build environment
ENV NODE_ENV=production \
    VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build application
RUN yarn type-check && \
    yarn build

# Production stage
FROM nginx:alpine

# Create nginx user/group with restricted privileges
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Configure NGINX
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/cache/nginx && \
    chown -R nginx:nginx /var/cache/nginx && \
    mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# NGINX configuration
RUN echo 'worker_processes auto;' > /etc/nginx/nginx.conf && \
    echo 'events { worker_connections 1024; }' >> /etc/nginx/nginx.conf && \
    echo 'http {' >> /etc/nginx/nginx.conf && \
    echo '    include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
    echo '    default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
    echo '    sendfile on;' >> /etc/nginx/nginx.conf && \
    echo '    keepalive_timeout 65;' >> /etc/nginx/nginx.conf && \
    echo '    client_max_body_size 10M;' >> /etc/nginx/nginx.conf && \
    # Compression settings
    echo '    gzip on;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_comp_level 6;' >> /etc/nginx/nginx.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf && \
    # Brotli compression
    echo '    brotli on;' >> /etc/nginx/nginx.conf && \
    echo '    brotli_comp_level 6;' >> /etc/nginx/nginx.conf && \
    echo '    brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf && \
    # Security headers
    echo '    add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\'';" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header X-Frame-Options "DENY" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;' >> /etc/nginx/nginx.conf && \
    echo '    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;' >> /etc/nginx/nginx.conf && \
    # Server configuration
    echo '    server {' >> /etc/nginx/nginx.conf && \
    echo '        listen 80;' >> /etc/nginx/nginx.conf && \
    echo '        server_name localhost;' >> /etc/nginx/nginx.conf && \
    echo '        root /usr/share/nginx/html;' >> /etc/nginx/nginx.conf && \
    echo '        index index.html;' >> /etc/nginx/nginx.conf && \
    echo '        location / {' >> /etc/nginx/nginx.conf && \
    echo '            try_files $uri $uri/ /index.html;' >> /etc/nginx/nginx.conf && \
    echo '        }' >> /etc/nginx/nginx.conf && \
    echo '        location /health {' >> /etc/nginx/nginx.conf && \
    echo '            access_log off;' >> /etc/nginx/nginx.conf && \
    echo '            return 200 "healthy\n";' >> /etc/nginx/nginx.conf && \
    echo '        }' >> /etc/nginx/nginx.conf && \
    echo '    }' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Remove server version display
RUN sed -i 's/server_tokens on/server_tokens off/' /etc/nginx/nginx.conf

# Configure logging
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# Expose port
EXPOSE 80

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]