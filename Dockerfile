# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# Owner-only, one-shot database tooling; never used as the web runtime.
FROM dependencies AS tooling
COPY scripts ./scripts
COPY lib/db/migration-client.mjs ./lib/db/migration-client.mjs
COPY database ./database
USER node
CMD ["node", "scripts/docker-setup.mjs"]

FROM dependencies AS builder
COPY . .
ENV MIMS_STANDALONE=1
# Build-time module evaluation creates a pool but does not connect. No secrets
# or live database are needed to compile the application.
RUN mkdir -p public && DATABASE_URL=postgresql://mims_app@127.0.0.1/mims_build npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node scripts/check-neon-app-env.mjs ./scripts/check-neon-app-env.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
