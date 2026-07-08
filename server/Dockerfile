FROM node:20-alpine

# Security: run as non-root user
RUN addgroup -g 1001 -S orbin && adduser -S orbin -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

# Switch to non-root user
USER orbin

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/api/health || exit 1

CMD ["node", "src/index.js"]