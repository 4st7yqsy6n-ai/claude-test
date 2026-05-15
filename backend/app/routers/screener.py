import logging

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/screener", tags=["screener"])

# ---------------------------------------------------------------------------
# Predefined universe of 50 large-cap US stocks
# ---------------------------------------------------------------------------
STOCK_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK-B",
    "UNH", "LLY", "JPM", "V", "XOM", "MA", "PG", "AVGO", "JNJ", "HD",
    "MRK", "ABBV", "COST", "CVX", "CRM", "NFLX", "AMD", "KO", "PEP",
    "TMO", "ORCL", "ADBE", "ACN", "WMT", "MCD", "ABT", "PM", "BAC",
    "GE", "RTX", "TXN", "HON", "SPGI", "CAT", "AXP", "ISRG", "BKNG",
    "INTU", "SBUX", "DE", "GS", "MS",
]

# S&P 500 sectors with representative ETFs / weights
SECTORS = [
    {"sector": "Information Technology", "ticker": "XLK",  "weight": 29.2},
    {"sector": "Health Care",            "ticker": "XLV",  "weight": 12.7},
    {"sector": "Financials",             "ticker": "XLF",  "weight": 13.1},
    {"sector": "Consumer Discretionary", "ticker": "XLY",  "weight": 10.8},
    {"sector": "Communication Services", "ticker": "XLC",  "weight": 8.9},
    {"sector": "Industrials",            "ticker": "XLI",  "weight": 8.4},
    {"sector": "Consumer Staples",       "ticker": "XLP",  "weight": 5.9},
    {"sector": "Energy",                 "ticker": "XLE",  "weight": 3.8},
    {"sector": "Utilities",              "ticker": "XLU",  "weight": 2.4},
    {"sector": "Real Estate",            "ticker": "XLRE", "weight": 2.3},
    {"sector": "Materials",              "ticker": "XLB",  "weight": 2.5},
]

# Realistic mock prices / changes for May 2026
MOCK_STOCK_DATA = {
    "AAPL":  {"price": 213.45, "change_pct":  1.23, "volume": 68_000_000, "market_cap": 3_280_000_000_000, "sector": "Information Technology"},
    "MSFT":  {"price": 445.32, "change_pct":  0.87, "volume": 23_000_000, "market_cap": 3_310_000_000_000, "sector": "Information Technology"},
    "NVDA":  {"price": 1087.50,"change_pct":  2.45, "volume": 42_000_000, "market_cap": 2_680_000_000_000, "sector": "Information Technology"},
    "GOOGL": {"price": 192.34, "change_pct":  0.54, "volume": 25_000_000, "market_cap": 2_410_000_000_000, "sector": "Communication Services"},
    "AMZN":  {"price": 224.78, "change_pct":  1.12, "volume": 32_000_000, "market_cap": 2_360_000_000_000, "sector": "Consumer Discretionary"},
    "META":  {"price": 578.23, "change_pct":  1.67, "volume": 18_000_000, "market_cap": 1_480_000_000_000, "sector": "Communication Services"},
    "TSLA":  {"price": 187.65, "change_pct": -2.34, "volume": 95_000_000, "market_cap":  598_000_000_000, "sector": "Consumer Discretionary"},
    "BRK-B": {"price": 441.20, "change_pct":  0.23, "volume": 4_200_000,  "market_cap":  980_000_000_000, "sector": "Financials"},
    "UNH":   {"price": 512.34, "change_pct": -0.45, "volume": 3_800_000,  "market_cap":  472_000_000_000, "sector": "Health Care"},
    "LLY":   {"price": 876.54, "change_pct":  3.21, "volume": 4_100_000,  "market_cap":  832_000_000_000, "sector": "Health Care"},
    "JPM":   {"price": 243.67, "change_pct":  0.67, "volume": 12_000_000, "market_cap":  703_000_000_000, "sector": "Financials"},
    "V":     {"price": 312.45, "change_pct":  0.45, "volume": 8_200_000,  "market_cap":  641_000_000_000, "sector": "Financials"},
    "XOM":   {"price": 121.34, "change_pct": -0.89, "volume": 18_000_000, "market_cap":  485_000_000_000, "sector": "Energy"},
    "MA":    {"price": 498.76, "change_pct":  0.56, "volume": 4_500_000,  "market_cap":  454_000_000_000, "sector": "Financials"},
    "PG":    {"price": 175.43, "change_pct":  0.12, "volume": 6_800_000,  "market_cap":  414_000_000_000, "sector": "Consumer Staples"},
    "AVGO":  {"price": 1876.54,"change_pct":  1.89, "volume": 2_100_000,  "market_cap":  873_000_000_000, "sector": "Information Technology"},
    "JNJ":   {"price": 152.34, "change_pct": -0.23, "volume": 9_200_000,  "market_cap":  366_000_000_000, "sector": "Health Care"},
    "HD":    {"price": 387.65, "change_pct":  0.34, "volume": 3_900_000,  "market_cap":  385_000_000_000, "sector": "Consumer Discretionary"},
    "MRK":   {"price": 134.56, "change_pct":  0.56, "volume": 8_600_000,  "market_cap":  340_000_000_000, "sector": "Health Care"},
    "ABBV":  {"price": 187.43, "change_pct":  0.78, "volume": 6_700_000,  "market_cap":  331_000_000_000, "sector": "Health Care"},
    "COST":  {"price": 876.32, "change_pct":  0.67, "volume": 2_300_000,  "market_cap":  389_000_000_000, "sector": "Consumer Staples"},
    "CVX":   {"price": 163.45, "change_pct": -0.67, "volume": 12_000_000, "market_cap":  307_000_000_000, "sector": "Energy"},
    "CRM":   {"price": 312.34, "change_pct":  1.23, "volume": 5_400_000,  "market_cap":  300_000_000_000, "sector": "Information Technology"},
    "NFLX":  {"price": 723.45, "change_pct":  2.12, "volume": 4_200_000,  "market_cap":  312_000_000_000, "sector": "Communication Services"},
    "AMD":   {"price": 198.76, "change_pct":  3.45, "volume": 48_000_000, "market_cap":  321_000_000_000, "sector": "Information Technology"},
    "KO":    {"price": 64.32,  "change_pct":  0.18, "volume": 15_000_000, "market_cap":  277_000_000_000, "sector": "Consumer Staples"},
    "PEP":   {"price": 173.45, "change_pct":  0.09, "volume": 7_200_000,  "market_cap":  238_000_000_000, "sector": "Consumer Staples"},
    "TMO":   {"price": 612.34, "change_pct":  0.45, "volume": 1_800_000,  "market_cap":  235_000_000_000, "sector": "Health Care"},
    "ORCL":  {"price": 143.56, "change_pct":  1.34, "volume": 8_900_000,  "market_cap":  389_000_000_000, "sector": "Information Technology"},
    "ADBE":  {"price": 487.65, "change_pct": -0.34, "volume": 3_200_000,  "market_cap":  218_000_000_000, "sector": "Information Technology"},
    "ACN":   {"price": 354.32, "change_pct":  0.23, "volume": 3_600_000,  "market_cap":  223_000_000_000, "sector": "Information Technology"},
    "WMT":   {"price": 73.45,  "change_pct":  0.45, "volume": 22_000_000, "market_cap":  590_000_000_000, "sector": "Consumer Staples"},
    "MCD":   {"price": 298.76, "change_pct":  0.32, "volume": 4_100_000,  "market_cap":  215_000_000_000, "sector": "Consumer Discretionary"},
    "ABT":   {"price": 124.56, "change_pct": -0.12, "volume": 6_800_000,  "market_cap":  216_000_000_000, "sector": "Health Care"},
    "PM":    {"price": 121.34, "change_pct":  0.23, "volume": 5_400_000,  "market_cap":  189_000_000_000, "sector": "Consumer Staples"},
    "BAC":   {"price": 43.56,  "change_pct":  0.78, "volume": 42_000_000, "market_cap":  344_000_000_000, "sector": "Financials"},
    "GE":    {"price": 187.43, "change_pct":  1.23, "volume": 8_700_000,  "market_cap":  204_000_000_000, "sector": "Industrials"},
    "RTX":   {"price": 123.45, "change_pct":  0.56, "volume": 7_200_000,  "market_cap":  163_000_000_000, "sector": "Industrials"},
    "TXN":   {"price": 213.67, "change_pct": -0.23, "volume": 5_600_000,  "market_cap":  194_000_000_000, "sector": "Information Technology"},
    "HON":   {"price": 223.45, "change_pct":  0.45, "volume": 3_900_000,  "market_cap":  148_000_000_000, "sector": "Industrials"},
    "SPGI":  {"price": 487.65, "change_pct":  0.67, "volume": 1_200_000,  "market_cap":  154_000_000_000, "sector": "Financials"},
    "CAT":   {"price": 376.54, "change_pct":  0.89, "volume": 3_200_000,  "market_cap":  183_000_000_000, "sector": "Industrials"},
    "AXP":   {"price": 254.32, "change_pct":  0.34, "volume": 4_500_000,  "market_cap":  186_000_000_000, "sector": "Financials"},
    "ISRG":  {"price": 432.56, "change_pct":  1.45, "volume": 2_100_000,  "market_cap":  153_000_000_000, "sector": "Health Care"},
    "BKNG":  {"price": 4234.56,"change_pct":  0.78, "volume": 450_000,    "market_cap":  168_000_000_000, "sector": "Consumer Discretionary"},
    "INTU":  {"price": 698.76, "change_pct":  0.56, "volume": 1_800_000,  "market_cap":  197_000_000_000, "sector": "Information Technology"},
    "SBUX":  {"price": 98.76,  "change_pct": -0.67, "volume": 12_000_000, "market_cap":  110_000_000_000, "sector": "Consumer Discretionary"},
    "DE":    {"price": 432.34, "change_pct":  0.45, "volume": 2_400_000,  "market_cap":  118_000_000_000, "sector": "Industrials"},
    "GS":    {"price": 543.21, "change_pct":  0.89, "volume": 3_100_000,  "market_cap":  178_000_000_000, "sector": "Financials"},
    "MS":    {"price": 112.34, "change_pct":  0.67, "volume": 14_000_000, "market_cap":  186_000_000_000, "sector": "Financials"},
}

MOCK_SECTOR_DATA = {
    "XLK":  {"change_pct":  1.43, "ytd_pct": 18.7},
    "XLV":  {"change_pct":  0.56, "ytd_pct":  7.2},
    "XLF":  {"change_pct":  0.67, "ytd_pct": 12.3},
    "XLY":  {"change_pct":  0.34, "ytd_pct":  9.1},
    "XLC":  {"change_pct":  1.12, "ytd_pct": 15.4},
    "XLI":  {"change_pct":  0.45, "ytd_pct":  8.9},
    "XLP":  {"change_pct":  0.12, "ytd_pct":  3.4},
    "XLE":  {"change_pct": -0.89, "ytd_pct": -4.2},
    "XLU":  {"change_pct":  0.23, "ytd_pct":  2.1},
    "XLRE": {"change_pct": -0.34, "ytd_pct": -1.8},
    "XLB":  {"change_pct":  0.45, "ytd_pct":  5.6},
}


def _get_stock_quote(symbol: str) -> dict:
    """Fetch a stock quote, falling back to mock data."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = float(getattr(info, "last_price", 0) or 0)
        prev = float(getattr(info, "previous_close", 0) or 0)
        if price == 0:
            raise ValueError("zero price")
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0.0
        volume = int(getattr(info, "three_month_average_volume", 0) or 0)
        market_cap = int(getattr(info, "market_cap", 0) or 0)
        return {
            "symbol": symbol,
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 4),
            "volume": volume,
            "market_cap": market_cap,
        }
    except Exception:
        mock = MOCK_STOCK_DATA.get(symbol, {})
        return {
            "symbol": symbol,
            "price": mock.get("price", 100.0),
            "change": round(mock.get("price", 100) * mock.get("change_pct", 0) / 100, 2),
            "change_pct": mock.get("change_pct", 0.0),
            "volume": mock.get("volume", 1_000_000),
            "market_cap": mock.get("market_cap", 0),
        }


def _get_sector_quote(ticker: str) -> dict:
    """Fetch a sector ETF quote, falling back to mock."""
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        price = float(getattr(info, "last_price", 0) or 0)
        prev = float(getattr(info, "previous_close", 0) or 0)
        if price == 0:
            raise ValueError("zero price")
        change_pct = ((price - prev) / prev * 100) if prev else 0.0
        return {"change_pct": round(change_pct, 4)}
    except Exception:
        mock = MOCK_SECTOR_DATA.get(ticker, {})
        return {"change_pct": mock.get("change_pct", 0.0)}


@router.get("/movers")
def movers():
    """Return top 5 gainers and losers from the stock universe."""
    try:
        quotes = []
        for symbol in STOCK_UNIVERSE:
            q = _get_stock_quote(symbol)
            mock_extra = MOCK_STOCK_DATA.get(symbol, {})
            q["sector"] = mock_extra.get("sector", "Unknown")
            quotes.append(q)

        sorted_by_change = sorted(quotes, key=lambda x: x["change_pct"], reverse=True)
        gainers = sorted_by_change[:5]
        losers = sorted_by_change[-5:][::-1]

        return {
            "gainers": gainers,
            "losers": losers,
        }
    except Exception as exc:
        logger.error("Movers error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/heatmap")
def heatmap():
    """Return S&P 500 sector heatmap data with performance metrics."""
    try:
        result = []
        for sector_info in SECTORS:
            sector = sector_info["sector"]
            ticker = sector_info["ticker"]
            weight = sector_info["weight"]
            quote = _get_sector_quote(ticker)
            mock = MOCK_SECTOR_DATA.get(ticker, {})
            result.append({
                "sector": sector,
                "ticker": ticker,
                "weight": weight,
                "change_pct": quote.get("change_pct", mock.get("change_pct", 0.0)),
                "ytd_pct": mock.get("ytd_pct", 0.0),
            })

        # Also include individual stock data grouped by sector for a granular heatmap
        stocks_by_sector: dict[str, list] = {}
        for symbol in STOCK_UNIVERSE:
            mock_stock = MOCK_STOCK_DATA.get(symbol, {})
            s = mock_stock.get("sector", "Unknown")
            if s not in stocks_by_sector:
                stocks_by_sector[s] = []
            stocks_by_sector[s].append({
                "symbol": symbol,
                "price": mock_stock.get("price", 0),
                "change_pct": mock_stock.get("change_pct", 0),
                "market_cap": mock_stock.get("market_cap", 0),
            })

        return {
            "sectors": result,
            "stocks": stocks_by_sector,
        }
    except Exception as exc:
        logger.error("Heatmap error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
