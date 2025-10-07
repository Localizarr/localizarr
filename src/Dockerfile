# Use Node.js 22 LTS (following AdonisJS v6 official docs)
FROM node:22-slim AS base

# All deps stage (including dev dependencies for building)
FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
ADD package.json package-lock.json ./
RUN npm ci

# Production only deps stage
FROM base AS production-deps
WORKDIR /app
ADD package.json package-lock.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
ADD . .
RUN node ace build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 localizarr

# Copy production dependencies
COPY --from=production-deps /app/node_modules /app/node_modules

# Copy built application
COPY --from=build /app/build /app

# Create necessary directories and set permissions
RUN mkdir -p /app/tmp /app/data && \
  chown -R localizarr:nodejs /app/tmp /app/data

# Switch to non-root user
USER localizarr

EXPOSE 5005 5006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5005 || exit 1

# Start the application (following AdonisJS v6 docs)
CMD ["node", "./bin/server.js"]
