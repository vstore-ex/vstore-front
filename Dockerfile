# -----------------------------------------------------------------------------
# Stage 1: Build the React / Vite SPA static bundle
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install packages using BuildKit cache mount
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit

# Copy application source files
COPY . .

# Build-time environment variable injection for Vite (bakes into static JS assets)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compile and bundle static production assets to /app/dist
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve production assets via unprivileged (non-root) Nginx
# -----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Patch alpine base packages at build time: the base tag carries a frozen
# apk snapshot (alpine 3.21.3) with fixable HIGH/CRITICAL CVEs; without this
# the Trivy CI gate (exit-code 1) blocks every release.
USER root
RUN apk --no-cache upgrade \
    && apk del --purge nginx-module-image-filter tiff \
    && rm -rf /var/cache/apk/*
USER 101

# Copy custom Nginx configuration and compiled static assets
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Default non-root HTTP listening port for nginx-unprivileged
EXPOSE 8080

# Container liveness check for Docker daemon and container orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

# Run Nginx in the foreground to keep the container running
CMD ["nginx", "-g", "daemon off;"]
