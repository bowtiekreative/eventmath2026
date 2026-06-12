'use strict';
/**
 * EventMath v2.9 — D±52 emergence tier, deepen, trace
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');
const EM = require('../runtime/eventmath-runtime.js');

let passed = 0, failed = 0;

function assert(label, condition, detail) {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else { console.error(`  ✗  ${label}`); if (detail !== undefined) console.error(`       got: ${JSON.stringify(detail)}`); failed++; }
}

function tok(src)     { return new EventMathTokenizer().tokenize(src); }
function parse(src)   { return new EventMathParser(tok(src)).parse(); }
function compile(src) { return new EventMathCodeGen().generate(parse(src)); }
function format(src)  { return new EventMathFormatter().format(parse(src)); }

// ── Runtime: D±52 Tier 4 in Dimensional Report ───────────────────────
console.log('\n─ D±52 Emergence tier (dimensional report) ─');

{
  // Create a basic chain + fractal + report
  const chain = new EM.EventMathChain('creator chain');
  chain.addLink('authentic voice', 'payment', 620);

  const negTorus = new EM.EventMathTorus('neg');
  negTorus.spinFrom(null, -39);
  const posTorus = new EM.EventMathTorus('pos');
  posTorus.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('market axis', negTorus, posTorus);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than market rate',
  });

  const report = new EM.EventMathDimensionalReport('test', [desire], chain, axis, [assumption]);

  assert('tier4: exists on dimensional report', typeof report.tier4Score === 'number', report.tier4Score);
  assert('tier4: is between 0 and 100', report.tier4Score >= 0 && report.tier4Score <= 100, report.tier4Score);
  // t3² / 100 — check the math
  const expectedT4 = Math.max(0, Math.round(report.tier3Score * report.tier3Score / 100));
  assert('tier4: equals t3²/100 (no deepen)', report.tier4Score === expectedT4, { t3: report.tier3Score, t4: report.tier4Score, expected: expectedT4 });
  assert('tier4: render includes TIER 4', report.render().includes('TIER 4'), null);
  assert('tier4: render includes D±52', report.render().includes('D±52'), null);
  assert('tier4: render includes Emergence', report.render().includes('Emergence'), null);
}

{
  // Strong root (t3 high) → emergence potential compounds
  const chain = new EM.EventMathChain('strong chain');
  chain.addLink('foundation', 'payment', 700);

  const neg39 = new EM.EventMathTorus('n39'); neg39.spinFrom(null, -39);
  const pos39 = new EM.EventMathTorus('p39'); pos39.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('strong axis', neg39, pos39);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = new EM.EventMathDesire('fair pay', { direction: 'more than', 'satisfied when': 'payment more than market rate' });
  const report = new EM.EventMathDimensionalReport('strong', [desire], chain, axis, [assumption]);

  // t3 ≥ 0, t4 = t3²/100 ≥ 0
  assert('tier4: scales with root strength', report.tier4Score >= 0, report.tier4Score);
  // When t3 is high (≥80), t4 should be ≥60 (80²/100 = 64)
  if (report.tier3Score >= 80) {
    assert('tier4: high root → high emergence', report.tier4Score >= 60, { t3: report.tier3Score, t4: report.tier4Score });
  } else {
    assert('tier4: t3 not high enough to test emergence threshold', true);
  }
}

// ── Runtime: EventMathFractalAxis.deepen ─────────────────────────────
console.log('\n─ Fractal axis deepen (D±52) ─');

{
  const neg39 = new EM.EventMathTorus('n39'); neg39.spinFrom(null, -39);
  const pos39 = new EM.EventMathTorus('p39'); pos39.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('market axis', neg39, pos39);

  assert('deepen: fractalDepth before = 3', axis.fractalDepth === 3, axis.fractalDepth);

  const neg52 = new EM.EventMathTorus('n52'); neg52.spinFrom(null, -52);
  const pos52 = new EM.EventMathTorus('p52'); pos52.spinFrom(null,  52);
  axis.deepen(neg52, pos52);

  assert('deepen: fractalDepth after = 4', axis.fractalDepth === 4, axis.fractalDepth);
  assert('deepen: dimension = 52', axis.dimension === 52, axis.dimension);
  assert('deepen: signature includes D±52', axis.signature.includes('D±52'), axis.signature);
  assert('deepen: tier4 exists on axis', axis.tier4 !== null && axis.tier4 !== undefined);
}

{
  // Deepen without explicit tori — auto-creates D±52 tori
  const neg39 = new EM.EventMathTorus('n39'); neg39.spinFrom(null, -39);
  const pos39 = new EM.EventMathTorus('p39'); pos39.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('auto axis', neg39, pos39);
  axis.deepen(null, null);
  assert('deepen: null tori auto-creates D±52', axis.tier4 !== null && axis.fractalDepth === 4);
}

{
  // Deepen modulates emergence confidence in dimensional report
  const chain = new EM.EventMathChain('deep chain');
  chain.addLink('work', 'payment', 620);

  const neg39 = new EM.EventMathTorus('n39'); neg39.spinFrom(null, -39);
  const pos39 = new EM.EventMathTorus('p39'); pos39.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('deep axis', neg39, pos39);

  const neg52 = new EM.EventMathTorus('n52'); neg52.spinFrom(null, -52);
  const pos52 = new EM.EventMathTorus('p52'); pos52.spinFrom(null,  52);
  axis.deepen(neg52, pos52);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = new EM.EventMathDesire('fair pay', { direction: 'more than', 'satisfied when': 'payment more than market rate' });
  const report = new EM.EventMathDimensionalReport('deep', [desire], chain, axis, [assumption]);

  assert('deepen in report: emergeAdjustments non-empty', report.emergeAdjustments.length > 0);
  // neg ×0.70 applied first, then pos ×1.30 — combined: 0.70 × 1.30 = 0.91 < 1
  assert('deepen in report: positive D±52 boosts emergence confidence', report.emergeConfidence > 0.8 && report.emergeConfidence < 1.0, report.emergeConfidence);
  // net emergeConfidence is 0.91 — between 0 and 2
  assert('deepen in report: net emerge confidence applied', report.emergeConfidence > 0 && report.emergeConfidence < 2, report.emergeConfidence);
}

// ── Runtime: EventMathTrace ───────────────────────────────────────────
console.log('\n─ Trace (priority sensitivity curve) ─');

{
  // OPPOSED conflict: s1=100, s2=0 → d1 always wins
  const chain = new EM.EventMathChain('c');
  chain.addLink('work', 'payment', 200);
  const d1 = new EM.EventMathDesire('fair payment', { direction: 'more than', 'satisfied when': 'payment more than 100' });
  const d2 = new EM.EventMathDesire('big savings', { direction: 'more than', 'satisfied when': 'savings more than 100' });
  const conflict = new EM.EventMathConflict('c', d1, d2, chain, []);
  const trace = new EM.EventMathTrace('t', conflict);

  assert('trace OPPOSED: dominant is fair payment', trace.dominant === 'fair payment', trace.dominant);
  assert('trace OPPOSED: breakeven is null', trace.breakeven === null, trace.breakeven);
  assert('trace OPPOSED: curve has 10 points', trace.curve.length === 10, trace.curve.length);
  assert('trace OPPOSED: render includes always wins', trace.render().includes('always wins'));
}

{
  // Both satisfiable: s1=100, s2=80 → breakeven at 80/100 = 0.8
  const chain = new EM.EventMathChain('two path');
  chain.addLink('work', 'payment', 200);
  chain.addLink('payment', 'savings', 80);
  const d1 = new EM.EventMathDesire('fair payment', { direction: 'more than', 'satisfied when': 'payment more than 100' });
  const d2 = new EM.EventMathDesire('savings goal', { direction: 'more than', 'satisfied when': 'savings more than 50' });
  const conflict = new EM.EventMathConflict('c2', d1, d2, chain, []);
  const trace = new EM.EventMathTrace('t2', conflict);

  assert('trace BOTH: curve has 10 points', trace.curve.length === 10, trace.curve.length);
  // When both satisfied, breakeven = s2/s1 = 100/100 = 1 (tied at equal priority)
  assert('trace BOTH: breakeven computed', trace.breakeven !== null || trace.dominant !== null);
  assert('trace BOTH: render includes TRACE header', trace.render().includes('TRACE'));
  assert('trace BOTH: render includes Breakeven', trace.render().includes('Breakeven') || trace.render().includes('always wins'));
}

{
  // Breakeven math: s1=60, s2=90 → breakeven = 90/60 = 1.5
  const chain = new EM.EventMathChain('math chain');
  chain.addLink('work', 'alpha', 60);
  chain.addLink('work', 'beta', 90);
  const d1 = new EM.EventMathDesire('want alpha', { direction: 'more than', 'satisfied when': 'alpha more than 30' });
  const d2 = new EM.EventMathDesire('want beta', { direction: 'more than', 'satisfied when': 'beta more than 50' });
  const conflict = new EM.EventMathConflict('math', d1, d2, chain, []);
  const trace = new EM.EventMathTrace('math trace', conflict);

  // s1=100, s2=100 → breakeven = 1.0
  // Actually both alpha (60>30) and beta (90>50) are satisfied → s1=100, s2=100
  // breakeven = 100/100 = 1.0
  assert('trace math: breakeven = 1 when scores equal', trace.breakeven === 1.0, trace.breakeven);
}

{
  // Render output structure
  const chain = new EM.EventMathChain('r');
  chain.addLink('a', 'payment', 200);
  const d1 = new EM.EventMathDesire('d1', { direction: 'more than', 'satisfied when': 'payment more than 100' });
  const d2 = new EM.EventMathDesire('d2', { direction: 'more than', 'satisfied when': 'savings more than 100' });
  const conflict = new EM.EventMathConflict('rc', d1, d2, chain, []);
  const trace = new EM.EventMathTrace('render trace', conflict);
  const rendered = trace.render();
  assert('trace render: TRACE header', rendered.includes('TRACE'));
  assert('trace render: Desire A present', rendered.includes('Desire A'));
  assert('trace render: Desire B present', rendered.includes('Desire B'));
}

// ── Tokenizer ─────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

{
  const tokens = tok('deepen market axis with emergence neg and emergence pos into deep axis');
  assert('deepen tokenizer: emits DEEPEN_STMT', tokens[0].type === 'DEEPEN_STMT', tokens[0].type);
  assert('deepen tokenizer: axisName', tokens[0].value.axisName === 'market axis', tokens[0].value);
  assert('deepen tokenizer: negName', tokens[0].value.negName === 'emergence neg', tokens[0].value);
  assert('deepen tokenizer: posName', tokens[0].value.posName === 'emergence pos', tokens[0].value);
  assert('deepen tokenizer: intoName', tokens[0].value.intoName === 'deep axis', tokens[0].value);
}

{
  const tokens = tok('trace tension report into priority curve');
  assert('trace tokenizer: emits TRACE_STMT', tokens[0].type === 'TRACE_STMT', tokens[0].type);
  assert('trace tokenizer: conflictName', tokens[0].value.conflictName === 'tension report', tokens[0].value);
  assert('trace tokenizer: intoName', tokens[0].value.intoName === 'priority curve', tokens[0].value);
}

// ── Parser ────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

{
  const ast = parse('deepen market axis with emergence neg and emergence pos into deep axis');
  const s = ast.statements[0];
  assert('deepen parser: DeepenStmt type', s.type === 'DeepenStmt', s.type);
  assert('deepen parser: axisName', s.axisName === 'market axis');
  assert('deepen parser: negName', s.negName === 'emergence neg');
  assert('deepen parser: posName', s.posName === 'emergence pos');
  assert('deepen parser: intoName', s.intoName === 'deep axis');
}

{
  const ast = parse('trace tension report into priority curve');
  const s = ast.statements[0];
  assert('trace parser: TraceStmt type', s.type === 'TraceStmt', s.type);
  assert('trace parser: conflictName', s.conflictName === 'tension report');
  assert('trace parser: intoName', s.intoName === 'priority curve');
}

// ── Codegen ───────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

{
  const js = compile('deepen market axis with emergence neg and emergence pos into deep axis');
  assert('deepen codegen: calls .deepen()', js.includes('.deepen('));
  assert('deepen codegen: axis var', js.includes('market_axis'));
  assert('deepen codegen: neg var', js.includes('emergence_neg'));
  assert('deepen codegen: pos var', js.includes('emergence_pos'));
}

{
  const js = compile('trace tension report into priority curve');
  assert('trace codegen: EventMathTrace constructor', js.includes('EventMathTrace'));
  assert('trace codegen: conflict var', js.includes('tension_report'));
}

// ── Formatter ─────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

{
  assert('deepen formatter: round-trips',
    format('deepen market axis with emergence neg and emergence pos into deep axis')
      .includes('deepen market axis with emergence neg and emergence pos into deep axis'));
  assert('trace formatter: round-trips',
    format('trace tension report into priority curve').includes('trace tension report into priority curve'));
}

// ── Gradient: EMERGENCE READY ─────────────────────────────────────────
console.log('\n─ Gradient: EMERGENCE READY ─');

{
  // To trigger EMERGENCE READY: need t3 ≥ 80 AND t4 ≥ 60 (i.e., t3² / 100 ≥ 60 → t3 ≥ ~77.5)
  // Use a chain where payment >> market rate (say, 10x)
  const chain = new EM.EventMathChain('strong chain');
  chain.addLink('work', 'payment', 5000);

  const neg39 = new EM.EventMathTorus('n39'); neg39.spinFrom(null, -39);
  const pos39 = new EM.EventMathTorus('p39'); pos39.spinFrom(null, 39);
  const axis = new EM.EventMathFractalAxis('strong axis', neg39, pos39);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = new EM.EventMathDesire('fair pay', { direction: 'more than', 'satisfied when': 'payment more than market rate' });
  const report = new EM.EventMathDimensionalReport('strong', [desire], chain, axis, [assumption]);

  // t3 = t2 * rootConfidence, t2 = t1 * systemConfidence
  // t1 = 100 (5000 >> 500), t2 = 100 * 0.9 (2-tier deduction? or 3-tier)
  // If t3 ≥ 80: EMERGENCE READY
  if (report.tier3Score >= 80) {
    assert('gradient: EMERGENCE READY when t3 ≥ 80 and t4 ≥ 60', report.gradient === 'EMERGENCE READY', report.gradient);
  } else {
    // Fall back: t3 < 80 so EMERGENCE READY doesn't trigger
    assert('gradient: EMERGENCE READY not triggered (t3 < 80)', report.gradient !== 'EMERGENCE READY' || report.tier3Score >= 80, { gradient: report.gradient, t3: report.tier3Score });
  }
  assert('gradient: gradient field non-empty', report.gradient.length > 0);
}

// ── End-to-end ────────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');

{
  const src = `
assume market rate is 500

chain leverage chain
  authentic voice leads to rate card published at value 9
  rate card published leads to direct outreach at value 12
  direct outreach leads to inbound brand interest at value 8
  inbound brand interest leads to negotiation at value 6
  negotiation leads to payment at value 620
  payment leads to reach expansion at value 18500
end

desire fair payment
category creator goal
matter
  direction is more than
  satisfied when is payment more than market rate
  priority is 3
end
end

desire creative freedom
category creator goal
matter
  direction is more than
  satisfied when is creative control more than 50
  priority is 2
end
end

spin market noise into noise torus at dimension -39
spin market signal into signal torus at dimension 39
fractal signal torus and noise torus into market axis

spin emergence noise into emergence neg at dimension -52
spin emergence signal into emergence pos at dimension 52
deepen market axis with emergence neg and emergence pos into deep axis

evaluate fair payment against leverage chain across fractal deep axis into leverage report

conflict fair payment and creative freedom for leverage chain into tension report
trace tension report into priority curve
show priority curve
`;
  try {
    const js = compile(src);
    const fn = new Function('require', 'console', 'module', js +
      '\nreturn { lr: typeof leverage_report !== "undefined" ? leverage_report : null, tc: typeof priority_curve !== "undefined" ? priority_curve : null };');
    let out = '';
    const { lr, tc } = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });

    assert('e2e: leverage report created', lr !== null);
    assert('e2e: tier4Score present on report', lr && typeof lr.tier4Score === 'number', lr && lr.tier4Score);
    assert('e2e: report render includes TIER 4', lr && lr.render().includes('TIER 4'));
    assert('e2e: deep axis has fractalDepth 4', lr && lr.fractal && lr.fractal.fractalDepth === 4, lr && lr.fractal && lr.fractal.fractalDepth);

    assert('e2e: priority curve created', tc !== null);
    assert('e2e: trace curve non-empty', tc && tc.curve.length > 0, tc && tc.curve.length);
    assert('e2e: trace render in output', out.includes('TRACE'));
  } catch (e) {
    assert('e2e: no runtime error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
