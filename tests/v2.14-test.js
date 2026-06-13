'use strict';
/**
 * EventMath v2.14 Tests — Collection Intelligence + Pipeline
 */

const assert = require('assert');
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
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function tok(src)     { return new EventMathTokenizer().tokenize(src); }
function parse(src)   { return new EventMathParser(tok(src)).parse(); }
function compile(src) { return new EventMathCodeGen().generate(parse(src)); }
function format(src)  { return new EventMathFormatter().format(parse(src)); }
function validate(src) {
  const v = new EventMathValidator();
  v.validate(parse(src));
  return v;
}

// ──────────────────────────────────────────────────────────────────────────
// Tokenizer tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Tokenizer: filter ──');

test('tokenizes filter statement', () => {
  const tokens = tok('filter item from items where item active into result');
  assert.strictEqual(tokens[0].type, 'FILTER_STMT');
  assert.strictEqual(tokens[0].value.itemName, 'item');
  assert.strictEqual(tokens[0].value.collName, 'items');
  assert.strictEqual(tokens[0].value.condition, 'item active');
  assert.strictEqual(tokens[0].value.resultName, 'result');
});

test('filter: multi-word item name', () => {
  const tokens = tok('filter active item from item list where active item deleted into result');
  assert.strictEqual(tokens[0].type, 'FILTER_STMT');
  assert.strictEqual(tokens[0].value.itemName, 'active item');
});

test('filter: expression condition', () => {
  const tokens = tok('filter item from items where item price more than 50 into pricey');
  assert.strictEqual(tokens[0].type, 'FILTER_STMT');
  assert.strictEqual(tokens[0].value.condition, 'item price more than 50');
});

console.log('\n── Tokenizer: find ──');

test('tokenizes find statement', () => {
  const tokens = tok('find item in items where item id is target id into found');
  assert.strictEqual(tokens[0].type, 'FIND_STMT');
  assert.strictEqual(tokens[0].value.itemName, 'item');
  assert.strictEqual(tokens[0].value.collName, 'items');
  assert.strictEqual(tokens[0].value.condition, 'item id is target id');
  assert.strictEqual(tokens[0].value.resultName, 'found');
});

test('old find-in-layer syntax unchanged', () => {
  const tokens = tok('find in my layer where priority is high into result');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'find');
});

console.log('\n── Tokenizer: sort ──');

test('sort ascending', () => {
  const tokens = tok('sort items by name into sorted');
  assert.strictEqual(tokens[0].type, 'SORT_STMT');
  assert.strictEqual(tokens[0].value.collName, 'items');
  assert.strictEqual(tokens[0].value.field, 'name');
  assert.strictEqual(tokens[0].value.descending, false);
  assert.strictEqual(tokens[0].value.resultName, 'sorted');
});

test('sort descending', () => {
  const tokens = tok('sort items by price descending into sorted');
  assert.strictEqual(tokens[0].type, 'SORT_STMT');
  assert.strictEqual(tokens[0].value.descending, true);
  assert.strictEqual(tokens[0].value.field, 'price');
});

test('sort: multi-word field', () => {
  const tokens = tok('sort products by unit price into sorted');
  assert.strictEqual(tokens[0].type, 'SORT_STMT');
  assert.strictEqual(tokens[0].value.field, 'unit price');
});

test('old sort-layer syntax unchanged', () => {
  const tokens = tok('sort layer my layer by matter priority');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'sort');
});

console.log('\n── Tokenizer: count ──');

test('count simple', () => {
  const tokens = tok('count items into total');
  assert.strictEqual(tokens[0].type, 'COUNT_STMT');
  assert.strictEqual(tokens[0].value.collName, 'items');
  assert.strictEqual(tokens[0].value.resultName, 'total');
  assert.ok(!tokens[0].value.condition);
});

test('count with condition', () => {
  const tokens = tok('count item in items where item active into active count');
  assert.strictEqual(tokens[0].type, 'COUNT_STMT');
  assert.strictEqual(tokens[0].value.itemName, 'item');
  assert.strictEqual(tokens[0].value.collName, 'items');
  assert.strictEqual(tokens[0].value.condition, 'item active');
  assert.strictEqual(tokens[0].value.resultName, 'active count');
});

test('old count-in-layer syntax unchanged', () => {
  const tokens = tok('count in my layer where priority is high into total');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'count');
});

console.log('\n── Tokenizer: pipe ──');

test('pipe single transform', () => {
  const tokens = tok('pipe raw data through normalize into clean data');
  assert.strictEqual(tokens[0].type, 'PIPE_STMT');
  assert.strictEqual(tokens[0].value.sourceName, 'raw data');
  assert.deepStrictEqual(tokens[0].value.transforms, ['normalize']);
  assert.strictEqual(tokens[0].value.resultName, 'clean data');
});

test('pipe multiple transforms', () => {
  const tokens = tok('pipe input through trim and validate and encode into output');
  assert.strictEqual(tokens[0].type, 'PIPE_STMT');
  assert.deepStrictEqual(tokens[0].value.transforms, ['trim', 'validate', 'encode']);
});

console.log('\n── Tokenizer: cast ──');

test('cast as number', () => {
  const tokens = tok('cast raw value as number into parsed');
  assert.strictEqual(tokens[0].type, 'CAST_STMT');
  assert.strictEqual(tokens[0].value.sourceName, 'raw value');
  assert.strictEqual(tokens[0].value.targetType, 'number');
  assert.strictEqual(tokens[0].value.resultName, 'parsed');
});

test('cast as text', () => {
  const tokens = tok('cast count as text into label');
  assert.strictEqual(tokens[0].type, 'CAST_STMT');
  assert.strictEqual(tokens[0].value.targetType, 'text');
});

test('cast as boolean', () => {
  const tokens = tok('cast value as boolean into flag');
  assert.strictEqual(tokens[0].type, 'CAST_STMT');
  assert.strictEqual(tokens[0].value.targetType, 'boolean');
});

console.log('\n── Tokenizer: log ──');

test('log value', () => {
  const tokens = tok('log cart total');
  assert.strictEqual(tokens[0].type, 'LOG_STMT');
  assert.strictEqual(tokens[0].value.value, 'cart total');
  assert.ok(!tokens[0].value.withValue);
});

test('log message with value', () => {
  const tokens = tok('log "Cart total:" with cart total');
  assert.strictEqual(tokens[0].type, 'LOG_STMT');
  assert.strictEqual(tokens[0].value.message, '"Cart total:"');
  assert.strictEqual(tokens[0].value.withValue, 'cart total');
});

test('log preserves line number', () => {
  const tokens = tok('log count');
  assert.ok(tokens[0].value.line > 0);
});

// ──────────────────────────────────────────────────────────────────────────
// Parser tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Parser ──');

test('parses FilterStmt', () => {
  const ast = parse('filter item from items where item active into result');
  assert.strictEqual(ast.statements[0].type, 'FilterStmt');
});

test('parses FindStmt', () => {
  const ast = parse('find item in items where item id is 1 into found');
  assert.strictEqual(ast.statements[0].type, 'FindStmt');
});

test('parses SortStmt', () => {
  const ast = parse('sort items by name into sorted');
  assert.strictEqual(ast.statements[0].type, 'SortStmt');
});

test('parses CountStmt (simple)', () => {
  const ast = parse('count items into total');
  assert.strictEqual(ast.statements[0].type, 'CountStmt');
});

test('parses CountStmt (with condition)', () => {
  const ast = parse('count item in items where item active into n');
  assert.strictEqual(ast.statements[0].type, 'CountStmt');
  assert.strictEqual(ast.statements[0].condition, 'item active');
});

test('parses PipeStmt', () => {
  const ast = parse('pipe data through clean into result');
  assert.strictEqual(ast.statements[0].type, 'PipeStmt');
});

test('parses CastStmt', () => {
  const ast = parse('cast value as number into n');
  assert.strictEqual(ast.statements[0].type, 'CastStmt');
});

test('parses LogStmt', () => {
  const ast = parse('log count');
  assert.strictEqual(ast.statements[0].type, 'LogStmt');
});

// ──────────────────────────────────────────────────────────────────────────
// Codegen tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Codegen: filter ──');

test('filter emits .filter()', () => {
  const js = compile('filter item from items where item active into result');
  assert.ok(js.includes('.filter('), `got: ${js}`);
  assert.ok(js.includes('result'), `got: ${js}`);
});

test('filter: expression condition', () => {
  const js = compile('filter item from items where item price more than 50 into pricey');
  assert.ok(js.includes('.filter('), `got: ${js}`);
  assert.ok(js.includes('>'), `got: ${js}`);
});

test('filter: item var used in condition', () => {
  const js = compile('filter item from items where item id is 1 into found');
  assert.ok(js.includes('function(item)'), `got: ${js}`);
  assert.ok(js.includes('==='), `got: ${js}`);
});

console.log('\n── Codegen: find ──');

test('find emits .find()', () => {
  const js = compile('find item in items where item id is 42 into found');
  assert.ok(js.includes('.find('), `got: ${js}`);
  assert.ok(js.includes('found'), `got: ${js}`);
  assert.ok(js.includes('|| null'), `got: ${js}`);
});

test('find: fallback to null', () => {
  const js = compile('find item in items where item name is "Alice" into match');
  assert.ok(js.includes('|| null'), `got: ${js}`);
});

console.log('\n── Codegen: sort ──');

test('sort ascending emits .slice().sort()', () => {
  const js = compile('sort items by name into sorted');
  assert.ok(js.includes('.slice().sort('), `got: ${js}`);
  assert.ok(js.includes('sorted'), `got: ${js}`);
});

test('sort descending reverses direction', () => {
  const js = compile('sort items by price descending into sorted');
  assert.ok(js.includes('.slice().sort('), `got: ${js}`);
  // descending: dir = -1, so -dir = 1 and dir = -1
  assert.ok(js.includes('1') && js.includes('-1'), `got: ${js}`);
});

test('sort preserves original array (slice)', () => {
  const js = compile('sort items by date into recent');
  assert.ok(js.includes('.slice()'), `got: ${js}`);
});

console.log('\n── Codegen: count ──');

test('count simple: emits .length', () => {
  const js = compile('count items into total');
  assert.ok(js.includes('.length'), `got: ${js}`);
  assert.ok(js.includes('total'), `got: ${js}`);
});

test('count with condition: emits .filter().length', () => {
  const js = compile('count item in items where item active into n');
  assert.ok(js.includes('.filter('), `got: ${js}`);
  assert.ok(js.includes('.length'), `got: ${js}`);
});

console.log('\n── Codegen: pipe ──');

test('pipe emits reduce chain', () => {
  const js = compile('pipe data through clean into result');
  assert.ok(js.includes('reduce'), `got: ${js}`);
  assert.ok(js.includes('clean'), `got: ${js}`);
  assert.ok(js.includes('result'), `got: ${js}`);
});

test('pipe: multiple transforms', () => {
  const js = compile('pipe input through trim and validate into output');
  assert.ok(js.includes('trim'), `got: ${js}`);
  assert.ok(js.includes('validate'), `got: ${js}`);
});

console.log('\n── Codegen: cast ──');

test('cast as number emits Number()', () => {
  const js = compile('cast raw as number into n');
  assert.ok(js.includes('Number('), `got: ${js}`);
});

test('cast as text emits String()', () => {
  const js = compile('cast n as text into label');
  assert.ok(js.includes('String('), `got: ${js}`);
});

test('cast as boolean emits Boolean()', () => {
  const js = compile('cast value as boolean into flag');
  assert.ok(js.includes('Boolean('), `got: ${js}`);
});

console.log('\n── Codegen: log ──');

test('log emits console.log with EM line reference', () => {
  const js = compile('log count');
  assert.ok(js.includes('console.log'), `got: ${js}`);
  assert.ok(js.includes('[EM:'), `got: ${js}`);
  assert.ok(js.includes('count'), `got: ${js}`);
});

test('log "msg" with value', () => {
  const js = compile('log "Count:" with count');
  assert.ok(js.includes('console.log'), `got: ${js}`);
  assert.ok(js.includes('"Count:"'), `got: ${js}`);
  assert.ok(js.includes('count'), `got: ${js}`);
});

test('log expression', () => {
  const js = compile('log a plus b');
  assert.ok(js.includes('console.log'), `got: ${js}`);
  assert.ok(js.includes('+'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Codegen: reactive lens
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Codegen: reactive lens ──');

test('non-reactive lens stays as IIFE', () => {
  const js = compile('lens total is price times quantity');
  assert.ok(js.includes('(function()'), `got: ${js}`);
  assert.ok(js.includes('*'), `got: ${js}`);
});

test('reactive lens: emits watcher function when depends on live rain', () => {
  const src = [
    'live rain price is 10',
    'live rain quantity is 1',
    'lens total is price times quantity',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('function __lens_total'), `got: ${js}`);
  assert.ok(js.includes('.watch('), `got: ${js}`);
  assert.ok(js.includes('price.get()'), `got: ${js}`);
  assert.ok(js.includes('quantity.get()'), `got: ${js}`);
});

test('reactive lens: calls initial computation', () => {
  const src = [
    'live rain count is 0',
    'lens double is count times 2',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('__lens_double()'), `got: ${js}`);
});

test('reactive lens: mixed signal and non-signal vars', () => {
  const src = [
    'live rain price is 10',
    'rain tax rate is 0.08',
    'lens tax is price times tax rate',
  ].join('\n');
  const js = compile(src);
  // price is a signal, tax_rate is not
  assert.ok(js.includes('price.get()'), `got: ${js}`);
  assert.ok(!js.includes('tax_rate.get()'), `got: ${js}`);
});

test('non-signal lens: no watcher emitted', () => {
  const src = [
    'rain a is 1',
    'rain b is 2',
    'lens sum is a plus b',
  ].join('\n');
  const js = compile(src);
  assert.ok(!js.includes('.watch('), `got: ${js}`);
  assert.ok(js.includes('(function()'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Formatter tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Formatter ──');

test('formats filter', () => {
  const out = format('filter item from items where item active into result');
  assert.ok(out.includes('filter'), `got: ${out}`);
  assert.ok(out.includes('from'), `got: ${out}`);
  assert.ok(out.includes('where'), `got: ${out}`);
});

test('formats find', () => {
  const out = format('find item in items where item id is 1 into found');
  assert.ok(out.includes('find') && out.includes('where'), `got: ${out}`);
});

test('formats sort ascending', () => {
  const out = format('sort items by name into sorted');
  assert.ok(out.includes('sort') && out.includes('by'), `got: ${out}`);
  assert.ok(!out.includes('descending'), `got: ${out}`);
});

test('formats sort descending', () => {
  const out = format('sort items by price descending into sorted');
  assert.ok(out.includes('descending'), `got: ${out}`);
});

test('formats count (simple)', () => {
  const out = format('count items into total');
  assert.ok(out.includes('count') && out.includes('into'), `got: ${out}`);
});

test('formats count (with condition)', () => {
  const out = format('count item in items where item active into n');
  assert.ok(out.includes('where'), `got: ${out}`);
});

test('formats pipe', () => {
  const out = format('pipe data through clean into result');
  assert.ok(out.includes('pipe') && out.includes('through'), `got: ${out}`);
});

test('formats cast', () => {
  const out = format('cast value as number into n');
  assert.ok(out.includes('cast') && out.includes('as'), `got: ${out}`);
});

test('formats log (value)', () => {
  const out = format('log count');
  assert.ok(out.includes('log'), `got: ${out}`);
});

test('formats log (with)', () => {
  const out = format('log "Debug:" with count');
  assert.ok(out.includes('log') && out.includes('with'), `got: ${out}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Validator tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Validator ──');

test('result names registered as marks', () => {
  const v = validate('filter item from items where item active into active items');
  const err = v.errors.filter(e => e.includes('active items'));
  assert.strictEqual(err.length, 0, `errors: ${v.errors.join(', ')}`);
});

test('no errors for pipe/cast/log keywords in names', () => {
  const v = validate('count items into total');
  const unexpectedErrors = v.errors.filter(e => e.includes('"count"') || e.includes('"into"'));
  assert.strictEqual(unexpectedErrors.length, 0, `errors: ${v.errors.join(', ')}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Backward compatibility: old layer syntax still works
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── Backward compatibility: old layer syntax ──');

test('sort layer still tokenizes correctly', () => {
  const tokens = tok('sort layer my layer by matter priority');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'sort');
  assert.strictEqual(tokens[1].value, 'layer');
});

test('filter layer still tokenizes correctly', () => {
  const tokens = tok('filter layer my events where priority is high into filtered');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'filter');
  assert.strictEqual(tokens[1].value, 'layer');
});

test('find in layer still tokenizes correctly', () => {
  const tokens = tok('find in my layer where priority is high into found');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'find');
});

test('count in layer still tokenizes correctly', () => {
  const tokens = tok('count in my layer where priority is high into n');
  assert.strictEqual(tokens[0].type, 'KEYWORD');
  assert.strictEqual(tokens[0].value, 'count');
});

// ──────────────────────────────────────────────────────────────────────────
// End-to-end tests
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── End-to-end ──');

test('e2e: full collection pipeline', () => {
  const src = [
    'rain products is void',
    'filter product from products where product in stock into available',
    'sort available by price into by price',
    'count product from available where product featured into featured count',
    'find product in available where product id is selected id into selected',
    'log "Available:" with featured count',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('.filter('), `filter missing: ${js}`);
  assert.ok(js.includes('.slice().sort('), `sort missing: ${js}`);
  assert.ok(js.includes('.find('), `find missing: ${js}`);
  assert.ok(js.includes('console.log'), `log missing: ${js}`);
});

test('e2e: cast + pipe', () => {
  const src = [
    'rain raw input is void',
    'cast raw input as text into text value',
    'pipe text value through trim and lowercase into clean value',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('String('), `cast missing: ${js}`);
  assert.ok(js.includes('reduce'), `pipe missing: ${js}`);
});

test('e2e: reactive lens with orbit', () => {
  const src = [
    'live rain price is 0',
    'live rain quantity is 0',
    'lens order total is price times quantity',
    'lens has order is quantity more than 0',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('function __lens_order_total'), `reactive lens missing: ${js}`);
  assert.ok(js.includes('price.get()'), `signal .get() missing: ${js}`);
  assert.ok(js.includes('quantity.get()'), `signal .get() missing: ${js}`);
  assert.ok(js.includes('function __lens_has_order'), `second reactive lens missing: ${js}`);
});

test('e2e: filter inside orbit', () => {
  const src = [
    'rain catalog is void',
    'orbit category in catalog',
    '  filter item from category items where item active into visible',
    '  count visible into visible count',
    '  log "Visible items:" with visible count',
    'end',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('.filter('), `got: ${js}`);
  assert.ok(js.includes('.length'), `got: ${js}`);
  assert.ok(js.includes('console.log'), `got: ${js}`);
});

test('e2e: count then guard', () => {
  const src = [
    'rain items is void',
    'count items into item count',
    'guard item count more than 0 else reflect void',
  ].join('\n');
  const js = compile(src);
  assert.ok(js.includes('.length'), `got: ${js}`);
  assert.ok(js.includes('>'), `got: ${js}`);
  assert.ok(js.includes('return null'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────────────');
console.log(`EventMath v2.14 Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
