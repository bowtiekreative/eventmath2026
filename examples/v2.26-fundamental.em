note v2.26 — Stock Analysis: Buffett Fundamental Analysis Lens

note ── How It Works ──────────────────────────────────────────────────────────
note Fetches financial data for a ticker (Yahoo Finance) and scores it
note across four Buffett criteria, 0-25 points each:
note   moat              — competitive advantage (gross margin, ROE, growth)
note   earnings          — consistency over 5+ years
note   financial strength — debt/equity, current ratio
note   valuation         — P/E relative to earnings growth
note
note Verdict bands:
note   strong buy  ≥ 75 points
note   buy         ≥ 55 points
note   hold        ≥ 35 points
note   pass        ≥  0 points
note   insufficient data — more than 3 fields missing

note ── Single Stock Analysis ─────────────────────────────────────────────────
note Fetches live data when online; uses provided data when offline.

fundamental "AAPL" via buffett into aapl analysis
show aapl analysis

note ── Multiple Stocks ──────────────────────────────────────────────────────
note Analyze several tickers in one program. Each runs independently.

fundamental "KO" via buffett into ko analysis
fundamental "WMT" via buffett into wmt analysis
fundamental "BRK.B" via buffett into brk analysis

show ko analysis
show wmt analysis
show brk analysis

note ── Classic Buffett Picks ──────────────────────────────────────────────────
note Warren Buffett's known portfolio favorites, analyzed through his own lens.

fundamental "AMEX" via buffett into amex score
fundamental "BAC" via buffett into bac score
fundamental "MCO" via buffett into mco score

show amex score
show bac score
show mco score

note ── Reading the Results ────────────────────────────────────────────────────
note Each result object contains:
note   ticker      — stock symbol
note   scores      — { moat, earnings, financial_strength, valuation } each 0-25
note   total       — combined score 0-100
note   verdict     — strong buy / buy / hold / pass / insufficient data
note   reasoning   — explanation for each dimension
note   missing     — fields not available from the data source
note   questions   — what to research if data is missing
note   disclaimer  — "This is an educational analysis only. Not financial advice."

note ── Benjamin Graham Analysis ──────────────────────────────────────────────
note Swap "via buffett" for "via graham" to apply Graham's 7-criteria
note defensive investor checklist from "The Intelligent Investor" (1949).
note
note Graham's 7 criteria (scored 0-100):
note   1. Adequate size         (10 pts) — revenue or market cap above threshold
note   2. Financial condition   (20 pts) — current ratio ≥ 2.0, low long-term debt
note   3. Earnings stability    (20 pts) — positive EPS, consistent revenue
note   4. Dividend record       (15 pts) — free cash flow as proxy for dividends
note   5. Earnings growth       (15 pts) — revenue growth ≥ 10% = full score
note   6. Moderate P/E          (10 pts) — P/E ≤ 15x (Graham's ideal)
note   7. Moderate P/B          (10 pts) — P/E × P/B ≤ 22.5 (Graham's formula)
note
note The Graham Number: √(22.5 × EPS × Book Value per Share)
note   If current price < Graham Number → stock is potentially undervalued
note   Buffett learned this directly from Graham at Columbia Business School

fundamental "KO" via graham into ko graham score
show ko graham score

fundamental "JNJ" via graham into jnj graham score
show jnj graham score

note ── Buffett vs. Graham: Same Data, Different Lenses ──────────────────────
note Run both on the same stock to see how the two frameworks differ.
note Graham is more conservative; Buffett evolved the approach to include moat.

fundamental "KO" via buffett into ko buffett score
fundamental "KO" via graham into ko graham compare
show ko buffett score
show ko graham compare

note ── End of v2.26 Fundamental Analysis Example ─────────────────────────────
note Run: em v2.26-fundamental.em
note Disclaimer: Educational use only. Not financial advice.
note Sources: Warren Buffett letters to shareholders; Benjamin Graham, "The Intelligent Investor"
