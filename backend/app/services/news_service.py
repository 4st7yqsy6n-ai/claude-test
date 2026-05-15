import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp
try:
    import feedparser
    _FEEDPARSER_AVAILABLE = True
except ImportError:
    feedparser = None  # type: ignore
    _FEEDPARSER_AVAILABLE = False

logger = logging.getLogger(__name__)

RSS_FEEDS = {
    "Reuters":       "https://feeds.reuters.com/reuters/businessNews",
    "FT":            "https://www.ft.com/rss/home",
    "WSJ":           "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "CNBC":          "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "Seeking Alpha": "https://seekingalpha.com/market_currents.xml",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
}

# ---------------------------------------------------------------------------
# Category keyword mapping
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS = {
    "macro": [
        "fed", "federal reserve", "inflation", "gdp", "cpi", "unemployment",
        "interest rate", "rate cut", "rate hike", "fomc", "jackson hole",
        "recession", "fiscal", "treasury", "ecb", "boe", "boj", "central bank",
        "nonfarm", "payrolls", "pmi", "ism", "retail sales",
    ],
    "crypto": [
        "bitcoin", "btc", "ethereum", "eth", "crypto", "blockchain",
        "defi", "nft", "altcoin", "solana", "binance", "coinbase", "web3",
    ],
    "fx": [
        "dollar", "euro", "yen", "sterling", "yuan", "renminbi",
        "forex", "currency", "fx ", "usd", "eur", "gbp", "jpy",
        "emerging market", "peso", "franc",
    ],
    "commodities": [
        "oil", "crude", "gold", "silver", "natural gas", "wheat", "corn",
        "commodity", "opec", "energy", "brent", "wti", "metal", "copper",
        "platinum", "agriculture",
    ],
    "equities": [
        "stock", "shares", "equity", "earnings", "s&p", "nasdaq", "dow",
        "ipo", "dividend", "buyback", "merger", "acquisition", "analyst",
        "upgrade", "downgrade", "rally", "sell-off",
    ],
}

# ---------------------------------------------------------------------------
# Realistic mock news for May 2026
# ---------------------------------------------------------------------------
MOCK_NEWS = [
    {"title": "Fed Holds Rates Steady, Signals Two Cuts Possible in H2 2026",
     "summary": "The Federal Reserve kept its benchmark rate at 5.25-5.50% for the sixth consecutive meeting, with Chair Powell noting that inflation progress remains insufficient for imminent cuts.",
     "link": "https://reuters.com/mock/fed-holds-rates",
     "published": "2026-05-15T14:30:00Z", "source": "Reuters", "category": "macro"},
    {"title": "S&P 500 Hits New All-Time High as Tech Leads Broad Rally",
     "summary": "The S&P 500 closed at 5,823, surpassing the previous record set in April, driven by strong earnings from mega-cap technology companies and easing credit conditions.",
     "link": "https://wsj.com/mock/sp500-ath",
     "published": "2026-05-15T21:00:00Z", "source": "WSJ", "category": "equities"},
    {"title": "Bitcoin Surges Past $95,000 on Institutional ETF Inflows",
     "summary": "Bitcoin touched $96,400 before settling around $95,400 as spot ETF products attracted $1.2 billion in net inflows over the past week, their strongest weekly pace since February.",
     "link": "https://ft.com/mock/btc-surges",
     "published": "2026-05-15T18:00:00Z", "source": "FT", "category": "crypto"},
    {"title": "10-Year Treasury Yield Edges Higher on Sticky Services Inflation",
     "summary": "The benchmark 10-year note yield rose 2 basis points to 4.31%, as a hotter-than-expected services CPI reading tempered expectations for near-term Fed rate reductions.",
     "link": "https://cnbc.com/mock/10y-yield",
     "published": "2026-05-15T16:45:00Z", "source": "CNBC", "category": "macro"},
    {"title": "Dollar Strengthens Against G10 Peers as Risk Appetite Fades",
     "summary": "The DXY index rose 0.3% as geopolitical tensions in Eastern Europe prompted haven demand. EUR/USD slipped to 1.0812 while USD/JPY held near 153.50.",
     "link": "https://reuters.com/mock/dollar-strength",
     "published": "2026-05-15T12:00:00Z", "source": "Reuters", "category": "fx"},
    {"title": "Gold Holds Above $2,380 Amid Central Bank Demand",
     "summary": "Spot gold consolidated near $2,387/oz as central bank buying, particularly from emerging market institutions, continues to provide a structural floor for prices.",
     "link": "https://ft.com/mock/gold-holds",
     "published": "2026-05-15T10:30:00Z", "source": "FT", "category": "commodities"},
    {"title": "NVIDIA Reports Blowout Q1 Results, Raises Full-Year Guidance",
     "summary": "NVIDIA's data center revenue grew 350% year-over-year to $22.6 billion, beating consensus by 18%. The company raised FY2027 revenue guidance by 12%, citing insatiable AI infrastructure demand.",
     "link": "https://wsj.com/mock/nvda-earnings",
     "published": "2026-05-14T22:00:00Z", "source": "WSJ", "category": "equities"},
    {"title": "ECB Policymakers Signal June Rate Cut is 'Live Decision'",
     "summary": "Multiple ECB Governing Council members indicated a 25bp cut in June remains on the table, contingent on continued disinflation in the eurozone and stable wage growth data.",
     "link": "https://reuters.com/mock/ecb-cut",
     "published": "2026-05-14T15:00:00Z", "source": "Reuters", "category": "macro"},
    {"title": "Ethereum ETF Sees Record Inflows as Institutional Adoption Accelerates",
     "summary": "US-listed spot Ethereum ETFs recorded $480 million in inflows on Wednesday, the highest single-day total since their January launch, pushing ETH above $3,400.",
     "link": "https://cnbc.com/mock/eth-etf",
     "published": "2026-05-14T19:00:00Z", "source": "CNBC", "category": "crypto"},
    {"title": "WTI Crude Slides on API Inventory Build, OPEC+ Output Uncertainty",
     "summary": "WTI crude fell 1.1% to $78.32/bbl after the API reported a 4.2 million barrel inventory build. Markets also weighed reports of potential OPEC+ production increases from June.",
     "link": "https://seekingalpha.com/mock/oil-slide",
     "published": "2026-05-14T22:30:00Z", "source": "Seeking Alpha", "category": "commodities"},
    {"title": "Apple Announces $110 Billion Share Buyback, Raises Dividend 5%",
     "summary": "Apple authorized its largest-ever share repurchase program and raised its quarterly dividend to $0.26 per share, reflecting confidence in long-term cash generation from services and hardware.",
     "link": "https://wsj.com/mock/aapl-buyback",
     "published": "2026-05-13T21:00:00Z", "source": "WSJ", "category": "equities"},
    {"title": "April CPI Comes in at 3.2%, Below 3.4% Consensus Estimate",
     "summary": "US consumer prices rose 3.2% year-over-year in April, the lowest reading since March 2021, boosting risk assets and pushing the 2-year Treasury yield 8 basis points lower.",
     "link": "https://reuters.com/mock/cpi-april",
     "published": "2026-05-13T13:30:00Z", "source": "Reuters", "category": "macro"},
    {"title": "China Manufacturing PMI Expands for Third Straight Month",
     "summary": "China's Caixin manufacturing PMI rose to 51.4 in April from 51.1, signalling sustained momentum in export-oriented industries and reducing fears of a hard landing.",
     "link": "https://ft.com/mock/china-pmi",
     "published": "2026-05-12T02:00:00Z", "source": "FT", "category": "macro"},
    {"title": "USD/JPY Tests 154 as BOJ Maintains Ultra-Loose Policy",
     "summary": "The yen weakened toward 154 per dollar after the Bank of Japan kept its yield curve control policy unchanged, disappointing traders who had expected a gradual hawkish pivot.",
     "link": "https://cnbc.com/mock/usdjpy",
     "published": "2026-05-12T05:00:00Z", "source": "CNBC", "category": "fx"},
    {"title": "Silver Outperforms Gold on Solar Panel Demand Outlook",
     "summary": "Silver rose 0.8% to $30.45/oz, outperforming gold on forecasts that solar photovoltaic installations will consume a record 230 million ounces in 2026.",
     "link": "https://seekingalpha.com/mock/silver",
     "published": "2026-05-11T14:00:00Z", "source": "Seeking Alpha", "category": "commodities"},
    {"title": "Meta Platforms Launches AI Assistant Across All Products",
     "summary": "Meta unveiled a next-generation AI assistant powered by its Llama 4 model, integrated into WhatsApp, Instagram, and Facebook Messenger, reaching over 3.2 billion daily active users.",
     "link": "https://wsj.com/mock/meta-ai",
     "published": "2026-05-10T17:00:00Z", "source": "WSJ", "category": "equities"},
    {"title": "Solana Network Processes Record 65,000 TPS in Stress Test",
     "summary": "Solana's mainnet handled 65,000 transactions per second during a coordinated load test, reinforcing its position as the preferred blockchain for high-frequency DeFi and gaming applications.",
     "link": "https://reuters.com/mock/solana-tps",
     "published": "2026-05-10T12:00:00Z", "source": "Reuters", "category": "crypto"},
    {"title": "Nonfarm Payrolls Add 177K in April, Below 200K Estimate",
     "summary": "The US economy added 177,000 jobs in April, slightly below the 200,000 consensus but the unemployment rate held at 4.1%, suggesting continued labour market resilience.",
     "link": "https://ft.com/mock/nfp",
     "published": "2026-05-09T13:30:00Z", "source": "FT", "category": "macro"},
    {"title": "Goldman Sachs Raises S&P 500 Year-End Target to 6,200",
     "summary": "Goldman's equity strategy team lifted its year-end S&P 500 price target from 5,800 to 6,200, citing AI-driven productivity gains and better-than-expected corporate earnings.",
     "link": "https://cnbc.com/mock/gs-target",
     "published": "2026-05-08T14:00:00Z", "source": "CNBC", "category": "equities"},
    {"title": "Corn and Wheat Rally on Adverse Weather Forecasts in Midwest",
     "summary": "CBOT corn futures rose 0.76% while wheat gained 0.46% as meteorological models projected below-average rainfall across key growing regions in Illinois and Iowa during May.",
     "link": "https://seekingalpha.com/mock/grains",
     "published": "2026-05-08T16:00:00Z", "source": "Seeking Alpha", "category": "commodities"},
]


def _categorize(title: str, summary: str) -> str:
    """Assign a category based on keywords in title and summary."""
    text = (title + " " + summary).lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return category
    return "equities"


async def _fetch_feed(session: aiohttp.ClientSession, source: str, url: str) -> list[dict]:
    """Fetch and parse a single RSS feed asynchronously."""
    if not _FEEDPARSER_AVAILABLE:
        return []
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
            text = await resp.text()
        feed = feedparser.parse(text)
        items = []
        for entry in feed.entries[:20]:
            title = entry.get("title", "")
            summary = entry.get("summary", entry.get("description", ""))[:400]
            link = entry.get("link", "")
            published_parsed = entry.get("published_parsed")
            if published_parsed:
                try:
                    dt = datetime(*published_parsed[:6], tzinfo=timezone.utc)
                    published = dt.isoformat()
                except Exception:
                    published = datetime.now(timezone.utc).isoformat()
            else:
                published = datetime.now(timezone.utc).isoformat()
            items.append({
                "title": title,
                "summary": summary,
                "link": link,
                "published": published,
                "source": source,
                "category": _categorize(title, summary),
            })
        return items
    except Exception as exc:
        logger.warning("RSS fetch failed for %s (%s): %s", source, url, exc)
        return []


async def _fetch_all_feeds() -> list[dict]:
    """Fetch all RSS feeds concurrently."""
    async with aiohttp.ClientSession(headers={"User-Agent": "QuantEcosystem/1.0"}) as session:
        tasks = [
            _fetch_feed(session, source, url)
            for source, url in RSS_FEEDS.items()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    articles: list[dict] = []
    for result in results:
        if isinstance(result, list):
            articles.extend(result)
    return articles


async def get_news(limit: int = 50, category: Optional[str] = None) -> list[dict]:
    """
    Return news articles from RSS feeds.
    Falls back to curated mock headlines if feeds are unavailable.
    """
    try:
        articles = await _fetch_all_feeds()
        if not articles:
            raise ValueError("no articles fetched")
    except Exception:
        articles = MOCK_NEWS.copy()

    # Sort by published date descending
    def _pub_key(a: dict) -> str:
        return a.get("published", "")

    articles = sorted(articles, key=_pub_key, reverse=True)

    if category:
        articles = [a for a in articles if a.get("category") == category]

    # Deduplicate by title
    seen_titles: set[str] = set()
    unique: list[dict] = []
    for a in articles:
        if a["title"] not in seen_titles:
            seen_titles.add(a["title"])
            unique.append(a)

    return unique[:limit]
