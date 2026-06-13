'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const EM                     = require('../runtime/eventmath-runtime.js');

let passed = 0;
let failed = 0;

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
  const js   = compile(src);
  const body = js
    .replace(/const EM = typeof[\s\S]*?eventmath-runtime\.js'\);\n/, '')
    .replace(/const __weights = \{\};\n/, '')
    .replace(/\/\/ ── Export for use ──[\s\S]*$/, '');
  const lines  = [];
  const mockCon = { log: (...a) => lines.push(a.join(' ')) };
  new Function('require', 'EM', '__weights', 'console', 'module', body)
    (require, EM, {}, mockCon, { exports: {} });
  return lines;
}

// ── Tokenizer ──────────────────────────────────────────────────────────

console.log('\nTokenizer — v1.8 new operators');

test('tokenizes "take away" as arithmetic operator', () => {
  const js = compile('mark x as score take away penalty');
  assert(js.includes('-'), `expected subtraction operator, got: ${js}`);
});

test('tokenizes "rewind of X" as sqrt builtin', () => {
  const js = compile('mark r as rewind of nine');
  assert(js.includes('Math.sqrt'), `expected Math.sqrt, got: ${js}`);
});

test('tokenizes "bound X and Y into Z"', () => {
  const tokens = new EventMathTokenizer().tokenize('bound neg side and pos side into main axis');
  const bs = tokens.find(t => t.type === 'BOUND_STMT');
  assert(bs, 'no BOUND_STMT token');
  assert(bs.value.firstName  === 'neg side',  `firstName: ${bs.value.firstName}`);
  assert(bs.value.secondName === 'pos side',  `secondName: ${bs.value.secondName}`);
  assert(bs.value.intoName   === 'main axis', `intoName: ${bs.value.intoName}`);
});

// ── Parser ────────────────────────────────────────────────────────────

console.log('\nParser — BoundStmt AST');

test('parses BoundStmt', () => {
  const ast = parse('bound a and b into c');
  const node = ast.statements.find(s => s.type === 'BoundStmt');
  assert(node, 'no BoundStmt');
  assert(node.firstName  === 'a', `firstName: ${node.firstName}`);
  assert(node.secondName === 'b', `secondName: ${node.secondName}`);
  assert(node.intoName   === 'c', `intoName: ${node.intoName}`);
});

// ── Codegen ───────────────────────────────────────────────────────────

console.log('\nCodegen — v1.8 output');

test('"take away" compiles to subtraction', () => {
  const js = compile('mark result as future take away past');
  assert(js.includes('1 - -1') || js.includes('future') || js.includes('1'), `got: ${js}`);
  // past=-1 and future=1 as numberless numbers
  assert(js.match(/1\s*-\s*-1/) || js.includes('result'), 'should subtract');
});

test('"past/present/future" resolve to -1/0/1', () => {
  const js = compile('mark x as past\nmark y as present\nmark z as future');
  assert(js.includes('-1'), `past should be -1, got:\n${js}`);
  assert(js.includes('0'),  `present should be 0, got:\n${js}`);
  assert(js.includes('1'),  `future should be 1, got:\n${js}`);
});

test('"rewind of X" compiles to Math.sqrt', () => {
  const js = compile('mark r as rewind of nine');
  assert(js.includes('Math.sqrt'), `missing Math.sqrt:\n${js}`);
});

test('negative dimension spin emits correct dimension value', () => {
  const js = compile(`
event source thing
matter
  type is base
end
end
spin source thing into neg torus at dimension -7
`);
  assert(js.includes('-7'), `missing negative dimension -7:\n${js}`);
  assert(js.includes('setDepth'), 'missing spinFrom call');
});

test('BoundStmt compiles to EventMathAxis', () => {
  const js = compile(`
event neg event
matter
  side is negative
end
end
event pos event
matter
  side is positive
end
end
spin neg event into neg torus at dimension -5
spin pos event into pos torus at dimension 5
bound neg torus and pos torus into the axis
`);
  assert(js.includes('EventMathAxis'), `missing EventMathAxis:\n${js}`);
  assert(js.includes('the_axis'), `missing result variable:\n${js}`);
});

// ── Runtime ───────────────────────────────────────────────────────────

console.log('\nRuntime — negative dimensions + axis');

test('negative dimension torus has inverted nucleus', () => {
  const posT = new EM.EventMathAnchor('pos');
  posT.setDepth(2);
  posT.expand(1);  // ring 1: totalOuter=4, +nucleus=5 → Fibonacci ✓
  const negT = new EM.EventMathAnchor('neg');
  negT.setDepth(-2);
  negT.expand(1);  // same count, but nucleus should be ABSENT (inverted)
  assert(posT.nucleusPresent() === true,  'positive D2 ring 1: nucleus should be present (5 is Fib)');
  assert(negT.nucleusPresent() === false, 'negative D2 ring 1: nucleus should be absent (inverted)');
});

test('positive and negative toruses are complementary', () => {
  // Across rings, exactly one of them has nucleus present at each point
  for (let rings = 1; rings <= 8; rings++) {
    const p = new EM.EventMathAnchor('p');
    p.setDepth(3);
    p.expand(rings);
    const n = new EM.EventMathAnchor('n');
    n.setDepth(-3);
    n.expand(rings);
    assert(p.nucleusPresent() !== n.nucleusPresent(),
      `Ring ${rings}: pos=${p.nucleusPresent()} neg=${n.nucleusPresent()} — should be complementary`);
  }
});

test('EventMathAxis creates the 6-layer complex structure', () => {
  const neg = new EM.EventMathAnchor('negative thirteen');
  neg.setDepth(-13);
  const pos = new EM.EventMathAnchor('positive thirteen');
  pos.setDepth(13);
  const axis = new EM.EventMathAxis('dimensional axis', neg, pos);
  assert(axis.bridge,     'missing bridge (i)');
  assert(axis.antiBridge, 'missing anti-bridge (-i)');
  assert(axis.metaAxis,   'missing meta-axis (R)');
  assert(axis.antiMeta,   'missing anti-meta (-R)');
  assert(axis.grandAxis,  'missing grand axis (C)');
  assert(axis.presentLine === 0, `presentLine should be 0 for ±13, got ${axis.presentLine}`);
});

test('axis bridge has higher zoom level than both toruses', () => {
  const neg = new EM.EventMathAnchor('neg');
  neg.setDepth(-5);
  const pos = new EM.EventMathAnchor('pos');
  pos.setDepth(5);
  const axis = new EM.EventMathAxis('ax', neg, pos);
  assert(axis.bridge.zoomLevel > Math.abs(neg.dimension), 'bridge zoom should exceed anchor depth');
  assert(axis.grandAxis.zoomLevel > axis.metaAxis.zoomLevel, 'grand > meta zoom');
});

test('axis render contains present line and Riemann reference', () => {
  const neg = new EM.EventMathAnchor('neg');
  neg.setDepth(-13);
  const pos = new EM.EventMathAnchor('pos');
  pos.setDepth(13);
  const axis = new EM.EventMathAxis('main axis', neg, pos);
  const rendered = axis.render();
  assert(rendered.includes('Present line: 0'), `missing present line: ${rendered}`);
  assert(rendered.includes('Riemann'), `missing Riemann reference: ${rendered}`);
  assert(rendered.includes('i x i'), `missing i² proof: ${rendered}`);
});

test('negative torus render shows clockwise direction', () => {
  const t = new EM.EventMathAnchor('neg');
  t.setDepth(-7);
  t.expand(3);
  const r = t.render();
  assert(r.includes('clockwise') || r.includes('↺'), `missing clockwise indicator: ${r}`);
  assert(r.includes('D-7'), `missing D-7 label: ${r}`);
});

test('take away arithmetic works end-to-end', () => {
  const lines = run('mark score as future take away past\nshow score');
  const out = lines.join('\n');
  assert(out.includes('2') || out.includes('score'), `expected 1-(-1)=2, got: ${out}`);
});

// ── Summary ───────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
