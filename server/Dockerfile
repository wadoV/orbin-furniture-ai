# ================================================================
# Orbin AI — Production Backend Dockerfile
# Multi-stage build for minimum image size and maximum security.
# ================================================================

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies for potential builds)
RUN npm ci

# Copy server code
COPY . .

# Prune dev dependencies for production image
RUN npm prune --omit=dev

# Stage 2: Runtime image
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production

# Copy built dependencies and source code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

# Expose port (Railway will map $PORT to this)
EXPOSE 3003

# Optimize Node memory footprint and execute
CMD ["node", "src/index.js"]
