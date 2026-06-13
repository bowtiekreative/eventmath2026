'use strict';
/**
 * EventMath v2.15 Tests — Variable References + now built-in
 *
 * Core fix: bare words in assignments are variable references.
 * String literals require quotes: "loading", "ryan", "admin".
 */

const assert = require('assert');
const { smartValue, compileExpr } = require('../src/expression.js');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

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

// ──────────────────────────────────────────────────────────────────────────
// smartValue: bare words are now variable references
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── smartValue: bare words → variable references ──');

test('single bare word → variable reference', () => {
  assert.strictEqual(smartValue(['loading']), 'loading');
});

test('multi-word bare → variable reference (underscored)', () => {
  const result = smartValue(['cart', 'total']);
  assert.ok(result.includes('cart') && result.includes('total'), `got: ${result}`);
  assert.ok(!result.startsWith('"'), `got: ${result}`);
});

test('void still → null', () => {
  assert.strictEqual(smartValue(['void']), 'null');
});

test('true still → true', () => {
  assert.strictEqual(smartValue(['true']), 'true');
});

test('false still → false', () => {
  assert.strictEqual(smartValue(['false']), 'false');
});

test('number still → number', () => {
  assert.strictEqual(smartValue(['42']), '42');
});

test('quoted string still → string literal', () => {
  assert.strictEqual(smartValue(['"loading"']), '"loading"');
});

test('quoted string with spaces → string literal', () => {
  assert.strictEqual(smartValue(['"hello world"']), '"hello world"');
});

test('expression with operator → compiled expression', () => {
  const result = smartValue(['price', 'times', 'quantity']);
  assert.ok(result.includes('*'), `got: ${result}`);
});

// ──────────────────────────────────────────────────────────────────────────
// now built-in
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── now built-in ──');

test('now as atom → Date.now()', () => {
  assert.strictEqual(compileExpr(['now']), 'Date.now()');
});

test('smartValue: now → Date.now()', () => {
  assert.strictEqual(smartValue(['now']), 'Date.now()');
});

test('rain timestamp is now', () => {
  const js = compile('rain timestamp is now');
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
});

test('lens elapsed is now minus start', () => {
  const js = compile('lens elapsed is now minus start');
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
  assert.ok(js.includes('-'), `got: ${js}`);
});

test('guard now more than expiry', () => {
  const js = compile('guard now more than expiry else reflect void');
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
  assert.ok(js.includes('>'), `got: ${js}`);
});

test('lens is expired is now more than expiry', () => {
  const js = compile('lens is expired is now more than expiry');
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
  assert.ok(js.includes('>'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// rain: bare words are variable references
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── rain: variable references ──');

test('rain total is cart total → variable reference', () => {
  const js = compile('rain total is cart total');
  assert.ok(js.includes('cart_total'), `got: ${js}`);
  assert.ok(!js.includes('"cart total"'), `got: ${js}`);
});

test('rain status is loading → variable reference', () => {
  const js = compile('rain status is loading');
  assert.ok(js.includes('= loading'), `got: ${js}`);
  assert.ok(!js.includes('"loading"'), `got: ${js}`);
});

test('rain status is "loading" → string literal', () => {
  const js = compile('rain status is "loading"');
  assert.ok(js.includes('"loading"'), `got: ${js}`);
});

test('rain count is 0 → number', () => {
  const js = compile('rain count is 0');
  assert.ok(js.includes('= 0'), `got: ${js}`);
});

test('rain active is true → boolean', () => {
  const js = compile('rain active is true');
  assert.ok(js.includes('= true'), `got: ${js}`);
});

test('rain user is void → null', () => {
  const js = compile('rain user is void');
  assert.ok(js.includes('= null'), `got: ${js}`);
});

test('rain timestamp is now → Date.now()', () => {
  const js = compile('rain timestamp is now');
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
});

test('rain result is base plus tax → expression', () => {
  const js = compile('rain result is base plus tax');
  assert.ok(js.includes('+'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// star: same rules as rain
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── star: variable references ──');

test('star label is my title → variable reference', () => {
  const js = compile('star label is my title');
  assert.ok(js.includes('my_title'), `got: ${js}`);
  assert.ok(!js.includes('"my title"'), `got: ${js}`);
});

test('star label is "My App" → string literal', () => {
  const js = compile('star label is "My App"');
  assert.ok(js.includes('"My App"'), `got: ${js}`);
});

test('star max is 100 → number', () => {
  const js = compile('star max is 100');
  assert.ok(js.includes('= 100'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// ground set: consistent with rain
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── ground set: consistent variable references ──');

test('ground set key is var → variable reference', () => {
  const js = compile('ground set theme is current theme');
  assert.ok(js.includes('current_theme'), `got: ${js}`);
  assert.ok(!js.includes('"current theme"'), `got: ${js}`);
});

test('ground set key is "string" → string literal', () => {
  const js = compile('ground set theme is "dark"');
  assert.ok(js.includes('"dark"'), `got: ${js}`);
});

test('ground set key is number → number', () => {
  const js = compile('ground set count is 0');
  assert.ok(js.includes(', 0)'), `got: ${js}`);
});

test('ground set key is void → null', () => {
  const js = compile('ground set session is void');
  assert.ok(js.includes(', null)'), `got: ${js}`);
});

test('ground set: consistent with rain (both use smartValue)', () => {
  const js1 = compile('rain theme is "dark"');
  const js2 = compile('ground set theme is "dark"');
  assert.ok(js1.includes('"dark"'), `rain: got ${js1}`);
  assert.ok(js2.includes('"dark"'), `ground set: got ${js2}`);
});

// ──────────────────────────────────────────────────────────────────────────
// End-to-end: real-world patterns the user hit
// ──────────────────────────────────────────────────────────────────────────

console.log('\n── End-to-end: real-world patterns ──');

test('assign one variable to another', () => {
  const js = compile([
    'rain source is void',
    'rain copy is source',
  ].join('\n'));
  assert.ok(js.includes('= source'), `got: ${js}`);
});

test('store loaded data in a rain var', () => {
  const js = compile([
    'rain user data is void',
    'rain user data is response',
  ].join('\n'));
  assert.ok(js.includes('= response'), `got: ${js}`);
});

test('ground set with runtime variable', () => {
  const js = compile([
    'rain token is void',
    'ground set session token is token',
  ].join('\n'));
  assert.ok(js.includes('EventMathGround.set'), `got: ${js}`);
  assert.ok(js.includes('token'), `got: ${js}`);
});

test('ground set with string literal', () => {
  const js = compile('ground set role is "admin"');
  assert.ok(js.includes('"admin"'), `got: ${js}`);
});

test('now in a lens expression', () => {
  const js = compile([
    'rain created at is now',
    'rain expires in is 3600000',
    'lens expiry is created at plus expires in',
    'lens is expired is now more than expiry',
  ].join('\n'));
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
  assert.ok(js.includes('+'), `got: ${js}`);
  assert.ok(js.includes('>'), `got: ${js}`);
});

test('full pattern: load, store, check', () => {
  const js = compile([
    'rain session token is void',
    'ground get session token into stored token',
    'rain session token is stored token',
    'guard session token is not void else reflect void',
    'rain timestamp is now',
  ].join('\n'));
  assert.ok(js.includes('EventMathGround.get'), `got: ${js}`);
  assert.ok(js.includes('stored_token'), `got: ${js}`);
  assert.ok(js.includes('!== null'), `got: ${js}`);
  assert.ok(js.includes('Date.now()'), `got: ${js}`);
});

// ──────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────────────');
console.log(`EventMath v2.15 Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
