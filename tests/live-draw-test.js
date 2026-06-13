/**
 * EventMath — reactive live draw (Phase 5)
 *
 * `live draw "<sql>" from ground into result` runs the query immediately,
 * then re-runs it automatically whenever the ground is written to.
 * Result is a plain `let` variable — always the current rows, no signal API
 * needed. Covers tokenizer/parser/codegen/formatter/runtime round-trips,
 * including a real SQLite reactivity test with node:sqlite.
 */

'use strict';

const assert = require('assert');
const EM = require('../runtime/eventmath-runtime.js');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓  ' + name); passed++; }
  catch (e) { console.log('  ✗  ' + name + '\n     ' + e.message); failed++; }
}

function tok(src) { return new EventMathTokenizer().tokenize(src); }
function parse(src) { return new EventMathParser(tok(src)).parse(); }
function gen(src, opts) { return new EventMathCodeGen().generate(parse(src), opts); }

console.log('\nEventMath — reactive live draw (Phase 5)\n');

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('─ Tokenizer ─');

test('live draw "sql" from g into r → LIVE_DRAW_STMT', () => {
  const t = tok('live draw "select * from t" from db into rows').find(x => x.type === 'LIVE_DRAW_STMT');
  assert.ok(t, 'LIVE_DRAW_STMT expected');
  assert.strictEqual(t.value.sql, 'select * from t');
  assert.strictEqual(t.value.from, 'db');
  assert.strictEqual(t.value.into, 'rows');
});

test('live draw preserves SQL with inner "from" keyword', () => {
  const t = tok('live draw "select id from users" from db into users').find(x => x.type === 'LIVE_DRAW_STMT');
  assert.ok(t, 'LIVE_DRAW_STMT expected');
  assert.strictEqual(t.value.sql, 'select id from users');
});

test('malformed live draw → ERROR token', () => {
  const t = tok('live draw no quotes').find(x => x.type === 'ERROR');
  assert.ok(t, 'ERROR expected for malformed live draw');
});

test('live rain still tokenizes correctly (backward compat)', () => {
  const t = tok('live rain count is 0').find(x => x.type === 'RAIN_STMT');
  assert.ok(t && t.value.live === true, 'RAIN_STMT with live=true expected');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

test('LiveDrawStmt node carries sql, from, into', () => {
  const s = parse('live draw "select 1 as n" from g into rows').statements.find(x => x.type === 'LiveDrawStmt');
  assert.ok(s, 'LiveDrawStmt expected');
  assert.strictEqual(s.sql, 'select 1 as n');
  assert.strictEqual(s.from, 'g');
  assert.strictEqual(s.into, 'rows');
});

// ── Codegen ──────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

const LIVE_SRC = `ground g at ":memory:"
live draw "select * from t" from g into rows`;

test('live draw emits let declaration (reassignable)', () => {
  const js = gen(LIVE_SRC);
  assert.ok(js.includes(`let rows = g.draw("select * from t")`), js);
});

test('live draw registers onWrite callback', () => {
  const js = gen(LIVE_SRC);
  assert.ok(js.includes(`g.onWrite(function() { rows = g.draw("select * from t"); })`), js);
});

test('live draw does NOT trigger async wrapper (no await needed)', () => {
  const js = gen(LIVE_SRC);
  assert.ok(!js.includes('(async () => {'), 'live draw alone should not wrap in async');
});

test('live draw works with serve — rows stays fresh on each request', () => {
  const src = `ground contacts at ":memory:"
live draw "select * from contacts" from contacts into rows
serve port 3000
  route get "/api/contacts"
    reply rows
  end
end`;
  const js = gen(src);
  assert.ok(js.includes(`let rows = contacts.draw("select * from contacts")`), js);
  assert.ok(js.includes(`contacts.onWrite(function() { rows = contacts.draw("select * from contacts"); })`), js);
  assert.ok(js.includes(`res.end(JSON.stringify(rows))`), js);
});

test('bun target: live draw emits same let + onWrite pattern', () => {
  const js = gen(LIVE_SRC, { target: 'bun' });
  assert.ok(js.includes(`let rows = g.draw("select * from t")`), js);
  assert.ok(js.includes(`g.onWrite(function() { rows = g.draw("select * from t"); })`), js);
});

test('multiple live draws on same ground both register', () => {
  const src = `ground g at ":memory:"
live draw "select * from a" from g into aRows
live draw "select * from b" from g into bRows`;
  const js = gen(src);
  assert.ok(js.includes('let aRows'), js);
  assert.ok(js.includes('let bRows'), js);
  assert.strictEqual((js.match(/g\.onWrite/g) || []).length, 2, 'two onWrite registrations');
});

// ── Formatter ────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

test('live draw round-trips through formatter', () => {
  const src = 'live draw "select * from t" from db into rows';
  const out = new EventMathFormatter().format(parse(src));
  assert.ok(out.includes('live draw "select * from t" from db into rows'), out);
});

// ── Runtime: real reactivity test ───────────────────────────────────
console.log('\n─ Runtime: reactivity ─');

test('EventMathGroundDB.onWrite is a function', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  assert.strictEqual(typeof g.onWrite, 'function');
});

test('onWrite callback fires after a write query', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  g.draw('create table t (n integer)');
  let fired = 0;
  g.onWrite(function() { fired++; });
  g.draw('insert into t values (1)');
  assert.strictEqual(fired, 1, 'onWrite should fire once after insert');
  g.draw('insert into t values (2)');
  assert.strictEqual(fired, 2, 'onWrite should fire again on second insert');
});

test('onWrite does NOT fire for read queries', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  g.draw('create table t (n integer)');
  g.draw('insert into t values (42)');
  let fired = 0;
  g.onWrite(function() { fired++; });
  g.draw('select * from t');
  assert.strictEqual(fired, 0, 'read query must not trigger onWrite');
});

test('live variable updates automatically when ground is written', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  g.draw('create table t (name text)');
  g.draw("insert into t values ('Ada')");

  // Simulate what the compiler emits for `live draw "select name from t" from g into rows`
  let rows = g.draw('select name from t');
  g.onWrite(function() { rows = g.draw('select name from t'); });

  assert.strictEqual(rows.length, 1, 'initial: one row');
  assert.strictEqual(rows[0].name, 'Ada');

  g.draw("insert into t values ('Grace')");

  assert.strictEqual(rows.length, 2, 'after insert: two rows');
  assert.strictEqual(rows[1].name, 'Grace');
});

test('multiple onWrite handlers all fire', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  g.draw('create table a (x integer)');
  g.draw('create table b (y integer)');

  let aRows = g.draw('select * from a');
  let bRows = g.draw('select * from b');

  g.onWrite(function() { aRows = g.draw('select * from a'); });
  g.onWrite(function() { bRows = g.draw('select * from b'); });

  g.draw('insert into a values (1)');
  g.draw('insert into b values (99)');

  assert.strictEqual(aRows.length, 1);
  assert.strictEqual(bRows.length, 1);
  assert.strictEqual(aRows[0].x, 1);
  assert.strictEqual(bRows[0].y, 99);
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
