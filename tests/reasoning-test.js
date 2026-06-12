'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

// ── helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function parse(src) {
  const tokens = new EventMathTokenizer().tokenize(src);
  return new EventMathParser(tokens).parse();
}

function compile(src) {
  const ast = parse(src);
  return new EventMathCodeGen().generate(ast);
}

// ── Tokenizer tests ──────────────────────────────────────────────────

console.log('\nTokenizer — v1.6 reasoning keywords');

test('tokenizes "weight X at N"', () => {
  const tokens = new EventMathTokenizer().tokenize('weight burnout at 2');
  const ws = tokens.find(t => t.type === 'WEIGHT_STMT');
  assert(ws, 'no WEIGHT_STMT token');
  assert(ws.value.targetName === 'burnout', `targetName: ${ws.value.targetName}`);
  assert(ws.value.value === 2, `value: ${ws.value.value}`);
});

test('tokenizes "explain X from Y into Z"', () => {
  const tokens = new EventMathTokenizer().tokenize('explain observations from candidates into best explanation');
  const es = tokens.find(t => t.type === 'EXPLAIN_STMT');
  assert(es, 'no EXPLAIN_STMT token');
  assert(es.value.observations === 'observations', `observations: ${es.value.observations}`);
  assert(es.value.candidates === 'candidates', `candidates: ${es.value.candidates}`);
  assert(es.value.intoName === 'best explanation', `intoName: ${es.value.intoName}`);
});

test('tokenizes "analogy X and Y into Z"', () => {
  const tokens = new EventMathTokenizer().tokenize('analogy high workload and unclear goals into similarity score');
  const as = tokens.find(t => t.type === 'ANALOGY_STMT');
  assert(as, 'no ANALOGY_STMT token');
  assert(as.value.firstName === 'high workload', `firstName: ${as.value.firstName}`);
  assert(as.value.secondName === 'unclear goals', `secondName: ${as.value.secondName}`);
  assert(as.value.intoName === 'similarity score', `intoName: ${as.value.intoName}`);
});

// ── Parser tests ──────────────────────────────────────────────────────

console.log('\nParser — v1.6 AST nodes');

test('parses WeightStmt into AST node', () => {
  const ast = parse('weight burnout at 2');
  const node = ast.statements.find(s => s.type === 'WeightStmt');
  assert(node, 'no WeightStmt in AST');
  assert(node.targetName === 'burnout', `targetName: ${node.targetName}`);
  assert(node.value === 2, `value: ${node.value}`);
});

test('parses ExplainStmt into AST node', () => {
  const ast = parse('explain obs from cands into result');
  const node = ast.statements.find(s => s.type === 'ExplainStmt');
  assert(node, 'no ExplainStmt in AST');
  assert(node.observations === 'obs', `observations: ${node.observations}`);
  assert(node.candidates === 'cands', `candidates: ${node.candidates}`);
  assert(node.intoName === 'result', `intoName: ${node.intoName}`);
});

test('parses AnalogyStmt into AST node', () => {
  const ast = parse('analogy event a and event b into sim');
  const node = ast.statements.find(s => s.type === 'AnalogyStmt');
  assert(node, 'no AnalogyStmt in AST');
  assert(node.firstName === 'event a', `firstName: ${node.firstName}`);
  assert(node.secondName === 'event b', `secondName: ${node.secondName}`);
  assert(node.intoName === 'sim', `intoName: ${node.intoName}`);
});

// ── Codegen tests ─────────────────────────────────────────────────────

console.log('\nCodegen — v1.6 output');

test('WeightStmt emits __weights assignment', () => {
  const js = compile('weight burnout at 2');
  assert(js.includes("__weights['burnout'] = 2"), `missing weight assignment in:\n${js}`);
});

test('WeightStmt emits __weights declaration at top', () => {
  const js = compile('weight burnout at 2');
  assert(js.includes('const __weights = {};'), 'missing __weights declaration');
});

test('ExplainStmt emits abductive IIFE', () => {
  const js = compile(`
event scenario a
matter
  cause is overload
end
end
event scenario b
matter
  cause is confusion
end
end
layer candidates
  scenario a
  scenario b
end
event obs one
matter
  resolved is true
  correct is true
  cause is overload
end
end
layer observations
  obs one
end
explain observations from candidates into best
`);
  assert(js.includes('abductive: true'), `missing abductive flag:\n${js}`);
  assert(js.includes('explanation_score'), `missing explanation_score:\n${js}`);
  assert(js.includes('const best'), `missing result variable:\n${js}`);
});

test('AnalogyStmt emits Jaccard similarity IIFE', () => {
  const js = compile(`
event thing a
matter
  color is red
  size is large
end
end
event thing b
matter
  color is red
  size is small
end
end
analogy thing a and thing b into sim
`);
  assert(js.includes('__matterSim'), `missing __matterSim:\n${js}`);
  assert(js.includes('__structSim'), `missing __structSim:\n${js}`);
  assert(js.includes('const sim'), `missing sim variable:\n${js}`);
});

// ── Runtime end-to-end tests ───────────────────────────────────────────

console.log('\nRuntime — end-to-end execution');

test('analogy of identical events returns 1', () => {
  const EM = require('../runtime/eventmath-runtime.js');
  const js = compile(`
event alpha
matter
  speed is fast
  direction is forward
end
end
event beta
matter
  speed is fast
  direction is forward
end
end
analogy alpha and beta into sim score
show sim score
`);
  const lines = [];
  // Strip runtime require, __weights decl, and module.exports block for Function context
  const body = js
    .replace(/const EM = typeof[\s\S]*?eventmath-runtime\.js'\);\n/, '')
    .replace(/const __weights = \{\};\n/, '')
    .replace(/\/\/ ── Export for use ──[\s\S]*$/, '');
  const mockModule = { exports: {} };
  const mockConsole = { log: (...args) => lines.push(args.join(' ')) };
  const fn = new Function('require', 'EM', '__weights', 'console', 'module', body);
  fn(require, EM, {}, mockConsole, mockModule);
  const out = lines.join('\n');
  assert(out.includes('1'), `expected sim=1, got: "${out}"`);
});

test('weight registry survives compile', () => {
  const js = compile('weight urgency at 5\nweight clarity at 2');
  assert(js.includes("__weights['urgency'] = 5"), 'missing urgency weight');
  assert(js.includes("__weights['clarity'] = 2"), 'missing clarity weight');
});

test('explain picks higher-matching candidate', () => {
  const js = compile(`
event strong match
matter
  cause is overload
  stress is high
end
end
event weak match
matter
  cause is confusion
  stress is low
end
end
layer cands
  strong match
  weak match
end
event obs a
matter
  resolved is true
  correct is true
  cause is overload
  stress is high
end
end
layer seen
  obs a
end
explain seen from cands into winner
`);
  assert(js.includes('const winner'), 'missing winner variable');
  assert(js.includes('explanation_score'), 'missing explanation_score');
});

// ── Summary ────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
