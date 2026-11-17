FROM node:24-alpine

WORKDIR /app

# La imagen oficial ya trae usuario `node` (uid/gid 1000) — requerido por Autopilot runAsNonRoot
COPY package*.json ./

RUN npm ci && chown -R node:node /app

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["npx", "tsx", "--import", "@opentelemetry/instrumentation/hook.mjs", "--import", "./src/observability/instrumentation.ts", "src/server.ts"]
