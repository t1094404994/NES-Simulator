FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.27.0 --activate
WORKDIR /app

FROM base AS server-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter nes-server...

FROM server-deps AS server-src
COPY apps/server apps/server
COPY packages/db packages/db
COPY packages/shared packages/shared
RUN pnpm --filter @nes/db exec prisma generate

FROM node:24-bookworm-slim AS server
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=server-src /app /app
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data
EXPOSE 8787
CMD ["apps/server/node_modules/.bin/tsx", "apps/server/src/index.ts"]

FROM base AS web-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY core/nes/package.json core/nes/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter nes-web...

FROM web-deps AS web-build
COPY apps/web apps/web
COPY core/nes core/nes
COPY packages/shared packages/shared
ARG NEXT_PUBLIC_API_BASE=https://www.nes-simulator.com
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN pnpm --filter nes-web build

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM base AS admin-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter nes-admin...

FROM admin-deps AS admin-build
COPY apps/admin apps/admin
COPY packages/shared packages/shared
RUN pnpm --filter nes-admin build

FROM nginx:1.27-alpine AS admin
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 80
