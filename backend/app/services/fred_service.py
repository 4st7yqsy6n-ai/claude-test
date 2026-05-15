import logging
from datetime import datetime, timezone
from typing import Any

import requests
from cachetools import TTLCache

from app.config import settings

logger = logging.getLogger(__name__)

# 1-hour TTL cache for macro data
_cache: TTLCache = TTLCache(maxsize=50, ttl=3600)

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

YIELD_SERIES = {
    "DGS1MO": "1M",
    "DGS3MO": "3M",
    "DGS6MO": "6M",
    "DGS1":   "1Y",
    "DGS2":   "2Y",
    "DGS5":   "5Y",
    "DGS7":   "7Y",
    "DGS10":  "10Y",
    "DGS20":  "20Y",
    "DGS30":  "30Y",
}

MACRO_SERIES = {
    "CPIAUCSL": {"label": "CPI (YoY %)",          "unit": "%"},
    "UNRATE":   {"label": "Unemployment Rate",     "unit": "%"},
    "FEDFUNDS": {"label": "Fed Funds Rate",        "unit": "%"},
    "GDP":      {"label": "Real GDP (QoQ %)",      "unit": "%"},
    "PAYEMS":   {"label": "Nonfarm Payrolls",      "unit": "K"},
    "T10YIE":   {"label": "10Y Breakeven Inflation","unit": "%"},
    "DEXUSEU":  {"label": "EUR/USD",               "unit": ""},
    "VIXCLS":   {"label": "VIX",                   "unit": ""},
}

# ---------------------------------------------------------------------------
# Realistic mock data for May 2026
# ---------------------------------------------------------------------------
MOCK_YIELD_CURVE = [
    {"maturity": "1M",  "maturity_label": "1 Month",   "yield": 5.28, "prev_yield": 5.30, "change": -0.02},
    {"maturity": "3M",  "maturity_label": "3 Month",   "yield": 5.22, "prev_yield": 5.23, "change": -0.01},
    {"maturity": "6M",  "maturity_label": "6 Month",   "yield": 5.01, "prev_yield": 5.04, "change": -0.03},
    {"maturity": "1Y",  "maturity_label": "1 Year",    "yield": 4.72, "prev_yield": 4.74, "change": -0.02},
    {"maturity": "2Y",  "maturity_label": "2 Year",    "yield": 4.52, "prev_yield": 4.51, "change":  0.01},
    {"maturity": "5Y",  "maturity_label": "5 Year",    "yield": 4.38, "prev_yield": 4.36, "change":  0.02},
    {"maturity": "7Y",  "maturity_label": "7 Year",    "yield": 4.35, "prev_yield": 4.33, "change":  0.02},
    {"maturity": "10Y", "maturity_label": "10 Year",   "yield": 4.31, "prev_yield": 4.29, "change":  0.02},
    {"maturity": "20Y", "maturity_label": "20 Year",   "yield": 4.58, "prev_yield": 4.57, "change":  0.01},
    {"maturity": "30Y", "maturity_label": "30 Year",   "yield": 4.52, "prev_yield": 4.50, "change":  0.02},
]

MOCK_MACRO = {
    "CPIAUCSL": {"label": "CPI (YoY %)",          "unit": "%",  "value": 3.2,    "prev": 3.4,    "change": -0.2,  "date": "2026-03-01"},
    "UNRATE":   {"label": "Unemployment Rate",     "unit": "%",  "value": 4.1,    "prev": 4.0,    "change":  0.1,  "date": "2026-04-01"},
    "FEDFUNDS": {"label": "Fed Funds Rate",        "unit": "%",  "value": 5.33,   "prev": 5.33,   "change":  0.0,  "date": "2026-04-01"},
    "GDP":      {"label": "Real GDP (QoQ %)",      "unit": "%",  "value": 2.1,    "prev": 2.8,    "change": -0.7,  "date": "2026-01-01"},
    "PAYEMS":   {"label": "Nonfarm Payrolls",      "unit": "K",  "value": 177.0,  "prev": 228.0,  "change": -51.0, "date": "2026-04-01"},
    "T10YIE":   {"label": "10Y Breakeven Inflation","unit": "%", "value": 2.34,   "prev": 2.31,   "change":  0.03, "date": "2026-05-14"},
    "DEXUSEU":  {"label": "EUR/USD",               "unit": "",   "value": 1.0823, "prev": 1.0811, "change":  0.0012, "date": "2026-05-14"},
    "VIXCLS":   {"label": "VIX",                   "unit": "",   "value": 16.82,  "prev": 17.27,  "change": -0.45, "date": "2026-05-14"},
}

MOCK_YIELDS_BY_SERIES = {
    "DGS1MO": 5.28, "DGS3MO": 5.22, "DGS6MO": 5.01, "DGS1": 4.72,
    "DGS2": 4.52, "DGS5": 4.38, "DGS7": 4.35, "DGS10": 4.31,
    "DGS20": 4.58, "DGS30": 4.52,
}


def _fred_request(series_id: str, limit: int = 10) -> list[dict]:
    """Fetch observations from FRED REST API."""
    params = {
        "series_id": series_id,
        "api_key": settings.FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    resp = requests.get(FRED_BASE, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    observations = data.get("observations", [])
    results = []
    for obs in observations:
        try:
            value = float(obs["value"]) if obs["value"] != "." else None
        except (ValueError, KeyError):
            value = None
        results.append({"date": obs.get("date", ""), "value": value})
    return results


def get_series(series_id: str, limit: int = 10) -> list[dict]:
    """Return raw observations for a FRED series."""
    cache_key = f"series_{series_id}_{limit}"
    if cache_key in _cache:
        return _cache[cache_key]

    if not settings.has_fred_key:
        logger.debug("No FRED key – returning mock for %s", series_id)
        base = MOCK_YIELDS_BY_SERIES.get(series_id) or MOCK_MACRO.get(series_id, {}).get("value", 0.0)
        results = [{"date": "2026-05-14", "value": base}]
        _cache[cache_key] = results
        return results

    try:
        results = _fred_request(series_id, limit)
        _cache[cache_key] = results
        return results
    except Exception as exc:
        logger.warning("FRED series fetch failed for %s: %s", series_id, exc)
        return []


def get_yield_curve() -> list[dict]:
    """Return the full US Treasury yield curve."""
    cache_key = "yield_curve"
    if cache_key in _cache:
        return _cache[cache_key]

    if not settings.has_fred_key:
        _cache[cache_key] = MOCK_YIELD_CURVE
        return MOCK_YIELD_CURVE

    result = []
    for series_id, maturity_label_short in YIELD_SERIES.items():
        try:
            obs = _fred_request(series_id, limit=2)
            if not obs:
                raise ValueError("empty")
            latest_val = next((o["value"] for o in obs if o["value"] is not None), None)
            prev_val = None
            for o in obs[1:]:
                if o["value"] is not None:
                    prev_val = o["value"]
                    break
            change = round(latest_val - prev_val, 4) if latest_val is not None and prev_val is not None else 0.0
            maturity_names = {
                "1M": "1 Month",  "3M": "3 Month",  "6M": "6 Month",
                "1Y": "1 Year",   "2Y": "2 Year",   "5Y": "5 Year",
                "7Y": "7 Year",   "10Y": "10 Year", "20Y": "20 Year",
                "30Y": "30 Year",
            }
            result.append({
                "maturity": maturity_label_short,
                "maturity_label": maturity_names.get(maturity_label_short, maturity_label_short),
                "yield": latest_val,
                "prev_yield": prev_val,
                "change": change,
            })
        except Exception as exc:
            logger.warning("Yield curve fetch failed for %s: %s", series_id, exc)
            # Fallback to mock for this point
            mock_point = next(
                (p for p in MOCK_YIELD_CURVE if p["maturity"] == maturity_label_short), None
            )
            if mock_point:
                result.append(mock_point)

    if not result:
        result = MOCK_YIELD_CURVE

    _cache[cache_key] = result
    return result


def get_macro_indicators() -> dict:
    """Return key macroeconomic indicators."""
    cache_key = "macro_indicators"
    if cache_key in _cache:
        return _cache[cache_key]

    if not settings.has_fred_key:
        result = {**MOCK_MACRO, "timestamp": datetime.now(timezone.utc).isoformat()}
        _cache[cache_key] = result
        return result

    result: dict[str, Any] = {}
    for series_id, meta in MACRO_SERIES.items():
        try:
            obs = _fred_request(series_id, limit=2)
            if not obs:
                raise ValueError("empty")
            latest = next((o for o in obs if o["value"] is not None), None)
            prev = None
            for o in obs[1:]:
                if o["value"] is not None:
                    prev = o
                    break
            latest_val = latest["value"] if latest else None
            prev_val = prev["value"] if prev else None
            change = round(latest_val - prev_val, 4) if latest_val is not None and prev_val is not None else 0.0
            result[series_id] = {
                "label": meta["label"],
                "unit": meta["unit"],
                "value": latest_val,
                "prev": prev_val,
                "change": change,
                "date": latest["date"] if latest else "",
            }
        except Exception as exc:
            logger.warning("Macro indicator fetch failed for %s: %s", series_id, exc)
            result[series_id] = MOCK_MACRO.get(series_id, {"label": series_id, "unit": "", "value": None})

    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    _cache[cache_key] = result
    return result
