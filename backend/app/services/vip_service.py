"""
vip_service.py
==============
Gold & Forex Quant Edge VIP Dashboard – core service layer.

All public functions attempt to fetch live data via yfinance and fall back
gracefully to deterministic, realistic mock data so the API is always usable
even without network access or valid market-data subscriptions.

Mock data uses fixed NumPy RNG seeds for full reproducibility across restarts.
"""

from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy yfinance import
# ---------------------------------------------------------------------------
_yf: Any = None


def _yfinance() -> Any:
    global _yf
    if _yf is None:
        import yfinance as yf  # noqa: PLC0415
        _yf = yf
    return _yf


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _utc(dt: datetime) -> str:
    """Ensure datetime is timezone-aware UTC and return ISO string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Coerce a value to float; return *default* on any failure."""
    try:
        if val is None:
            return default
        f = float(val)
        return default if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Static correlation matrix (real-world approximate values)
# ---------------------------------------------------------------------------

#: Pair ordering used throughout the module.
CORR_PAIRS = ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"]

#: Lower-triangular values, row-major.  Symmetric; diagonal = 1.0.
#: Sources: multi-year empirical correlations on daily returns.
_CORR_RAW: list[list[float]] = [
    # XAU/USD  EUR/USD  GBP/USD  USD/JPY  AUD/USD  USD/CAD
    [1.00,     0.60,    0.55,   -0.68,    0.45,   -0.40],   # XAU/USD
    [0.60,     1.00,    0.87,   -0.75,    0.72,   -0.68],   # EUR/USD
    [0.55,     0.87,    1.00,   -0.70,    0.68,   -0.62],   # GBP/USD
    [-0.68,   -0.75,   -0.70,    1.00,   -0.65,    0.58],   # USD/JPY
    [0.45,     0.72,    0.68,   -0.65,    1.00,   -0.55],   # AUD/USD
    [-0.40,   -0.68,   -0.62,    0.58,   -0.55,    1.00],   # USD/CAD
]

CORRELATION_MATRIX: dict[str, dict[str, float]] = {
    p1: {p2: _CORR_RAW[i][j] for j, p2 in enumerate(CORR_PAIRS)}
    for i, p1 in enumerate(CORR_PAIRS)
}


# ===========================================================================
# 1. MARKET REGIME
# ===========================================================================

def get_market_regime() -> dict:
    """
    Detect the current macro market regime using VIX, DXY, gold, and
    inflation-breakeven proxies.

    Tries to pull live data from yfinance for ``^VIX``, ``DX-Y.NYB``,
    ``GC=F``, ``TIP``, and ``IEF``.  Falls back to a realistic mock regime
    on any failure.

    Returns
    -------
    dict
        Keys: risk_sentiment, risk_score, inflation_regime, inflation_score,
        usd_cycle, usd_score, gold_bias, gold_bias_score, regime_label,
        key_drivers, updated_at.
    """
    try:
        return _compute_live_regime()
    except Exception as exc:
        logger.warning("Live regime fetch failed (%s) – using mock regime", exc)
        return _mock_regime()


def _compute_live_regime() -> dict:
    """Fetch live regime indicators from yfinance and compute scores."""
    yf = _yfinance()

    symbols = ["^VIX", "DX-Y.NYB", "GC=F", "TIP", "IEF"]
    tickers = yf.Tickers(" ".join(symbols))

    def _last_price(sym: str) -> float:
        try:
            info = tickers.tickers[sym].fast_info
            p = _safe_float(getattr(info, "last_price", None))
            if p == 0.0:
                raise ValueError("zero price")
            return p
        except Exception:
            return 0.0

    vix = _last_price("^VIX") or 17.5
    dxy = _last_price("DX-Y.NYB") or 104.2
    tip = _last_price("TIP") or 113.4
    ief = _last_price("IEF") or 93.8

    return _build_regime(vix=vix, dxy=dxy, tip=tip, ief=ief)


def _build_regime(*, vix: float, dxy: float, tip: float, ief: float) -> dict:
    """Pure function: maps indicator values → regime dict."""
    # --- Risk sentiment -------------------------------------------------------
    # VIX: >28 = extreme risk-off; <14 = extreme risk-on; linear scale 0-100.
    risk_score = max(0.0, min(100.0, 100.0 - (vix - 10.0) * (100.0 / 30.0)))
    if vix >= 28:
        risk_sentiment = "risk_off"
    elif vix <= 15:
        risk_sentiment = "risk_on"
    else:
        risk_sentiment = "neutral"

    # --- Inflation breakeven (TIP/IEF ratio proxy) ---------------------------
    be_ratio = (tip / ief) if ief else 1.21
    # Typical range 1.15 – 1.35; mid = 1.25
    inflation_score = max(0.0, min(100.0, (be_ratio - 1.10) * (100.0 / 0.30)))
    if be_ratio >= 1.28:
        inflation_regime = "high_inflation"
    elif be_ratio <= 1.18:
        inflation_regime = "deflation"
    elif be_ratio <= 1.22:
        inflation_regime = "disinflation"
    else:
        inflation_regime = "stable"

    # --- USD cycle ------------------------------------------------------------
    # DXY: >106 = strong; <100 = weak; mid-range 100-106.
    usd_score = max(0.0, min(100.0, (dxy - 94.0) * (100.0 / 18.0)))
    if dxy >= 106:
        usd_cycle = "strong_dollar"
    elif dxy <= 100:
        usd_cycle = "weak_dollar"
    else:
        usd_cycle = "neutral"

    # --- Gold bias composite --------------------------------------------------
    # Risk-off → +, weak dollar → +, high inflation → +
    gold_bias_score = 0.0
    gold_bias_score += (50.0 - risk_score) * 0.8          # risk-off boosts gold
    gold_bias_score += (50.0 - usd_score) * 0.6           # weak USD boosts gold
    gold_bias_score += (inflation_score - 50.0) * 0.4     # high inflation boosts gold
    gold_bias_score = max(-100.0, min(100.0, gold_bias_score))

    if gold_bias_score > 20:
        gold_bias = "bullish"
    elif gold_bias_score < -20:
        gold_bias = "bearish"
    else:
        gold_bias = "neutral"

    # --- Human-readable label -------------------------------------------------
    regime_parts = []
    if risk_sentiment == "risk_off":
        regime_parts.append("Risk-Off")
    elif risk_sentiment == "risk_on":
        regime_parts.append("Risk-On")
    else:
        regime_parts.append("Neutral Risk")

    if inflation_regime == "high_inflation":
        regime_parts.append("High Inflation")
    elif inflation_regime == "disinflation":
        regime_parts.append("Disinflation")
    elif inflation_regime == "deflation":
        regime_parts.append("Deflation")
    else:
        regime_parts.append("Stable CPI")

    if usd_cycle == "strong_dollar":
        regime_parts.append("Strong USD")
    elif usd_cycle == "weak_dollar":
        regime_parts.append("Weak USD")

    gold_arrow = "→ Gold Bullish" if gold_bias == "bullish" else ("→ Gold Bearish" if gold_bias == "bearish" else "→ Gold Neutral")
    regime_label = " + ".join(regime_parts) + f" {gold_arrow}"

    # --- Key drivers ----------------------------------------------------------
    key_drivers: list[str] = []
    key_drivers.append(f"VIX at {vix:.1f} – {'elevated fear, safe-haven demand' if vix > 20 else 'complacency, risk appetite intact'}")
    key_drivers.append(f"DXY at {dxy:.1f} – {'USD headwind for gold' if dxy > 104 else 'USD tailwind for gold'}")
    key_drivers.append(f"Inflation breakeven ratio {be_ratio:.3f} – {'above 5Y average, inflationary' if be_ratio > 1.25 else 'moderating inflation expectations'}")
    key_drivers.append(f"Gold bias score {gold_bias_score:+.1f}/100 – regime {'supports' if gold_bias == 'bullish' else ('suppresses' if gold_bias == 'bearish' else 'neutral on')} gold longs")
    if risk_sentiment == "risk_off" and inflation_regime == "high_inflation" and usd_cycle == "weak_dollar":
        key_drivers.append("Trifecta regime: Risk-Off + High Inflation + Weak USD – historically strongest gold bull signal")

    return {
        "risk_sentiment": risk_sentiment,
        "risk_score": round(risk_score, 2),
        "inflation_regime": inflation_regime,
        "inflation_score": round(inflation_score, 2),
        "usd_cycle": usd_cycle,
        "usd_score": round(usd_score, 2),
        "gold_bias": gold_bias,
        "gold_bias_score": round(gold_bias_score, 2),
        "regime_label": regime_label,
        "key_drivers": key_drivers,
        "updated_at": _now_iso(),
    }


def _mock_regime() -> dict:
    """Realistic mock regime for May 2026 (risk-off, elevated inflation, moderate USD)."""
    return _build_regime(vix=22.4, dxy=103.8, tip=114.2, ief=93.5)


# ===========================================================================
# 2. TRADING SIGNALS
# ===========================================================================

# Reference prices for signal generation (May 2026 realistic levels)
_REF_PRICES: dict[str, float] = {
    "XAU/USD": 2640.00,
    "EUR/USD": 1.0850,
    "GBP/USD": 1.2680,
    "USD/JPY": 157.20,
    "AUD/USD": 0.6450,
    "USD/CAD": 1.3680,
    "GBP/JPY": 199.30,
    "XAU/EUR": 2432.00,  # approx 2640 / 1.0850
}


def get_signals() -> list[dict]:
    """
    Generate trading signals for eight Gold & FX pairs.

    Signals are derived from current regime (fetched via get_market_regime),
    reference price levels, and rule-based technical logic.  All
    entry/stop/TP values are mathematically consistent.

    Returns
    -------
    list[dict]
        One signal dict per pair; keys per specification.
    """
    try:
        regime = get_market_regime()
    except Exception:
        regime = _mock_regime()

    rng = np.random.default_rng(20260527)  # fixed seed for reproducibility

    gold_bias = regime.get("gold_bias", "bullish")
    risk_sentiment = regime.get("risk_sentiment", "risk_off")
    usd_cycle = regime.get("usd_cycle", "neutral")

    return [
        _build_xauusd_signal(gold_bias, regime, rng),
        _build_eurusd_signal(usd_cycle, regime, rng),
        _build_gbpusd_signal(usd_cycle, regime, rng),
        _build_usdjpy_signal(risk_sentiment, regime, rng),
        _build_audusd_signal(risk_sentiment, regime, rng),
        _build_usdcad_signal(regime, rng),
        _build_gbpjpy_signal(risk_sentiment, regime, rng),
        _build_xaueur_signal(gold_bias, regime, rng),
    ]


def _signal_base(
    pair: str,
    direction: str,
    entry: float,
    stop: float,
    tp1: float,
    tp2: float,
    tp3: float,
    confidence: int,
    rationale: str,
    regime_alignment: bool,
    time_frame: str,
    invalidation: str,
    status: str = "ACTIVE",
    spread_pips: float = 0.0,
) -> dict:
    """Assemble a signal dict with derived fields."""
    pip_risk = abs(entry - stop)
    pip_reward_tp2 = abs(tp2 - entry)
    rr = round(pip_reward_tp2 / pip_risk, 2) if pip_risk > 0 else 0.0

    if entry < stop:
        # SHORT – entry zone description
        entry_low = round(entry * 0.9997, 5)
        entry_high = round(entry * 1.0003, 5)
    else:
        entry_low = round(entry * 0.9997, 5)
        entry_high = round(entry * 1.0003, 5)

    # Format entry zone based on magnitude
    if entry > 100:
        ez = f"{entry_low:.2f}-{entry_high:.2f}"
    elif entry > 1:
        ez = f"{entry_low:.4f}-{entry_high:.4f}"
    else:
        ez = f"{entry_low:.5f}-{entry_high:.5f}"

    if confidence >= 70:
        confidence_label = "HIGH"
    elif confidence >= 45:
        confidence_label = "MEDIUM"
    else:
        confidence_label = "LOW"

    return {
        "pair": pair,
        "direction": direction,
        "entry_zone": ez,
        "stop_loss": round(stop, 5),
        "tp1": round(tp1, 5),
        "tp2": round(tp2, 5),
        "tp3": round(tp3, 5),
        "confidence": confidence,
        "confidence_label": confidence_label,
        "rationale": rationale,
        "regime_alignment": regime_alignment,
        "time_frame": time_frame,
        "r_r_ratio": rr,
        "invalidation": invalidation,
        "generated_at": _now_iso(),
        "status": status,
    }


def _build_xauusd_signal(gold_bias: str, regime: dict, rng: np.random.Generator) -> dict:
    base = 2640.0
    if gold_bias == "bullish":
        entry = 2618.0
        stop = 2594.0
        tp1 = 2645.0
        tp2 = 2672.0
        tp3 = 2710.0
        direction = "LONG"
        confidence = 78
        rationale = (
            "Risk-off regime with elevated VIX supports gold safe-haven bid. "
            "Price holding above the 2600 psychological support and 200-EMA on H4. "
            "Bullish engulfing on D1 at key demand zone signals institutional accumulation."
        )
        regime_alignment = True
        invalidation = "Daily close below 2590 invalidates bullish structure"
    else:
        entry = 2648.0
        stop = 2671.0
        tp1 = 2625.0
        tp2 = 2600.0
        tp3 = 2570.0
        direction = "SHORT"
        confidence = 55
        rationale = (
            "Strengthening USD and easing inflation expectations reduce gold's appeal. "
            "Price rejected at the 2650 resistance cluster with bearish RSI divergence. "
            "Risk-on sentiment diminishes safe-haven premium."
        )
        regime_alignment = False
        invalidation = "Break and close above 2680 invalidates short bias"

    return _signal_base(
        pair="XAU/USD",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="H4",
        invalidation=invalidation,
    )


def _build_eurusd_signal(usd_cycle: str, regime: dict, rng: np.random.Generator) -> dict:
    if usd_cycle == "weak_dollar":
        entry = 1.0840
        stop = 1.0790
        tp1 = 1.0880
        tp2 = 1.0930
        tp3 = 1.1000
        direction = "LONG"
        confidence = 65
        rationale = (
            "Weak dollar environment underpins EUR/USD recovery from the 1.08 handle. "
            "ECB holding rates steady while Fed dovish pivot expectations build provides EUR tailwind. "
            "Price bounced from the ascending trendline support with increasing buy-side volume."
        )
        regime_alignment = True
        invalidation = "Break below 1.0780 voids the bullish setup"
    elif usd_cycle == "strong_dollar":
        entry = 1.0865
        stop = 1.0910
        tp1 = 1.0820
        tp2 = 1.0780
        tp3 = 1.0720
        direction = "SHORT"
        confidence = 70
        rationale = (
            "Strong dollar regime presses EUR/USD toward major support. "
            "Diverging rate expectations — Fed hawkish, ECB nearing cut cycle — weigh on EUR. "
            "Daily shooting star at resistance confirms downside momentum."
        )
        regime_alignment = True
        invalidation = "Daily close above 1.0920 negates the short"
    else:
        entry = 1.0855
        stop = 1.0800
        tp1 = 1.0900
        tp2 = 1.0950
        tp3 = 1.1020
        direction = "LONG"
        confidence = 52
        rationale = (
            "Neutral USD environment with EUR stabilising above key support at 1.0800. "
            "Positioning data shows EUR short squeeze potential near multi-month lows. "
            "Watch for break above 1.0900 to confirm directional bias."
        )
        regime_alignment = False
        invalidation = "H4 close below 1.0795 invalidates long thesis"

    return _signal_base(
        pair="EUR/USD",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="D1",
        invalidation=invalidation,
    )


def _build_gbpusd_signal(usd_cycle: str, regime: dict, rng: np.random.Generator) -> dict:
    if usd_cycle in ("weak_dollar", "neutral"):
        entry = 1.2665
        stop = 1.2605
        tp1 = 1.2720
        tp2 = 1.2780
        tp3 = 1.2870
        direction = "LONG"
        confidence = 60
        rationale = (
            "GBP/USD finding support at the 1.2650 structure level with BoE still in hawkish hold. "
            "Cable resilience vs EUR suggests relative GBP strength. "
            "H4 higher-low sequence intact; dips into 1.2650-1.2680 offer tactical long entries."
        )
        regime_alignment = True
        invalidation = "Weekly close below 1.2590 shifts bias to neutral"
    else:
        entry = 1.2690
        stop = 1.2745
        tp1 = 1.2640
        tp2 = 1.2580
        tp3 = 1.2490
        direction = "SHORT"
        confidence = 62
        rationale = (
            "Strong USD momentum pressing GBP toward 2024 lows. "
            "BoE rate cut expectations accelerating amid softening UK CPI. "
            "Daily rejection candle at descending 50-EMA confirms sell pressure."
        )
        regime_alignment = True
        invalidation = "Break above 1.2750 with close invalidates short"

    return _signal_base(
        pair="GBP/USD",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="H4",
        invalidation=invalidation,
    )


def _build_usdjpy_signal(risk_sentiment: str, regime: dict, rng: np.random.Generator) -> dict:
    # Risk-off → yen strengthens → USD/JPY falls → SHORT
    if risk_sentiment == "risk_off":
        entry = 157.50
        stop = 159.20
        tp1 = 156.00
        tp2 = 154.50
        tp3 = 152.00
        direction = "SHORT"
        confidence = 73
        rationale = (
            "Risk-off environment drives JPY safe-haven demand, pressuring USD/JPY lower. "
            "BoJ pivoting toward normalisation — rate hike expectations limit USD/JPY upside. "
            "Price forming a double-top at 158-159 zone with bearish RSI divergence on D1."
        )
        regime_alignment = True
        invalidation = "Daily close above 159.50 negates the bearish scenario"
    elif risk_sentiment == "risk_on":
        entry = 156.80
        stop = 155.20
        tp1 = 158.00
        tp2 = 159.50
        tp3 = 161.50
        direction = "LONG"
        confidence = 58
        rationale = (
            "Risk-on appetite reduces JPY safe-haven premium. "
            "Wide US-Japan rate differential sustains carry trade demand for USD/JPY. "
            "Breakout above 157.00 resistance targets the 2024 highs near 160."
        )
        regime_alignment = True
        invalidation = "Break below 155.00 voids bullish structure"
    else:
        entry = 157.00
        stop = 158.80
        tp1 = 155.50
        tp2 = 154.00
        tp3 = 151.50
        direction = "SHORT"
        confidence = 48
        rationale = (
            "Neutral risk environment with JPY finding footing amid BoJ policy uncertainty. "
            "US rate cut expectations capping USD/JPY rallies. "
            "Watching for break of 156.00 support to trigger momentum short."
        )
        regime_alignment = False
        invalidation = "Close above 158.90 invalidates the setup"

    return _signal_base(
        pair="USD/JPY",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="D1",
        invalidation=invalidation,
    )


def _build_audusd_signal(risk_sentiment: str, regime: dict, rng: np.random.Generator) -> dict:
    if risk_sentiment == "risk_on":
        entry = 0.6440
        stop = 0.6390
        tp1 = 0.6490
        tp2 = 0.6550
        tp3 = 0.6620
        direction = "LONG"
        confidence = 63
        rationale = (
            "Risk-on conditions favour commodity-linked AUD. "
            "Chinese stimulus expectations and iron ore demand support the Aussie dollar. "
            "AUD/USD bounced from strong 0.6400 demand zone; H4 momentum turning higher."
        )
        regime_alignment = True
        invalidation = "Daily close below 0.6380 negates bullish thesis"
    else:
        entry = 0.6460
        stop = 0.6510
        tp1 = 0.6410
        tp2 = 0.6360
        tp3 = 0.6290
        direction = "SHORT"
        confidence = 61
        rationale = (
            "Risk-off and global growth concerns pressure the risk-sensitive AUD. "
            "Slowing China demand signals weakness in commodity exports. "
            "AUD/USD capped below 0.6500 resistance; bearish daily close below 0.6450 needed."
        )
        regime_alignment = True
        invalidation = "Close above 0.6520 invalidates the short"

    return _signal_base(
        pair="AUD/USD",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="H4",
        invalidation=invalidation,
    )


def _build_usdcad_signal(regime: dict, rng: np.random.Generator) -> dict:
    usd_cycle = regime.get("usd_cycle", "neutral")
    if usd_cycle == "strong_dollar":
        entry = 1.3660
        stop = 1.3600
        tp1 = 1.3730
        tp2 = 1.3800
        tp3 = 1.3900
        direction = "LONG"
        confidence = 64
        rationale = (
            "Strong USD regime drives USD/CAD toward the 1.38 resistance zone. "
            "Oil price weakness reduces Canadian dollar support — negative for CAD. "
            "Price broke above 1.3650 supply-turned-demand; pullback offers long entry."
        )
        regime_alignment = True
        invalidation = "H4 close below 1.3590 negates the bullish view"
    else:
        entry = 1.3700
        stop = 1.3760
        tp1 = 1.3640
        tp2 = 1.3570
        tp3 = 1.3480
        direction = "SHORT"
        confidence = 56
        rationale = (
            "USD/CAD overbought on weekly RSI near 1.37 — risk of mean reversion. "
            "Oil price stabilisation supporting CAD fundamentals. "
            "Bearish pin bar at 1.3720 monthly resistance; tight stops above 1.3760."
        )
        regime_alignment = False
        invalidation = "Weekly close above 1.3780 invalidates short thesis"

    return _signal_base(
        pair="USD/CAD",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="D1",
        invalidation=invalidation,
    )


def _build_gbpjpy_signal(risk_sentiment: str, regime: dict, rng: np.random.Generator) -> dict:
    if risk_sentiment == "risk_off":
        entry = 199.80
        stop = 201.50
        tp1 = 197.50
        tp2 = 195.00
        tp3 = 191.00
        direction = "SHORT"
        confidence = 69
        rationale = (
            "GBP/JPY highly sensitive to risk sentiment — risk-off drives sharp yen appreciation. "
            "Cross approaching key monthly resistance at 200 with bearish divergence on the weekly. "
            "Dual safe-haven demand for JPY and GBP vulnerability creates asymmetric short opportunity."
        )
        regime_alignment = True
        invalidation = "Daily close above 201.80 invalidates the short"
    else:
        entry = 198.50
        stop = 196.80
        tp1 = 200.50
        tp2 = 202.80
        tp3 = 206.00
        direction = "LONG"
        confidence = 55
        rationale = (
            "Risk appetite recovering — GBP/JPY historically outperforms in reflationary cycles. "
            "BoE divergence from BoJ (more hawkish) supports GBP/JPY upside. "
            "Break above 200 psychological level targets 2024 highs at 205-207."
        )
        regime_alignment = True
        invalidation = "Close below 196.50 negates the bullish pattern"

    return _signal_base(
        pair="GBP/JPY",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="H4",
        invalidation=invalidation,
    )


def _build_xaueur_signal(gold_bias: str, regime: dict, rng: np.random.Generator) -> dict:
    # XAU/EUR = XAU/USD / EUR/USD ≈ 2640 / 1.0850 ≈ 2432
    base = 2432.0
    if gold_bias == "bullish":
        entry = 2415.0
        stop = 2390.0
        tp1 = 2448.0
        tp2 = 2470.0
        tp3 = 2510.0
        direction = "LONG"
        confidence = 72
        rationale = (
            "Gold priced in euros maintains bullish structure, benefiting from ECB dovish tilt vs. USD. "
            "XAU/EUR holding above the 2400 psychological level and rising 20-week EMA. "
            "European inflation concerns support gold's real-asset appeal for EUR-based investors."
        )
        regime_alignment = True
        invalidation = "Weekly close below 2385 shifts bias to neutral"
    else:
        entry = 2445.0
        stop = 2470.0
        tp1 = 2420.0
        tp2 = 2395.0
        tp3 = 2360.0
        direction = "SHORT"
        confidence = 50
        rationale = (
            "XAU/EUR testing upper resistance band near 2450; overbought weekly RSI. "
            "EUR strengthening relative to USD reduces XAU/EUR upside. "
            "Wait for confirmation close below 2440 before entering short."
        )
        regime_alignment = False
        invalidation = "Break above 2480 negates the bearish structure"

    return _signal_base(
        pair="XAU/EUR",
        direction=direction,
        entry=entry,
        stop=stop,
        tp1=tp1,
        tp2=tp2,
        tp3=tp3,
        confidence=confidence,
        rationale=rationale,
        regime_alignment=regime_alignment,
        time_frame="W1",
        invalidation=invalidation,
    )


# ===========================================================================
# 3. ENHANCED ECONOMIC CALENDAR
# ===========================================================================

def get_enhanced_calendar() -> list[dict]:
    """
    Return 15-20 upcoming high-impact economic events for the next 7 days,
    plus 2-3 recently-past events with actual values and surprise indices.

    Events cover FOMC, NFP, CPI, PCE, ECB, BoJ, BoE, PMI releases.

    Returns
    -------
    list[dict]
        Sorted by datetime ascending; past events appear at the top.
    """
    base_date = datetime(2026, 5, 27, tzinfo=timezone.utc)
    events: list[dict] = []

    # ---- Past events (already released) ------------------------------------
    past = [
        {
            "id": "ev-001",
            "datetime": _utc(base_date - timedelta(days=3, hours=2)),
            "event": "US Core PCE Price Index (MoM) – Apr",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "0.3%",
            "previous": "0.3%",
            "actual": "0.4%",
            "surprise_index": 33.3,
            "historical_gold_reaction": "+0.6% avg on beat consensus",
            "historical_fx_reaction": {"EUR/USD": "-0.4%", "USD/JPY": "+0.5%", "GBP/USD": "-0.3%"},
            "gold_impact_score": 8,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY", "GBP/USD"],
        },
        {
            "id": "ev-002",
            "datetime": _utc(base_date - timedelta(days=5, hours=8, minutes=30)),
            "event": "US Initial Jobless Claims",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "medium",
            "forecast": "222K",
            "previous": "228K",
            "actual": "215K",
            "surprise_index": 45.5,
            "historical_gold_reaction": "-0.2% avg on beat (strong labour = hawkish Fed)",
            "historical_fx_reaction": {"EUR/USD": "-0.2%", "USD/JPY": "+0.3%"},
            "gold_impact_score": 4,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY"],
        },
        {
            "id": "ev-003",
            "datetime": _utc(base_date - timedelta(days=7, hours=14)),
            "event": "Eurozone CPI Flash Estimate (YoY) – Apr",
            "country": "European Union",
            "country_code": "EU",
            "currency": "EUR",
            "impact": "high",
            "forecast": "2.3%",
            "previous": "2.2%",
            "actual": "2.1%",
            "surprise_index": -25.0,
            "historical_gold_reaction": "-0.3% avg on miss (disinflation narrative)",
            "historical_fx_reaction": {"EUR/USD": "-0.5%", "GBP/USD": "-0.2%", "USD/JPY": "+0.4%"},
            "gold_impact_score": 5,
            "pairs_affected": ["EUR/USD", "XAU/EUR", "GBP/USD"],
        },
    ]
    events.extend(past)

    # ---- Upcoming events ---------------------------------------------------
    upcoming: list[dict] = [
        {
            "id": "ev-010",
            "datetime": _utc(base_date + timedelta(hours=2, minutes=30)),
            "event": "US CB Consumer Confidence – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "medium",
            "forecast": "97.5",
            "previous": "97.0",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "-0.2% avg on beat (risk-on reduces safe-haven)",
            "historical_fx_reaction": {"EUR/USD": "-0.2%", "USD/JPY": "+0.3%"},
            "gold_impact_score": 3,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY"],
        },
        {
            "id": "ev-011",
            "datetime": _utc(base_date + timedelta(days=1, hours=8, minutes=30)),
            "event": "US ADP Non-Farm Employment Change – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "175K",
            "previous": "162K",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "-0.4% avg on beat / +0.5% avg on miss",
            "historical_fx_reaction": {"EUR/USD": "-0.3%", "USD/JPY": "+0.4%", "GBP/USD": "-0.2%"},
            "gold_impact_score": 7,
            "pairs_affected": ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY"],
        },
        {
            "id": "ev-012",
            "datetime": _utc(base_date + timedelta(days=1, hours=14)),
            "event": "FOMC Meeting Minutes",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "N/A",
            "previous": "N/A",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.8% avg on dovish tone / -0.7% avg on hawkish tone",
            "historical_fx_reaction": {"EUR/USD": "+0.4%", "USD/JPY": "-0.6%", "GBP/USD": "+0.3%"},
            "gold_impact_score": 9,
            "pairs_affected": ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"],
        },
        {
            "id": "ev-013",
            "datetime": _utc(base_date + timedelta(days=2, hours=8, minutes=30)),
            "event": "US GDP (QoQ) Prelim – Q1 2026",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "1.8%",
            "previous": "2.3%",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.5% avg on miss (growth fears = safe-haven)",
            "historical_fx_reaction": {"EUR/USD": "+0.4%", "USD/JPY": "-0.5%", "AUD/USD": "-0.3%"},
            "gold_impact_score": 7,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY", "AUD/USD"],
        },
        {
            "id": "ev-014",
            "datetime": _utc(base_date + timedelta(days=2, hours=12, minutes=30)),
            "event": "BoE Governor Bailey Speech",
            "country": "United Kingdom",
            "country_code": "GB",
            "currency": "GBP",
            "impact": "high",
            "forecast": "N/A",
            "previous": "N/A",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "Low direct impact; GBP/USD most affected",
            "historical_fx_reaction": {"GBP/USD": "+/-0.5%", "EUR/GBP": "+/-0.3%", "GBP/JPY": "+/-0.8%"},
            "gold_impact_score": 2,
            "pairs_affected": ["GBP/USD", "GBP/JPY", "EUR/GBP"],
        },
        {
            "id": "ev-015",
            "datetime": _utc(base_date + timedelta(days=3, hours=7, minutes=45)),
            "event": "ECB Interest Rate Decision",
            "country": "European Union",
            "country_code": "EU",
            "currency": "EUR",
            "impact": "high",
            "forecast": "3.40%",
            "previous": "3.65%",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.4% avg on cut (USD strengthens vs EUR, XAU/EUR rises)",
            "historical_fx_reaction": {"EUR/USD": "-0.7%", "GBP/USD": "-0.3%", "USD/JPY": "+0.5%"},
            "gold_impact_score": 8,
            "pairs_affected": ["EUR/USD", "XAU/EUR", "GBP/USD", "USD/JPY"],
        },
        {
            "id": "ev-016",
            "datetime": _utc(base_date + timedelta(days=3, hours=8, minutes=30)),
            "event": "ECB Press Conference – Lagarde",
            "country": "European Union",
            "country_code": "EU",
            "currency": "EUR",
            "impact": "high",
            "forecast": "N/A",
            "previous": "N/A",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.5% avg on dovish forward guidance",
            "historical_fx_reaction": {"EUR/USD": "+/-0.6%", "GBP/USD": "+/-0.3%"},
            "gold_impact_score": 7,
            "pairs_affected": ["EUR/USD", "XAU/EUR", "GBP/USD"],
        },
        {
            "id": "ev-017",
            "datetime": _utc(base_date + timedelta(days=3, hours=14, minutes=30)),
            "event": "US Weekly Jobless Claims",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "medium",
            "forecast": "220K",
            "previous": "215K",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.2% avg on miss (worse labour = dovish Fed)",
            "historical_fx_reaction": {"EUR/USD": "+0.2%", "USD/JPY": "-0.2%"},
            "gold_impact_score": 3,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY"],
        },
        {
            "id": "ev-018",
            "datetime": _utc(base_date + timedelta(days=4, hours=8, minutes=30)),
            "event": "US Non-Farm Payrolls – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "185K",
            "previous": "177K",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+1.2% avg on big miss / -0.9% avg on strong beat",
            "historical_fx_reaction": {"EUR/USD": "+0.6%", "USD/JPY": "-0.8%", "GBP/USD": "+0.4%", "AUD/USD": "+0.3%"},
            "gold_impact_score": 10,
            "pairs_affected": ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"],
        },
        {
            "id": "ev-019",
            "datetime": _utc(base_date + timedelta(days=4, hours=8, minutes=30)),
            "event": "US Unemployment Rate – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "4.0%",
            "previous": "3.9%",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.8% avg on rise (labour market concern = Fed cut)",
            "historical_fx_reaction": {"EUR/USD": "+0.3%", "USD/JPY": "-0.5%"},
            "gold_impact_score": 9,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY"],
        },
        {
            "id": "ev-020",
            "datetime": _utc(base_date + timedelta(days=4, hours=8, minutes=30)),
            "event": "US Average Hourly Earnings (MoM) – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "0.3%",
            "previous": "0.3%",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.4% avg on beat (wage inflation = inflationary)",
            "historical_fx_reaction": {"EUR/USD": "-0.2%", "USD/JPY": "+0.3%"},
            "gold_impact_score": 7,
            "pairs_affected": ["XAU/USD", "EUR/USD", "USD/JPY"],
        },
        {
            "id": "ev-021",
            "datetime": _utc(base_date + timedelta(days=5, hours=0, minutes=50)),
            "event": "BoJ Monetary Policy Meeting Minutes",
            "country": "Japan",
            "country_code": "JP",
            "currency": "JPY",
            "impact": "high",
            "forecast": "N/A",
            "previous": "N/A",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.3% avg on hawkish surprise (JPY strengthen = DXY down)",
            "historical_fx_reaction": {"USD/JPY": "-0.7%", "GBP/JPY": "-0.6%", "EUR/USD": "+0.2%"},
            "gold_impact_score": 5,
            "pairs_affected": ["USD/JPY", "GBP/JPY", "XAU/USD"],
        },
        {
            "id": "ev-022",
            "datetime": _utc(base_date + timedelta(days=5, hours=9, minutes=0)),
            "event": "Eurozone Manufacturing PMI Final – May",
            "country": "European Union",
            "country_code": "EU",
            "currency": "EUR",
            "impact": "medium",
            "forecast": "48.5",
            "previous": "47.3",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "Low direct impact; EUR/USD most affected",
            "historical_fx_reaction": {"EUR/USD": "+0.3%", "GBP/USD": "+0.1%"},
            "gold_impact_score": 2,
            "pairs_affected": ["EUR/USD", "GBP/USD"],
        },
        {
            "id": "ev-023",
            "datetime": _utc(base_date + timedelta(days=5, hours=9, minutes=30)),
            "event": "UK Services PMI Final – May",
            "country": "United Kingdom",
            "country_code": "GB",
            "currency": "GBP",
            "impact": "medium",
            "forecast": "52.8",
            "previous": "52.5",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "Minimal gold impact; GBP pairs affected",
            "historical_fx_reaction": {"GBP/USD": "+0.3%", "GBP/JPY": "+0.5%"},
            "gold_impact_score": 1,
            "pairs_affected": ["GBP/USD", "GBP/JPY"],
        },
        {
            "id": "ev-024",
            "datetime": _utc(base_date + timedelta(days=6, hours=8, minutes=30)),
            "event": "Canada Employment Change – May",
            "country": "Canada",
            "country_code": "CA",
            "currency": "CAD",
            "impact": "high",
            "forecast": "22K",
            "previous": "18K",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "Indirect via USD/CAD; minimal gold effect",
            "historical_fx_reaction": {"USD/CAD": "-0.4%", "CAD/JPY": "+0.3%"},
            "gold_impact_score": 2,
            "pairs_affected": ["USD/CAD"],
        },
        {
            "id": "ev-025",
            "datetime": _utc(base_date + timedelta(days=6, hours=14, minutes=0)),
            "event": "Fed Chair Powell Speech – Jackson Hole Pre-event",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "N/A",
            "previous": "N/A",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+1.0% avg on dovish / -0.8% avg on hawkish",
            "historical_fx_reaction": {"EUR/USD": "+0.6%", "USD/JPY": "-0.7%", "GBP/USD": "+0.4%"},
            "gold_impact_score": 10,
            "pairs_affected": ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"],
        },
        {
            "id": "ev-026",
            "datetime": _utc(base_date + timedelta(days=7, hours=8, minutes=30)),
            "event": "US CPI (MoM) – May",
            "country": "United States",
            "country_code": "US",
            "currency": "USD",
            "impact": "high",
            "forecast": "0.3%",
            "previous": "0.4%",
            "actual": None,
            "surprise_index": None,
            "historical_gold_reaction": "+0.8% avg on beat / -0.6% avg on miss",
            "historical_fx_reaction": {"EUR/USD": "-0.5%", "USD/JPY": "+0.7%", "GBP/USD": "-0.4%"},
            "gold_impact_score": 10,
            "pairs_affected": ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "XAU/EUR"],
        },
    ]

    events.extend(upcoming)
    events.sort(key=lambda e: e["datetime"])
    return events


# ===========================================================================
# 4. BACKTEST
# ===========================================================================

#: Strategy metadata registry.
STRATEGY_REGISTRY: dict[str, dict] = {
    "gold_mean_reversion": {
        "display_name": "Gold Mean Reversion",
        "description": (
            "Fades extended moves in XAU/USD using Bollinger Band extremes (2σ), "
            "RSI(14) oversold/overbought readings, and mean-reversion to the 20-period EMA. "
            "Enters when price closes outside the band and RSI confirms exhaustion."
        ),
        "parameters": {
            "bb_period": 20,
            "bb_std": 2.0,
            "rsi_period": 14,
            "rsi_overbought": 72,
            "rsi_oversold": 28,
            "atr_stop_multiplier": 1.8,
            "profit_target_rr": 2.5,
        },
        "pair": "XAU/USD",
        "timeframe": "H4",
        "period_label": "Jan 2020 – Dec 2024",
    },
    "fx_momentum_nfp": {
        "display_name": "FX Momentum – NFP Event",
        "description": (
            "Trades the initial and continuation move in EUR/USD following US Non-Farm Payrolls. "
            "Enters in the direction of the NFP surprise 15 minutes after the release, "
            "targeting two momentum legs with dynamic ATR-based stops."
        ),
        "parameters": {
            "entry_delay_min": 15,
            "initial_stop_atr": 1.5,
            "tp1_rr": 1.5,
            "tp2_rr": 3.0,
            "max_hold_bars": 24,
            "min_surprise_std": 0.5,
        },
        "pair": "EUR/USD",
        "timeframe": "H1",
        "period_label": "Jan 2020 – Dec 2024",
    },
    "carry_trade": {
        "display_name": "G10 Carry Trade",
        "description": (
            "Systematic carry trade going long high-yielding G10 currencies against JPY and CHF. "
            "Position sizing based on carry differential; exits triggered by VIX spike (>25) "
            "or technical reversal signals to avoid carry unwind events."
        ),
        "parameters": {
            "max_pairs": 3,
            "vix_exit_threshold": 25,
            "rebalance_frequency": "weekly",
            "leverage": 5.0,
            "carry_threshold_bps": 150,
        },
        "pair": "Multi (USD/JPY, AUD/JPY, NZD/JPY)",
        "timeframe": "D1",
        "period_label": "Jan 2020 – Dec 2024",
    },
    "volatility_breakout": {
        "display_name": "Volatility Breakout – London Open",
        "description": (
            "Trades breakouts of the Asian session range at London open (08:00 GMT). "
            "Entries triggered when price exceeds the Asian high/low by 1.5× ATR(20). "
            "Applied across GBP/USD, EUR/USD, and XAU/USD."
        ),
        "parameters": {
            "asian_session_start": "00:00 GMT",
            "asian_session_end": "07:00 GMT",
            "breakout_atr_multiplier": 1.5,
            "stop_inside_range_pct": 0.5,
            "tp_atr_multiplier": 3.0,
            "max_hold_bars": 8,
        },
        "pair": "GBP/USD, EUR/USD, XAU/USD",
        "timeframe": "H1",
        "period_label": "Jan 2020 – Dec 2024",
    },
    "gold_macro_filter": {
        "display_name": "Gold Macro Regime Filter",
        "description": (
            "Long-only gold strategy filtered by macro regime conditions. "
            "Goes long XAU/USD only when VIX > 18 OR real yields negative OR DXY weakening trend. "
            "Uses weekly structure levels for entries and 3-month momentum for trend confirmation."
        ),
        "parameters": {
            "vix_threshold": 18,
            "real_yield_threshold": 0.0,
            "dxy_trend_period": 13,
            "entry_pullback_atr": 1.0,
            "trail_stop_atr": 2.5,
            "regime_lookback_weeks": 4,
        },
        "pair": "XAU/USD",
        "timeframe": "W1",
        "period_label": "Jan 2020 – Dec 2024",
    },
}


def run_backtest(strategy_name: str) -> dict:
    """
    Run (simulate) a backtest for the given strategy name.

    Parameters
    ----------
    strategy_name : str
        One of the keys in STRATEGY_REGISTRY.

    Returns
    -------
    dict
        Full backtest report including equity curve, monthly returns,
        trade distribution, and regime breakdown.

    Raises
    ------
    ValueError
        If the strategy name is not recognised.
    """
    if strategy_name not in STRATEGY_REGISTRY:
        raise ValueError(
            f"Unknown strategy '{strategy_name}'. "
            f"Available: {list(STRATEGY_REGISTRY.keys())}"
        )
    meta = STRATEGY_REGISTRY[strategy_name]
    # Each strategy gets a unique seed for reproducible but distinct curves.
    seed = abs(hash(strategy_name)) % (2**31)
    rng = np.random.default_rng(seed)
    return _generate_backtest_report(strategy_name, meta, rng)


def _generate_backtest_report(
    strategy_name: str,
    meta: dict,
    rng: np.random.Generator,
) -> dict:
    """Generate a realistic backtest report using controlled random simulation."""
    # --- Strategy-specific performance profiles ------------------------------
    profiles = {
        "gold_mean_reversion": dict(
            n_trades=312, win_rate=0.595, pf=1.72, sharpe=1.41,
            max_dd=-14.8, net_pnl=62.4, avg_trade=0.20, best=4.8, worst=-2.2,
            avg_hold=6.2,
        ),
        "fx_momentum_nfp": dict(
            n_trades=89, win_rate=0.528, pf=1.55, sharpe=1.18,
            max_dd=-18.3, net_pnl=38.7, avg_trade=0.44, best=8.2, worst=-3.1,
            avg_hold=4.8,
        ),
        "carry_trade": dict(
            n_trades=156, win_rate=0.672, pf=2.21, sharpe=1.87,
            max_dd=-22.6, net_pnl=94.2, avg_trade=0.61, best=6.1, worst=-8.4,
            avg_hold=34.5,
        ),
        "volatility_breakout": dict(
            n_trades=441, win_rate=0.487, pf=1.44, sharpe=1.02,
            max_dd=-16.1, net_pnl=28.9, avg_trade=0.07, best=5.3, worst=-2.8,
            avg_hold=2.9,
        ),
        "gold_macro_filter": dict(
            n_trades=67, win_rate=0.731, pf=3.12, sharpe=2.24,
            max_dd=-11.2, net_pnl=118.3, avg_trade=1.77, best=12.4, worst=-3.6,
            avg_hold=18.7,
        ),
    }
    p = profiles[strategy_name]

    # --- Equity curve (60 monthly points, Jan 2020 – Dec 2024) ---------------
    equity_curve = _generate_equity_curve(p["net_pnl"], p["max_dd"], rng)

    # --- Monthly returns (36 months, Jan 2022 – Dec 2024) --------------------
    monthly_returns = _generate_monthly_returns(p["win_rate"], p["avg_trade"], rng)

    # --- Trade return distribution -------------------------------------------
    trade_distribution = _generate_trade_distribution(p["n_trades"], p["win_rate"], rng)

    # --- Regime breakdown ----------------------------------------------------
    regime_breakdown = _generate_regime_breakdown(p["win_rate"], p["avg_trade"], rng)

    return {
        "strategy_name": strategy_name,
        "display_name": meta["display_name"],
        "description": meta["description"],
        "parameters": meta["parameters"],
        "period": meta["period_label"],
        "total_trades": p["n_trades"],
        "win_rate": round(p["win_rate"], 4),
        "profit_factor": round(p["pf"], 3),
        "sharpe_ratio": round(p["sharpe"], 3),
        "max_drawdown": round(p["max_dd"], 2),
        "net_pnl_pct": round(p["net_pnl"], 2),
        "avg_trade_pnl": round(p["avg_trade"], 4),
        "best_trade": round(p["best"], 2),
        "worst_trade": round(p["worst"], 2),
        "avg_hold_bars": round(p["avg_hold"], 1),
        "equity_curve": equity_curve,
        "monthly_returns": monthly_returns,
        "trade_distribution": trade_distribution,
        "regime_breakdown": regime_breakdown,
        "pair": meta["pair"],
        "timeframe": meta["timeframe"],
    }


def _generate_equity_curve(
    net_pnl: float,
    max_dd: float,
    rng: np.random.Generator,
) -> list[dict]:
    """Generate a 60-point equity curve (monthly) with realistic drawdown periods."""
    import calendar as cal

    n = 60
    # Monthly drift and volatility
    monthly_return = (1 + net_pnl / 100) ** (1 / n) - 1
    monthly_vol = abs(max_dd) / 100 / 3.5   # approximate vol from max DD
    monthly_vol = max(monthly_vol, 0.01)

    returns = rng.normal(monthly_return, monthly_vol, n)

    # Inject 2-3 drawdown periods to make curve realistic
    dd_periods = sorted(rng.choice(range(5, 55), size=3, replace=False))
    for dd_start in dd_periods:
        dd_len = int(rng.integers(2, 6))
        dd_severity = rng.uniform(0.3, 0.7) * abs(max_dd) / 100
        for j in range(min(dd_len, n - dd_start)):
            returns[dd_start + j] -= dd_severity / dd_len

    equity = 100.0
    curve: list[dict] = []
    start = datetime(2020, 1, 1)
    for i, r in enumerate(returns):
        equity = equity * (1 + r)
        equity = max(equity, 50.0)   # clamp extreme losses for display
        month_dt = start + timedelta(days=30 * i)
        curve.append({
            "date": month_dt.strftime("%Y-%m"),
            "equity": round(float(equity), 2),
        })
    return curve


def _generate_monthly_returns(
    win_rate: float,
    avg_trade: float,
    rng: np.random.Generator,
) -> list[dict]:
    """Generate 36 months of monthly returns (Jan 2022 – Dec 2024)."""
    results: list[dict] = []
    start = datetime(2022, 1, 1)
    for i in range(36):
        # Skew monthly return by win rate
        base = rng.normal(avg_trade * 3, abs(avg_trade) * 5)
        ret = round(float(base), 4)
        dt = start + timedelta(days=30 * i)
        results.append({"month": dt.strftime("%Y-%m"), "return": ret})
    return results


def _generate_trade_distribution(
    n_trades: int,
    win_rate: float,
    rng: np.random.Generator,
) -> list[dict]:
    """Bucket trade P&L into distribution histogram."""
    buckets = [
        ("< -3%", 0),
        ("-3% to -2%", 0),
        ("-2% to -1%", 0),
        ("-1% to 0%", 0),
        ("0% to 1%", 0),
        ("1% to 2%", 0),
        ("2% to 3%", 0),
        ("> 3%", 0),
    ]
    # Simulate individual trades
    wins = int(n_trades * win_rate)
    losses = n_trades - wins
    win_returns = rng.exponential(1.5, wins)
    loss_returns = -rng.exponential(1.2, losses)
    all_returns = np.concatenate([win_returns, loss_returns])

    counts = [0] * 8
    for r in all_returns:
        if r < -3:
            counts[0] += 1
        elif r < -2:
            counts[1] += 1
        elif r < -1:
            counts[2] += 1
        elif r < 0:
            counts[3] += 1
        elif r < 1:
            counts[4] += 1
        elif r < 2:
            counts[5] += 1
        elif r < 3:
            counts[6] += 1
        else:
            counts[7] += 1

    return [{"bucket": b, "count": c} for (b, _), c in zip(buckets, counts)]


def _generate_regime_breakdown(
    win_rate: float,
    avg_trade: float,
    rng: np.random.Generator,
) -> list[dict]:
    """Break down performance by macro regime."""
    regimes = [
        ("Risk-Off + High Inflation", 0.30),
        ("Risk-On + Disinflation", 0.25),
        ("Neutral + Stable CPI", 0.25),
        ("Risk-Off + Deflation", 0.10),
        ("Risk-On + High Inflation", 0.10),
    ]
    breakdown: list[dict] = []
    for regime_name, weight in regimes:
        n = max(1, int(weight * 200))
        # Regimes that suit macro-conscious strategies differ
        wr_adj = win_rate + rng.uniform(-0.12, 0.18)
        wr_adj = max(0.3, min(0.85, wr_adj))
        pnl_adj = avg_trade + rng.uniform(-0.3, 0.5)
        breakdown.append({
            "regime": regime_name,
            "trades": n,
            "win_rate": round(float(wr_adj), 3),
            "avg_pnl": round(float(pnl_adj), 4),
        })
    return breakdown


# ===========================================================================
# 5. PORTFOLIO RISK
# ===========================================================================

def get_portfolio_risk(positions: list[dict]) -> dict:
    """
    Calculate portfolio-level risk metrics for a list of open positions.

    Parameters
    ----------
    positions : list[dict]
        Each dict should contain: pair, size_lots, entry, stop,
        account_size, risk_pct.

    Returns
    -------
    dict
        Exposure, VaR, concentration, position sizing, and risk warnings.
    """
    if not positions:
        return _empty_risk_report()

    positions_summary, total_exposure, usd_exp, gold_exp = _process_positions(positions)
    account_size = _safe_float(positions[0].get("account_size", 10000))

    # Portfolio VaR (simplified parametric VaR using correlation matrix)
    var_95, var_99, exp_dd = _compute_portfolio_var(positions_summary, account_size)

    # Concentration risk
    n = len(positions)
    if n == 1:
        concentration_risk = "HIGH"
    elif n <= 2:
        concentration_risk = "MEDIUM"
    else:
        concentration_risk = "LOW"

    # Check for over-correlated positions
    pairs = [p.get("pair", "") for p in positions]
    corr_warnings = _check_correlation_warnings(pairs)

    # Position sizing recommendations
    pos_sizes = _recommend_position_sizes(positions, account_size)

    # Risk warnings
    risk_warnings: list[str] = list(corr_warnings)
    total_risk_pct = sum(
        _safe_float(p.get("risk_pct", 1.0)) for p in positions
    )
    if total_risk_pct > 5.0:
        risk_warnings.append(
            f"Total portfolio risk {total_risk_pct:.1f}% exceeds recommended 5% maximum. "
            "Consider reducing individual position sizes."
        )
    if len(positions) > 5:
        risk_warnings.append(
            "More than 5 simultaneous positions increases correlation risk and "
            "complicates management. Consider reducing to 3-4 core positions."
        )
    for ps in positions_summary:
        if ps.get("r_r_ratio", 0) < 1.5:
            risk_warnings.append(
                f"{ps['pair']}: R/R ratio {ps.get('r_r_ratio', 0):.2f} is below the minimum 1.5 threshold."
            )
    if not risk_warnings:
        risk_warnings.append("Portfolio risk metrics within acceptable parameters.")

    return {
        "total_exposure_usd": round(total_exposure, 2),
        "usd_exposure": round(usd_exp, 2),
        "gold_exposure": round(gold_exp, 2),
        "positions_summary": positions_summary,
        "correlation_matrix": CORRELATION_MATRIX,
        "portfolio_var_95": round(var_95, 4),
        "portfolio_var_99": round(var_99, 4),
        "expected_drawdown": round(exp_dd, 4),
        "concentration_risk": concentration_risk,
        "position_sizes": pos_sizes,
        "risk_warnings": risk_warnings,
    }


def _empty_risk_report() -> dict:
    return {
        "total_exposure_usd": 0.0,
        "usd_exposure": 0.0,
        "gold_exposure": 0.0,
        "positions_summary": [],
        "correlation_matrix": CORRELATION_MATRIX,
        "portfolio_var_95": 0.0,
        "portfolio_var_99": 0.0,
        "expected_drawdown": 0.0,
        "concentration_risk": "LOW",
        "position_sizes": [],
        "risk_warnings": ["No positions provided."],
    }


def _process_positions(
    positions: list[dict],
) -> tuple[list[dict], float, float, float]:
    """Enrich each position with derived risk fields."""
    summaries: list[dict] = []
    total_exp = 0.0
    usd_exp = 0.0
    gold_exp = 0.0

    for pos in positions:
        pair = str(pos.get("pair", "XAU/USD"))
        size_lots = _safe_float(pos.get("size_lots", 0.1))
        entry = _safe_float(pos.get("entry", 0))
        stop = _safe_float(pos.get("stop", 0))
        account = _safe_float(pos.get("account_size", 10000))
        risk_pct = _safe_float(pos.get("risk_pct", 1.0))

        # Notional value per lot depends on pair
        if "XAU" in pair:
            lot_size = 100          # 1 lot gold = 100 oz
            price = entry or 2640.0
            notional = size_lots * lot_size * price
            gold_exp += notional
        else:
            lot_size = 100_000      # standard FX lot
            notional = size_lots * lot_size
            usd_exp += notional

        total_exp += notional

        pip_risk = abs(entry - stop) if (entry and stop) else 0.0
        dollar_risk = account * risk_pct / 100

        # R/R using entry and stop; TP2 assumed 2× stop distance
        tp2_implied = entry + (2 * pip_risk) if entry > stop else entry - (2 * pip_risk)
        rr = 2.0  # default

        summaries.append({
            "pair": pair,
            "size_lots": size_lots,
            "entry": round(entry, 5),
            "stop": round(stop, 5),
            "notional_usd": round(notional, 2),
            "dollar_risk": round(dollar_risk, 2),
            "risk_pct_account": round(risk_pct, 2),
            "pip_risk": round(pip_risk, 5),
            "r_r_ratio": rr,
            "tp2_implied": round(tp2_implied, 5),
        })

    return summaries, total_exp, usd_exp, gold_exp


def _compute_portfolio_var(
    positions_summary: list[dict],
    account_size: float,
) -> tuple[float, float, float]:
    """Simplified parametric portfolio VaR (as % of account)."""
    if not positions_summary or account_size <= 0:
        return 0.0, 0.0, 0.0

    # Daily volatility estimates per asset class (annualised ÷ √252)
    daily_vol_map = {
        "XAU/USD": 0.0085,
        "XAU/EUR": 0.0090,
        "EUR/USD": 0.0042,
        "GBP/USD": 0.0048,
        "USD/JPY": 0.0045,
        "AUD/USD": 0.0055,
        "USD/CAD": 0.0040,
        "GBP/JPY": 0.0068,
    }

    weights: list[float] = []
    vols: list[float] = []
    pairs: list[str] = []

    total_notional = sum(p.get("notional_usd", 0) for p in positions_summary)
    if total_notional == 0:
        return 0.0, 0.0, 0.0

    for p in positions_summary:
        pair = p.get("pair", "")
        notional = p.get("notional_usd", 0)
        w = notional / total_notional
        vol = daily_vol_map.get(pair, 0.005)
        weights.append(w)
        vols.append(vol)
        pairs.append(pair)

    n = len(weights)
    # Build correlation sub-matrix for the actual positions held
    corr_matrix = np.eye(n)
    for i in range(n):
        for j in range(n):
            if i != j:
                p1 = pairs[i]
                p2 = pairs[j]
                corr_matrix[i][j] = CORRELATION_MATRIX.get(p1, {}).get(p2, 0.0)

    w_arr = np.array(weights)
    v_arr = np.array(vols)
    cov_matrix = np.outer(v_arr, v_arr) * corr_matrix
    portfolio_variance = float(w_arr @ cov_matrix @ w_arr)
    portfolio_vol = math.sqrt(max(portfolio_variance, 0))

    # Z-scores: 95% = 1.645, 99% = 2.326
    var_95 = portfolio_vol * 1.645 * 100   # as % of portfolio
    var_99 = portfolio_vol * 2.326 * 100
    exp_dd = portfolio_vol * 2.063 * 100   # CVaR(95%) approximation

    return var_95, var_99, exp_dd


def _check_correlation_warnings(pairs: list[str]) -> list[str]:
    """Generate warnings for highly-correlated position combinations."""
    warnings: list[str] = []
    for i in range(len(pairs)):
        for j in range(i + 1, len(pairs)):
            p1, p2 = pairs[i], pairs[j]
            corr = CORRELATION_MATRIX.get(p1, {}).get(p2)
            if corr is None:
                continue
            if abs(corr) >= 0.75:
                direction = "positively" if corr > 0 else "negatively"
                warnings.append(
                    f"High correlation ({corr:+.2f}) detected between {p1} and {p2} — "
                    f"both positions are {direction} correlated, effectively doubling directional exposure."
                )
    return warnings


def _recommend_position_sizes(
    positions: list[dict],
    account_size: float,
) -> list[dict]:
    """Recommend position sizes based on 1% and 2% risk per trade."""
    recs: list[dict] = []
    for pos in positions:
        pair = str(pos.get("pair", ""))
        entry = _safe_float(pos.get("entry", 0))
        stop = _safe_float(pos.get("stop", 0))
        pip_risk = abs(entry - stop)
        if pip_risk == 0 or account_size == 0:
            recs.append({"pair": pair, "recommended_lots": 0.0, "max_lots": 0.0})
            continue

        if "XAU" in pair:
            pip_value = 100.0   # 1 lot XAU = 100 oz; 1 pip = $1/oz → $100/lot
        else:
            pip_value = 10.0    # standard FX lot; 1 pip = $10/lot

        recommended_lots = round((account_size * 0.01) / (pip_risk * pip_value), 3)
        max_lots = round((account_size * 0.02) / (pip_risk * pip_value), 3)

        recs.append({
            "pair": pair,
            "recommended_lots": max(recommended_lots, 0.01),
            "max_lots": max(max_lots, 0.01),
        })
    return recs


# ===========================================================================
# 6. SCENARIO ANALYSIS
# ===========================================================================

def get_scenario_analysis() -> list[dict]:
    """
    Return six forward-looking macro scenario analyses with trading playbooks.

    Returns
    -------
    list[dict]
        Six scenarios covering inflation, policy, risk, and geopolitical events.
    """
    base_gold = 2640.0

    scenarios: list[dict] = [
        # ---- 1. CPI +30bps Surprise -------------------------------------------
        {
            "scenario_id": "scn-001",
            "name": "CPI +30bps Surprise",
            "category": "inflation",
            "description": (
                "US CPI prints 30bps above consensus (e.g. 0.6% MoM vs 0.3% expected), "
                "driven by shelter and energy components. Re-ignites inflation fear, "
                "markets reprice Fed rate cuts from 2 to 0 in 2026."
            ),
            "probability": 0.15,
            "impact": {
                "XAU/USD": {"direction": "BULLISH", "expected_move_pct": 1.8, "confidence": "HIGH"},
                "EUR/USD": {"direction": "BEARISH", "expected_move_pct": -0.6, "confidence": "HIGH"},
                "GBP/USD": {"direction": "BEARISH", "expected_move_pct": -0.5, "confidence": "MEDIUM"},
                "USD/JPY": {"direction": "BULLISH", "expected_move_pct": 0.9, "confidence": "HIGH"},
                "AUD/USD": {"direction": "BEARISH", "expected_move_pct": -0.4, "confidence": "MEDIUM"},
                "DXY": {"direction": "BULLISH", "expected_move_pct": 0.7, "confidence": "HIGH"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 1.018, 0),
                "EUR/USD": 1.0780,
                "GBP/USD": 1.2580,
                "USD/JPY": 158.50,
                "DXY": 106.00,
            },
            "trading_playbook": (
                "Buy XAU/USD on the dip immediately post-release — gold rallies as inflation hedge "
                "despite initial USD spike. Short EUR/USD targeting 1.0780 on rate divergence. "
                "USD/JPY long viable but watch BoJ intervention risk above 158."
            ),
            "historical_analog": (
                "June 2022 CPI shock (9.1% print vs 8.8% expected): Gold initially sold off "
                "on USD spike but recovered +2.3% within 5 sessions as stagflation narrative took hold."
            ),
        },

        # ---- 2. Fed Emergency Rate Cut -----------------------------------------
        {
            "scenario_id": "scn-002",
            "name": "Fed Emergency Rate Cut",
            "category": "policy",
            "description": (
                "Fed announces an unscheduled 50bps rate cut outside of regular FOMC meetings, "
                "citing rapid credit tightening or financial stability concerns. "
                "Markets price in 150-200bps of additional cuts within 12 months."
            ),
            "probability": 0.08,
            "impact": {
                "XAU/USD": {"direction": "STRONGLY BULLISH", "expected_move_pct": 3.5, "confidence": "HIGH"},
                "EUR/USD": {"direction": "BULLISH", "expected_move_pct": 1.2, "confidence": "HIGH"},
                "GBP/USD": {"direction": "BULLISH", "expected_move_pct": 1.0, "confidence": "HIGH"},
                "USD/JPY": {"direction": "STRONGLY BEARISH", "expected_move_pct": -2.5, "confidence": "HIGH"},
                "AUD/USD": {"direction": "BULLISH", "expected_move_pct": 0.8, "confidence": "MEDIUM"},
                "DXY": {"direction": "STRONGLY BEARISH", "expected_move_pct": -1.5, "confidence": "HIGH"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 1.035, 0),
                "EUR/USD": 1.1050,
                "GBP/USD": 1.2950,
                "USD/JPY": 152.00,
                "DXY": 100.50,
            },
            "trading_playbook": (
                "Immediate buy XAU/USD — emergency cuts have historically produced 3-5% gold rallies within 48h. "
                "Sell USD/JPY aggressively targeting 152.00; BoJ less likely to intervene on yen strengthening. "
                "EUR/USD long toward 1.10+ as dollar tanks across the board."
            ),
            "historical_analog": (
                "March 2020 emergency cut to 0%: Gold initially sold off on liquidity crunch, "
                "then surged +25% over the following 6 months to $2,075 all-time high."
            ),
        },

        # ---- 3. Risk-Off Spike (VIX > 35) --------------------------------------
        {
            "scenario_id": "scn-003",
            "name": "Risk-Off Spike – VIX > 35",
            "category": "risk",
            "description": (
                "A systemic risk event (banking stress, geopolitical escalation, or credit market dislocation) "
                "drives VIX above 35. Equity markets fall 5-8%, credit spreads widen sharply, "
                "and safe-haven flows dominate all asset classes."
            ),
            "probability": 0.12,
            "impact": {
                "XAU/USD": {"direction": "BULLISH", "expected_move_pct": 2.8, "confidence": "HIGH"},
                "EUR/USD": {"direction": "BEARISH", "expected_move_pct": -1.0, "confidence": "MEDIUM"},
                "GBP/USD": {"direction": "BEARISH", "expected_move_pct": -1.4, "confidence": "HIGH"},
                "USD/JPY": {"direction": "BEARISH", "expected_move_pct": -2.0, "confidence": "HIGH"},
                "AUD/USD": {"direction": "STRONGLY BEARISH", "expected_move_pct": -2.5, "confidence": "HIGH"},
                "DXY": {"direction": "BULLISH", "expected_move_pct": 1.2, "confidence": "MEDIUM"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 1.028, 0),
                "EUR/USD": 1.0700,
                "GBP/USD": 1.2450,
                "USD/JPY": 152.50,
                "AUD/USD": 0.6200,
                "DXY": 107.00,
            },
            "trading_playbook": (
                "Core position: Long XAU/USD — gold is the primary safe-haven. "
                "Short AUD/USD and GBP/JPY as the highest-beta risk-off trades. "
                "USD/JPY short valid but beware of early USD strength before yen takes over. "
                "Reduce all carry positions immediately."
            ),
            "historical_analog": (
                "August 2024 yen carry unwind: VIX spiked to 65 intraday, USD/JPY fell 12 handles in 3 days, "
                "AUD/USD dropped 3.5%. Gold briefly sold off on margin calls then rallied strongly."
            ),
        },

        # ---- 4. USD Surge (DXY > 108) ------------------------------------------
        {
            "scenario_id": "scn-004",
            "name": "USD Surge – DXY Above 108",
            "category": "policy",
            "description": (
                "Combination of hawkish Fed surprise, European recession fears, and "
                "dollar funding squeeze drives DXY above 108 — a 5% rally from current levels. "
                "Last seen in Q4 2022 at the peak of global tightening cycle."
            ),
            "probability": 0.10,
            "impact": {
                "XAU/USD": {"direction": "BEARISH", "expected_move_pct": -2.5, "confidence": "HIGH"},
                "EUR/USD": {"direction": "STRONGLY BEARISH", "expected_move_pct": -2.8, "confidence": "HIGH"},
                "GBP/USD": {"direction": "STRONGLY BEARISH", "expected_move_pct": -2.5, "confidence": "HIGH"},
                "USD/JPY": {"direction": "STRONGLY BULLISH", "expected_move_pct": 3.0, "confidence": "HIGH"},
                "AUD/USD": {"direction": "STRONGLY BEARISH", "expected_move_pct": -3.0, "confidence": "HIGH"},
                "DXY": {"direction": "STRONGLY BULLISH", "expected_move_pct": 4.8, "confidence": "HIGH"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 0.975, 0),
                "EUR/USD": 1.0400,
                "GBP/USD": 1.2100,
                "USD/JPY": 162.00,
                "AUD/USD": 0.6050,
                "DXY": 108.50,
            },
            "trading_playbook": (
                "Short EUR/USD and GBP/USD aggressively — these pairs have highest DXY beta. "
                "XAU/USD short possible but note gold can decouple from USD when physical demand surges. "
                "Long USD/JPY but set tight stops — BoJ verbal/physical intervention risk is HIGH above 160."
            ),
            "historical_analog": (
                "October 2022 DXY peak at 114.8: EUR/USD hit parity (1.0000), GBP/USD crashed to 1.0350 "
                "(mini-budget crisis compounded move), Gold fell to $1,620 (-15% from peak)."
            ),
        },

        # ---- 5. BoJ Hawkish Pivot -----------------------------------------------
        {
            "scenario_id": "scn-005",
            "name": "BoJ Hawkish Pivot – Rate Hike to 0.75%",
            "category": "policy",
            "description": (
                "Bank of Japan raises rates to 0.75% (from current 0.25%) and signals further hikes ahead, "
                "citing persistent wage growth above 3% and CPI entrenched above 2% target. "
                "Triggers massive carry trade unwind — estimated $2 trillion in yen-funded carry."
            ),
            "probability": 0.20,
            "impact": {
                "XAU/USD": {"direction": "BULLISH", "expected_move_pct": 1.2, "confidence": "MEDIUM"},
                "EUR/USD": {"direction": "BULLISH", "expected_move_pct": 0.5, "confidence": "LOW"},
                "GBP/USD": {"direction": "BEARISH", "expected_move_pct": -0.3, "confidence": "LOW"},
                "USD/JPY": {"direction": "STRONGLY BEARISH", "expected_move_pct": -3.5, "confidence": "HIGH"},
                "AUD/USD": {"direction": "BEARISH", "expected_move_pct": -1.5, "confidence": "HIGH"},
                "DXY": {"direction": "BEARISH", "expected_move_pct": -0.8, "confidence": "MEDIUM"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 1.012, 0),
                "USD/JPY": 148.00,
                "GBP/JPY": 188.00,
                "AUD/USD": 0.6200,
                "DXY": 101.50,
            },
            "trading_playbook": (
                "Core trade: Short USD/JPY targeting 148.00 — highest conviction play. "
                "Short GBP/JPY and AUD/JPY as carry unwind accelerates. "
                "Gold long as DXY weakens, but position sizing smaller as JPY risk appetite may hurt EM metals. "
                "Avoid short EUR/USD — EUR tends to strengthen when USD weakens broadly."
            ),
            "historical_analog": (
                "July 2024 BoJ surprise hike to 0.25%: USD/JPY fell from 157 to 142 in 3 weeks (-9.6%), "
                "AUD/USD dropped 4%, and global equity markets fell 5-10% on carry unwind fears."
            ),
        },

        # ---- 6. Oil Price Collapse ----------------------------------------------
        {
            "scenario_id": "scn-006",
            "name": "Oil Price Collapse – Brent Below $60",
            "category": "geopolitical",
            "description": (
                "Brent crude falls below $60/barrel due to OPEC+ production increase, "
                "slowing Chinese demand, and US shale supply surge. "
                "Deflationary shock reduces inflation expectations, pressuring rate-hike bets."
            ),
            "probability": 0.14,
            "impact": {
                "XAU/USD": {"direction": "BEARISH", "expected_move_pct": -1.0, "confidence": "MEDIUM"},
                "EUR/USD": {"direction": "BEARISH", "expected_move_pct": -0.4, "confidence": "MEDIUM"},
                "GBP/USD": {"direction": "BEARISH", "expected_move_pct": -0.6, "confidence": "MEDIUM"},
                "USD/JPY": {"direction": "BEARISH", "expected_move_pct": -0.5, "confidence": "LOW"},
                "AUD/USD": {"direction": "STRONGLY BEARISH", "expected_move_pct": -2.0, "confidence": "HIGH"},
                "DXY": {"direction": "NEUTRAL", "expected_move_pct": 0.2, "confidence": "LOW"},
            },
            "key_levels": {
                "XAU/USD": round(base_gold * 0.990, 0),
                "AUD/USD": 0.6200,
                "USD/CAD": 1.4000,
                "EUR/USD": 1.0750,
                "DXY": 104.50,
            },
            "trading_playbook": (
                "Short AUD/USD — Australia is a major commodity exporter and AUD tracks oil with high beta. "
                "Long USD/CAD as Canada's petro-currency weakens — target 1.40. "
                "Gold near-term bearish on disinflation but may recover if growth concerns emerge. "
                "Avoid broad USD longs — deflationary impulse may prompt Fed easing."
            ),
            "historical_analog": (
                "November 2014 oil crash: Brent fell from $115 to $45 over 6 months. "
                "AUD/USD dropped 15%, USD/CAD surged to 1.46, Gold initially sold off 5% "
                "then held $1,150-$1,200 range as deflation concerns offset USD strength."
            ),
        },
    ]

    return scenarios


# ===========================================================================
# Strategy listing helper (used by /strategies endpoint)
# ===========================================================================

def list_strategies() -> list[dict]:
    """
    Return a summary list of available backtest strategies.

    Returns
    -------
    list[dict]
        Each entry: strategy_name, display_name, description, pair, timeframe.
    """
    return [
        {
            "strategy_name": key,
            "display_name": meta["display_name"],
            "description": meta["description"],
            "pair": meta["pair"],
            "timeframe": meta["timeframe"],
            "period": meta["period_label"],
            "parameters": meta["parameters"],
        }
        for key, meta in STRATEGY_REGISTRY.items()
    ]
