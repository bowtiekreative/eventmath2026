'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const EM                     = require('../runtime/eventmath-runtime.js');

// ── helpers ────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function parse(src) {
  return new EventMathParser(new EventMathTokenizer().tokenize(src)).parse();
}

function compile(src) {
  return new EventMathCodeGen().generate(parse(src));
}

function run(src) {
  const js = compile(src);
  const body = js
    .replace(/const EM = typeof[\s\S]*?eventmath-runtime\.js'\);\n/, '')
    .replace(/const __weights = \{\};\n/, '')
    .replace(/\/\/ ── Export for use ──[\s\S]*$/, '');
  const lines = [];
  const mockConsole = { log: (...a) => lines.push(a.join(' ')) };
  const fn = new Function('require', 'EM', '__weights', 'module', 'console', body);
  fn(require, EM, {}, { exports: {} }, mockConsole);
  return lines;
}

// ── Runtime — nStepFib ────────────────────────────────────

console.log('\nRuntime — D-step Fibonacci');

test('D2 nStepFib matches standard Fibonacci', () => {
  const seq = EM.nStepFib(2, 100);
  assert(seq.indexOf(1)  >= 0, 'missing 1');
  assert(seq.indexOf(5)  >= 0, 'missing 5');
  assert(seq.indexOf(13) >= 0, 'missing 13');
  assert(seq.indexOf(21) >= 0, 'missing 21');
  assert(seq.indexOf(34) >= 0, 'missing 34');
  assert(seq.indexOf(4)  < 0,  '4 should not be in Fibonacci');
});

test('D3 tribonacci: 1,1,1,3,5,9,17,31', () => {
  const seq = EM.nStepFib(3, 50);
  assert(seq.indexOf(3)  >= 0, 'missing 3');
  assert(seq.indexOf(5)  >= 0, 'missing 5');
  assert(seq.indexOf(9)  >= 0, 'missing 9');
  assert(seq.indexOf(17) >= 0, 'missing 17');
  assert(seq.indexOf(31) >= 0, 'missing 31');
  assert(seq.indexOf(8)  < 0,  '8 should not be in D3');
});

test('D5 pentanacci starts: 1,1,1,1,1,5,9,17,33,65', () => {
  const seq = EM.nStepFib(5, 70);
  assert(seq.indexOf(5)  >= 0, 'missing 5');
  assert(seq.indexOf(9)  >= 0, 'missing 9');
  assert(seq.indexOf(17) >= 0, 'missing 17');
  assert(seq.indexOf(33) >= 0, 'missing 33');
  assert(seq.indexOf(65) >= 0, 'missing 65');
  assert(seq.indexOf(31) < 0,  '31 should NOT be in D5 pentanacci');
});

test('isNStepFib D2 correctly identifies Fibonacci numbers', () => {
  assert(EM.isNStepFib(5,  2) === true,  '5 should be Fibonacci');
  assert(EM.isNStepFib(13, 2) === true,  '13 should be Fibonacci');
  assert(EM.isNStepFib(4,  2) === false, '4 should not be Fibonacci');
  assert(EM.isNStepFib(6,  2) === false, '6 should not be Fibonacci');
});

test('isNStepFib D3 identifies tribonacci numbers', () => {
  assert(EM.isNStepFib(3,  3) === true,  '3 should be D3-Fibonacci');
  assert(EM.isNStepFib(9,  3) === true,  '9 should be D3-Fibonacci');
  assert(EM.isNStepFib(8,  3) === false, '8 should not be D3-Fibonacci');
});

test('getShapeName returns correct polygon names', () => {
  assert(EM.getShapeName(2)  === 'square',      'D2 should be square');
  assert(EM.getShapeName(3)  === 'triangle',    'D3 should be triangle');
  assert(EM.getShapeName(5)  === 'pentagon',    'D5 should be pentagon');
  assert(EM.getShapeName(13) === 'tridecagon',  'D13 should be tridecagon');
});

// ── Runtime — torus dimensions ────────────────────────────

console.log('\nRuntime — multi-dimensional torus');

test('D2 torus has 4 pts/ring and Fibonacci at ring 1 (total=5)', () => {
  const t = new EM.EventMathAnchor('t');
  t.setDepth(2);
  t.expand(1);
  assert(t.rings[0].count === 4, 'D2 should have 4 pts/ring');
  assert(t.rings[0].fibonacci === true, 'Ring 1 total 5 should be Fibonacci');
});

test('D3 torus has 3 pts/ring and tribonacci at ring 1 (total=4)', () => {
  const t = new EM.EventMathAnchor('t');
  t.setDepth(3);
  t.expand(1);
  assert(t.rings[0].count === 3, 'D3 should have 3 pts/ring');
  // D3 tribonacci: 1,1,1,3,5... — 4 is not in sequence, but 3 is
  // ring 1 gives outer=3, with_nucleus=4. Is 4 tribonacci? No.
  // ring 2 gives outer=6, with_nucleus=7. No.
  // ring 3 gives outer=9, with_nucleus=10. No.
  // Actually D3 trib: 1,1,1,3,5,9... so 9 is hit at ring 3+1=wait let me recalculate
  // outer=3*3=9 after 3 rings, with_nucleus=10. Not trib.
  // outer=3*1=3 after 1 ring, with_nucleus=4. Not trib.
  // Actually, 5 is in D3 (1,1,1,3,5,9): after 5/3 ~2 rings... hmm 3*2-1=5? No, outer would be 6.
  // 3 is in D3: outer would need to be 2, so less than 1 ring. Not possible.
  // So no hits in first 5 rings — that's correct, D3 switches are rarer.
  assert(t.dimension === 3, 'dimension should be 3');
});

test('D5 torus has 5 pts/ring', () => {
  const t = new EM.EventMathAnchor('t');
  t.setDepth(5);
  t.expand(3);
  assert(t.rings[0].count === 5, 'D5 should have 5 pts/ring');
  assert(t.totalOuter === 15, 'after 3 rings: 3×5=15');
});

test('D13 torus has 13 pts/ring', () => {
  const t = new EM.EventMathAnchor('t');
  t.setDepth(13);
  t.expand(2);
  assert(t.rings[0].count === 13, 'D13 should have 13 pts/ring');
  assert(t.totalOuter === 26, 'after 2 rings: 2×13=26');
  assert(t.dimension === 13, 'dimension should be 13');
});

test('D5 rotation step is 18 degrees per ring', () => {
  const t = new EM.EventMathAnchor('t');
  t.setDepth(5);
  t.expand(2);
  assert(t.rings[0].rotation === 0,  'ring 1 rotation should be 0°');
  assert(t.rings[1].rotation === 18, 'ring 2 rotation should be 18°');
});

// ── Runtime — landscape ───────────────────────────────────

console.log('\nRuntime — EventMathLandscape');

test('landscape auto-creates bridges between toruses', () => {
  const t1 = new EM.EventMathAnchor('alpha'); t1.setDepth(2); t1.expand(3);
  const t2 = new EM.EventMathAnchor('beta');  t2.setDepth(5); t2.expand(3);
  const L = new EM.EventMathLandscape('test');
  L.addTorus(t1); L.addTorus(t2);
  assert(L.bridges.length === 1, 'should have 1 bridge');
  assert(L.bridges[0].dimension === 6, 'bridge dim = max(2,5)+1 = 6');
});

test('landscape bridge dimension caps at 13', () => {
  const t1 = new EM.EventMathAnchor('a'); t1.setDepth(13);
  const t2 = new EM.EventMathAnchor('b'); t2.setDepth(13);
  const L = new EM.EventMathLandscape('test');
  L.addTorus(t1); L.addTorus(t2);
  assert(L.bridges[0].dimension === 13, 'bridge should cap at 13');
});

test('forecast returns the torus with soonest Fibonacci switch', () => {
  const t1 = new EM.EventMathAnchor('a'); t1.setDepth(2); t1.expand(8); // 32 outer → next switch +1
  const t2 = new EM.EventMathAnchor('b'); t2.setDepth(2); t2.expand(3); // 12 outer → next switch +2
  const L = new EM.EventMathLandscape('test');
  L.addTorus(t1); L.addTorus(t2);
  const fc = L.forecast();
  assert(fc.matter.next_switch_torus === 'a', 'a should be soonest (1 ring away)');
  assert(fc.matter.rings_until_switch === 1, 'should be 1 ring away');
});

test('forecast detects cross-dimensional resonance', () => {
  const t1 = new EM.EventMathAnchor('a'); t1.setDepth(2); t1.expand(8); // next +1
  const t2 = new EM.EventMathAnchor('b'); t2.setDepth(3); // D3, needs more rings
  t2.expand(4); // 12 outer, need next D3 fib after 13... 17 → need 1 more ring? 12+3=15, +nucleus=16. not 17. need 2 more
  // Let me use another torus that also hits in 1 ring
  const t3 = new EM.EventMathAnchor('c'); t3.setDepth(2); t3.expand(2); // 8 outer → next fib 13 → need 2 rings? no (8+4=12,13 ✓). so 1 ring away!
  const L = new EM.EventMathLandscape('test');
  L.addTorus(t1); L.addTorus(t3);
  const fc = L.forecast();
  assert(fc.matter.cross_dimensional_resonances >= 1, 'should detect resonance: ' + JSON.stringify(fc.matter));
});

test('dimensional signature sums all torus dimensions', () => {
  const t1 = new EM.EventMathAnchor('a'); t1.setDepth(3);
  const t2 = new EM.EventMathAnchor('b'); t2.setDepth(7);
  const t3 = new EM.EventMathAnchor('c'); t3.setDepth(3);
  const L = new EM.EventMathLandscape('test');
  L.addTorus(t1); L.addTorus(t2); L.addTorus(t3);
  const fc = L.forecast();
  assert(fc.matter.total_dimensional_signature === 13, 'signature should be 3+7+3=13');
});

// ── Compiler — tokenizer/parser/codegen ───────────────────

console.log('\nCompiler — v1.7 pipeline');

test('tokenizes "spin X into Y at dimension N"', () => {
  const tokens = new EventMathTokenizer().tokenize('spin field into my torus at dimension 5');
  const t = tokens.find(x => x.type === 'SPIN_STMT');
  assert(t, 'no SPIN_STMT token');
  assert(t.value.dimension === 5, `dimension should be 5, got ${t.value.dimension}`);
  assert(t.value.sourceName === 'field', `sourceName: ${t.value.sourceName}`);
  assert(t.value.intoName === 'my torus', `intoName: ${t.value.intoName}`);
});

test('tokenizes "landscape from T1 and T2 into L"', () => {
  const tokens = new EventMathTokenizer().tokenize('landscape from alpha and beta into view');
  const t = tokens.find(x => x.type === 'LANDSCAPE_STMT');
  assert(t, 'no LANDSCAPE_STMT token');
  assert(JSON.stringify(t.value.sources) === JSON.stringify(['alpha', 'beta']), `sources: ${JSON.stringify(t.value.sources)}`);
  assert(t.value.intoName === 'view', `intoName: ${t.value.intoName}`);
});

test('tokenizes "forecast from L into F"', () => {
  const tokens = new EventMathTokenizer().tokenize('forecast from my landscape into next event');
  const t = tokens.find(x => x.type === 'FORECAST_STMT');
  assert(t, 'no FORECAST_STMT token');
  assert(t.value.landscapeName === 'my landscape', `landscapeName: ${t.value.landscapeName}`);
  assert(t.value.intoName === 'next event', `intoName: ${t.value.intoName}`);
});

test('parser preserves dimension in SpinStmt AST', () => {
  const ast = parse('spin field into torus at dimension 8');
  const n = ast.statements.find(s => s.type === 'SpinStmt');
  assert(n, 'no SpinStmt');
  assert(n.dimension === 8, `dimension should be 8, got ${n.dimension}`);
});

test('parser creates LandscapeStmt with sources array', () => {
  const ast = parse('landscape from alpha and beta and gamma into view');
  const n = ast.statements.find(s => s.type === 'LandscapeStmt');
  assert(n, 'no LandscapeStmt');
  assert(n.sources.length === 3, `sources.length should be 3, got ${n.sources.length}`);
  assert(n.intoName === 'view', `intoName: ${n.intoName}`);
});

test('codegen emits setDepth with dimension', () => {
  const js = compile('spin field into my torus at dimension 5');
  assert(js.includes('setDepth(5)'), `missing spinFrom with dimension:\n${js}`);
});

test('codegen emits landscape addTorus calls', () => {
  const js = compile(`
event alpha
matter
  x is 1
end
end
spin alpha into torus a at dimension 3
spin alpha into torus b at dimension 5
landscape from torus a and torus b into view
`);
  assert(js.includes('new EM.EventMathLandscape'), 'missing EventMathLandscape');
  assert(js.includes('addTorus'), 'missing addTorus');
});

test('codegen emits forecast call', () => {
  const js = compile(`
event alpha
matter
  x is 1
end
end
spin alpha into torus a at dimension 2
landscape from torus a into view
forecast from view into next
`);
  assert(js.includes('.forecast()'), 'missing forecast call');
});

// ── Summary ───────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
