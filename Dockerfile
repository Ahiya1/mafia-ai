# Simplified Dockerfile for AI Mafia - FIXED
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build backend server
RUN npm run build:server

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# FIX: Copy the scripts directory for migrations
COPY --from=builder /app/scripts ./scripts
# Also copy server source for migration dependencies
COPY --from=builder /app/server ./server

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

USER nextjs

EXPOSE 3001

# Start the server
CMD ["node", "dist/server/index.js"]