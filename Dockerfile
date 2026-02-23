# Stage 1: Get Bun binary
FROM oven/bun:latest AS bun-source

# Stage 2: Final image using Debian Trixie
FROM debian:trixie-slim

# Copy Bun binary from Stage 1
COPY --from=bun-source /usr/local/bin/bun /usr/local/bin/bun

# Install basic certificates and minimal dependencies for Bun/Network
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Start the application
CMD ["bun", "run", "src/index.ts"]
