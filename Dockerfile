FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/extension/package.json apps/extension/package.json
RUN npm ci --workspace=apps/server --include-workspace-root

COPY apps/server apps/server
RUN npm run build --workspace=apps/server

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/extension/package.json apps/extension/package.json
RUN npm ci --omit=dev --workspace=apps/server --include-workspace-root \
    && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist

USER node
EXPOSE 8080

CMD ["node", "apps/server/dist/main.js"]
