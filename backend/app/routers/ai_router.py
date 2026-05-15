import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import ai_service, fred_service, market_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    symbol: str
    context: Optional[dict[str, Any]] = None


class BriefingRequest(BaseModel):
    pass  # data fetched internally


class AskRequest(BaseModel):
    question: str
    context: Optional[str] = None


class TradeIdeaRequest(BaseModel):
    symbol: str


class JarvisRequest(BaseModel):
    query: str
    context: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Return AI-generated market analysis for a symbol."""
    try:
        result = ai_service.analyze_market(req.symbol, req.context)
        return result
    except Exception as exc:
        logger.error("AI analyze error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/briefing")
def briefing(req: BriefingRequest):
    """Generate a morning market briefing using live market and macro data."""
    try:
        market_data = market_service.get_market_overview()
        macro_data = fred_service.get_macro_indicators()
        result = ai_service.get_daily_briefing(market_data=market_data, macro_data=macro_data)
        return result
    except Exception as exc:
        logger.error("AI briefing error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/ask")
def ask(req: AskRequest):
    """Answer a free-form market or finance question."""
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        result = ai_service.answer_question(req.question.strip(), context=req.context)
        return result
    except Exception as exc:
        logger.error("AI ask error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/trade-idea")
def trade_idea(req: TradeIdeaRequest):
    """Generate a trade idea for the given symbol."""
    try:
        # Pull latest OHLCV data for context
        ohlcv = market_service.get_ohlcv(req.symbol, period="1mo", interval="1d")
        context_data: dict[str, Any] = {}
        if ohlcv:
            latest = ohlcv[-1]
            context_data["close"] = latest.get("close")
            context_data["volume"] = latest.get("volume")
            if len(ohlcv) >= 2:
                prev_close = ohlcv[-2].get("close", 0)
                if prev_close:
                    change_pct = (latest["close"] - prev_close) / prev_close * 100
                    context_data["change_pct"] = round(change_pct, 4)
            # Calculate RSI from available data
            import pandas as pd
            df = pd.DataFrame(ohlcv)
            indicators = market_service.calculate_indicators(df)
            rsi_series = indicators.get("rsi", [])
            if rsi_series:
                valid_rsi = [r for r in rsi_series if r is not None]
                if valid_rsi:
                    context_data["rsi"] = round(valid_rsi[-1], 2)
        result = ai_service.generate_trade_idea(req.symbol, context_data)
        return result
    except Exception as exc:
        logger.error("Trade idea error for %s: %s", req.symbol, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/jarvis")
def jarvis(req: JarvisRequest):
    """JARVIS voice-command endpoint — returns spoken response + UI action."""
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        result = ai_service.jarvis_query(req.query.strip(), context=req.context)
        return result
    except Exception as exc:
        logger.error("JARVIS query error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
