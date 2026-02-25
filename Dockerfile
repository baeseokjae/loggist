# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build client (Vite) + server (tsup) ──
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build:client && pnpm run build:server

# ── Stage 3: Production runner ──
FROM node:22-alpine AS runner
RUN apk add --no-cache libstdc++
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 loggist && \
    adduser --system --uid 1001 loggist

COPY --from=builder --chown=loggist:loggist /app/dist ./dist
COPY --from=builder --chown=loggist:loggist /app/node_modules ./node_modules
COPY --from=builder --chown=loggist:loggist /app/package.json ./

RUN mkdir -p /app/data && chown loggist:loggist /app/data

USER loggist
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "dist/server/index.js"]
