/**
 * EventMath v2.26 — Fundamental Analysis (Buffett Lens) test suite
 *
 * Covers: fundamental, buffett analysis
 *
 * Run: node tests/v2.26-test.js
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function tokenize(src) {
  return new EventMathTokenizer().tokenize(src);
}

function parse(src) {
  const tokens = tokenize(src);
  return new EventMathParser(tokens).parse();
}

function compile(src) {
  const ast = parse(src);
  return new EventMathCodeGen().generate(ast);
}

// ── Tokenizer: fundamental ───────────────────────────────────────────────────

console.log('\n── Tokenizer: fundamental via buffett ──');
{
  const toks = tokenize('fundamental "AAPL" via buffett into aapl analysis');
  assert('FUNDAMENTAL_STMT emitted', toks[0].type === 'FUNDAMENTAL_STMT');
  assert('ticker extracted uppercase', toks[0].value.ticker === 'AAPL');
  assert('provider is buffett', toks[0].value.provider === 'buffett');
  assert('intoName extracted', toks[0].value.intoName === 'aapl analysis');
}

{
  const toks = tokenize('fundamental "MSFT" via buffett into msft score');
  assert('ticker MSFT', toks[0].value.ticker === 'MSFT');
  assert('intoName msft score', toks[0].value.intoName === 'msft score');
}

{
  const toks = tokenize('fundamental "tsla" via buffett into tesla check');
  assert('ticker lowercased to uppercase', toks[0].value.ticker === 'TSLA');
}

console.log('\n── Tokenizer: fundamental without via ──');
{
  const toks = tokenize('fundamental "GOOG" into google analysis');
  assert('no via: FUNDAMENTAL_STMT', toks[0].type === 'FUNDAMENTAL_STMT');
  assert('no via: ticker', toks[0].value.ticker === 'GOOG');
  assert('no via: provider defaults to buffett', toks[0].value.provider === 'buffett');
  assert('no via: intoName', toks[0].value.intoName === 'google analysis');
}

console.log('\n── Tokenizer: fundamental various tickers ──');
{
  const tickers = ['BRK.B', 'KO', 'WMT', 'JNJ', 'BAC'];
  for (const ticker of tickers) {
    const toks = tokenize(`fundamental "${ticker}" via buffett into result`);
    assert(`ticker ${ticker}`, toks[0].value.ticker === ticker);
  }
}

// ── Parser: FundamentalStmt ──────────────────────────────────────────────────

console.log('\n── Parser: FundamentalStmt ──');
{
  const ast = parse('fundamental "AAPL" via buffett into aapl analysis');
  const stmt = ast.statements[0];
  assert('type is FundamentalStmt', stmt.type === 'FundamentalStmt');
  assert('ticker', stmt.ticker === 'AAPL');
  assert('provider', stmt.provider === 'buffett');
  assert('intoName', stmt.intoName === 'aapl analysis');
}

{
  const ast = parse('fundamental "MSFT" via buffett into msft score\nshow msft score');
  assert('two statements', ast.statements.length === 2);
  assert('second is Show', ast.statements[1].type === 'Show');
}

{
  const ast = parse('fundamental "KO" into coke check');
  const stmt = ast.statements[0];
  assert('parser no via: ticker KO', stmt.ticker === 'KO');
  assert('parser no via: provider buffett', stmt.provider === 'buffett');
}

// ── Codegen: FundamentalStmt ─────────────────────────────────────────────────

console.log('\n── Codegen: fundamental requires fundamental runtime ──');
{
  const js = compile('fundamental "AAPL" via buffett into aapl analysis');
  assert('requires fundamental runtime', js.includes('eventmath-fundamental-runtime'));
  assert('async wrapper present', js.includes('async () =>'));
  assert('buffettAnalysis call', js.includes('buffettAnalysis'));
  assert('ticker in call', js.includes('"AAPL"'));
}

console.log('\n── Codegen: fundamental variable hoisted ──');
{
  const js = compile('fundamental "AAPL" via buffett into aapl analysis\nshow aapl analysis');
  assert('variable hoisted', js.includes('let aapl_analysis') || js.includes('let aaplanalysis') || js.includes('aapl_analysis'));
  assert('assignment present', js.includes('= await __emFundamental.buffettAnalysis'));
}

console.log('\n── Codegen: multiple fundamentals ──');
{
  const js = compile([
    'fundamental "AAPL" via buffett into aapl',
    'fundamental "MSFT" via buffett into msft',
    'show aapl',
    'show msft'
  ].join('\n'));
  assert('two buffettAnalysis calls', (js.match(/buffettAnalysis/g) || []).length >= 2);
  assert('aapl hoisted', js.includes('let aapl'));
  assert('msft hoisted', js.includes('let msft'));
}

console.log('\n── Codegen: fundamental does not require task runtime ──');
{
  const js = compile('fundamental "AAPL" via buffett into result');
  assert('no task runtime', !js.includes('eventmath-task-runtime'));
  assert('has fundamental runtime', js.includes('eventmath-fundamental-runtime'));
}

// ── Runtime: fundamental runtime exports ────────────────────────────────────

console.log('\n── Runtime: fundamental runtime exports ──');
{
  const rt = require('../runtime/eventmath-fundamental-runtime.js');
  assert('buffettAnalysis exported', typeof rt.buffettAnalysis === 'function');
  assert('assessMoat exported', typeof rt.assessMoat === 'function');
  assert('generateScorecard exported', typeof rt.generateScorecard === 'function');
}

console.log('\n── Runtime: assessMoat scoring ──');
{
  const rt = require('../runtime/eventmath-fundamental-runtime.js');
  const strongData = {
    gross_margins: 0.45,
    roe: 0.30,
    revenue_growth: 0.12,
    sector: 'technology'
  };
  const moat = rt.assessMoat('AAPL', strongData);
  assert('assessMoat returns object', typeof moat === 'object');
  assert('moat has score', typeof moat.score === 'number');
  assert('moat score in range 0-25', moat.score >= 0 && moat.score <= 25);
  assert('moat has moat_type', typeof moat.moat_type === 'string');
  assert('strong data gives wide moat', moat.moat_type === 'wide');
}

{
  const rt = require('../runtime/eventmath-fundamental-runtime.js');
  const weakData = {
    gross_margins: 0.05,
    roe: 0.02,
    revenue_growth: -0.05,
    sector: 'other'
  };
  const moat = rt.assessMoat('WEAK', weakData);
  assert('weak data gives none/narrow moat', moat.moat_type === 'none' || moat.moat_type === 'narrow');
  assert('weak data gives low score', moat.score < 15);
}

console.log('\n── Runtime: generateScorecard ──');
{
  const rt = require('../runtime/eventmath-fundamental-runtime.js');
  const analysis = {
    ticker: 'AAPL',
    scores: { moat: 20, earnings: 18, financial_strength: 22, valuation: 10 },
    total: 70,
    verdict: 'buy',
    missing: [],
    questions: [],
    reasoning: ['Wide moat: pricing power', 'Consistent earnings', 'Strong balance sheet', 'Fair valuation']
  };
  const card = rt.generateScorecard('AAPL', analysis);
  assert('scorecard is string', typeof card === 'string');
  assert('scorecard includes ticker', card.includes('AAPL'));
  assert('scorecard includes verdict', card.toLowerCase().includes('buy'));
  assert('scorecard includes total', card.includes('70'));
}

console.log('\n── Runtime: buffettAnalysis offline scoring ──');
{
  const rt = require('../runtime/eventmath-fundamental-runtime.js');
  const providedData = {
    grossMargin: 0.40,
    roe: 0.25,
    revenueGrowth: 0.10,
    debtToEquity: 0.5,
    currentRatio: 2.0,
    peRatio: 22,
    earningsGrowthYears: 8
  };
  rt.buffettAnalysis('TEST', providedData).then(result => {
    assert('buffettAnalysis returns object', typeof result === 'object');
    assert('has ticker', result.ticker === 'TEST');
    assert('has scores object', typeof result.scores === 'object');
    assert('has total score', typeof result.total === 'number');
    assert('total in range 0-100', result.total >= 0 && result.total <= 100);
    assert('has verdict', typeof result.verdict === 'string');
    assert('has missing array', Array.isArray(result.missing));
    assert('has questions array', Array.isArray(result.questions));
    assert('has disclaimer', typeof result.disclaimer === 'string');
    assert('disclaimer mentions educational', result.disclaimer.toLowerCase().includes('educational'));

    const summary = `\n${'─'.repeat(50)}\nv2.26 tests: ${passed} passed, ${failed} failed\n`;
    console.log(summary);
    if (failed > 0) process.exit(1);
  }).catch(err => {
    console.error('Runtime error:', err.message);
    process.exit(1);
  });
}
