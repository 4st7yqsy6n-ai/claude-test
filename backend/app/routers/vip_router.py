"""
vip_router.py
=============
FastAPI router for the Gold & Forex Quant Edge VIP Dashboard.

All routes live under the /api/vip prefix. Heavy service calls run in a
thread-pool executor to avoid blocking the async event loop.

Responses return raw data directly (no wrapper envelope) so the frontend
can consume them without unwrapping.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from cachetools import TTLCache
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.services import vip_service

logger = logging.getLogger(__name__)

# ── Caches ─────────────────────────────────────────────────────────────────────
_regime_cache: TTLCache = TTLCache(maxsize=4, ttl=300)      # 5 min
_signals_cache: TTLCache = TTLCache(maxsize=4, ttl=60)      # 1 min
_calendar_cache: TTLCache = TTLCache(maxsize=4, ttl=900)    # 15 min
_scenarios_cache: TTLCache = TTLCache(maxsize=4, ttl=3600)  # 1 hr
_backtest_cache: TTLCache = TTLCache(maxsize=32, ttl=3600)  # 1 hr per strategy

router = APIRouter(prefix="/vip", tags=["VIP – Gold & Forex Quant Edge"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class PositionIn(BaseModel):
    pair: str = Field(default="XAU/USD", description="Currency or commodity pair.")
    size_lots: float = Field(default=0.1, ge=0.01, le=100.0)
    entry: float = Field(default=2620.0, gt=0)
    stop: float = Field(default=2580.0, gt=0)
    account_size: float = Field(default=10_000.0, gt=0)
    risk_pct: float = Field(default=1.0, ge=0.1, le=10.0)
    direction: str = Field(default="LONG")

    @field_validator("pair")
    @classmethod
    def validate_pair(cls, v: str) -> str:
        v = v.strip().upper()
        if "/" not in v or len(v) < 6:
            raise ValueError(f"Invalid pair format: '{v}'. Expected 'XXX/YYY'.")
        return v

    @field_validator("stop")
    @classmethod
    def stop_must_differ_from_entry(cls, v: float, info: Any) -> float:
        entry = info.data.get("entry")
        if entry is not None and abs(v - entry) < 1e-8:
            raise ValueError("stop must differ from entry price.")
        return v


class RiskRequest(BaseModel):
    positions: list[PositionIn] = Field(min_length=1, max_length=20)


# ── Async helper ───────────────────────────────────────────────────────────────

async def _run(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


def _cache_get(cache: TTLCache, key: str) -> Any:
    return cache.get(key)


def _cache_set(cache: TTLCache, key: str, value: Any) -> None:
    try:
        cache[key] = value
    except ValueError:
        pass


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/regime", summary="Market Regime Detection")
async def get_regime() -> Any:
    """
    Live macro regime across Risk Sentiment, Inflation, and USD Cycle.
    Fetches VIX, DXY, gold, TIP/IEF from yfinance. Cached 5 min.
    """
    if (cached := _cache_get(_regime_cache, "regime")) is not None:
        return cached
    try:
        result = await _run(vip_service.get_market_regime)
    except Exception as exc:
        logger.error("get_market_regime failed: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    _cache_set(_regime_cache, "regime", result)
    return result


@router.get("/signals", summary="VIP Trading Signals")
async def get_signals() -> Any:
    """
    Live signals for XAU/USD, EUR/USD, GBP/USD, USD/JPY, AUD/USD,
    USD/CAD, GBP/JPY, XAU/EUR — entry/SL/TP/confidence. Cached 1 min.
    """
    if (cached := _cache_get(_signals_cache, "signals")) is not None:
        return cached
    try:
        result = await _run(vip_service.get_signals)
    except Exception as exc:
        logger.error("get_signals failed: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    _cache_set(_signals_cache, "signals", result)
    return result


@router.get("/calendar", summary="Enhanced Economic Calendar")
async def get_calendar() -> Any:
    """
    Economic events with gold impact scores, surprise index, and
    historical FX/gold reactions. Uses Finnhub if FINNHUB_API_KEY is set.
    Cached 15 min.
    """
    if (cached := _cache_get(_calendar_cache, "calendar")) is not None:
        return cached
    try:
        result = await _run(vip_service.get_enhanced_calendar)
    except Exception as exc:
        logger.error("get_calendar failed: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    _cache_set(_calendar_cache, "calendar", result)
    return result


@router.get("/strategies", summary="List available backtest strategies")
async def list_strategies() -> Any:
    """Catalogue of available backtesting strategies."""
    return vip_service.list_strategies()


@router.get("/backtest/{strategy_name}", summary="Strategy backtest results")
async def get_backtest(strategy_name: str) -> Any:
    """
    Backtesting results for the given strategy. Available:
    gold_mean_reversion, fx_momentum_nfp, carry_trade,
    volatility_breakout, gold_macro_filter.
    """
    if (cached := _cache_get(_backtest_cache, strategy_name)) is not None:
        return cached
    try:
        result = await _run(vip_service.run_backtest, strategy_name)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("backtest failed for %s: %s", strategy_name, exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    _cache_set(_backtest_cache, strategy_name, result)
    return result


@router.post("/risk", summary="Portfolio risk analytics")
async def calculate_risk(body: RiskRequest) -> Any:
    """
    Portfolio-level VaR, correlation exposure, concentration risk,
    and position sizing recommendations.
    """
    try:
        positions = [pos.model_dump() for pos in body.positions]
        return await _run(vip_service.get_portfolio_risk, positions)
    except Exception as exc:
        logger.error("risk analytics failed: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/scenarios", summary="Macro scenario analysis")
async def get_scenarios() -> Any:
    """
    6 macro scenarios (CPI surprise, Fed cut, VIX spike, USD surge,
    BoJ pivot, oil collapse) with expected FX/gold impact and trading playbooks.
    Cached 1 hr.
    """
    if (cached := _cache_get(_scenarios_cache, "scenarios")) is not None:
        return cached
    try:
        result = await _run(vip_service.get_scenario_analysis)
    except Exception as exc:
        logger.error("scenarios failed: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    _cache_set(_scenarios_cache, "scenarios", result)
    return result


@router.get("/correlation", summary="Static gold + FX correlation matrix")
async def get_correlation() -> Any:
    """Real-world approximate 5-year rolling correlation matrix."""
    return {
        "matrix": vip_service.CORRELATION_MATRIX,
        "pairs": list(vip_service.CORRELATION_MATRIX.keys()),
        "note": "5-year rolling correlation — updated quarterly",
    }
