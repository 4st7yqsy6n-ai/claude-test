import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cache – 60-second TTL for market data
# ---------------------------------------------------------------------------
_overview_cache: TTLCache = TTLCache(maxsize=10, ttl=60)
_ohlcv_cache: TTLCache = TTLCache(maxsize=200, ttl=60)
_info_cache: TTLCache = TTLCache(maxsize=200, ttl=300)

# ---------------------------------------------------------------------------
# Symbol groups
# ---------------------------------------------------------------------------
INDICES = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX", "^TNX", "^TYX"]
FX = [
    "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X",
    "AUDUSD=X", "USDCAD=X", "USDCNH=X", "USDMXN=X",
]
CRYPTO = ["BTC-USD", "ETH-USD", "SOL-USD"]
COMMODITIES = ["GC=F", "SI=F", "CL=F", "NG=F", "ZC=F", "ZW=F"]

SYMBOL_LABELS = {
    "^GSPC": "S&P 500", "^DJI": "Dow Jones", "^IXIC": "NASDAQ",
    "^RUT": "Russell 2000", "^VIX": "VIX", "^TNX": "10Y Yield", "^TYX": "30Y Yield",
    "EURUSD=X": "EUR/USD", "GBPUSD=X": "GBP/USD", "USDJPY=X": "USD/JPY",
    "USDCHF=X": "USD/CHF", "AUDUSD=X": "AUD/USD", "USDCAD=X": "USD/CAD",
    "USDCNH=X": "USD/CNH", "USDMXN=X": "USD/MXN",
    "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana",
    "GC=F": "Gold", "SI=F": "Silver", "CL=F": "WTI Crude",
    "NG=F": "Nat Gas", "ZC=F": "Corn", "ZW=F": "Wheat",
}

# ---------------------------------------------------------------------------
# Realistic mock fallback data (May 2026)
# ---------------------------------------------------------------------------
MOCK_PRICES: dict[str, dict] = {
    "^GSPC":    {"price": 5823.45, "change": 18.32,  "change_pct": 0.32,  "volume": 3_200_000_000},
    "^DJI":     {"price": 42_156.78, "change": 95.40, "change_pct": 0.23, "volume": 850_000_000},
    "^IXIC":    {"price": 18_934.21, "change": 87.65, "change_pct": 0.46, "volume": 5_100_000_000},
    "^RUT":     {"price": 2_143.67, "change": -4.32,  "change_pct": -0.20, "volume": 1_200_000_000},
    "^VIX":     {"price": 16.82,    "change": -0.45,  "change_pct": -2.61, "volume": 0},
    "^TNX":     {"price": 4.31,     "change": 0.03,   "change_pct": 0.70,  "volume": 0},
    "^TYX":     {"price": 4.52,     "change": 0.02,   "change_pct": 0.44,  "volume": 0},
    "EURUSD=X": {"price": 1.0823,   "change": 0.0012, "change_pct": 0.11,  "volume": 0},
    "GBPUSD=X": {"price": 1.2734,   "change": -0.0023,"change_pct": -0.18, "volume": 0},
    "USDJPY=X": {"price": 153.42,   "change": 0.34,   "change_pct": 0.22,  "volume": 0},
    "USDCHF=X": {"price": 0.9012,   "change": -0.0015,"change_pct": -0.17, "volume": 0},
    "AUDUSD=X": {"price": 0.6523,   "change": 0.0008, "change_pct": 0.12,  "volume": 0},
    "USDCAD=X": {"price": 1.3654,   "change": -0.0021,"change_pct": -0.15, "volume": 0},
    "USDCNH=X": {"price": 7.2341,   "change": 0.0123, "change_pct": 0.17,  "volume": 0},
    "USDMXN=X": {"price": 17.3456,  "change": 0.0234, "change_pct": 0.14,  "volume": 0},
    "BTC-USD":  {"price": 95_432.10, "change": 1_234.56, "change_pct": 1.31, "volume": 28_000_000_000},
    "ETH-USD":  {"price": 3_421.78,  "change": 67.34,    "change_pct": 2.01, "volume": 14_000_000_000},
    "SOL-USD":  {"price": 187.65,    "change": 4.32,     "change_pct": 2.36, "volume": 3_200_000_000},
    "GC=F":     {"price": 2_387.40,  "change": 12.30,    "change_pct": 0.52, "volume": 245_000},
    "SI=F":     {"price": 30.45,     "change": 0.23,     "change_pct": 0.76, "volume": 65_000},
    "CL=F":     {"price": 78.32,     "change": -0.87,    "change_pct": -1.10, "volume": 412_000},
    "NG=F":     {"price": 2.34,      "change": -0.04,    "change_pct": -1.68, "volume": 128_000},
    "ZC=F":     {"price": 432.50,    "change": 3.25,     "change_pct": 0.76, "volume": 98_000},
    "ZW=F":     {"price": 543.75,    "change": -2.50,    "change_pct": -0.46, "volume": 72_000},
}


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Convert a value to float, returning default on failure."""
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return default
        return float(val)
    except (TypeError, ValueError):
        return default


def _fetch_quote(symbol: str) -> dict:
    """Fetch a single symbol quote, fallback to mock on error."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = _safe_float(getattr(info, "last_price", None))
        prev_close = _safe_float(getattr(info, "previous_close", None))
        if price == 0.0:
            raise ValueError("zero price")
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0
        volume = _safe_float(getattr(info, "three_month_average_volume", None))
        return {
            "symbol": symbol,
            "label": SYMBOL_LABELS.get(symbol, symbol),
            "price": round(price, 6),
            "change": round(change, 6),
            "change_pct": round(change_pct, 4),
            "volume": int(volume),
        }
    except Exception as exc:
        logger.warning("Quote fetch failed for %s: %s – using mock", symbol, exc)
        mock = MOCK_PRICES.get(symbol, {"price": 0, "change": 0, "change_pct": 0, "volume": 0})
        return {
            "symbol": symbol,
            "label": SYMBOL_LABELS.get(symbol, symbol),
            **mock,
        }


def get_market_overview() -> dict:
    """Return a full market overview across indices, FX, crypto, and commodities."""
    cache_key = "market_overview"
    if cache_key in _overview_cache:
        return _overview_cache[cache_key]

    def fetch_group(symbols: list[str]) -> list[dict]:
        return [_fetch_quote(s) for s in symbols]

    result = {
        "indices": fetch_group(INDICES),
        "fx": fetch_group(FX),
        "crypto": fetch_group(CRYPTO),
        "commodities": fetch_group(COMMODITIES),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _overview_cache[cache_key] = result
    return result


def get_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    """Return OHLCV data for a symbol."""
    cache_key = hashkey(symbol, period, interval)
    if cache_key in _ohlcv_cache:
        return _ohlcv_cache[cache_key]

    try:
        df = yf.download(symbol, period=period, interval=interval, auto_adjust=True, progress=False)
        if df.empty:
            raise ValueError("empty dataframe")
        # Flatten multi-level columns that yfinance sometimes returns
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna(subset=["Close"])
        records = []
        for ts, row in df.iterrows():
            records.append({
                "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                "open": round(_safe_float(row.get("Open")), 4),
                "high": round(_safe_float(row.get("High")), 4),
                "low": round(_safe_float(row.get("Low")), 4),
                "close": round(_safe_float(row.get("Close")), 4),
                "volume": int(_safe_float(row.get("Volume"))),
            })
        _ohlcv_cache[cache_key] = records
        return records
    except Exception as exc:
        logger.warning("OHLCV fetch failed for %s: %s – returning mock", symbol, exc)
        return _generate_mock_ohlcv(symbol, period)


def _generate_mock_ohlcv(symbol: str, period: str) -> list[dict]:
    """Generate a realistic mock OHLCV series."""
    base = MOCK_PRICES.get(symbol, {}).get("price", 100.0)
    n_days = {"1d": 1, "5d": 5, "1mo": 22, "3mo": 63, "6mo": 126, "1y": 252, "2y": 504, "5y": 1260}.get(period, 252)
    rng = np.random.default_rng(abs(hash(symbol)) % (2**31))
    returns = rng.normal(0.0003, 0.012, n_days)
    closes = base * np.exp(np.cumsum(returns))
    records = []
    today = pd.Timestamp.now(tz="UTC").normalize()
    for i, close in enumerate(closes):
        day = today - pd.Timedelta(days=(n_days - 1 - i))
        high = close * (1 + abs(rng.normal(0, 0.005)))
        low = close * (1 - abs(rng.normal(0, 0.005)))
        open_ = close * (1 + rng.normal(0, 0.003))
        records.append({
            "timestamp": day.isoformat(),
            "open": round(float(open_), 4),
            "high": round(float(high), 4),
            "low": round(float(low), 4),
            "close": round(float(close), 4),
            "volume": int(rng.integers(1_000_000, 50_000_000)),
        })
    return records


def get_ticker_info(symbol: str) -> dict:
    """Return company / instrument info for a symbol."""
    cache_key = hashkey(symbol, "info")
    if cache_key in _info_cache:
        return _info_cache[cache_key]

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        result = {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName") or SYMBOL_LABELS.get(symbol, symbol),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "eps": info.get("trailingEps"),
            "dividend_yield": info.get("dividendYield"),
            "week_52_high": info.get("fiftyTwoWeekHigh"),
            "week_52_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageVolume"),
            "beta": info.get("beta"),
            "description": (info.get("longBusinessSummary") or "")[:500],
            "website": info.get("website", ""),
            "country": info.get("country", ""),
            "currency": info.get("currency", "USD"),
        }
        _info_cache[cache_key] = result
        return result
    except Exception as exc:
        logger.warning("Info fetch failed for %s: %s – returning mock", symbol, exc)
        result = {
            "symbol": symbol,
            "name": SYMBOL_LABELS.get(symbol, symbol),
            "sector": "N/A",
            "industry": "N/A",
            "market_cap": None,
            "pe_ratio": None,
            "forward_pe": None,
            "eps": None,
            "dividend_yield": None,
            "week_52_high": None,
            "week_52_low": None,
            "avg_volume": None,
            "beta": None,
            "description": "",
            "website": "",
            "country": "",
            "currency": "USD",
        }
        _info_cache[cache_key] = result
        return result


# ---------------------------------------------------------------------------
# Technical indicators
# ---------------------------------------------------------------------------

def calculate_indicators(df: pd.DataFrame) -> dict:
    """
    Calculate RSI(14), MACD, Bollinger Bands, EMA20, EMA50, EMA200
    from a DataFrame with a 'close' column.
    Returns dict with indicator series as lists ready for JSON serialisation.
    """
    if df.empty or "close" not in df.columns:
        return {}

    close = df["close"].astype(float)
    timestamps = df["timestamp"].tolist() if "timestamp" in df.columns else list(range(len(df)))

    # EMA
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()

    # RSI(14)
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    # MACD (12, 26, 9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - macd_signal

    # Bollinger Bands (20, 2)
    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std

    def _series_to_list(s: pd.Series) -> list:
        return [round(v, 6) if not np.isnan(v) else None for v in s.tolist()]

    return {
        "timestamps": timestamps,
        "ema20": _series_to_list(ema20),
        "ema50": _series_to_list(ema50),
        "ema200": _series_to_list(ema200),
        "rsi": _series_to_list(rsi),
        "macd": _series_to_list(macd_line),
        "macd_signal": _series_to_list(macd_signal),
        "macd_hist": _series_to_list(macd_hist),
        "bb_upper": _series_to_list(bb_upper),
        "bb_mid": _series_to_list(bb_mid),
        "bb_lower": _series_to_list(bb_lower),
    }
