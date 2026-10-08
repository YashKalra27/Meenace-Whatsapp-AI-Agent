FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and client manifests
COPY package*.json ./
COPY tsconfig.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source files
COPY src/ ./src/
COPY client/ ./client/

# Build client production bundle
RUN cd client && npm run build

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/src ./src
COPY tsconfig.json ./
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "src/server.ts"]
