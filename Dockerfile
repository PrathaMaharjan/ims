# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js imports route modules during build. These values only satisfy module
# initialization; real credentials are supplied to the running container.
RUN DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?sslmode=require' \
    REDIS_URL='redis://127.0.0.1:6379' \
    ACCESS_TOKEN_SECRET='build-only-placeholder' \
    REFRESH_TOKEN_SECRET='build-only-placeholder' \
    CLOUDINARY_CLOUD_NAME='build-placeholder' \
    CLOUDINARY_API_KEY='build-placeholder' \
    CLOUDINARY_API_SECRET='build-placeholder' \
    pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
