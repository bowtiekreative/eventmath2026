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

note ── End of v2.26 Fundamental Analysis Example ─────────────────────────────
note Run: em v2.26-fundamental.em
note Disclaimer: Educational use only. Not financial advice.
