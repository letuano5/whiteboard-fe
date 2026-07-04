# syntax=docker/dockerfile:1
#
# Build context must be the repo root (monorepo): docker build -f backend/Dockerfile .
#
# Backend runs via `tsx` instead of a `tsc` build: @vdt/shared resolves to raw
# TypeScript source (no dist step), which plain `node` cannot load at runtime.
# `tsx` provides the same module resolution used in local dev (`pnpm dev`).

FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter "whiteboard-be..."

FROM deps AS runtime
ENV NODE_ENV=production
COPY packages/shared packages/shared
COPY backend backend
WORKDIR /app/backend
RUN pnpm exec prisma generate

EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx src/index.ts"]
