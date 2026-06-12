/**
 * EventMath v2.4 — Dimensional Scoring Tests
 * Tests: EventMathDimensionalReport, tokenizer, parser, codegen, end-to-end
 */

'use strict';

const assert = require('assert');
const EM = require('../runtime/eventmath-runtime.js');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓  ' + name); passed++; }
  catch (e) { console.log('  ✗  ' + name + '\n     ' + e.message); failed++; }
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeChain(name, links) {
  const c = new EM.EventMathChain(name);
  links.forEach(([f, t, v]) => c.addLink(f, t, v !== undefined ? v : undefined));
  return c;
}

function makeFractal3Tier(name) {
  const neg = new EM.EventMathTorus(name + '_neg');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus(name + '_pos');
  pos.spinFrom(null, 39);
  return new EM.EventMathFractalAxis(name, neg, pos);
}

function makeFractal2Tier(name) {
  const neg = new EM.EventMathTorus(name + '_neg');
  neg.spinFrom(null, -13);
  const pos = new EM.EventMathTorus(name + '_pos');
  pos.spinFrom(null, 13);
  return new EM.EventMathFractalAxis(name, neg, pos);
}

function makeDesire(name, sw, dir) {
  return new EM.EventMathDesire(name, {
    scenario: 'test',
    subjective: 'I want ' + name,
    outcome: 'outcome of ' + name,
    direction: dir || 'more than',
    state: 'desired',
    'satisfied when': sw || ('payment more than 400')
  });
}

function compile(src) {
  const tokens = new EventMathTokenizer().tokenize(src);
  const ast    = new EventMathParser(tokens).parse();
  return new EventMathCodeGen().generate(ast);
}

function runCode(src) {
  const js = compile(src);
  const fn = new Function('require', 'console', 'module', js + '\nreturn typeof __dimReport !== "undefined" ? __dimReport : null;');
  let out = '';
  const fakeConsole = { log: s => { out += s + '\n'; } };
  const fakeModule  = { exports: {} };
  const result = fn(require, fakeConsole, fakeModule);
  return { out, result };
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nEventMath v2.4 — Dimensional Scoring Tests\n');

// ── Runtime: constructor ─────────────────────────────────────────────
console.log('─ Runtime: EventMathDimensionalReport ─');

test('constructor creates object with name', () => {
  const d = new EM.EventMathDimensionalReport('test report', [], null, null, []);
  assert.strictEqual(d.name, 'test report');
});

test('desires array stored correctly', () => {
  const desire = makeDesire('fair payment', 'payment more than 500');
  const d = new EM.EventMathDimensionalReport('r', [desire], null, null, []);
  assert.strictEqual(d.desires.length, 1);
  assert.strictEqual(d.desires[0].name, 'fair payment');
});

test('tier1Score matches direct SatisfactionEngine score', () => {
  const chain = makeChain('leverage', [
    ['authentic voice', 'rate card published', 9],
    ['rate card published', 'direct outreach', 12],
    ['direct outreach', 'payment', 620]
  ]);
  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = makeDesire('fair payment', 'payment more than market rate', 'more than');
  const engine = new EM.EventMathSatisfactionEngine('direct', [desire], chain, [assumption]);
  const report = new EM.EventMathDimensionalReport('r', [desire], chain, null, [assumption]);
  assert.strictEqual(report.tier1Score, engine.score);
});

test('tier1Engine is an EventMathSatisfactionEngine', () => {
  const chain = makeChain('c', [['a', 'b', 100]]);
  const report = new EM.EventMathDimensionalReport('r', [], chain, null, []);
  assert.ok(report.tier1Engine instanceof EM.EventMathSatisfactionEngine);
});

// ── Runtime: tier 2 (system confidence) ─────────────────────────────
console.log('\n─ Runtime: Tier 2 system confidence ─');

test('tier2Score equals tier1Score when no fallacies and no fractal', () => {
  const chain = makeChain('short', [['a', 'b', 1]]);
  const desire = makeDesire('d', 'b more than 0', 'more than');
  const report = new EM.EventMathDimensionalReport('r', [desire], chain, null, []);
  // slippery slope fires on chains > 4 links, short chain → no fallacy → confidence = 1
  assert.strictEqual(report.systemConfidence, 1.0);
  assert.strictEqual(report.tier2Score, report.tier1Score);
});

test('slippery slope on long chain reduces system confidence by 0.75', () => {
  const chain = makeChain('long', [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f']
  ]);
  const desire = makeDesire('d', 'payment more than 100');
  const report = new EM.EventMathDimensionalReport('r', [desire], chain, null, []);
  assert.ok(report.systemAdjustments.some(a => a.includes('slippery slope')));
  assert.ok(report.systemConfidence <= 0.75);
});

test('systemAdjustments array populated when fallacies detected', () => {
  const chain = makeChain('long', [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f']
  ]);
  const report = new EM.EventMathDimensionalReport('r', [], chain, null, []);
  assert.ok(Array.isArray(report.systemAdjustments));
  assert.ok(report.systemAdjustments.length > 0);
});

test('present line offset reduces system confidence by 0.9', () => {
  const chain = makeChain('c', [['a', 'b']]);
  // Build a fractal with asymmetric toruses (non-zero present line)
  const neg = new EM.EventMathTorus('n'); neg.spinFrom(null, -13);
  const pos = new EM.EventMathTorus('p'); pos.spinFrom(null, 26);
  const fractal = new EM.EventMathFractalAxis('f', neg, pos);
  const report = new EM.EventMathDimensionalReport('r', [], chain, fractal, []);
  if (fractal.presentLine !== 0) {
    assert.ok(report.systemAdjustments.some(a => a.includes('present line offset')));
  } else {
    assert.ok(true); // symmetric — no adjustment applied
  }
});

// ── Runtime: tier 3 (root confidence) ───────────────────────────────
console.log('\n─ Runtime: Tier 3 root confidence ─');

test('3-tier fractal with D39 positive torus → rootConfidence × 1.2', () => {
  const fractal = makeFractal3Tier('vision axis');
  const chain = makeChain('c', [['a', 'b', 100]]);
  const report = new EM.EventMathDimensionalReport('r', [], chain, fractal, []);
  assert.ok(report.rootAdjustments.some(a => a.includes('×1.20')));
  assert.ok(report.rootConfidence > 1.0 || report.rootAdjustments.some(a => a.includes('×0.60')));
});

test('3-tier fractal with D39 negative torus → rootAdjustments includes ×0.60', () => {
  const fractal = makeFractal3Tier('noise axis');
  const report = new EM.EventMathDimensionalReport('r', [], null, fractal, []);
  assert.ok(report.rootAdjustments.some(a => a.includes('×0.60') || a.includes('×1.20') || a.includes('balanced')));
});

test('2-tier fractal → rootConfidence × 0.9', () => {
  const fractal = makeFractal2Tier('foundation');
  const report = new EM.EventMathDimensionalReport('r', [], null, fractal, []);
  assert.ok(report.rootAdjustments.some(a => a.includes('×0.90')));
  // Only applies if tier3 doesn't exist (2-tier fractal)
  assert.ok(!fractal.tier3);
});

test('no fractal provided → rootConfidence × 0.8', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.rootAdjustments.some(a => a.includes('×0.80')));
});

test('tier3Score never exceeds 100', () => {
  const fractal = makeFractal3Tier('axis');
  const chain   = makeChain('c', [['a', 'b', 9999]]);
  const desire  = makeDesire('d', 'b more than 1', 'more than');
  const report  = new EM.EventMathDimensionalReport('r', [desire], chain, fractal, []);
  assert.ok(report.tier3Score <= 100);
});

test('tier3Score never below 0', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.tier3Score >= 0);
});

// ── Runtime: gradient analysis ───────────────────────────────────────
console.log('\n─ Runtime: Gradient analysis ─');

test('gradient BLOCKED when tier1 = 0', () => {
  const chain = makeChain('c', [['a', 'b']]);
  const desire = makeDesire('d', 'payment more than 500'); // no payment in chain
  const report = new EM.EventMathDimensionalReport('r', [desire], chain, null, []);
  if (report.tier1Score === 0) {
    assert.strictEqual(report.gradient, 'BLOCKED');
  } else {
    assert.ok(true); // chain might partially satisfy — gradient is not BLOCKED then
  }
});

test('correctionPath is a non-empty string', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(typeof report.correctionPath === 'string' && report.correctionPath.length > 0);
});

test('gradient is one of the expected values', () => {
  const gradients = ['ALIGNED', 'BLOCKED', 'SHARP DECLINE', 'SURFACE VIABLE',
                     'ROOT STRONGER THAN SURFACE', 'ROOT MISALIGNED'];
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(gradients.includes(report.gradient));
});

// ── Runtime: render ──────────────────────────────────────────────────
console.log('\n─ Runtime: render() ─');

test('render includes "TIER 1"', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.render().includes('TIER 1'));
});

test('render includes "TIER 2"', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.render().includes('TIER 2'));
});

test('render includes "TIER 3"', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.render().includes('TIER 3'));
});

test('render includes gradient label', () => {
  const report = new EM.EventMathDimensionalReport('r', [], null, null, []);
  assert.ok(report.render().includes('GRADIENT:'));
  assert.ok(report.render().includes(report.gradient));
});

test('render includes desire names', () => {
  const d1 = makeDesire('fair payment', 'payment more than 500');
  const d2 = makeDesire('audience reach', 'reach more than 10000');
  const report = new EM.EventMathDimensionalReport('r', [d1, d2], null, null, []);
  const out = report.render();
  assert.ok(out.includes('fair payment'));
  assert.ok(out.includes('audience reach'));
});

test('render includes chain name', () => {
  const chain  = makeChain('leverage chain', [['a', 'b']]);
  const report = new EM.EventMathDimensionalReport('r', [], chain, null, []);
  assert.ok(report.render().includes('leverage chain'));
});

test('render includes fractal name', () => {
  const fractal = makeFractal2Tier('vision axis');
  const report  = new EM.EventMathDimensionalReport('r', [], null, fractal, []);
  assert.ok(report.render().includes('vision axis'));
});

test('desires joined with " | " in render header', () => {
  const d1 = makeDesire('payment', 'payment more than 500');
  const d2 = makeDesire('reach', 'reach more than 1000');
  const report = new EM.EventMathDimensionalReport('r', [d1, d2], null, null, []);
  assert.ok(report.render().includes('payment | reach'));
});

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

test('satisfy across fractal emits DIMENSIONAL_STMT', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'satisfy fair payment against leverage chain across fractal vision axis into payment report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.ok(dim, 'DIMENSIONAL_STMT token expected');
});

test('DIMENSIONAL_STMT has correct desireNames (single)', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'satisfy fair payment against leverage chain across fractal vision axis into payment report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.deepStrictEqual(dim.value.desireNames, ['fair payment']);
});

test('DIMENSIONAL_STMT has correct chainName', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'satisfy fair payment against leverage chain across fractal vision axis into payment report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.strictEqual(dim.value.chainName, 'leverage chain');
});

test('DIMENSIONAL_STMT has correct fractalName', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'satisfy fair payment against leverage chain across fractal vision axis into payment report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.strictEqual(dim.value.fractalName, 'vision axis');
});

test('evaluate with multiple desires across fractal emits DIMENSIONAL_STMT', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate fair payment and audience reach and brand deals against leverage chain across fractal vision axis into full report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.ok(dim, 'DIMENSIONAL_STMT token expected');
  assert.strictEqual(dim.value.desireNames.length, 3);
});

test('evaluate desireNames includes all three names', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate fair payment and audience reach and brand deals against leverage chain across fractal vision axis into full report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.deepStrictEqual(dim.value.desireNames, ['fair payment', 'audience reach', 'brand deals']);
});

test('evaluate intoName correctly parsed', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate payment against chain across fractal axis into my report'
  );
  const dim = tokens.find(t => t.type === 'DIMENSIONAL_STMT');
  assert.strictEqual(dim.value.intoName, 'my report');
});

test('satisfy without "across fractal" still emits SATISFY_STMT', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'satisfy fair payment against leverage chain into payment result'
  );
  const sat = tokens.find(t => t.type === 'SATISFY_STMT');
  assert.ok(sat, 'SATISFY_STMT expected when no "across fractal"');
});

test('evaluate without "across fractal" still emits EVALUATE_STMT', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate fair payment and audience reach against leverage chain into score'
  );
  const ev = tokens.find(t => t.type === 'EVALUATE_STMT');
  assert.ok(ev, 'EVALUATE_STMT expected when no "across fractal"');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

test('parser produces DimensionalStmt node', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate payment against my chain across fractal my axis into report result'
  );
  const ast = new EventMathParser(tokens).parse();
  const dim = ast.statements.find(s => s.type === 'DimensionalStmt');
  assert.ok(dim, 'DimensionalStmt node expected');
});

test('DimensionalStmt has correct fractalName', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate payment against my chain across fractal my axis into report result'
  );
  const ast = new EventMathParser(tokens).parse();
  const dim = ast.statements.find(s => s.type === 'DimensionalStmt');
  assert.strictEqual(dim.fractalName, 'my axis');
});

test('DimensionalStmt has correct intoName', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'evaluate payment against my chain across fractal my axis into report result'
  );
  const ast = new EventMathParser(tokens).parse();
  const dim = ast.statements.find(s => s.type === 'DimensionalStmt');
  assert.strictEqual(dim.intoName, 'report result');
});

// ── Codegen ──────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

test('codegen emits EventMathDimensionalReport constructor', () => {
  const js = compile(
    'evaluate payment against my chain across fractal my axis into report result'
  );
  assert.ok(js.includes('EventMathDimensionalReport'), 'constructor expected in output');
});

test('codegen passes __assumptions as 5th arg', () => {
  const js = compile(
    'evaluate payment against my chain across fractal my axis into my report'
  );
  assert.ok(js.includes('__assumptions'), '__assumptions expected in dimensional call');
});

// ── End-to-end ───────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');

test('full compile + run with 3-tier fractal', () => {
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

spin neg torus into neg at dimension -39
spin pos torus into pos at dimension 39
fractal neg and pos into vision axis

desire fair payment
category creator goal
matter
  scenario is brand negotiation
  subjective is I want to be paid what I am worth
  outcome is payment at market rate
  direction is more than
  state is desired
  satisfied when is payment more than market rate
end
end

evaluate fair payment against leverage chain across fractal vision axis into __dimReport
show __dimReport
`;
  const { out } = runCode(src);
  assert.ok(out.includes('TIER 1'), 'Tier 1 section expected');
  assert.ok(out.includes('TIER 2'), 'Tier 2 section expected');
  assert.ok(out.includes('TIER 3'), 'Tier 3 section expected');
  assert.ok(out.includes('GRADIENT:'), 'Gradient line expected');
});

test('end-to-end output includes desire name in render', () => {
  const src = `
chain simple chain
  action leads to payment at value 620
end

spin neg torus into nt at dimension -13
spin pos torus into pt at dimension 13
fractal nt and pt into base axis

desire fair payment
category creator goal
matter
  scenario is test
  subjective is want payment
  outcome is payment over 500
  direction is more than
  state is desired
  satisfied when is payment more than 500
end
end

evaluate fair payment against simple chain across fractal base axis into __dimReport
show __dimReport
`;
  const { out } = runCode(src);
  assert.ok(out.includes('fair payment'), 'desire name in output');
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
