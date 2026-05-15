import logging
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.services.market_service import (
    calculate_indicators,
    get_market_overview,
    get_ohlcv,
    get_ticker_info,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market", tags=["market"])


@router.get("/overview")
def market_overview():
    """Return prices for indices, FX, crypto, and commodities."""
    try:
        return get_market_overview()
    except Exception as exc:
        logger.error("market overview error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{symbol}/ohlcv")
def ohlcv(
    symbol: str,
    period: str = Query(default="1y", description="yfinance period (e.g. 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y)"),
    interval: str = Query(default="1d", description="yfinance interval (e.g. 1m, 5m, 15m, 1h, 1d, 1wk, 1mo)"),
):
    """Return OHLCV candlestick data for a symbol."""
    try:
        data = get_ohlcv(symbol, period=period, interval=interval)
        return {"symbol": symbol, "period": period, "interval": interval, "data": data}
    except Exception as exc:
        logger.error("OHLCV error for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{symbol}/info")
def ticker_info(symbol: str):
    """Return company / instrument info for a symbol."""
    try:
        return get_ticker_info(symbol)
    except Exception as exc:
        logger.error("Ticker info error for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{symbol}/indicators")
def indicators(
    symbol: str,
    period: str = Query(default="1y", description="Historical period for indicator calculation"),
):
    """Return technical indicators (RSI, MACD, Bollinger Bands, EMA) plus OHLCV data."""
    try:
        ohlcv_data = get_ohlcv(symbol, period=period, interval="1d")
        if not ohlcv_data:
            raise HTTPException(status_code=404, detail=f"No data found for symbol: {symbol}")
        df = pd.DataFrame(ohlcv_data)
        indicator_data = calculate_indicators(df)
        return {
            "symbol": symbol,
            "period": period,
            "ohlcv": ohlcv_data,
            "indicators": indicator_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Indicators error for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail=str(exc))
