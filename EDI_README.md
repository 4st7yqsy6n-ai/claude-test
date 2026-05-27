# ⚡ Economic Deviation Indicator (EDI) — TradingView Pine Script v5

> A quantitative, multi-factor forex analysis matrix that goes significantly
> further than the IFF Spread / currency-strength tools you've seen.
> It fuses **28-pair CSI strength**, **statistical Z-score deviation**,
> **CFTC COT institutional positioning**, **momentum**, and **persistence**
> into one ranked composite score per currency and an auto-detected pair spread.

---

## What makes this better than IFF Spread / standard CSI tools

| Feature | IFF Spread | Standard CSI | **EDI** |
|---------|-----------|-------------|---------|
| Currency pairs used | Unknown | Varies | **28 majors** (all 8 currencies fully cross-referenced) |
| Statistical deviation | ❌ | ❌ | ✅ Z-score (σ from rolling mean) |
| Institutional data | ❌ | ❌ | ✅ CFTC COT (real or price proxy) |
| Δ Flow (acceleration) | ❌ | Partial | ✅ 5-bar CSI acceleration |
| Momentum | ❌ | ❌ | ✅ Fast EMA − Slow EMA |
| Persistence | ❌ | ❌ | ✅ Consecutive directional bars |
| Weighted composite | ❌ | ❌ | ✅ User-tunable score per currency |
| Top pair suggestion | ❌ | ❌ | ✅ Auto-detects highest spread pair |
| Alerts | Partial | ❌ | ✅ 6 alert conditions |

---

## Indicator components

### 1 · Currency Strength Index (CSI)
Derives individual currency strength from **all 28 major FX pairs** using RSI.

- Each currency participates in **exactly 7 pairs** (complete G8 cross-matrix)
- When a currency is the **base** of a pair → its RSI directly adds to CSI
- When a currency is the **quote** of a pair → `(100 − RSI)` is used (inverted)
- Smoothed with a configurable EMA to reduce noise
- Result: CSI ∈ [0, 100]; **50 = neutral**, >50 = strong, <50 = weak

### 2 · Statistical Deviation (Z-Score)
Measures how far today's CSI is from its historical mean.

```
Z = (CSI − SMA(CSI, N)) / StdDev(CSI, N)
```

- **+1.5σ and above** → historically overbought strength; reversion risk or strong trend
- **−1.5σ and below** → historically oversold; support or trend reversal setup
- Works on any timeframe; longer lookbacks give macro-scale signals
- Background turns **yellow** when any currency hits extreme deviation

### 3 · Δ Flow (acceleration)
`Δ Flow = CSI[0] − CSI[N bars ago]`

- Positive → currency gaining momentum (institutions accumulating)
- Negative → currency losing momentum (distribution)
- Combined with Z-score gives mean-reversion vs. momentum-continuation context

### 4 · COT Institutional Data (2 modes)

#### Mode A — Real CFTC (requires TradingView COT data)
Fetches the **weekly CFTC Commitments of Traders futures-only report**.
Net Non-Commercial position = Large Speculators (hedge funds, CTAs).

| Currency | CFTC Ticker (TradingView) | CME Code |
|----------|--------------------------|----------|
| EUR | `CFTC:099741_FO_ALL` | Euro FX |
| GBP | `CFTC:096742_FO_ALL` | British Pound |
| JPY | `CFTC:097741_FO_ALL` | Japanese Yen (inverted) |
| CHF | `CFTC:092741_FO_ALL` | Swiss Franc |
| CAD | `CFTC:090741_FO_ALL` | Canadian Dollar |
| AUD | `CFTC:232741_FO_ALL` | Australian Dollar |
| NZD | `CFTC:112741_FO_ALL` | New Zealand Dollar |
| USD | `CFTC:098662_FO_ALL` | US Dollar Index |

> **Note:** JPY futures are quoted as JPY per USD, so the net position is
> inverted to align with standard chart direction (USD/JPY).

Each series is normalised over a rolling `N`-week window to [−50, +50] so
currencies with different contract sizes are directly comparable.

#### Mode B — Price-Based Proxy (no extra data, works everywhere)
Approximates institutional vs retail sentiment divergence:

```
Proxy = RSI(CSI, 50 bars) − RSI(CSI, 10 bars)
```

- **50-bar RSI** ≈ institutional / trend-following horizon
- **10-bar RSI** ≈ retail / short-term horizon
- Large positive spread → institutions more bullish than retail → strong long bias
- Large negative spread → institutional distribution signal

### 5 · Momentum
`Momentum = EMA(CSI, fast) − EMA(CSI, slow)`

Standard MACD-style measurement applied to the currency strength index
rather than raw price.

### 6 · Persistence
Counts how many **consecutive bars** the CSI has moved in the same direction
within the lookback window. Signed: positive = consecutive up-bars, negative = consecutive down-bars.

High persistence + strong CSI = trending currency → momentum confirmation.
Low persistence despite strong CSI = choppy → avoid or trade smaller.

### 7 · Composite Score
A **single quantitative score** per currency, range [−1, +1]:

```
Score = (Strength × w_str) + (Deviation × w_dev) + (COT × w_cot)
      + (Momentum × w_mom) + (Persistence × w_pers)
```

All components are first normalised to [−1, +1]:
- Strength:    `(CSI − 50) / 50`
- Deviation:   `Z / 3`
- COT:         `COT_value / 50`
- Momentum:    `Mom / 10`
- Persistence: `Persist / window`

Default weights (adjustable in settings):
| Component | Default |
|-----------|---------|
| Strength  | ~33.75% |
| Deviation | ~22.5%  |
| Momentum  | ~11.25% |
| Persistence| ~7.5%  |
| COT       | 25%     |

### 8 · Pair Spread & Signal
The indicator auto-detects your chart symbol and extracts base/quote.

```
EDI Spread = Composite(BASE) − Composite(QUOTE)
```

- **Positive spread** → fundamental bias to go LONG the pair
- **Negative spread** → fundamental bias to go SHORT the pair
- Chart shows the spread scaled ×100 as both a line and histogram

---

## Where to find public institutional / bank positioning data

These are all **free and publicly available**:

### CFTC COT Reports (most important)
- **Official CFTC website:** https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- Weekly, released every Friday at 3:30 PM EST (covering previous Tuesday)
- **TradingView:** Search `CFTC:` prefix → use codes above
- **Barchart:** https://www.barchart.com/futures/commitment-of-traders/currencies
- **Quandl / Nasdaq Data Link:** `CFTC/...` dataset (free tier available)

### Central Bank Speeches & Policy
- **Fed:** https://www.federalreserve.gov/newsevents/speeches.htm
- **ECB:** https://www.ecb.europa.eu/press/key/html/index.en.html
- **BOE:** https://www.bankofengland.co.uk/news/speeches
- **BOJ:** https://www.boj.or.jp/en/announcements/press/koen_2024/index.htm

### BIS (Bank for International Settlements)
- Quarterly Review — shows bank positioning and cross-border flows
- https://www.bis.org/publ/qtrpdf/r_qt2406.htm

### IMF COFER (Currency Composition of Official Foreign Exchange Reserves)
- Shows which currencies central banks hold in reserves
- https://data.imf.org/?sk=e6a5f467-c14b-4aa8-9f6d-5a09ec4e62a4

### TradingEconomics (macro data)
- Interest rate differentials, GDP, inflation — free tier
- https://tradingeconomics.com/currencies

### Speculative Positioning (alternative free sources)
- **DailyFX COT:** https://www.dailyfx.com/sentiment
- **Investing.com COT:** https://www.investing.com/tools/commitments-of-traders
- **Oanda Order Book:** https://www.oanda.com/forex-trading/analysis/open-position-ratios

---

## How to install

1. Open TradingView → Pine Script Editor (bottom of chart)
2. Paste the full contents of `EDI_Economic_Deviation_Indicator.pine`
3. Click **Add to chart**
4. Apply to any forex pair (indicator auto-detects the symbol)

## Recommended settings

| Use case | CSI Len | Smoothing | Z-Score | COT Mode | COT Weight |
|----------|---------|-----------|---------|----------|------------|
| Swing (H4/D) | 14 | 5 | 100 | Proxy or Real | 0.25 |
| Macro (W/M) | 14 | 10 | 200 | Real CFTC | 0.35 |
| Intraday (M15/H1) | 7 | 3 | 50 | Proxy | 0.10 |
| COT-focused | 14 | 5 | 100 | Real CFTC | 0.40 |

## Reading the matrix

```
⚡ ECONOMIC DEVIATION INDICATOR (EDI) v1.0
USDJPY  BASE:0.58  QUOTE:-0.61  SPREAD:1.19  STRONG BULL  EXPAND:EXPANDING  HTF:BULL ALIGN

CCY │ CSI  │ NET%  │ Δ FLOW │ Z-SCORE σ     │ COT/INST │ MOMENTUM │ PERSIST │ STATE      │ SIGNAL
USD │ 57.8 │ +7.8  │ +2.1  │ +1.23σ ABOVE  │ ▲ LONG   │ ▲ 3.12  │  7      │ BULL       │ ▲ LONG
EUR │ 44.2 │ -5.8  │ -1.3  │ -0.87σ BELOW  │ ▼ BIAS-  │ ▼ -2.1  │ -5      │ BEAR       │ ▼ SHORT
...
🔎 TOP SETUP: USDJPY  SPREAD:1.19  (USD LONG vs JPY SHORT)
```

**Column guide:**
- `CSI` — raw currency strength [0–100], 50 = neutral
- `NET %` — distance from 50 (signed), directly comparable across currencies
- `Δ FLOW` — 5-bar acceleration; positive = gaining, negative = losing
- `Z-SCORE` — standard deviations from mean + contextual label
- `COT/INST` — institutional positioning direction and magnitude
- `MOMENTUM` — fast EMA minus slow EMA of CSI
- `PERSIST` — consecutive same-direction bars (positive = bullish streak)
- `STATE` — qualitative label from composite score
- `SIGNAL` — directional trade signal from composite score

---

## Alerts available

| Alert name | Trigger |
|-----------|---------|
| `EDI Strong Bull` | Spread > 0.5 (strong bullish bias) |
| `EDI Strong Bear` | Spread < −0.5 |
| `EDI Bull Cross` | Spread crosses above 0 |
| `EDI Bear Cross` | Spread crosses below 0 |
| `EDI Extreme Deviation` | Any currency hits ±threshold σ |
| `EDI Strong Signal Entry` | Spread enters ±0.5 zone |

---

## Limitations

- Pine Script `request.security()` limit: 40 calls. EDI uses 36 (28 pairs + 8 COT). Stay under this.
- CFTC COT data is **weekly** and lags by ~3 days. Use it as context, not timing.
- CSI is derived from RSI which lags by its length. Shorter RSI = faster but noisier.
- Z-score requires `dev_len` bars to stabilise (default 100). Works poorly on very new instruments.
- This is a **fundamental bias tool**, not a timing entry tool. Combine with price action / structure.
