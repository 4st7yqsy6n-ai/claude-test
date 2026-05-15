import asyncio
import json
import logging
import random
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ai_router, macro, market, news, screener
from app.services.market_service import MOCK_PRICES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="QuantEcosystem API",
    description="Bloomberg-terminal-style quantitative trading dashboard backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if settings.ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(market.router, prefix="/api")
app.include_router(macro.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(ai_router.router, prefix="/api")
app.include_router(screener.router, prefix="/api")

# ---------------------------------------------------------------------------
# Symbols streamed over WebSocket
# ---------------------------------------------------------------------------
WS_SYMBOLS = [
    "^GSPC", "^DJI", "^IXIC", "^VIX", "^TNX",
    "BTC-USD", "ETH-USD",
    "EURUSD=X", "USDJPY=X",
    "GC=F", "CL=F",
    "AAPL", "MSFT", "NVDA",
]

# Seed the "live" prices from mock data so ticks look realistic
_live_prices: dict[str, float] = {
    sym: MOCK_PRICES.get(sym, {}).get("price", 100.0)
    for sym in WS_SYMBOLS
}


def _simulate_tick(symbol: str) -> dict:
    """
    Generate a realistic price tick by applying a tiny random walk.
    Falls back to the last known live price.
    """
    global _live_prices
    base = _live_prices.get(symbol, 100.0)
    # Volatility scales with price magnitude; ~0.05% per tick
    sigma = max(base * 0.0005, 0.01)
    new_price = base + random.gauss(0, sigma)
    new_price = max(new_price, base * 0.90)   # clamp extreme moves
    new_price = min(new_price, base * 1.10)
    _live_prices[symbol] = new_price
    mock_base = MOCK_PRICES.get(symbol, {})
    original_price = mock_base.get("price", new_price)
    change = new_price - original_price
    change_pct = (change / original_price * 100) if original_price else 0.0
    return {
        "symbol": symbol,
        "price": round(new_price, 6),
        "change": round(change, 6),
        "change_pct": round(change_pct, 4),
    }


async def _try_fetch_live_prices() -> list[dict]:
    """
    Attempt to fetch real prices from yfinance; on failure return simulated ticks.
    This runs in an executor so it doesn't block the event loop.
    """
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()

        def _fetch():
            tickers = yf.Tickers(" ".join(WS_SYMBOLS))
            results = []
            for sym in WS_SYMBOLS:
                try:
                    info = tickers.tickers[sym].fast_info
                    price = float(getattr(info, "last_price", 0) or 0)
                    prev = float(getattr(info, "previous_close", 0) or 0)
                    if price == 0:
                        raise ValueError("zero price")
                    change = price - prev
                    change_pct = (change / prev * 100) if prev else 0.0
                    results.append({
                        "symbol": sym,
                        "price": round(price, 6),
                        "change": round(change, 6),
                        "change_pct": round(change_pct, 4),
                    })
                except Exception:
                    results.append(_simulate_tick(sym))
            return results

        return await loop.run_in_executor(None, _fetch)
    except Exception as exc:
        logger.debug("Live price fetch failed, using simulated ticks: %s", exc)
        return [_simulate_tick(sym) for sym in WS_SYMBOLS]


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected. Total connections: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket disconnected. Total connections: %d", len(self.active_connections))

    async def send_json(self, websocket: WebSocket, data: dict):
        try:
            await websocket.send_text(json.dumps(data))
        except Exception:
            self.disconnect(websocket)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time price streaming endpoint.
    Sends a JSON payload every 5 seconds containing current prices for
    major indices, crypto, FX, and commodities.
    """
    await manager.connect(websocket)
    try:
        # Send initial snapshot immediately
        prices = await _try_fetch_live_prices()
        await manager.send_json(websocket, {
            "type": "snapshot",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": prices,
        })

        while True:
            # Wait 5 seconds between updates, but also listen for client messages
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                # If client sends a message, we can handle it here (e.g. subscribe to symbol)
                # For now just acknowledge
                await manager.send_json(websocket, {
                    "type": "ack",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            except asyncio.TimeoutError:
                # 5 seconds elapsed – send price update
                prices = await _try_fetch_live_prices()
                await manager.send_json(websocket, {
                    "type": "price_update",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": prices,
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """Service health check."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "services": {
            "anthropic": "configured" if settings.has_anthropic_key else "mock mode",
            "fred": "configured" if settings.has_fred_key else "mock mode",
        },
    }


@app.get("/")
def root():
    """Root endpoint."""
    return {"status": "QuantEcosystem API running"}
