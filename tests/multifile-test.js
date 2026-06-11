/**
 * Multi-file integration test
 * Creates temp files, compiles them with the use statement, verifies output.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');

console.log('\n============================================================');
console.log('Multi-file Integration Test');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e.message}`);
    failed++;
  }
}

// ── Test 1: Use statement tokenizes ──────────────────────────
test('use statement tokenizes correctly', () => {
  const t = new EventMathTokenizer();
  const tokens = t.tokenize('use sprint layer from events.em');
  const types = tokens.map(t => t.type + '(' + t.value + ')').join(' ');
  if (!types.includes('KEYWORD(use)')) throw new Error('Missing KEYWORD(use): ' + types);
  if (!types.includes('NAME(sprint layer)')) throw new Error('Missing NAME(sprint layer): ' + types);
  if (!types.includes('KEYWORD(from)')) throw new Error('Missing KEYWORD(from): ' + types);
  if (!types.includes('LITERAL(events.em)')) throw new Error('Missing LITERAL(events.em): ' + types);
});

// ── Test 2: Use statement parses to Use AST node ─────────────
test('use statement parses to Use node', () => {
  const t = new EventMathTokenizer();
  const p = new EventMathParser(t.tokenize('use sprint layer from events.em'));
  const ast = p.parse();
  if (ast.errors && ast.errors.length > 0) throw new Error('Parse errors: ' + ast.errors.join(', '));
  const useNode = ast.statements.find(s => s.type === 'Use');
  if (!useNode) throw new Error('No Use node in AST');
  if (useNode.name !== 'sprint layer') throw new Error('Wrong name: ' + useNode.name);
  if (useNode.from !== 'events.em') throw new Error('Wrong from: ' + useNode.from);
});

// ── Test 3: Use statement compiles to require ─────────────────
test('use statement compiles to require()', () => {
  const t = new EventMathTokenizer();
  const p = new EventMathParser(t.tokenize('use sprint layer from events.em'));
  const ast = p.parse();
  const g = new EventMathCodeGen();
  const js = g.generate(ast);
  if (!js.includes("require('./events.em.js')")) {
    throw new Error('Compiled output missing require: ' + js.substring(0, 200));
  }
});

// ── Test 4: Multi-file example compiles ───────────────────────
test('multi-file example sprint-main.em compiles', () => {
  const mainPath = path.join(__dirname, '../examples/sprint-main.em');
  if (!fs.existsSync(mainPath)) throw new Error('Missing examples/sprint-main.em');
  const src = fs.readFileSync(mainPath, 'utf-8');
  const t = new EventMathTokenizer();
  const p = new EventMathParser(t.tokenize(src));
  const ast = p.parse();
  if (ast.errors && ast.errors.length > 0) throw new Error('Parse errors: ' + ast.errors.join(', '));
  const g = new EventMathCodeGen();
  const js = g.generate(ast);
  if (!js.includes("require('./sprint-events.em.js')")) {
    throw new Error('Missing sprint-events require');
  }
  if (!js.includes("require('./billing-events.em.js')")) {
    throw new Error('Missing billing-events require');
  }
});

// ── Test 5: Validator accepts imported names ──────────────────
test('validator does not flag imported names as undefined', () => {
  const { EventMathValidator } = require('../src/validator.js');
  const t = new EventMathTokenizer();
  const src = 'use auth features from sprint-events.em\ntimeline my sprint\npresent\n  auth features\nend\nend';
  const p = new EventMathParser(t.tokenize(src));
  const ast = p.parse();
  const v = new EventMathValidator();
  const result = v.validate(ast);
  const authErrors = result.errors.filter(e => e.includes('auth features'));
  if (authErrors.length > 0) throw new Error('Validator wrongly flagged imported name: ' + authErrors[0]);
});

// ── Summary ───────────────────────────────────────────────────
console.log('\n============================================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('============================================================\n');
if (failed > 0) process.exit(1);
