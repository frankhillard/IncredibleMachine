FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.mjs index.html styles.css ./
COPY src ./src
COPY scripts ./scripts
COPY extra_levels ./extra_levels

ENV HOST=0.0.0.0
ENV PORT=8080

RUN chown -R node:node /app
USER node

EXPOSE 8080

CMD ["node", "server.mjs"]
