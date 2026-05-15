import logging
from typing import Any, Optional

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior quantitative analyst and macro strategist at a top hedge fund. "
    "Provide concise, data-driven analysis. Be direct and actionable. "
    "Use precise numbers and percentages. Structure your responses clearly with key points. "
    "Never hedge excessively — give your best analytical assessment."
)

# ---------------------------------------------------------------------------
# Mock responses for when no API key is available
# ---------------------------------------------------------------------------

def _mock_market_analysis(symbol: str) -> dict:
    return {
        "symbol": symbol,
        "outlook": "Neutral-Bullish",
        "summary": (
            f"Technical structure for {symbol} remains constructive above key moving averages. "
            "Price action is consolidating within a defined range following last month's breakout. "
            "Volume profile suggests institutional accumulation at current levels."
        ),
        "key_levels": {
            "support": ["Strong demand zone at 200-day EMA", "Previous breakout level acting as support"],
            "resistance": ["All-time high ceiling", "Options gamma wall from monthly expiry"],
        },
        "catalysts": [
            "Upcoming earnings / data release",
            "Macro sensitivity to Fed rate expectations",
            "Sector rotation dynamics",
        ],
        "risk_factors": [
            "Elevated valuation vs. historical multiples",
            "Rising real yields compressing risk premium",
            "Geopolitical tail risk from current flashpoints",
        ],
        "recommendation": "Monitor for confirmation of continuation pattern. Position sizing should reflect current macro uncertainty.",
        "confidence": "Medium",
        "time_horizon": "2-4 weeks",
    }


def _mock_daily_briefing() -> dict:
    return {
        "date": "May 15, 2026",
        "headline": "Risk assets resilient as inflation data surprises to the downside",
        "executive_summary": (
            "Markets opened with a risk-on bias after April CPI printed 3.2% vs 3.4% consensus, "
            "its lowest level since early 2021. Equity indices pushed to new highs led by technology. "
            "Treasury yields initially fell but retraced after a strong 10-year auction. "
            "The dollar weakened modestly, supporting EM currencies and gold."
        ),
        "key_themes": [
            "Disinflation narrative regaining traction — opens door to September Fed cut",
            "AI infrastructure capex cycle remains the dominant equity driver",
            "Yield curve steepening on front-end rally vs. long-end resilience",
            "Bitcoin breaking above $95K reflects continued ETF-driven institutional adoption",
        ],
        "watchlist": [
            {"item": "Fed speakers today (Williams 14:30, Waller 16:00)", "impact": "High"},
            {"item": "EIA crude inventory report 15:30", "impact": "Medium"},
            {"item": "30-year bond auction 18:00", "impact": "High"},
        ],
        "sector_rotation": "Favour growth over value in the near term given disinflation surprise. Defensive sectors (utilities, healthcare) likely to underperform.",
        "fx_outlook": "USD weakness bias in the near term. Long EUR/USD above 1.0800 offers favourable risk/reward into ECB June meeting.",
        "rates_outlook": "2-year yields remain anchored near 4.5%. The belly of the curve (5Y) offers best risk/reward for rates bulls.",
    }


def _mock_trade_idea(symbol: str) -> dict:
    return {
        "symbol": symbol,
        "direction": "Long",
        "strategy": "Momentum breakout with defined risk",
        "entry": "Current market price or limit at nearest support",
        "stop_loss": "2% below entry / below key moving average",
        "target_1": "5% above entry (partial profit)",
        "target_2": "10% above entry (full exit)",
        "risk_reward": "1:3 minimum",
        "rationale": (
            f"Technical setup for {symbol} shows a higher-low sequence forming on the daily chart, "
            "consistent with trend continuation. Relative strength versus the sector benchmark has been "
            "positive for four consecutive weeks. The options market implies 30-day realized vol below "
            "historical average, suggesting positioning is light and a breakout could be amplified."
        ),
        "size_recommendation": "1-2% of portfolio",
        "time_horizon": "3-6 weeks",
        "key_risks": [
            "Broad market drawdown invalidates sector-level setups",
            "Earnings/data release before target reached",
        ],
        "invalidation": "Daily close below the most recent swing low",
    }


def _mock_answer(question: str) -> dict:
    return {
        "question": question,
        "answer": (
            "Based on current market conditions as of May 2026: the macroeconomic backdrop is characterised "
            "by sticky but declining inflation (CPI at 3.2%), a resilient labour market (unemployment 4.1%), "
            "and a Federal Reserve that has kept rates on hold at 5.25-5.50% but is signalling potential cuts "
            "in H2 2026. Equity markets are at all-time highs supported by strong AI-driven earnings growth. "
            "Treasury yields are elevated but stable, with the 10-year at 4.31%. The dollar is modestly strong. "
            "Risk assets broadly remain in an uptrend despite stretched valuations in pockets of the market."
        ),
        "confidence": "Medium-High",
        "disclaimer": "This is AI-generated analysis for informational purposes only. Not investment advice.",
    }


# ---------------------------------------------------------------------------
# Live Anthropic API helpers
# ---------------------------------------------------------------------------

def _get_client() -> Optional[anthropic.Anthropic]:
    if not settings.has_anthropic_key:
        return None
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _call_claude(prompt: str, max_tokens: int = 1024) -> str:
    client = _get_client()
    if client is None:
        raise RuntimeError("No Anthropic API key configured")
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_market(symbol: str, context_data: Optional[dict] = None) -> dict:
    """Return a structured market analysis for the given symbol."""
    if not settings.has_anthropic_key:
        logger.debug("No Anthropic key – returning mock analysis for %s", symbol)
        return _mock_market_analysis(symbol)

    ctx_str = ""
    if context_data:
        ctx_str = "\n\nContext data provided:\n"
        for k, v in context_data.items():
            ctx_str += f"  {k}: {v}\n"

    prompt = (
        f"Provide a structured market analysis for {symbol}. "
        f"Include: current technical outlook, key support/resistance levels, "
        f"near-term catalysts, risk factors, and an actionable recommendation.{ctx_str}\n\n"
        "Format your response as a JSON-compatible structure with keys: "
        "outlook, summary, key_levels (support/resistance lists), catalysts (list), "
        "risk_factors (list), recommendation, confidence, time_horizon."
    )

    try:
        import json
        raw = _call_claude(prompt, max_tokens=1200)
        # Try to parse as JSON; if that fails, wrap it
        try:
            parsed = json.loads(raw)
            parsed["symbol"] = symbol
            return parsed
        except json.JSONDecodeError:
            return {
                "symbol": symbol,
                "raw_analysis": raw,
                "outlook": "See raw_analysis",
                "confidence": "High",
            }
    except Exception as exc:
        logger.error("Claude analysis failed for %s: %s", symbol, exc)
        return _mock_market_analysis(symbol)


def get_daily_briefing(market_data: Optional[dict] = None, macro_data: Optional[dict] = None) -> dict:
    """Generate a morning market briefing."""
    if not settings.has_anthropic_key:
        return _mock_daily_briefing()

    market_str = ""
    if market_data:
        indices = market_data.get("indices", [])[:5]
        market_str = "Key market levels:\n"
        for idx in indices:
            market_str += f"  {idx.get('label', idx.get('symbol', ''))}: {idx.get('price')} ({idx.get('change_pct', 0):+.2f}%)\n"

    macro_str = ""
    if macro_data:
        macro_str = "Macro backdrop:\n"
        for series, data in list(macro_data.items())[:5]:
            if isinstance(data, dict) and "value" in data:
                macro_str += f"  {data.get('label', series)}: {data.get('value')} ({data.get('change', 0):+.3f})\n"

    prompt = (
        f"Generate a morning market briefing for today.\n\n{market_str}\n{macro_str}\n"
        "Structure your briefing with: executive_summary, headline (one sentence), "
        "key_themes (list of 4), watchlist (list of events with impact level), "
        "sector_rotation outlook, fx_outlook, rates_outlook. "
        "Be specific with numbers and actionable with views."
    )

    try:
        import json
        raw = _call_claude(prompt, max_tokens=1500)
        try:
            parsed = json.loads(raw)
            return parsed
        except json.JSONDecodeError:
            return {"raw_briefing": raw, "headline": "Daily Market Briefing"}
    except Exception as exc:
        logger.error("Daily briefing generation failed: %s", exc)
        return _mock_daily_briefing()


def answer_question(question: str, context: Optional[str] = None) -> dict:
    """Answer a free-form question about markets."""
    if not settings.has_anthropic_key:
        return _mock_answer(question)

    ctx_str = f"\n\nAdditional context: {context}" if context else ""
    prompt = (
        f"Answer the following market/finance question concisely and with precision:\n\n"
        f"{question}{ctx_str}\n\n"
        "Provide a clear answer, confidence level, and any important caveats."
    )

    try:
        raw = _call_claude(prompt, max_tokens=800)
        return {
            "question": question,
            "answer": raw,
            "confidence": "High",
            "disclaimer": "AI-generated analysis. Not investment advice.",
        }
    except Exception as exc:
        logger.error("Q&A failed: %s", exc)
        return _mock_answer(question)


JARVIS_SYSTEM_PROMPT = """You are JARVIS, an elite AI trading analyst embedded inside a Bloomberg-grade quantitative trading terminal.

The user is speaking to you via voice. Your response will be:
1. READ ALOUD by text-to-speech — so write naturally spoken sentences, no markdown, no bullet symbols, no special characters
2. Used to CONTROL the dashboard UI

You MUST respond in valid JSON with exactly two fields:
- "text": your spoken response (2-5 sentences max, natural conversational tone, no markdown)
- "action": one of:
  - {"type": "navigate", "view": "<view>"} where view is one of: terminal, macro, screener, news, ai
  - {"type": "navigate_symbol", "symbol": "<TICKER>", "view": "terminal"}
  - {"type": "none"}

Dashboard views available:
- "terminal": main trading chart and market overview (default for equity/FX/crypto analysis)
- "macro": yield curve, economic indicators, world monitor, correlation matrix
- "screener": top movers, sector heatmap, economic calendar
- "news": news feed from Reuters, FT, WSJ, CNBC
- "ai": AI analyst chat interface

Symbol routing: use standard Yahoo Finance tickers (AAPL, MSFT, BTC-USD, EURUSD=X, GC=F for gold, CL=F for oil, ^GSPC for S&P 500, ^VIX for VIX, etc.)

Examples:
- "show me the macro dashboard" → navigate to macro
- "what is Apple doing" → navigate_symbol AAPL
- "show me Bitcoin" → navigate_symbol BTC-USD
- "what are the top movers" → navigate to screener
- "give me the news" → navigate to news
- "analyze Tesla" → navigate_symbol TSLA
- "show me gold" → navigate_symbol GC=F
- "yield curve" → navigate to macro

Be concise, confident, and professional. Speak like a senior trader, not a customer service bot."""


def jarvis_query(query: str, context: Optional[dict] = None) -> dict:
    """Process a JARVIS voice command — return spoken text + UI action."""
    ctx_str = ""
    if context:
        current_view = context.get("currentView", "terminal")
        selected_symbol = context.get("selectedSymbol", "SPY")
        ctx_str = f"\nCurrent dashboard state: viewing '{current_view}', selected symbol is {selected_symbol}."

    if not settings.has_anthropic_key:
        return _mock_jarvis_response(query, context)

    prompt = f"User voice command: \"{query}\"{ctx_str}\n\nRespond with JSON only."

    try:
        import json
        client = _get_client()
        if client is None:
            return _mock_jarvis_response(query, context)

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            system=JARVIS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw.strip())
        return parsed
    except Exception as exc:
        logger.error("JARVIS Claude call failed: %s", exc)
        return _mock_jarvis_response(query, context)


def _mock_jarvis_response(query: str, context: Optional[dict] = None) -> dict:
    """Rule-based JARVIS fallback when no API key is configured."""
    q = query.lower().strip()

    nav_rules = [
        (["macro", "yield", "yields", "curve", "cpi", "inflation", "fed", "rates", "gdp", "indicators", "world monitor"], "macro"),
        (["news", "headlines", "latest", "happening", "reuters", "cnbc", "wsj"], "news"),
        (["screener", "movers", "gainers", "losers", "sectors", "heatmap", "calendar", "top stocks"], "screener"),
        (["ai analyst", "ask ai", "chat", "talk"], "ai"),
    ]

    symbol_map = {
        "apple": "AAPL", "microsoft": "MSFT", "nvidia": "NVDA", "google": "GOOGL",
        "alphabet": "GOOGL", "amazon": "AMZN", "tesla": "TSLA", "meta": "META",
        "netflix": "NFLX", "bitcoin": "BTC-USD", "btc": "BTC-USD", "ethereum": "ETH-USD",
        "eth": "ETH-USD", "solana": "SOL-USD", "gold": "GC=F", "oil": "CL=F",
        "crude": "CL=F", "silver": "SI=F", "s&p": "^GSPC", "s&p 500": "^GSPC",
        "spy": "SPY", "qqq": "QQQ", "vix": "^VIX", "dow": "^DJI",
        "nasdaq": "^IXIC", "euro": "EURUSD=X", "pound": "GBPUSD=X",
        "yen": "USDJPY=X", "eurusd": "EURUSD=X", "gbpusd": "GBPUSD=X",
        "jpmorgan": "JPM", "berkshire": "BRK-B", "visa": "V", "walmart": "WMT",
    }

    for keywords, view in nav_rules:
        if any(k in q for k in keywords):
            label_map = {
                "macro": "Navigating to the macro dashboard. You will see the yield curve, key economic indicators, and global market overview.",
                "news": "Opening the news feed. Here are the latest headlines from Reuters, the Financial Times, WSJ, and CNBC.",
                "screener": "Opening the screener. You can see today's top movers, sector performance, and the economic calendar.",
                "ai": "Opening the AI analyst. You can ask me anything about the markets.",
            }
            return {"text": label_map[view], "action": {"type": "navigate", "view": view}}

    for name, ticker in symbol_map.items():
        if name in q:
            readable = name.title()
            return {
                "text": f"Pulling up {readable} on the chart. I will analyze the current price action and key technical levels for you.",
                "action": {"type": "navigate_symbol", "symbol": ticker, "view": "terminal"},
            }

    briefing_keys = ["briefing", "summary", "morning", "overview", "market", "how are markets", "what's happening"]
    if any(k in q for k in briefing_keys):
        return {
            "text": "Markets are trading with a risk-on tone. The S&P 500 is up point four percent, the ten year Treasury yield is at four point three percent, and Bitcoin is holding above ninety five thousand. Technology is leading, with defensive sectors lagging slightly.",
            "action": {"type": "navigate", "view": "terminal"},
        }

    return {
        "text": f"I heard your query about {query[:60]}. Let me pull up the relevant information on the dashboard for you.",
        "action": {"type": "none"},
    }


def generate_trade_idea(symbol: str, data: Optional[dict] = None) -> dict:
    """Generate a trade idea for the given symbol."""
    if not settings.has_anthropic_key:
        return _mock_trade_idea(symbol)

    data_str = ""
    if data:
        latest_close = data.get("close")
        change_pct = data.get("change_pct")
        rsi = data.get("rsi")
        data_str = (
            f"\nLatest price data for {symbol}:\n"
            f"  Close: {latest_close}\n"
            f"  Change: {change_pct}%\n"
            f"  RSI(14): {rsi}\n"
        )

    prompt = (
        f"Generate a specific, actionable trade idea for {symbol}.{data_str}\n\n"
        "Include: direction (Long/Short), strategy type, specific entry price or condition, "
        "stop loss level with rationale, two profit targets, risk/reward ratio, "
        "position sizing as % of portfolio, time horizon, key risks, and invalidation criteria. "
        "Be precise with levels."
    )

    try:
        import json
        raw = _call_claude(prompt, max_tokens=1000)
        try:
            parsed = json.loads(raw)
            parsed["symbol"] = symbol
            return parsed
        except json.JSONDecodeError:
            return {
                "symbol": symbol,
                "raw_idea": raw,
                "direction": "See raw_idea",
            }
    except Exception as exc:
        logger.error("Trade idea generation failed for %s: %s", symbol, exc)
        return _mock_trade_idea(symbol)
