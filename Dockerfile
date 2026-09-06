# Dockerfile multi-stage para servir Next.js (frontend) e AdonisJS (backend) juntos

# Stage 1: Build do frontend Next.js
FROM node:20 AS frontend-build
WORKDIR /app/frontend-next
COPY frontend-next/package*.json ./
RUN npm install
COPY frontend-next/ ./
RUN npm run build

# Stage 2: Build do backend AdonisJS
FROM node:20 AS backend-build
WORKDIR /app
COPY package*.json ./
COPY src/package*.json ./src/
RUN npm install
COPY . .
RUN cd src && npm install && npm run build:ts

# Stage 3: Imagem final para produção
FROM node:20-slim
WORKDIR /app

# Copia backend
COPY --from=backend-build /app /app

# Copia build do frontend para dentro do backend
COPY --from=frontend-build /app/frontend-next/.next /app/frontend-next/.next
COPY --from=frontend-build /app/frontend-next/public /app/frontend-next/public

ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

CMD ["node", "src/bin/server.js"]
