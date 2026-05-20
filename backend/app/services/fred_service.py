import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import requests
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# 1-hour TTL cache for macro data
_cache: TTLCache = TTLCache(maxsize=50, ttl=3600)

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

# ---------------------------------------------------------------------------
# US Treasury yield curve (no API key needed)
# ---------------------------------------------------------------------------
_TREASURY_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "d": "http://schemas.microsoft.com/ado/2007/08/dataservices",
}

_YIELD_FIELDS = {
    "BC_1MONTH":  ("1M",  "1 Month"),
    "BC_3MONTH":  ("3M",  "3 Month"),
    "BC_6MONTH":  ("6M",  "6 Month"),
    "BC_1YEAR":   ("1Y",  "1 Year"),
    "BC_2YEAR":   ("2Y",  "2 Year"),
    "BC_5YEAR":   ("5Y",  "5 Year"),
    "BC_7YEAR":   ("7Y",  "7 Year"),
    "BC_10YEAR":  ("10Y", "10 Year"),
    "BC_20YEAR":  ("20Y", "20 Year"),
    "BC_30YEAR":  ("30Y", "30 Year"),
}


def _fetch_treasury_yield_curve() -> list[dict]:
    yyyymm = datetime.now().strftime("%Y%m")
    url = (
        "https://home.treasury.gov/resource-center/data-chart-center/"
        f"interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value={yyyymm}"
    )
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    entries = root.findall(".//atom:entry", _TREASURY_NS)
    if not entries:
        raise ValueError("No entries in Treasury XML")

    latest_props = entries[-1].find(".//d:properties", _TREASURY_NS)
    prev_props = entries[-2].find(".//d:properties", _TREASURY_NS) if len(entries) >= 2 else None
    if latest_props is None:
        raise ValueError("Missing properties in Treasury entry")

    result = []
    for field, (maturity_short, maturity_long) in _YIELD_FIELDS.items():
        el = latest_props.find(f"d:{field}", _TREASURY_NS)
        prev_el = prev_props.find(f"d:{field}", _TREASURY_NS) if prev_props is not None else None
        latest_val = float(el.text) if el is not None and el.text else None
        prev_val = float(prev_el.text) if prev_el is not None and prev_el.text else None
        change = round(latest_val - prev_val, 4) if latest_val is not None and prev_val is not None else 0.0
        result.append({
            "maturity": maturity_short,
            "maturity_label": maturity_long,
            "yield": latest_val,
            "prev_yield": prev_val,
            "change": change,
        })
    return result


# ---------------------------------------------------------------------------
# BLS public API v1 – no key required (500 req/day)
# Series: CPI, Unemployment, Nonfarm Payrolls
# ---------------------------------------------------------------------------
_BLS_MAP = {
    "CUUR0000SA0":   "CPIAUCSL",   # CPI All Urban
    "LNS14000000":   "UNRATE",     # Unemployment rate
    "CES0000000001": "PAYEMS",     # Total nonfarm payrolls (thousands)
}


def _fetch_bls_indicators() -> dict:
    url = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
    payload = {"seriesid": list(_BLS_MAP.keys()), "latest": "true"}
    resp = requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    out: dict[str, Any] = {}
    for series in data.get("Results", {}).get("series", []):
        sid = series["seriesID"]
        items = series.get("data", [])
        if not items:
            continue
        latest = items[0]
        prev = items[1] if len(items) > 1 else None
        try:
            latest_val = float(latest["value"])
            prev_val = float(prev["value"]) if prev else None
        except (TypeError, ValueError):
            continue
        fred_key = _BLS_MAP.get(sid, sid)
        out[fred_key] = {
            "value": latest_val,
            "prev": prev_val,
            "change": round(latest_val - prev_val, 4) if prev_val is not None else 0.0,
            "date": f"{latest['year']}-{latest['period'].replace('M', '').zfill(2)}-01",
        }
    return out


# ---------------------------------------------------------------------------
# yfinance – VIX and EUR/USD (no key needed)
# ---------------------------------------------------------------------------
def _fetch_yf_indicators() -> dict:
    try:
        import yfinance as yf
        out: dict[str, Any] = {}
        for symbol, fred_key in (("^VIX", "VIXCLS"), ("EURUSD=X", "DEXUSEU")):
            try:
                info = yf.Ticker(symbol).fast_info
                price = float(getattr(info, "last_price", None) or 0)
                prev = float(getattr(info, "previous_close", None) or 0)
                if price:
                    out[fred_key] = {
                        "value": round(price, 4),
                        "prev": round(prev, 4) if prev else None,
                        "change": round(price - prev, 4) if prev else 0.0,
                        "date": datetime.now(timezone.utc).date().isoformat(),
                    }
            except Exception:
                pass
        return out
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_yield_curve() -> list[dict]:
    cache_key = "yield_curve"
    if cache_key in _cache:
        return _cache[cache_key]
    try:
        result = _fetch_treasury_yield_curve()
        if result:
            _cache[cache_key] = result
            return result
    except Exception as exc:
        logger.warning("Treasury yield curve fetch failed: %s – using mock", exc)
    _cache[cache_key] = MOCK_YIELD_CURVE
    return MOCK_YIELD_CURVE


def get_macro_indicators() -> dict:
    cache_key = "macro_indicators"
    if cache_key in _cache:
        return _cache[cache_key]

    result: dict[str, Any] = {k: dict(v) for k, v in MOCK_MACRO.items()}

    # Layer in BLS data
    try:
        bls = _fetch_bls_indicators()
        for fred_key, vals in bls.items():
            if fred_key in result:
                result[fred_key].update(vals)
    except Exception as exc:
        logger.warning("BLS fetch failed: %s – using mock macro", exc)

    # Layer in yfinance data (VIX, EUR/USD)
    try:
        yf_data = _fetch_yf_indicators()
        for fred_key, vals in yf_data.items():
            if fred_key in result:
                result[fred_key].update(vals)
    except Exception as exc:
        logger.warning("yfinance macro fetch failed: %s", exc)

    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    _cache[cache_key] = result
    return result


def get_series(series_id: str, limit: int = 10) -> list[dict]:
    """Compatibility shim – returns mock observations for a series key."""
    cache_key = f"series_{series_id}_{limit}"
    if cache_key in _cache:
        return _cache[cache_key]
    mock = MOCK_MACRO.get(series_id, {})
    results = [{"date": mock.get("date", "2026-05-14"), "value": mock.get("value", 0.0)}]
    _cache[cache_key] = results
    return results
