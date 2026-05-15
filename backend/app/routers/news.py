import logging
from typing import Optional

from fastapi import APIRouter, Query

from app.services.news_service import get_news

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/news", tags=["news"])

VALID_CATEGORIES = {"macro", "equities", "fx", "crypto", "commodities"}


@router.get("")
async def news_feed(
    limit: int = Query(default=50, ge=1, le=200),
    category: Optional[str] = Query(default=None, description="Filter by category: macro, equities, fx, crypto, commodities"),
):
    """Return recent market news from multiple sources."""
    cat = category.lower() if category else None
    if cat and cat not in VALID_CATEGORIES:
        cat = None  # silently ignore invalid categories
    articles = await get_news(limit=limit, category=cat)
    return {"count": len(articles), "category": cat, "data": articles}
