FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

RUN node scripts/prepare-standalone.mjs || true

RUN mkdir -p .next/standalone/.next/static
RUN cp -r .next/static .next/standalone/.next/static || true
RUN cp -r public .next/standalone/public || true

RUN mkdir -p .next/standalone/bundled-data
RUN cp -r data/* .next/standalone/bundled-data/ || true


FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENV MAP_OF_US_STORAGE_MODE=local

ENV MAP_OF_US_DATA_DIR=/app/data

ENV MAP_OF_US_BUNDLED_DATA_DIR=/app/bundled-data

RUN addgroup -g 1001 -S nextjs && adduser -S nextjs -u 1001 -G nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./

RUN mkdir -p /app/data && chown -R nextjs:nextjs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]