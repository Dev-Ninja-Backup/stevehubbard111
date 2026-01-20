# =======================
# 1️⃣ Builder Stage
# =======================
FROM node:22 AS builder

WORKDIR /usr/src/app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and install all dependencies (including devDeps)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY prisma ./prisma
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN pnpm build

# =======================
# 2️⃣ Dev Stage
# =======================
FROM node:22 AS dev

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy everything from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./package.json

ENV NODE_ENV=development
EXPOSE 6969

# Use tsx directly for seed or pnpm scripts
CMD ["pnpm", "run", "start:dev"]
