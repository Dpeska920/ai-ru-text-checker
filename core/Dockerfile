FROM oven/bun:1.2-slim AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "run", "--watch", "src/index.ts"]

FROM dependencies AS builder
COPY . .

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 app \
    && adduser --system --uid 1001 --ingroup app app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/src ./src
COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/tsconfig.json ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
