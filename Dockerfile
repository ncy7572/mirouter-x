FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3102 \
    MIROUTER_DB=/app/data/mirouter.sqlite

COPY package.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

VOLUME ["/app/data"]
EXPOSE 3102

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3102) + '/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
