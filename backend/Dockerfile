
# ==============================================================================
# LUNAR WINDOW — Backend Production Dockerfile
# Multi-stage lightweight Python container with NAIF CSPICE kernel support
# ==============================================================================

# Stage 1: Build Python dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies for C-extensions (CSPICE/SpiceyPy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# Stage 2: Production runtime
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python dependencies
COPY --from=builder /install /usr/local

# Copy backend application, scripts, and data
COPY . /app

# Download and verify the required official NAIF SPICE kernels
# This runs during image build, not application startup.
RUN python scripts/download_kernels.py

# Create non-root application user
RUN adduser --disabled-password --gecos "" lunaruser \
    && chown -R lunaruser:lunaruser /app

USER lunaruser

# Application configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LUNAR_DEBUG=false \
    LUNAR_SPICE_KERNEL_DIR=/app/data/kernels \
    PORT=8000

# Application port
EXPOSE 8000

# Container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

# Start FastAPI application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
