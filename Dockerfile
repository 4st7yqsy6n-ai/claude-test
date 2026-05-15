# ── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ .

# Empty VITE_API_URL = relative URLs, so frontend talks to same host/port as API
RUN VITE_API_URL="" npm run build


# ── Stage 2: Python backend + bundled frontend ────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Python deps — install core packages directly to avoid build failures on feedparser/sgmllib3k
COPY backend/requirements.txt .
RUN pip install --no-cache-dir \
      fastapi[standard] \
      "uvicorn[standard]" \
      pydantic \
      yfinance \
      pandas \
      numpy \
      requests \
      httpx \
      python-dotenv \
      anthropic \
      aiohttp \
      cachetools \
      pytz \
      aiofiles \
    || true

# Copy backend source
COPY backend/ .

# Copy built frontend into static/
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
