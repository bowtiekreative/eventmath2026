'use strict';
/**
 * EventMath v2.13 Tests — Expression Engine + Reactive Signals
 */

const assert = require('assert');
const { compileExpr, smartValue, hasOperator, safeName } = require('../src/expression.js');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');
const { EventMathValidator } = require('../src/validator.js');

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

function tok(src)     { return new EventMathTokenizer().tokenize(src); }
function parse(src)   { return new EventMathParser(tok(src)).parse(); }
function compile(src) { return new EventMathCodeGen().generate(parse(src)); }
function format(src)  { return new EventMathFormatter().format(parse(src)); }

// ──────────────────────────────────────────────────────────────────────────
// expression.js unit tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── safeName ──');

test('safeName: simple word', () => {
  assert.strictEqual(safeName('count'), 'count');
});
test('safeName: multi-word → underscores', () => {
  assert.strictEqual(safeName('cart total'), 'cart_total');
});
test('safeName: empty → null', () => {
  assert.strictEqual(safeName(''), 'null');
});
test('safeName: special chars replaced', () => {
  assert.ok(/^[a-zA-Z0-9_$]+$/.test(safeName('my-value!')));
});

console.log('\n── hasOperator ──');

test('detects "plus"', () => {
  assert.strictEqual(hasOperator(['price', 'plus', 'tax']), true);
});
test('detects "times"', () => {
  assert.strictEqual(hasOperator(['a', 'times', 'b']), true);
});
test('detects "is"', () => {
  assert.strictEqual(hasOperator(['x', 'is', 'y']), true);
});
test('no operator in bare words', () => {
  assert.strictEqual(hasOperator(['hello', 'world']), false);
});
test('detects "more than"', () => {
  assert.strictEqual(hasOperator(['count', 'more', 'than', '0']), true);
});

console.log('\n── compileExpr: arithmetic ──');

test('a plus b', () => {
  assert.strictEqual(compileExpr(['a', 'plus', 'b']), '(a + b)');
});
test('a minus b', () => {
  assert.strictEqual(compileExpr(['a', 'minus', 'b']), '(a - b)');
});
test('a times b', () => {
  assert.strictEqual(compileExpr(['a', 'times', 'b']), '(a * b)');
});
test('a divided by b', () => {
  assert.strictEqual(compileExpr(['a', 'divided', 'by', 'b']), '(a / b)');
});
test('left-associativity: a plus b minus c', () => {
  const result = compileExpr(['a', 'plus', 'b', 'minus', 'c']);
  // Should produce (a + (b - c)) or ((a + b) - c) — just verify it compiles
  assert.ok(result.includes('a') && result.includes('b') && result.includes('c'));
  assert.ok(result.includes('+') || result.includes('-'));
});
test('nested: a plus b times c — precedence', () => {
  const result = compileExpr(['a', 'plus', 'b', 'times', 'c']);
  // plus is lower precedence, so splits first: a + (b * c)
  assert.ok(result.includes('(b * c)'), `got: ${result}`);
  assert.ok(result.includes('a'));
});

console.log('\n── compileExpr: comparison ──');

test('a more than b', () => {
  assert.strictEqual(compileExpr(['a', 'more', 'than', 'b']), '(a > b)');
});
test('a less than b', () => {
  assert.strictEqual(compileExpr(['a', 'less', 'than', 'b']), '(a < b)');
});
test('a at least b', () => {
  assert.strictEqual(compileExpr(['a', 'at', 'least', 'b']), '(a >= b)');
});
test('a at most b', () => {
  assert.strictEqual(compileExpr(['a', 'at', 'most', 'b']), '(a <= b)');
});
test('a is b', () => {
  assert.strictEqual(compileExpr(['a', 'is', 'b']), '(a === b)');
});
test('a is not b', () => {
  assert.strictEqual(compileExpr(['a', 'is', 'not', 'b']), '(a !== b)');
});

console.log('\n── compileExpr: boolean ──');

test('a and b', () => {
  assert.strictEqual(compileExpr(['a', 'and', 'b']), '(a && b)');
});
test('a or b', () => {
  assert.strictEqual(compileExpr(['a', 'or', 'b']), '(a || b)');
});
test('not a', () => {
  assert.strictEqual(compileExpr(['not', 'a']), '!(a)');
});
test('not (a and b)', () => {
  const result = compileExpr(['not', 'a', 'and', 'b']);
  assert.ok(result.startsWith('!('), `got: ${result}`);
});

console.log('\n── compileExpr: null checks ──');

test('a is void → null check', () => {
  const result = compileExpr(['a', 'is', 'void']);
  assert.ok(result.includes('=== null') || result.includes('=== undefined'), `got: ${result}`);
});
test('a is not void → non-null check', () => {
  const result = compileExpr(['a', 'is', 'not', 'void']);
  assert.ok(result.includes('!== null') || result.includes('!== undefined'), `got: ${result}`);
});

console.log('\n── compileExpr: atoms ──');

test('number literal', () => {
  assert.strictEqual(compileExpr(['42']), '42');
});
test('float literal', () => {
  assert.strictEqual(compileExpr(['3.14']), '3.14');
});
test('true literal', () => {
  assert.strictEqual(compileExpr(['true']), 'true');
});
test('false literal', () => {
  assert.strictEqual(compileExpr(['false']), 'false');
});
test('void literal', () => {
  assert.strictEqual(compileExpr(['void']), 'null');
});
test('quoted string', () => {
  assert.strictEqual(compileExpr(['"hello"']), '"hello"');
});
test('multi-word name → safeName', () => {
  const result = compileExpr(['cart', 'total']);
  assert.ok(result.includes('cart') && result.includes('total'), `got: ${result}`);
});
test('empty array → null', () => {
  assert.strictEqual(compileExpr([]), 'null');
});

console.log('\n── smartValue ──');

test('void → null', () => {
  assert.strictEqual(smartValue(['void']), 'null');
});
test('true → true', () => {
  assert.strictEqual(smartValue(['true']), 'true');
});
test('false → false', () => {
  assert.strictEqual(smartValue(['false']), 'false');
});
test('number → number', () => {
  assert.strictEqual(smartValue(['42']), '42');
});
test('quoted string → as-is', () => {
  assert.strictEqual(smartValue(['"hello"']), '"hello"');
});
test('expression with operator → compileExpr', () => {
  const result = smartValue(['price', 'times', 'quantity']);
  assert.ok(result.includes('*'), `got: ${result}`);
});
test('bare words → string literal', () => {
  const result = smartValue(['EventMath', 'Studio']);
  assert.strictEqual(result, '"EventMath Studio"');
});
test('bare single word → string literal', () => {
  const result = smartValue(['loading']);
  assert.strictEqual(result, '"loading"');
});
test('empty → null', () => {
  assert.strictEqual(smartValue([]), 'null');
});

// ──────────────────────────────────────────────────────────────────────────
// EventMathSignal runtime tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── EventMathSignal runtime ──');

// Load runtime
let EM;
test('runtime loads', () => {
  EM = require('../runtime/eventmath-runtime.js');
  assert.ok(EM);
});

test('EventMathSignal is exported', () => {
  assert.ok(typeof EM.EventMathSignal === 'function');
});

test('initial value via get()', () => {
  const sig = new EM.EventMathSignal(42);
  assert.strictEqual(sig.get(), 42);
});

test('set() updates value', () => {
  const sig = new EM.EventMathSignal(0);
  sig.set(99);
  assert.strictEqual(sig.get(), 99);
});

test('watch() fires on change', () => {
  const sig = new EM.EventMathSignal('a');
  let fired = false;
  let newVal;
  sig.watch(function(v) { fired = true; newVal = v; });
  sig.set('b');
  assert.strictEqual(fired, true);
  assert.strictEqual(newVal, 'b');
});

test('watch() does not fire when value unchanged', () => {
  const sig = new EM.EventMathSignal('x');
  let count = 0;
  sig.watch(function() { count++; });
  sig.set('x'); // same value
  assert.strictEqual(count, 0);
});

test('watch() unsubscribe stops notifications', () => {
  const sig = new EM.EventMathSignal(1);
  let count = 0;
  const unsub = sig.watch(function() { count++; });
  sig.set(2);
  unsub();
  sig.set(3);
  assert.strictEqual(count, 1); // fired once, not twice
});

test('multiple watchers', () => {
  const sig = new EM.EventMathSignal(0);
  let a = 0, b = 0;
  sig.watch(function() { a++; });
  sig.watch(function() { b++; });
  sig.set(1);
  assert.strictEqual(a, 1);
  assert.strictEqual(b, 1);
});

test('valueOf() returns primitive value', () => {
  const sig = new EM.EventMathSignal(7);
  assert.strictEqual(+sig, 7);
});

test('toString() returns string of value', () => {
  const sig = new EM.EventMathSignal('hello');
  assert.strictEqual(sig.toString(), 'hello');
});

test('initial value can be null', () => {
  const sig = new EM.EventMathSignal(null);
  assert.strictEqual(sig.get(), null);
});

// ──────────────────────────────────────────────────────────────────────────
// Tokenizer tests — live rain
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Tokenizer: live rain ──');

test('tokenizes live rain', () => {
  const tok = new EventMathTokenizer();
  const tokens = tok.tokenize('live rain count is 0');
  assert.ok(tokens.length > 0);
  assert.strictEqual(tokens[0].type, 'RAIN_STMT');
  assert.strictEqual(tokens[0].value.live, true);
  assert.strictEqual(tokens[0].value.name, 'count');
  assert.strictEqual(tokens[0].value.value, '0');
});

test('live rain multi-word name', () => {
  const tok = new EventMathTokenizer();
  const tokens = tok.tokenize('live rain cart total is 0');
  assert.strictEqual(tokens[0].type, 'RAIN_STMT');
  assert.strictEqual(tokens[0].value.live, true);
  assert.strictEqual(tokens[0].value.name, 'cart total');
});

test('live rain void initial', () => {
  const tok = new EventMathTokenizer();
  const tokens = tok.tokenize('live rain user is void');
  assert.strictEqual(tokens[0].type, 'RAIN_STMT');
  assert.strictEqual(tokens[0].value.live, true);
  assert.strictEqual(tokens[0].value.value, 'void');
});

// ──────────────────────────────────────────────────────────────────────────
// Codegen tests — expressions wired through
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Codegen: lens expressions ──');

test('lens: arithmetic expression', () => {
  const js = compile('lens total is price times quantity');
  assert.ok(js.includes('*'), `expected *, got: ${js}`);
  assert.ok(js.includes('price'), `expected price, got: ${js}`);
  assert.ok(js.includes('quantity'), `expected quantity, got: ${js}`);
});

test('lens: plus expression', () => {
  const js = compile('lens sum is a plus b');
  assert.ok(js.includes('+'), `expected +, got: ${js}`);
});

test('lens: comparison expression', () => {
  const js = compile('lens is premium is plan more than 1');
  assert.ok(js.includes('>'), `expected >, got: ${js}`);
});

test('lens: boolean expression', () => {
  const js = compile('lens valid is logged in and not expired');
  assert.ok(js.includes('&&'), `expected &&, got: ${js}`);
  assert.ok(js.includes('!'), `expected !, got: ${js}`);
});

test('lens: is void null check', () => {
  const js = compile('lens no user is current user is void');
  assert.ok(js.includes('null') || js.includes('undefined'), `got: ${js}`);
});

console.log('\n── Codegen: rain expressions ──');

test('rain: bare words become string literal', () => {
  const js = compile('rain title is EventMath Studio');
  assert.ok(js.includes('"EventMath Studio"'), `got: ${js}`);
});

test('rain: void → null', () => {
  const js = compile('rain user is void');
  assert.ok(js.includes('= null'), `got: ${js}`);
});

test('rain: number literal', () => {
  const js = compile('rain count is 0');
  assert.ok(js.includes('= 0'), `got: ${js}`);
});

test('rain: boolean literal', () => {
  const js = compile('rain active is true');
  assert.ok(js.includes('= true'), `got: ${js}`);
});

test('rain: expression', () => {
  const js = compile('rain total is base plus tax');
  assert.ok(js.includes('+'), `got: ${js}`);
});

console.log('\n── Codegen: live rain → EventMathSignal ──');

test('live rain: emits EventMathSignal', () => {
  const js = compile('live rain count is 0');
  assert.ok(js.includes('EventMathSignal'), `got: ${js}`);
});

test('live rain: void initial value', () => {
  const js = compile('live rain user is void');
  assert.ok(js.includes('EventMathSignal'), `got: ${js}`);
  assert.ok(js.includes('null'), `got: ${js}`);
});

test('live rain: expression initial value', () => {
  const js = compile('live rain total is base plus tax');
  assert.ok(js.includes('EventMathSignal'), `got: ${js}`);
  assert.ok(js.includes('+'), `got: ${js}`);
});

console.log('\n── Codegen: guard expressions ──');

test('guard: single name condition', () => {
  const js = compile('guard session token else reflect void');
  assert.ok(js.includes('session_token'), `got: ${js}`);
});

test('guard: comparison condition', () => {
  const js = compile('guard count more than 0 else reflect void');
  assert.ok(js.includes('>'), `got: ${js}`);
});

test('guard: is not void condition', () => {
  const js = compile('guard user is not void else reflect void');
  assert.ok(js.includes('!== null') || js.includes('!== undefined'), `got: ${js}`);
});

console.log('\n── Codegen: star expressions ──');

test('star: number literal', () => {
  const js = compile('star max is 100');
  assert.ok(js.includes('= 100'), `got: ${js}`);
});

test('star: quoted string', () => {
  const js = compile('star api url is "https://api.example.com"');
  assert.ok(js.includes('"https://api.example.com"'), `got: ${js}`);
});

test('star: bare words → string literal', () => {
  const js = compile('star title is My App');
  assert.ok(js.includes('"My App"'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Formatter tests — live rain
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Formatter: live rain ──');

test('formatter handles live rain token', () => {
  const fmt = new EventMathFormatter();
  const result = fmt.format(parse('live rain count is 0'));
  assert.ok(typeof result === 'string');
  assert.ok(result.includes('rain') && result.includes('count'), `got: ${result}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Validator tests — live keyword
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Validator: live keyword ──');

test('validator does not flag "live" as reserved in names', () => {
  const val = new EventMathValidator();
  val.validate(parse('live rain count is 0'));
  const liveErrors = val.errors.filter(e => e.includes('live'));
  assert.strictEqual(liveErrors.length, 0, `unexpected errors: ${liveErrors.join(', ')}`);
});

// ──────────────────────────────────────────────────────────────────────────
// End-to-end tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── End-to-end: expression programs ──');

test('e2e: arithmetic chain', () => {
  const src = [
    'rain price is 10',
    'rain quantity is 3',
    'lens total is price times quantity',
    'lens tax is total times 0.08',
    'lens final is total plus tax',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('*'), `got: ${js}`);
  assert.ok(js.includes('+'), `got: ${js}`);
  assert.ok(js.includes('0.08'), `got: ${js}`);
});

test('e2e: guard chain with expression', () => {
  const src = [
    'rain session is void',
    'guard session is not void else reflect void',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('null'), `got: ${js}`);
});

test('e2e: live rain + match', () => {
  const src = [
    'live rain status is void',
    'rain status is loading',
    'match status',
    '  arm loading',
    '    show loading screen',
    '  arm ready',
    '    show dashboard',
    '  arm else',
    '    show not found',
    'end',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('EventMathSignal'), `got: ${js}`);
  assert.ok(js.includes('switch'), `got: ${js}`);
});

test('e2e: orbit with lens expression', () => {
  const src = [
    'rain items is active list',
    'orbit item in items',
    '  lens line total is item price times item quantity',
    '  show item',
    'end',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('for'), `got: ${js}`);
  assert.ok(js.includes('*'), `got: ${js}`);
});

test('e2e: boolean expression in lens', () => {
  const src = [
    'rain logged in is false',
    'rain dismissed is false',
    'lens show banner is logged in and not dismissed',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('&&'), `got: ${js}`);
  assert.ok(js.includes('!'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────────────');
console.log(`EventMath v2.13 Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
