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
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy source code
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 edgeai

# Create app directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/edgeai-node /app/edgeai-node

# Copy static files
COPY static ./static

# Set ownership
RUN chown -R edgeai:edgeai /app

# Switch to non-root user
USER edgeai

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/chain || exit 1

# Run the application
CMD ["./edgeai-node"]
