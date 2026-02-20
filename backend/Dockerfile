# ─────────────────────────────────────────
# Backend — Production Dockerfile
# ─────────────────────────────────────────
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# ── Dependencies stage ──────────────────
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Runtime stage ────────────────────────
FROM base AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodeuser -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

USER nodeuser

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "-r", "dotenv/config", "index.js"]
