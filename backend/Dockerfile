# EdgeAI Blockchain - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM rustlang/rust:nightly-bookworm-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    clang \
    libclang-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo.toml first (Cargo.lock will be generated)
COPY Cargo.toml ./

# Copy source code
COPY src ./src

# Build release binary (this will generate Cargo.lock)
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd -r edgeai && useradd -r -g edgeai -m -u 1000 edgeai

# Create app and data directories
WORKDIR /app
RUN mkdir -p /data

# Copy binary from builder
COPY --from=builder /app/target/release/edgeai-node /app/edgeai-node

# Copy static files if they exist
COPY static ./static

# Set ownership for app and data directories
RUN chown -R edgeai:edgeai /app /data

# Switch to non-root user
USER edgeai

# Expose ports
# 8080 - HTTP API
# 9000 - P2P Network
EXPOSE 8080 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/chain || exit 1

# Environment variables for configuration
# EDGEAI_BOOTSTRAP_NODES - Comma-separated list of bootstrap node addresses
# EDGEAI_P2P_PORT - P2P listening port (default: 9000)
# EDGEAI_HTTP_PORT - HTTP API port (default: 8080)
ENV EDGEAI_BOOTSTRAP_NODES=""
ENV EDGEAI_P2P_PORT=9000
ENV EDGEAI_HTTP_PORT=8080

# Data volume
VOLUME /data

# Run the application
CMD ["./edgeai-node"]
