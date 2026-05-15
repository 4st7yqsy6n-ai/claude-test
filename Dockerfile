# Single-stage — Python only. Frontend is pre-built and included in the repo.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    "fastapi[standard]" \
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
    aiofiles

COPY backend/ .

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
