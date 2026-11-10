FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

COPY package*.json ./
RUN npm install --omit=dev && npm install -g tsx

COPY tsconfig.json ./
COPY src/ ./src/
RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 7860

CMD ["tsx", "src/server.ts"]
