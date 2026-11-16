FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ai-octopus-v2/package.json ./
RUN npm install --no-audit --no-fund
COPY ai-octopus-v2/ ./
RUN npx prisma generate --schema server/prisma/schema.prisma && npm run web:build && npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node","server/src/index.js"]
