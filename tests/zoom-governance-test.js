/**
 * EventMath v1.4 — Zoom Governance Test Suite
 * Tests zoom opposite and zoom meta (equal and opposite, meta-control)
 */

const { EventMathTokenizer } = require('../src/tokenizer');
const { EventMathParser }    = require('../src/parser');
const { EventMathCodeGen }   = require('../src/codegen');

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function compile(src) {
  const tokens = new EventMathTokenizer().tokenize(src);
  const ast    = new EventMathParser(tokens).parse();
  return new EventMathCodeGen().generate(ast);
}

function parse(src) {
  const tokens = new EventMathTokenizer().tokenize(src);
  return new EventMathParser(tokens).parse();
}

console.log('\n============================================================');
console.log('EventMath v1.4 — Zoom Governance (Opposite + Meta) Tests');
console.log('============================================================\n');

// ── ZOOM_OPPOSITE tokenizing ─────────────────────────────────────

test('zoom opposite tokenizes to ZOOM_OPPOSITE token', () => {
  const tokens = new EventMathTokenizer().tokenize('zoom opposite on learning process into resistance');
  const t = tokens.find(t => t.type === 'ZOOM_OPPOSITE');
  assert(t, 'expected ZOOM_OPPOSITE token');
  assert(t.value.sourceName === 'learning process', `expected sourceName 'learning process', got '${t.value.sourceName}'`);
  assert(t.value.intoName === 'resistance', `expected intoName 'resistance', got '${t.value.intoName}'`);
});

// ── ZOOM_META tokenizing ─────────────────────────────────────────

test('zoom meta tokenizes to ZOOM_META token with all four subjects', () => {
  const tokens = new EventMathTokenizer().tokenize(
    'zoom meta on not knowing and knowing and learning process and resistance into learning environment'
  );
  const t = tokens.find(t => t.type === 'ZOOM_META');
  assert(t, 'expected ZOOM_META token');
  assert(t.value.subjects.length === 4, `expected 4 subjects, got ${t.value.subjects.length}`);
  assert(t.value.subjects[0] === 'not knowing', `expected 'not knowing', got '${t.value.subjects[0]}'`);
  assert(t.value.subjects[3] === 'resistance', `expected 'resistance', got '${t.value.subjects[3]}'`);
  assert(t.value.intoName === 'learning environment', `expected intoName 'learning environment'`);
});

// ── Parser ───────────────────────────────────────────────────────

test('zoom opposite parses to ZoomOpposite AST node', () => {
  const ast = parse('zoom opposite on learning process into resistance');
  const node = ast.statements.find(n => n.type === 'ZoomOpposite');
  assert(node, 'expected ZoomOpposite node');
  assert(node.sourceName === 'learning process');
  assert(node.intoName === 'resistance');
});

test('zoom meta parses to ZoomMeta AST node', () => {
  const ast = parse(
    'zoom meta on not knowing and knowing and learning process and resistance into learning environment'
  );
  const node = ast.statements.find(n => n.type === 'ZoomMeta');
  assert(node, 'expected ZoomMeta node');
  assert(Array.isArray(node.subjects), 'subjects should be array');
  assert(node.subjects.length === 4);
  assert(node.intoName === 'learning environment');
});

// ── Codegen ──────────────────────────────────────────────────────

test('zoom opposite compiles with opposite=true and polarity=-1', () => {
  const src = `
event not knowing
category state
end

event knowing
category state
end

zoom in on not knowing and knowing into learning process
zoom opposite on learning process into resistance
`;
  const js = compile(src);
  assert(js.includes('__opp.opposite = true'), 'expected opposite = true');
  assert(js.includes('__opp.polarity = -1'), 'expected polarity = -1');
  assert(js.includes("__opp.oppositeOf = 'learning process'"), 'expected oppositeOf');
  assert(js.includes("const resistance"), 'expected resistance variable');
});

test('zoom meta compiles with meta=true, correct zoom level, and governs array', () => {
  const src = `
event not knowing
category state
end

event knowing
category state
end

zoom in on not knowing and knowing into learning process
zoom opposite on learning process into resistance
zoom meta on not knowing and knowing and learning process and resistance into learning environment
`;
  const js = compile(src);
  assert(js.includes('__meta.meta = true'), 'expected meta = true');
  assert(js.includes('__meta.governs = __governs'), 'expected governs assignment');
  assert(js.includes('__maxLevel + 1'), 'expected zoom level increment');
  assert(js.includes('const learning_environment'), 'expected learning_environment variable');
});

test('zoom meta of zoom meta produces level 4 (fractal depth)', () => {
  const src = `
event not knowing
category state
end

event knowing
category state
end

zoom in on not knowing and knowing into learning process
zoom opposite on learning process into resistance
zoom meta on not knowing and knowing and learning process and resistance into learning environment
zoom opposite on learning environment into environment collapse
zoom meta on learning environment and environment collapse into life conditions
`;
  const js = compile(src);
  assert(js.includes('const life_conditions'), 'expected life_conditions variable');
  assert(js.includes('const environment_collapse'), 'expected environment_collapse');
  // Each meta adds +1 to zoom level — life_conditions should be at level 4
  assert(js.includes('__maxLevel + 1'), 'expected recursive level increment');
});

test('full pipeline: opposing-forces.em compiles and runs without errors', () => {
  const path = require('path');
  const fs   = require('fs');
  const src  = fs.readFileSync(path.join(__dirname, '../examples/opposing-forces.em'), 'utf8');
  const js   = compile(src);
  assert(js.length > 0, 'expected non-empty output');
  // Run the compiled JS and check it produces governance output
  const output = require('child_process').execSync(
    `node ${path.join(__dirname, '../examples/opposing-forces.em.js')}`,
    { encoding: 'utf8' }
  );
  assert(output.includes('Opposite Control: resistance'), 'expected resistance as Opposite Control');
  assert(output.includes('Meta-Control: learning environment'), 'expected learning environment as Meta-Control');
  assert(output.includes('Zoom Level: 3'), 'expected zoom level 3 for meta-control');
  assert(output.includes('Meta-Control: life conditions'), 'expected second-order meta-control');
  assert(output.includes('Zoom Level: 4'), 'expected zoom level 4 for second-order meta');
});

// ── Summary ──────────────────────────────────────────────────────

console.log('\n============================================================\n');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('\n============================================================');
if (failed > 0) process.exit(1);
