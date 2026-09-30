# MGR CAPITAL ASSISTANCE — Backend production image
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache wget tini \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 backend \
    && mkdir -p /app/uploads /app/backups /app/logs \
    && chown -R backend:nodejs /app

COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=backend:nodejs /app/prisma ./prisma
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

USER backend
ENV NODE_ENV=production
ENV PORT=4000
ENV WS_PORT=4001
EXPOSE 4000 4001

ENTRYPOINT ["/sbin/tini", "--"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1
CMD ["node", "dist/server.js"]
