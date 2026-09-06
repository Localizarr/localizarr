# Multi-stage: frontend-svelte + backend AdonisJS
FROM node:20 AS frontend-build
WORKDIR /app/frontend-svelte
COPY frontend-svelte/package*.json ./
RUN npm ci
COPY frontend-svelte/ ./
RUN npm run build

FROM node:20 AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend
COPY backend/ ./backend/
RUN npm run build --prefix backend

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /app/backend /app/backend
COPY --from=frontend-build /app/public/svelte /app/public/svelte
WORKDIR /app/backend
RUN npm ci --omit=dev
ENV NODE_ENV=production
ENV PORT=5005
ENV PROXY_PORT=5006
EXPOSE 5005 5006
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s CMD curl -f http://localhost:5005/ || exit 1
CMD ["node", "build/bin/server.js"]
