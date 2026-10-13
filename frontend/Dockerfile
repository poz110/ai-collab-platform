FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --filter @acp/frontend --frozen-lockfile

FROM deps AS build
ARG API_ORIGIN=http://localhost:3001
ENV API_ORIGIN=$API_ORIGIN
COPY frontend/ frontend/
RUN pnpm -C frontend build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone 输出（next.config.ts output: "standalone"）
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
