FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "--import", "@opentelemetry/instrumentation/hook.mjs", "--import", "./src/observability/instrumentation.ts", "src/server.ts"]