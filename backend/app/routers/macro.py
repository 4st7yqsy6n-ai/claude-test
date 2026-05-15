import logging

from fastapi import APIRouter, HTTPException

from app.services.fred_service import get_macro_indicators, get_yield_curve

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/macro", tags=["macro"])

# ---------------------------------------------------------------------------
# Realistic economic calendar for mid-May through end-May 2026
# ---------------------------------------------------------------------------
ECONOMIC_CALENDAR = [
    {
        "date": "2026-05-15",
        "time": "08:30",
        "event": "Initial Jobless Claims",
        "actual": None,
        "forecast": "218K",
        "previous": "222K",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-15",
        "time": "08:30",
        "event": "Philadelphia Fed Manufacturing Index",
        "actual": None,
        "forecast": "8.2",
        "previous": "5.2",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-15",
        "time": "15:30",
        "event": "EIA Crude Oil Inventories",
        "actual": None,
        "forecast": "-1.2M",
        "previous": "+3.6M",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-16",
        "time": "08:30",
        "event": "Retail Sales MoM",
        "actual": None,
        "forecast": "0.4%",
        "previous": "-0.2%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-05-16",
        "time": "09:15",
        "event": "Industrial Production MoM",
        "actual": None,
        "forecast": "0.2%",
        "previous": "0.3%",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-16",
        "time": "10:00",
        "event": "University of Michigan Consumer Sentiment (Prelim)",
        "actual": None,
        "forecast": "78.5",
        "previous": "77.2",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-19",
        "time": "08:30",
        "event": "Building Permits",
        "actual": None,
        "forecast": "1.45M",
        "previous": "1.42M",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-19",
        "time": "08:30",
        "event": "Housing Starts",
        "actual": None,
        "forecast": "1.38M",
        "previous": "1.35M",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-20",
        "time": "14:00",
        "event": "FOMC Meeting Minutes",
        "actual": None,
        "forecast": "N/A",
        "previous": "N/A",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-05-21",
        "time": "08:30",
        "event": "Initial Jobless Claims",
        "actual": None,
        "forecast": "215K",
        "previous": "218K",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-22",
        "time": "09:45",
        "event": "S&P Global US Manufacturing PMI (Flash)",
        "actual": None,
        "forecast": "51.2",
        "previous": "50.8",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-22",
        "time": "09:45",
        "event": "S&P Global US Services PMI (Flash)",
        "actual": None,
        "forecast": "53.4",
        "previous": "52.9",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-27",
        "time": "09:00",
        "event": "S&P/Case-Shiller Home Price Index",
        "actual": None,
        "forecast": "6.1%",
        "previous": "6.4%",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-27",
        "time": "10:00",
        "event": "CB Consumer Confidence",
        "actual": None,
        "forecast": "102.3",
        "previous": "99.8",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-28",
        "time": "08:30",
        "event": "GDP Growth Rate QoQ (Second Estimate)",
        "actual": None,
        "forecast": "2.1%",
        "previous": "2.8%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-05-29",
        "time": "08:30",
        "event": "Core PCE Price Index MoM",
        "actual": None,
        "forecast": "0.2%",
        "previous": "0.3%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-05-29",
        "time": "08:30",
        "event": "Personal Income MoM",
        "actual": None,
        "forecast": "0.4%",
        "previous": "0.5%",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-05-29",
        "time": "08:30",
        "event": "Personal Spending MoM",
        "actual": None,
        "forecast": "0.3%",
        "previous": "0.8%",
        "importance": "medium",
        "country": "US",
    },
    {
        "date": "2026-06-04",
        "time": "10:00",
        "event": "ISM Manufacturing PMI",
        "actual": None,
        "forecast": "50.1",
        "previous": "49.8",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-06-06",
        "time": "08:30",
        "event": "Nonfarm Payrolls",
        "actual": None,
        "forecast": "190K",
        "previous": "177K",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-06-06",
        "time": "08:30",
        "event": "Unemployment Rate",
        "actual": None,
        "forecast": "4.1%",
        "previous": "4.1%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-06-11",
        "time": "08:30",
        "event": "CPI YoY",
        "actual": None,
        "forecast": "3.1%",
        "previous": "3.2%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-06-12",
        "time": "14:00",
        "event": "FOMC Interest Rate Decision",
        "actual": None,
        "forecast": "5.25-5.50%",
        "previous": "5.25-5.50%",
        "importance": "high",
        "country": "US",
    },
    {
        "date": "2026-06-12",
        "time": "14:30",
        "event": "FOMC Press Conference",
        "actual": None,
        "forecast": "N/A",
        "previous": "N/A",
        "importance": "high",
        "country": "US",
    },
]


@router.get("/yields")
def yield_curve():
    """Return the current US Treasury yield curve."""
    try:
        return {"data": get_yield_curve()}
    except Exception as exc:
        logger.error("Yield curve error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/indicators")
def macro_indicators():
    """Return key macroeconomic indicators."""
    try:
        return get_macro_indicators()
    except Exception as exc:
        logger.error("Macro indicators error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/calendar")
def economic_calendar():
    """Return the upcoming economic event calendar."""
    return {"data": ECONOMIC_CALENDAR}
