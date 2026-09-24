# Medical Causation AI — NestJS API (production)
# Build context is the repository root (npm workspaces).
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS builder
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run prisma:generate --workspace=api && npm run build --workspace=api

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
RUN chown -R nestjs:nestjs /app
USER nestjs
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
