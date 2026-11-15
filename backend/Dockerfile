# ==============================================================================
# LUNAR WINDOW — Backend Production Dockerfile
# Multi-stage lightweight Python container with NAIF CSPICE kernel support
# ==============================================================================

FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies for C-extensions (CSPICE/SpiceyPy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final Runtime Image
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime libgomp if needed by CSPICE
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# Copy application code and kernels
COPY . /app

# Ensure non-root execution for security
RUN adduser --disabled-password --gecos "" lunaruser \
    && chown -R lunaruser:lunaruser /app
USER lunaruser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LUNAR_DEBUG=false \
    LUNAR_SPICE_KERNEL_DIR=/app/data/kernels \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
