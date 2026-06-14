'use strict';

/**
 * EventMath Fundamental Runtime v2.26
 * Warren Buffett-style fundamental analysis with live Yahoo Finance data.
 * Uses ONLY Node.js standard library (no npm).
 */

const https = require('https');

const FETCH_TIMEOUT_MS = 5000;
const IDEAL_PE = 15;

// _httpsGet — fire a GET request and resolve with the parsed JSON body or null on error
function _httpsGet(url) {
  return new Promise((resolve) => {
    let req;
    const timer = setTimeout(() => {
      if (req) req.destroy();
      resolve(null);
    }, FETCH_TIMEOUT_MS);

    try {
      req = https.get(url, {
        headers: { 'User-Agent': 'EventMath-Fundamental/2.26' },
      }, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(raw));
          } catch (_e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    } catch (_e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// _safeGet — safely navigate a nested object path, returning undefined when missing
function _safeGet(obj, ...keys) {
  return keys.reduce((cur, k) => (cur != null ? cur[k] : undefined), obj);
}

// _extractChartData — pull what we can from Yahoo chart response
function _extractChartData(json) {
  const result = {};
  try {
    const meta = _safeGet(json, 'chart', 'result', 0, 'meta');
    if (!meta) return result;
    if (meta.regularMarketPrice != null) result.price = meta.regularMarketPrice;
    if (meta.marketCap != null) result.market_cap = meta.marketCap;
  } catch (_e) {}
  return result;
}

// _extractSummaryData — pull fundamentals from Yahoo quoteSummary response
function _extractSummaryData(json) {
  const result = {};
  try {
    const ks = _safeGet(json, 'quoteSummary', 'result', 0, 'defaultKeyStatistics');
    const fd = _safeGet(json, 'quoteSummary', 'result', 0, 'financialData');

    if (ks) {
      if (_safeGet(ks, 'trailingEps', 'raw') != null) result.eps = ks.trailingEps.raw;
      if (_safeGet(ks, 'trailingPE', 'raw') != null) result.pe_ratio = ks.trailingPE.raw;
      if (_safeGet(ks, 'returnOnEquity', 'raw') != null) result.roe = ks.returnOnEquity.raw;
      if (_safeGet(ks, 'debtToEquity', 'raw') != null) result.debt_to_equity = ks.debtToEquity.raw / 100;
      if (_safeGet(ks, 'enterpriseToEbitda', 'raw') != null) result.enterprise_to_ebitda = ks.enterpriseToEbitda.raw;
      if (_safeGet(ks, 'marketCap', 'raw') != null) result.market_cap = ks.marketCap.raw;
    }

    if (fd) {
      if (_safeGet(fd, 'freeCashflow', 'raw') != null) result.free_cash_flow = fd.freeCashflow.raw;
      if (_safeGet(fd, 'revenueGrowth', 'raw') != null) result.revenue_growth = fd.revenueGrowth.raw;
      if (_safeGet(fd, 'grossMargins', 'raw') != null) result.gross_margins = fd.grossMargins.raw;
      if (_safeGet(fd, 'returnOnEquity', 'raw') != null && result.roe == null) {
        result.roe = fd.returnOnEquity.raw;
      }
      if (_safeGet(fd, 'totalDebt', 'raw') != null) result.total_debt = fd.totalDebt.raw;
    }
  } catch (_e) {}
  return result;
}

// _scoreMoat — evaluate economic moat indicators from data, return 0-25
function _scoreMoat(data) {
  let score = 0;
  const signals = [];

  if ((data.gross_margins || 0) > 0.40) {
    score += 10;
    signals.push('Gross margin above 40% suggests pricing power');
  } else if ((data.gross_margins || 0) > 0.25) {
    score += 5;
    signals.push('Moderate gross margin above 25%');
  }

  if ((data.roe || 0) > 0.20) {
    score += 8;
    signals.push('ROE above 20% indicates durable competitive advantage');
  } else if ((data.roe || 0) > 0.12) {
    score += 4;
    signals.push('Acceptable ROE above 12%');
  }

  if ((data.revenue_growth || 0) > 0.10) {
    score += 7;
    signals.push('Revenue growing above 10% annually');
  } else if ((data.revenue_growth || 0) > 0.04) {
    score += 3;
    signals.push('Moderate revenue growth above 4%');
  }

  if (signals.length === 0) {
    signals.push('Insufficient data to assess moat');
  }

  return { score: Math.min(score, 25), signals };
}

// _scoreEarnings — evaluate earnings consistency, return 0-25
function _scoreEarnings(data) {
  let score = 0;
  const signals = [];

  if ((data.eps || 0) > 0) {
    score += 15;
    signals.push(`Positive EPS of ${(data.eps || 0).toFixed(2)}`);
  } else if (data.eps != null) {
    signals.push('Negative EPS — earnings not consistent');
  }

  if ((data.revenue_growth || 0) > 0.05) {
    score += 10;
    signals.push('Positive revenue growth supports earnings trend');
  } else if ((data.revenue_growth || 0) >= 0) {
    score += 4;
    signals.push('Flat or modest revenue growth');
  }

  if (signals.length === 0) {
    signals.push('EPS and revenue data unavailable');
  }

  return { score: Math.min(score, 25), signals };
}

// _scoreFinancialStrength — evaluate balance sheet health, return 0-25
function _scoreFinancialStrength(data) {
  let score = 0;
  const signals = [];

  const de = data.debt_to_equity;
  if (de != null) {
    if (de < 0.5) {
      score += 15;
      signals.push(`Debt/Equity of ${de.toFixed(2)} is below ideal 0.5`);
    } else if (de < 1.0) {
      score += 8;
      signals.push(`Debt/Equity of ${de.toFixed(2)} is moderate`);
    } else {
      score += 2;
      signals.push(`High Debt/Equity of ${de.toFixed(2)} is a concern`);
    }
  }

  if (data.free_cash_flow != null) {
    if (data.free_cash_flow > 0) {
      score += 10;
      signals.push('Positive free cash flow');
    } else {
      score += 0;
      signals.push('Negative free cash flow — watch closely');
    }
  }

  if (signals.length === 0) {
    signals.push('D/E and FCF data unavailable');
  }

  return { score: Math.min(score, 25), signals };
}

// _scoreValuation — compare P/E to Buffett's 15x ideal, return 0-25
function _scoreValuation(data) {
  let score = 0;
  const signals = [];

  const pe = data.pe_ratio;
  if (pe != null && pe > 0) {
    if (pe <= IDEAL_PE) {
      score += 25;
      signals.push(`P/E of ${pe.toFixed(1)}x is at or below ideal ${IDEAL_PE}x`);
    } else if (pe <= 20) {
      score += 18;
      signals.push(`P/E of ${pe.toFixed(1)}x is slightly above ideal ${IDEAL_PE}x but acceptable`);
    } else if (pe <= 30) {
      score += 10;
      signals.push(`P/E of ${pe.toFixed(1)}x is above ideal ${IDEAL_PE}x — premium priced`);
    } else {
      score += 3;
      signals.push(`P/E of ${pe.toFixed(1)}x is significantly above ideal ${IDEAL_PE}x`);
    }
  } else if (pe != null && pe <= 0) {
    signals.push('Negative or zero P/E — company may not be profitable');
  } else {
    signals.push('P/E ratio unavailable — valuation cannot be assessed');
  }

  return { score: Math.min(score, 25), signals };
}

// buffettAnalysis — fetch Yahoo Finance data and apply Warren Buffett scoring criteria
async function buffettAnalysis(ticker, providedData = {}) {
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
  const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics%2CfinancialData`;

  const [chartJson, summaryJson] = await Promise.all([
    _httpsGet(chartUrl),
    _httpsGet(summaryUrl),
  ]);

  const fetched = Object.assign(
    {},
    _extractChartData(chartJson),
    _extractSummaryData(summaryJson)
  );

  // providedData overrides fetched
  const data = Object.assign({}, fetched, providedData);

  const FIELDS = ['pe_ratio', 'eps', 'roe', 'debt_to_equity', 'free_cash_flow', 'revenue_growth', 'market_cap'];
  const missing = FIELDS.filter(f => data[f] == null);
  const questions = missing.map(f => {
    const label = f.replace(/_/g, ' ');
    return `What is ${ticker}'s current ${label}?`;
  });

  const moatResult = _scoreMoat(data);
  const earningsResult = _scoreEarnings(data);
  const financialResult = _scoreFinancialStrength(data);
  const valuationResult = _scoreValuation(data);

  const scores = {
    moat: moatResult.score,
    earnings: earningsResult.score,
    financial_strength: financialResult.score,
    valuation: valuationResult.score,
  };

  const total = scores.moat + scores.earnings + scores.financial_strength + scores.valuation;

  let verdict;
  if (missing.length > 3) {
    verdict = 'insufficient data';
  } else if (total >= 75) {
    verdict = 'strong buy';
  } else if (total >= 55) {
    verdict = 'buy';
  } else if (total >= 35) {
    verdict = 'hold';
  } else {
    verdict = 'pass';
  }

  const reasoning = [
    ...moatResult.signals,
    ...earningsResult.signals,
    ...financialResult.signals,
    ...valuationResult.signals,
  ];

  return {
    ticker,
    timestamp: Date.now(),
    data: {
      pe_ratio: data.pe_ratio || null,
      eps: data.eps || null,
      roe: data.roe || null,
      debt_to_equity: data.debt_to_equity || null,
      free_cash_flow: data.free_cash_flow || null,
      market_cap: data.market_cap || null,
      revenue_growth: data.revenue_growth || null,
    },
    missing,
    questions,
    scores,
    total,
    verdict,
    reasoning,
    disclaimer: 'This is an educational analysis only. Not financial advice.',
  };
}

// assessMoat — score a ticker's economic moat from pre-fetched data, return structured result
function assessMoat(ticker, data = {}) {
  let score = 0;
  const signals = [];
  let moat_type = 'none';

  const grossMargin = data.gross_margins || data.gross_margin || null;
  const roe = data.roe || null;
  const revenueGrowth = data.revenue_growth || null;
  const sector = (data.sector || '').toLowerCase();

  if (grossMargin != null && grossMargin > 0.40) {
    score += 10;
    signals.push('High gross margin (>40%) indicates pricing power moat');
  } else if (grossMargin != null && grossMargin > 0.25) {
    score += 5;
    signals.push('Moderate gross margin suggests partial moat');
  }

  if (roe != null && roe > 0.20) {
    score += 8;
    signals.push('High ROE (>20%) reflects durable competitive advantage');
  } else if (roe != null && roe > 0.12) {
    score += 4;
    signals.push('Acceptable ROE above 12%');
  }

  if (revenueGrowth != null && revenueGrowth > 0.10) {
    score += 4;
    signals.push('Strong revenue growth supports network or brand moat');
  }

  // Sector moat bonuses
  if (['technology', 'software', 'platform'].some(s => sector.includes(s))) {
    score += 3;
    signals.push('Technology/platform sector often features switching-cost moats');
  } else if (['consumer', 'beverage', 'food', 'brand'].some(s => sector.includes(s))) {
    score += 3;
    signals.push('Consumer brand sector supports brand moat potential');
  }

  score = Math.min(score, 25);

  if (score >= 18) {
    moat_type = 'wide';
  } else if (score >= 9) {
    moat_type = 'narrow';
  } else {
    moat_type = 'none';
  }

  if (signals.length === 0) {
    signals.push('Insufficient data to evaluate moat');
  }

  return { ticker, moat_type, score, signals };
}

// _bar — render a block-char progress bar scaled to barWidth chars
function _bar(score, max, barWidth) {
  const filled = Math.round((score / max) * barWidth);
  const empty = barWidth - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// generateScorecard — format a buffettAnalysis result as a printable scorecard string
function generateScorecard(ticker, analysis) {
  const s = analysis.scores || {};
  const total = analysis.total || 0;
  const verdict = (analysis.verdict || 'unknown').toUpperCase();
  const BAR_W = 8;

  const moatBar = _bar(s.moat || 0, 25, BAR_W);
  const earningsBar = _bar(s.earnings || 0, 25, BAR_W);
  const financialBar = _bar(s.financial_strength || 0, 25, BAR_W);
  const valuationBar = _bar(s.valuation || 0, 25, BAR_W);

  const label = (str, width) => str.padEnd(width);

  const lines = [
    `═══ Buffett Scorecard: ${ticker} ════════════════`,
    `${label('Moat', 16)}${moatBar}  ${String(s.moat || 0).padStart(2)}/25`,
    `${label('Earnings', 16)}${earningsBar}  ${String(s.earnings || 0).padStart(2)}/25`,
    `${label('Financial', 16)}${financialBar}  ${String(s.financial_strength || 0).padStart(2)}/25`,
    `${label('Valuation', 16)}${valuationBar}  ${String(s.valuation || 0).padStart(2)}/25`,
    '─────────────────────────────────────────────',
    `${label('Total', 16)}${String(total).padStart(2)}/100    ${verdict}`,
    '─────────────────────────────────────────────',
    'Reasoning:',
  ];

  const reasoning = analysis.reasoning || [];
  for (const r of reasoning) {
    lines.push(`• ${r}`);
  }

  lines.push('═════════════════════════════════════════════');
  lines.push('⚠  Not financial advice. Educational use only.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// grahamNumber(eps, bookValuePerShare) — SYNC
// Calculates Benjamin Graham's intrinsic value estimate: √(22.5 × EPS × BV/share)
// ---------------------------------------------------------------------------

function grahamNumber(eps, bookValuePerShare) {
  if (eps == null || bookValuePerShare == null || eps <= 0 || bookValuePerShare <= 0) {
    return { error: 'Insufficient data for Graham Number', grahamNumber: null };
  }
  const gn = Math.sqrt(22.5 * eps * bookValuePerShare);
  return {
    grahamNumber: gn,
    eps,
    bookValuePerShare,
    maxPrice: gn,
    verdict: null, // No current price provided; caller must compare
  };
}

// ---------------------------------------------------------------------------
// grahamAnalysis(ticker, providedData) — ASYNC
// Applies Benjamin Graham's 7 criteria from The Intelligent Investor
// ---------------------------------------------------------------------------

async function grahamAnalysis(ticker, providedData = {}) {
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
  const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics%2CfinancialData`;

  const [chartJson, summaryJson] = await Promise.all([
    _httpsGet(chartUrl),
    _httpsGet(summaryUrl),
  ]);

  // Also try to pull pb_ratio and current_ratio from summaryData if available
  const fetched = Object.assign(
    {},
    _extractChartData(chartJson),
    _extractSummaryData(summaryJson),
    _extractGrahamExtras(summaryJson)
  );

  // providedData overrides fetched
  const data = Object.assign({}, fetched, providedData);

  // Fields needed for Graham's 7 criteria
  const FIELDS = [
    'revenue', 'market_cap',       // 1. Adequate size
    'current_ratio',               // 2. Financial condition
    'eps',                         // 3. Earnings stability
    'free_cash_flow',              // 4. Dividend record (proxy)
    'revenue_growth',              // 5. Earnings growth
    'pe_ratio',                    // 6. Moderate P/E
    'pb_ratio',                    // 7. Moderate P/B
  ];
  const missing = FIELDS.filter(f => data[f] == null);
  const questions = missing.map(f => {
    const qmap = {
      revenue: `What is ${ticker}'s annual revenue?`,
      market_cap: `What is ${ticker}'s current market capitalization?`,
      current_ratio: `What is ${ticker}'s current ratio?`,
      eps: `What is ${ticker}'s trailing twelve-month EPS?`,
      free_cash_flow: `Does ${ticker} pay consistent dividends?`,
      revenue_growth: `What has been ${ticker}'s earnings growth over the past 5 years?`,
      pe_ratio: `What is ${ticker}'s current P/E ratio?`,
      pb_ratio: `What is ${ticker}'s current price-to-book ratio?`,
    };
    return qmap[f] || `What is ${ticker}'s current ${f.replace(/_/g, ' ')}?`;
  });

  // Score each of Graham's 7 criteria
  const scores = {};
  const reasoning = [];

  // 1. Adequate size (0-10 pts)
  {
    let s = 0;
    if (data.revenue != null && data.revenue >= 100e6) {
      s = 10; reasoning.push('Revenue meets Graham\'s minimum size threshold (≥ $100M)');
    } else if (data.market_cap != null && data.market_cap >= 500e6) {
      s = 7; reasoning.push('Market cap suggests adequate enterprise size (≥ $500M)');
    } else if (data.revenue != null || data.market_cap != null) {
      s = 3; reasoning.push('Company appears below Graham\'s preferred size threshold');
    } else {
      reasoning.push('Size data unavailable — cannot assess adequate size criterion');
    }
    scores.adequate_size = Math.min(s, 10);
  }

  // 2. Financial condition (0-20 pts)
  {
    let s = 0;
    const cr = data.current_ratio;
    if (cr != null) {
      if (cr >= 2.0) {
        s += 15; reasoning.push(`Current ratio of ${cr.toFixed(2)} meets Graham's ≥ 2.0 standard`);
      } else if (cr >= 1.5) {
        s += 8; reasoning.push(`Current ratio of ${cr.toFixed(2)} is below Graham's ideal but acceptable`);
      } else {
        reasoning.push(`Current ratio of ${cr.toFixed(2)} is below Graham's minimum of 1.5`);
      }
    } else {
      reasoning.push('Current ratio unavailable — financial condition partially unscored');
    }
    // LTD <= 2× net working capital proxy: use debt_to_equity as signal
    if (data.debt_to_equity != null) {
      if (data.debt_to_equity < 0.5) {
        s += 5; reasoning.push('Low debt-to-equity supports Graham\'s long-term debt constraint');
      } else if (data.debt_to_equity < 1.0) {
        s += 2; reasoning.push('Moderate debt-to-equity — borderline on Graham\'s debt criterion');
      }
    }
    scores.financial_condition = Math.min(s, 20);
  }

  // 3. Earnings stability (0-20 pts)
  {
    let s = 0;
    if (data.eps != null && data.eps > 0) {
      s = 20; reasoning.push(`Positive EPS of ${data.eps.toFixed(2)} supports earnings stability`);
    } else if (data.eps != null && data.eps <= 0) {
      s = 0; reasoning.push('Negative EPS — fails Graham\'s earnings stability criterion');
    } else {
      reasoning.push('EPS unavailable — earnings stability cannot be confirmed');
    }
    scores.earnings_stability = Math.min(s, 20);
  }

  // 4. Dividend record (0-15 pts) — proxy: positive free cash flow
  {
    let s = 0;
    if (data.free_cash_flow != null && data.free_cash_flow > 0) {
      s = 15; reasoning.push('Positive free cash flow supports capacity for uninterrupted dividends');
    } else if (data.free_cash_flow != null && data.free_cash_flow <= 0) {
      s = 0; reasoning.push('Negative free cash flow — dividend capacity in question');
    } else {
      reasoning.push('Free cash flow unavailable — dividend record cannot be assessed');
    }
    scores.dividend_record = Math.min(s, 15);
  }

  // 5. Earnings growth (0-15 pts)
  {
    let s = 0;
    const rg = data.revenue_growth;
    if (rg != null) {
      if (rg > 0.10) {
        s = 15; reasoning.push(`Revenue growth of ${(rg * 100).toFixed(1)}% exceeds Graham's 10% growth threshold`);
      } else if (rg > 0.03) {
        s = 8; reasoning.push(`Moderate revenue growth of ${(rg * 100).toFixed(1)}% — partially meets Graham's standard`);
      } else {
        s = 0; reasoning.push(`Revenue growth of ${(rg * 100).toFixed(1)}% is below Graham's preferred minimum`);
      }
    } else {
      reasoning.push('Revenue growth data unavailable — earnings growth unscored');
    }
    scores.earnings_growth = Math.min(s, 15);
  }

  // 6. Moderate P/E (0-10 pts)
  {
    let s = 0;
    const pe = data.pe_ratio;
    if (pe != null && pe > 0) {
      if (pe <= 15) {
        s = 10; reasoning.push(`P/E of ${pe.toFixed(1)}x meets Graham's ≤ 15 standard`);
      } else if (pe <= 20) {
        s = 6; reasoning.push(`P/E of ${pe.toFixed(1)}x is slightly above Graham's ideal — moderate`);
      } else if (pe <= 25) {
        s = 3; reasoning.push(`P/E of ${pe.toFixed(1)}x exceeds Graham's guideline — premium priced`);
      } else {
        s = 0; reasoning.push(`P/E of ${pe.toFixed(1)}x significantly exceeds Graham's ≤ 15 criterion`);
      }
    } else if (pe != null) {
      reasoning.push('Negative or zero P/E — company may not be profitable');
    } else {
      reasoning.push('P/E ratio unavailable — cannot score moderate P/E criterion');
    }
    scores.moderate_pe = Math.min(s, 10);
  }

  // 7. Moderate P/B (0-10 pts)
  {
    let s = 0;
    const pe = data.pe_ratio;
    const pb = data.pb_ratio;
    if (pe != null && pe > 0 && pb != null && pb > 0) {
      const product = pe * pb;
      if (product <= 22.5) {
        s = 10; reasoning.push(`P/E × P/B = ${product.toFixed(1)} meets Graham's ≤ 22.5 combined test`);
      } else {
        s = 0; reasoning.push(`P/E × P/B = ${product.toFixed(1)} exceeds Graham's 22.5 combined ceiling`);
        // Fall back to P/B alone for partial credit
        if (pb <= 1.5) { s = 7; reasoning.push(`P/B of ${pb.toFixed(2)} alone is below 1.5 — partial credit awarded`); }
        else if (pb <= 2.5) { s = 4; reasoning.push(`P/B of ${pb.toFixed(2)} is below 2.5 — modest partial credit`); }
      }
    } else if (pb != null && pb > 0) {
      if (pb <= 1.5) {
        s = 10; reasoning.push(`P/B of ${pb.toFixed(2)} meets Graham's ≤ 1.5 standalone standard`);
      } else if (pb <= 2.5) {
        s = 5; reasoning.push(`P/B of ${pb.toFixed(2)} is moderate — partially meets Graham's guideline`);
      } else {
        s = 0; reasoning.push(`P/B of ${pb.toFixed(2)} exceeds Graham's preferred level`);
      }
    } else {
      reasoning.push('P/B ratio unavailable — cannot score moderate P/B criterion');
    }
    scores.moderate_pb = Math.min(s, 10);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  let verdict;
  if (missing.length > 3) {
    verdict = 'insufficient data';
  } else if (total >= 75) {
    verdict = 'strong buy';
  } else if (total >= 55) {
    verdict = 'buy';
  } else if (total >= 35) {
    verdict = 'hold';
  } else {
    verdict = 'pass';
  }

  return {
    ticker,
    timestamp: Date.now(),
    data: {
      revenue: data.revenue || null,
      market_cap: data.market_cap || null,
      current_ratio: data.current_ratio || null,
      eps: data.eps || null,
      free_cash_flow: data.free_cash_flow || null,
      revenue_growth: data.revenue_growth || null,
      pe_ratio: data.pe_ratio || null,
      pb_ratio: data.pb_ratio || null,
      debt_to_equity: data.debt_to_equity || null,
    },
    scores,
    total,
    verdict,
    reasoning,
    missing,
    questions,
    disclaimer: 'This is an educational analysis using Benjamin Graham\'s criteria. Not financial advice.',
  };
}

// _extractGrahamExtras — pull pb_ratio and current_ratio from Yahoo quoteSummary
function _extractGrahamExtras(json) {
  const result = {};
  try {
    const ks = _safeGet(json, 'quoteSummary', 'result', 0, 'defaultKeyStatistics');
    const fd = _safeGet(json, 'quoteSummary', 'result', 0, 'financialData');

    if (ks) {
      if (_safeGet(ks, 'priceToBook', 'raw') != null) result.pb_ratio = ks.priceToBook.raw;
    }
    if (fd) {
      if (_safeGet(fd, 'currentRatio', 'raw') != null) result.current_ratio = fd.currentRatio.raw;
      if (_safeGet(fd, 'totalRevenue', 'raw') != null) result.revenue = fd.totalRevenue.raw;
    }
  } catch (_e) {}
  return result;
}

// ---------------------------------------------------------------------------
// generateGrahamScorecard(ticker, analysis) — SYNC
// Formats a grahamAnalysis result as a printable ASCII scorecard
// ---------------------------------------------------------------------------

function generateGrahamScorecard(ticker, analysis) {
  const s = analysis.scores || {};
  const total = analysis.total || 0;
  const verdict = (analysis.verdict || 'unknown').toUpperCase();
  const BAR_W = 8;

  const criteria = [
    { key: 'adequate_size',      label: 'Adequate Size',      max: 10 },
    { key: 'financial_condition', label: 'Financial Cond.',   max: 20 },
    { key: 'earnings_stability', label: 'Earns. Stability',   max: 20 },
    { key: 'dividend_record',    label: 'Dividend Record',    max: 15 },
    { key: 'earnings_growth',    label: 'Earnings Growth',    max: 15 },
    { key: 'moderate_pe',        label: 'Moderate P/E',       max: 10 },
    { key: 'moderate_pb',        label: 'Moderate P/B',       max: 10 },
  ];

  const label = (str, width) => str.padEnd(width);

  const lines = [
    `═══ Graham Scorecard: ${ticker} ════════════════`,
  ];

  for (const c of criteria) {
    const score = s[c.key] || 0;
    const bar = _bar(score, c.max, BAR_W);
    lines.push(`${label(c.label, 16)}${bar}  ${String(score).padStart(2)}/${c.max}`);
  }

  lines.push('─────────────────────────────────────────────');
  lines.push(`${label('Total', 16)}${String(total).padStart(2)}/100    ${verdict}`);
  lines.push('─────────────────────────────────────────────');
  lines.push('Reasoning:');

  const reasoning = analysis.reasoning || [];
  for (const r of reasoning) {
    lines.push(`• ${r}`);
  }

  lines.push('═════════════════════════════════════════════');
  lines.push('⚠  Not financial advice. Based on "The Intelligent Investor" by Benjamin Graham.');

  return lines.join('\n');
}

module.exports = { buffettAnalysis, assessMoat, generateScorecard, grahamNumber, grahamAnalysis, generateGrahamScorecard };
