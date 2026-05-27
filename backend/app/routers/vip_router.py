"""
vip_router.py
=============
FastAPI router for the Gold & Forex Quant Edge VIP Dashboard.

All routes live under the ``/api/vip`` prefix.  Heavy service calls are
wrapped in a thread-pool executor so they never block the async event loop.

Caching strategy (TTLCache via cachetools):
  - /regime   → 5 minutes  (macro regime changes slowly)
  - /signals  → 1 minute   (signals update on each bar close)
  - /calendar → 15 minutes (calendar events rarely change mid-session)
  - /scenarios→ 1 hour     (scenario probabilities are quasi-static)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from cachetools import TTLCache
from fastapi import APIRouter, Body, HTTPException, Path, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.services import vip_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Caches  (all with maxsize=32; VIP endpoints have low cardinality)
# ---------------------------------------------------------------------------

_regime_cache: TTLCache = TTLCache(maxsize=4, ttl=300)     # 5 min
_signals_cache: TTLCache = TTLCache(maxsize=4, ttl=60)     # 1 min
_calendar_cache: TTLCache = TTLCache(maxsize=4, ttl=900)   # 15 min
_scenarios_cache: TTLCache = TTLCache(maxsize=4, ttl=3600) # 1 hour
_backtest_cache: TTLCache = TTLCache(maxsize=32, ttl=3600) # 1 hour (strategy-keyed)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/vip", tags=["VIP – Gold & Forex Quant Edge"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class PositionIn(BaseModel):
    """A single open trading position for risk analysis."""

    pair: str = Field(
        default="XAU/USD",
        examples=["XAU/USD", "EUR/USD", "GBP/USD"],
        description="Currency or commodity pair.",
    )
    size_lots: float = Field(
        default=0.1,
        ge=0.01,
        le=100.0,
        description="Position size in standard lots.",
    )
    entry: float = Field(
        default=2620.0,
        gt=0,
        description="Entry price.",
    )
    stop: float = Field(
        default=2580.0,
        gt=0,
        description="Stop-loss price.",
    )
    account_size: float = Field(
        default=10_000.0,
        gt=0,
        description="Total account equity in USD.",
    )
    risk_pct: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Risk allocated to this trade as a percentage of account equity.",
    )

    @field_validator("pair")
    @classmethod
    def validate_pair(cls, v: str) -> str:
        v = v.strip().upper()
        if "/" not in v or len(v) < 6:
            raise ValueError(f"Invalid pair format: '{v}'. Expected format: 'XXX/YYY'.")
        return v

    @field_validator("stop")
    @classmethod
    def stop_must_differ_from_entry(cls, v: float, info: Any) -> float:
        entry = info.data.get("entry")
        if entry is not None and abs(v - entry) < 1e-8:
            raise ValueError("stop_loss must differ from entry price.")
        return v


class RiskRequest(BaseModel):
    """Request body for the portfolio risk endpoint."""

    positions: list[PositionIn] = Field(
        min_length=1,
        max_length=20,
        description="List of open positions to analyse.",
    )


# ---------------------------------------------------------------------------
# Internal async helpers
# ---------------------------------------------------------------------------

async def _run_in_executor(fn, *args):
    """Run a synchronous function in the default thread-pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


def _cache_get(cache: TTLCache, key: str) -> Any:
    return cache.get(key)


def _cache_set(cache: TTLCache, key: str, value: Any) -> None:
    try:
        cache[key] = value
    except ValueError:
        pass  # cache full edge-case


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/regime",
    summary="Market Regime Detection",
    response_description="Current macro regime with risk, inflation, and USD cycle scores.",
)
async def get_regime() -> JSONResponse:
    """
    Detect the current macro market regime using VIX, DXY, and inflation-breakeven proxies.

    Fetches live data from yfinance when available; falls back to realistic mock data.

    **Cached for 5 minutes.**
    """
    cache_key = "regime"
    cached = _cache_get(_regime_cache, cache_key)
    if cached is not None:
        logger.debug("Serving regime from cache")
        return JSONResponse(content={"status": "ok", "cached": True, "data": cached})

    try:
        result = await _run_in_executor(vip_service.get_market_regime)
    except Exception as exc:
        logger.error("get_market_regime failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Regime service temporarily unavailable: {exc}",
        )

    _cache_set(_regime_cache, cache_key, result)
    return JSONResponse(content={"status": "ok", "cached": False, "data": result})


@router.get(
    "/signals",
    summary="VIP Trading Signals",
    response_description="Active trading signals for Gold and major FX pairs.",
)
async def get_signals() -> JSONResponse:
    """
    Generate trading signals for XAU/USD, EUR/USD, GBP/USD, USD/JPY, AUD/USD,
    USD/CAD, GBP/JPY, and XAU/EUR.

    Each signal includes entry zone, stop-loss, three take-profit levels,
    confidence score, and regime alignment indicator.

    **Cached for 1 minute.**
    """
    cache_key = "signals"
    cached = _cache_get(_signals_cache, cache_key)
    if cached is not None:
        logger.debug("Serving signals from cache")
        return JSONResponse(content={"status": "ok", "cached": True, "data": cached})

    try:
        result = await _run_in_executor(vip_service.get_signals)
    except Exception as exc:
        logger.error("get_signals failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Signals service temporarily unavailable: {exc}",
        )

    _cache_set(_signals_cache, cache_key, result)
    return JSONResponse(content={"status": "ok", "cached": False, "data": result})


@router.get(
    "/calendar",
    summary="Enhanced Economic Calendar",
    response_description="Upcoming high-impact economic events with historical gold & FX reactions.",
)
async def get_calendar() -> JSONResponse:
    """
    Return 15-20 high-impact economic events for the next 7 days,
    including 2-3 recently-released events with actual values and surprise indices.

    Each event includes:
    - Historical gold reaction on beat/miss
    - Historical FX reactions per pair
    - Gold impact score (0-10)
    - List of pairs most affected

    **Cached for 15 minutes.**
    """
    cache_key = "calendar"
    cached = _cache_get(_calendar_cache, cache_key)
    if cached is not None:
        logger.debug("Serving calendar from cache")
        return JSONResponse(content={"status": "ok", "cached": True, "data": cached})

    try:
        result = await _run_in_executor(vip_service.get_enhanced_calendar)
    except Exception as exc:
        logger.error("get_enhanced_calendar failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Calendar service temporarily unavailable: {exc}",
        )

    _cache_set(_calendar_cache, cache_key, result)
    return JSONResponse(content={"status": "ok", "cached": False, "data": result})


@router.get(
    "/backtest/{strategy_name}",
    summary="Run Backtest",
    response_description="Full backtest report including equity curve, monthly returns, and regime breakdown.",
)
async def run_backtest(
    strategy_name: str = Path(
        ...,
        description=(
            "Strategy identifier. One of: gold_mean_reversion, fx_momentum_nfp, "
            "carry_trade, volatility_breakout, gold_macro_filter."
        ),
        examples=["gold_mean_reversion"],
    ),
) -> JSONResponse:
    """
    Simulate a backtest for the specified strategy over the 2020-2024 period.

    Returns detailed performance metrics including:
    - Win rate, profit factor, Sharpe ratio, max drawdown
    - 60-point monthly equity curve with realistic drawdown periods
    - 36-month return history
    - Trade P&L distribution histogram
    - Performance breakdown by macro regime

    Available strategies:
    - **gold_mean_reversion** – XAU/USD Bollinger Band mean reversion (H4)
    - **fx_momentum_nfp** – EUR/USD NFP event momentum (H1)
    - **carry_trade** – G10 multi-pair carry strategy (D1)
    - **volatility_breakout** – London open range breakout (H1)
    - **gold_macro_filter** – XAU/USD macro regime-filtered long strategy (W1)

    **Cached for 1 hour per strategy.**
    """
    cache_key = f"backtest:{strategy_name}"
    cached = _cache_get(_backtest_cache, cache_key)
    if cached is not None:
        logger.debug("Serving backtest '%s' from cache", strategy_name)
        return JSONResponse(content={"status": "ok", "cached": True, "data": cached})

    try:
        result = await _run_in_executor(vip_service.run_backtest, strategy_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("run_backtest('%s') failed: %s", strategy_name, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Backtest service temporarily unavailable: {exc}",
        )

    _cache_set(_backtest_cache, cache_key, result)
    return JSONResponse(content={"status": "ok", "cached": False, "data": result})


@router.post(
    "/risk",
    summary="Portfolio Risk Analysis",
    response_description="Portfolio-level risk metrics including VaR, correlation, and position sizing.",
    status_code=status.HTTP_200_OK,
)
async def get_portfolio_risk(
    body: RiskRequest = Body(..., description="List of open positions to analyse."),
) -> JSONResponse:
    """
    Calculate portfolio-level risk metrics for a set of open positions.

    Computes:
    - Total notional exposure (USD, Gold)
    - Parametric VaR at 95% and 99% confidence
    - Expected drawdown (CVaR)
    - Full 6x6 correlation matrix (XAU/USD, EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD)
    - Concentration risk rating
    - Recommended and maximum lot sizes (1% and 2% risk rules)
    - Risk warnings (over-correlated positions, excessive total risk, poor R/R)

    **Not cached** — results depend on request body.

    ### Example request body
    ```json
    {
      "positions": [
        {"pair": "XAU/USD", "size_lots": 0.5, "entry": 2620, "stop": 2580,
         "account_size": 10000, "risk_pct": 1.0},
        {"pair": "EUR/USD", "size_lots": 1.0, "entry": 1.0850, "stop": 1.0790,
         "account_size": 10000, "risk_pct": 1.0}
      ]
    }
    ```
    """
    positions_raw = [p.model_dump() for p in body.positions]
    try:
        result = await _run_in_executor(vip_service.get_portfolio_risk, positions_raw)
    except Exception as exc:
        logger.error("get_portfolio_risk failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Risk service temporarily unavailable: {exc}",
        )
    return JSONResponse(content={"status": "ok", "data": result})


@router.get(
    "/scenarios",
    summary="Macro Scenario Analysis",
    response_description="Six forward-looking macro scenarios with impact maps and trading playbooks.",
)
async def get_scenarios() -> JSONResponse:
    """
    Return six macro scenario analyses covering key market risk events:

    1. **CPI +30bps Surprise** – Inflation shock re-ignites Fed hawkishness
    2. **Fed Emergency Rate Cut** – Unscheduled 50bps cut, gold surges
    3. **Risk-Off Spike (VIX > 35)** – Systemic risk event, safe-haven flows
    4. **USD Surge (DXY > 108)** – Dollar funding squeeze, cross-asset pain
    5. **BoJ Hawkish Pivot** – Carry unwind, yen surges, AUD tanks
    6. **Oil Price Collapse** – Deflationary shock, commodity currencies crushed

    Each scenario includes:
    - Probability estimate
    - Per-pair directional impact with confidence rating
    - Key price levels to watch
    - Tactical trading playbook
    - Historical analog

    **Cached for 1 hour.**
    """
    cache_key = "scenarios"
    cached = _cache_get(_scenarios_cache, cache_key)
    if cached is not None:
        logger.debug("Serving scenarios from cache")
        return JSONResponse(content={"status": "ok", "cached": True, "data": cached})

    try:
        result = await _run_in_executor(vip_service.get_scenario_analysis)
    except Exception as exc:
        logger.error("get_scenario_analysis failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Scenario service temporarily unavailable: {exc}",
        )

    _cache_set(_scenarios_cache, cache_key, result)
    return JSONResponse(content={"status": "ok", "cached": False, "data": result})


@router.get(
    "/strategies",
    summary="List Available Strategies",
    response_description="All backtest-able strategies with metadata.",
)
async def list_strategies() -> JSONResponse:
    """
    Return a summary of all strategies available for backtesting.

    Each entry includes:
    - ``strategy_name`` – the URL slug used in ``/backtest/{strategy_name}``
    - ``display_name`` – human-readable title
    - ``description`` – strategy logic overview
    - ``pair`` – instrument(s) traded
    - ``timeframe`` – primary execution timeframe
    - ``parameters`` – default strategy parameters
    """
    try:
        result = await _run_in_executor(vip_service.list_strategies)
    except Exception as exc:
        logger.error("list_strategies failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Strategies service temporarily unavailable: {exc}",
        )
    return JSONResponse(content={"status": "ok", "data": result})

