"""
World index data service.

Data priority:
  1. Koyfin API  — set KOYFIN_API_KEY in .env to enable
  2. yfinance    — free, always available as fallback
  3. Mock data   — last resort

Koyfin API docs: https://koyfin.com/docs/api (requires account + API key)
"""
import logging
from datetime import datetime, timezone

from cachetools import TTLCache

from app.config import settings

logger = logging.getLogger(__name__)

KOYFIN_BASE_URL = "https://api.koyfin.com"

_world_cache: TTLCache = TTLCache(maxsize=5, ttl=60)

WORLD_INDEX_MAP = [
    # Americas
    {"symbol": "SPX",    "yf": "^GSPC",    "name": "S&P 500",        "country": "United States",  "flag": "🇺🇸", "region": "americas"},
    {"symbol": "NDX",    "yf": "^NDX",     "name": "Nasdaq 100",     "country": "United States",  "flag": "🇺🇸", "region": "americas"},
    {"symbol": "TSX",    "yf": "^GSPTSE",  "name": "TSX Composite",  "country": "Canada",         "flag": "🇨🇦", "region": "americas"},
    {"symbol": "IBOV",   "yf": "^BVSP",    "name": "Bovespa",        "country": "Brazil",         "flag": "🇧🇷", "region": "americas"},
    {"symbol": "MXX",    "yf": "^MXX",     "name": "IPC Mexico",     "country": "Mexico",         "flag": "🇲🇽", "region": "americas"},
    # Europe
    {"symbol": "DAX",    "yf": "^GDAXI",   "name": "DAX 40",         "country": "Germany",        "flag": "🇩🇪", "region": "europe"},
    {"symbol": "FTSE",   "yf": "^FTSE",    "name": "FTSE 100",       "country": "United Kingdom", "flag": "🇬🇧", "region": "europe"},
    {"symbol": "CAC",    "yf": "^FCHI",    "name": "CAC 40",         "country": "France",         "flag": "🇫🇷", "region": "europe"},
    {"symbol": "IBEX",   "yf": "^IBEX",    "name": "IBEX 35",        "country": "Spain",          "flag": "🇪🇸", "region": "europe"},
    {"symbol": "SMI",    "yf": "^SSMI",    "name": "SMI Index",      "country": "Switzerland",    "flag": "🇨🇭", "region": "europe"},
    # Asia-Pacific
    {"symbol": "N225",   "yf": "^N225",    "name": "Nikkei 225",     "country": "Japan",          "flag": "🇯🇵", "region": "asia-pacific"},
    {"symbol": "HSI",    "yf": "^HSI",     "name": "Hang Seng",      "country": "Hong Kong",      "flag": "🇭🇰", "region": "asia-pacific"},
    {"symbol": "SHCOMP", "yf": "000001.SS","name": "Shanghai Comp.", "country": "China",          "flag": "🇨🇳", "region": "asia-pacific"},
    {"symbol": "ASX",    "yf": "^AXJO",    "name": "ASX 200",        "country": "Australia",      "flag": "🇦🇺", "region": "asia-pacific"},
    {"symbol": "KOSPI",  "yf": "^KS11",    "name": "KOSPI",          "country": "South Korea",    "flag": "🇰🇷", "region": "asia-pacific"},
]

_MOCK: dict[str, dict] = {
    "^GSPC":    {"price": 5847.23,   "change": 24.56,    "change_pct": 0.42},
    "^NDX":     {"price": 20412.18,  "change": 142.33,   "change_pct": 0.70},
    "^GSPTSE":  {"price": 22847.40,  "change": 88.12,    "change_pct": 0.39},
    "^BVSP":    {"price": 131244.80, "change": -842.30,  "change_pct": -0.64},
    "^MXX":     {"price": 52438.20,  "change": 124.80,   "change_pct": 0.24},
    "^GDAXI":   {"price": 19248.50,  "change": 184.20,   "change_pct": 0.97},
    "^FTSE":    {"price": 8284.40,   "change": -42.30,   "change_pct": -0.51},
    "^FCHI":    {"price": 7602.80,   "change": 38.40,    "change_pct": 0.51},
    "^IBEX":    {"price": 11482.60,  "change": 94.10,    "change_pct": 0.83},
    "^SSMI":    {"price": 11924.80,  "change": -28.40,   "change_pct": -0.24},
    "^N225":    {"price": 38620.40,  "change": 482.80,   "change_pct": 1.27},
    "^HSI":     {"price": 19281.50,  "change": -148.20,  "change_pct": -0.76},
    "000001.SS":{"price": 3302.48,   "change": 24.82,    "change_pct": 0.76},
    "^AXJO":    {"price": 8284.40,   "change": 48.20,    "change_pct": 0.58},
    "^KS11":    {"price": 2574.82,   "change": -18.42,   "change_pct": -0.71},
}


def _fetch_from_koyfin() -> dict[str, dict] | None:
    """Fetch global index quotes from Koyfin API. Returns None when unavailable."""
    if not settings.has_koyfin_key:
        return None
    try:
        import requests
        yf_symbols = [idx["yf"] for idx in WORLD_INDEX_MAP]
        resp = requests.get(
            f"{KOYFIN_BASE_URL}/api/v2/quotes",
            params={"codes": ",".join(yf_symbols)},
            headers={"Authorization": f"Bearer {settings.KOYFIN_API_KEY}"},
            timeout=10,
        )
        resp.raise_for_status()
        return _normalize_koyfin(resp.json())
    except Exception as exc:
        logger.warning("Koyfin API unavailable: %s – falling back to yfinance", exc)
        return None


def _normalize_koyfin(data: dict) -> dict[str, dict]:
    """
    Normalize Koyfin response to {yf_symbol: {price, change, change_pct}}.

    Koyfin response shape (adjust if their schema differs):
      {"quotes": [{"code": "^GSPC", "price": 5847.23, "change": 24.56, "changePercent": 0.42}]}
    """
    result: dict[str, dict] = {}
    for q in data.get("quotes", []):
        result[q["code"]] = {
            "price": float(q.get("price", 0)),
            "change": float(q.get("change", 0)),
            "change_pct": float(q.get("changePercent", 0)),
        }
    return result


def _fetch_from_yfinance() -> dict[str, dict]:
    """Fetch world index quotes via yfinance."""
    from app.services.market_service import _fetch_quote
    prices: dict[str, dict] = {}
    for idx in WORLD_INDEX_MAP:
        try:
            q = _fetch_quote(idx["yf"])
            prices[idx["yf"]] = {
                "price": q["price"],
                "change": q["change"],
                "change_pct": q["change_pct"],
            }
        except Exception as exc:
            logger.debug("yfinance miss for %s: %s", idx["yf"], exc)
    return prices


def get_world_indices() -> dict:
    """Return global equity indices grouped by region with source metadata."""
    cache_key = "world_indices"
    if cache_key in _world_cache:
        return _world_cache[cache_key]

    source = "mock"
    prices: dict[str, dict] = {}

    koyfin_prices = _fetch_from_koyfin()
    if koyfin_prices:
        prices = koyfin_prices
        source = "koyfin"
    else:
        yf_prices = _fetch_from_yfinance()
        if yf_prices:
            prices = yf_prices
            source = "yfinance"

    by_region: dict[str, list] = {"americas": [], "europe": [], "asia-pacific": []}
    for idx in WORLD_INDEX_MAP:
        p = prices.get(idx["yf"]) or _MOCK.get(idx["yf"], {"price": 0, "change": 0, "change_pct": 0})
        by_region[idx["region"]].append({
            "symbol": idx["symbol"],
            "name": idx["name"],
            "country": idx["country"],
            "flag": idx["flag"],
            "region": idx["region"],
            "price": round(float(p["price"]), 2),
            "change": round(float(p["change"]), 4),
            "change_pct": round(float(p["change_pct"]), 4),
        })

    result = {
        "indices": by_region,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _world_cache[cache_key] = result
    return result
