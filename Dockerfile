FROM node:20-slim

# Build tools in case better-sqlite3 needs to compile (no prebuilt binary).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Full install: dev dependencies are required to run tsc (backend) and Vite (frontend).
RUN cd backend && npm ci && cd ../frontend && npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

RUN npm run build

EXPOSE 10000

CMD ["npm", "start"]