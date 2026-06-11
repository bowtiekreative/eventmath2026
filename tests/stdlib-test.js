/**
 * EventMath Standard Library Test Suite
 *
 * Tests the built-in math, date, string, and layer operations
 * added in v1.0.
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');

console.log('\n' + '='.repeat(60));
console.log('EventMath Standard Library Test Suite');
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

function compile(source) {
  const tokenizer = new EventMathTokenizer();
  const tokens = tokenizer.tokenize(source);
  const parser = new EventMathParser(tokens);
  const ast = parser.parse();
  if (ast.errors && ast.errors.length > 0) {
    throw new Error('Parse errors: ' + ast.errors.join(', '));
  }
  const codegen = new EventMathCodeGen();
  return codegen.generate(ast);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

// ── Test 1: round of X ───────────────────────────────────────
test('round of 3.7 compiles to Math.round', () => {
  const js = compile('mark x as round of 3.7');
  if (!js.includes('Math.round')) {
    throw new Error(`Expected Math.round in output, got:\n${js}`);
  }
});

// ── Test 2: minimum of X and Y ───────────────────────────────
test('minimum of 5 and 10 compiles to Math.min(5, 10)', () => {
  const js = compile('mark x as minimum of 5 and 10');
  if (!js.includes('Math.min(5, 10)')) {
    throw new Error(`Expected Math.min(5, 10) in output, got:\n${js}`);
  }
});

// ── Test 3: maximum of X and Y ───────────────────────────────
test('maximum of 5 and 10 compiles to Math.max(5, 10)', () => {
  const js = compile('mark x as maximum of 5 and 10');
  if (!js.includes('Math.max(5, 10)')) {
    throw new Error(`Expected Math.max(5, 10) in output, got:\n${js}`);
  }
});

// ── Test 4: random between X and Y ───────────────────────────
test('random between 1 and 6 compiles with Math.random()', () => {
  const js = compile('mark x as random between 1 and 6');
  if (!js.includes('Math.random()')) {
    throw new Error(`Expected Math.random() in output, got:\n${js}`);
  }
});

// ── Test 5: today as a value ──────────────────────────────────
test('today as a value compiles with new Date()', () => {
  const js = compile('mark x as today');
  if (!js.includes('new Date()')) {
    throw new Error(`Expected new Date() in output, got:\n${js}`);
  }
});

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
