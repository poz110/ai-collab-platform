FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/
RUN pnpm install --filter @acp/backend --frozen-lockfile

FROM deps AS build
COPY backend/ backend/
RUN pnpm -C backend build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/drizzle /app/backend/drizzle
COPY --from=build /app/backend/package.json /app/backend/package.json
WORKDIR /app/backend
EXPOSE 3001
# 启动前先跑迁移（migrate.ts 编译产物），再启动 API
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
