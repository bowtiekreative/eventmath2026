/**
 * EventMath — SQLite-backed ground + draw (Phase 2)
 *
 * `ground NAME at "file.db"` opens a SQLite-backed store; `draw "<sql>" from
 * NAME into RESULT` queries it. Covers tokenizer/parser/codegen/formatter,
 * plus a real round-trip against an in-memory database via the runtime.
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

console.log('\nEventMath — SQLite ground + draw (Phase 2)\n');

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('─ Tokenizer ─');

test('ground NAME at "file" → GROUND_STMT op=open', () => {
  const t = tok('ground contacts at "app.db"').find(x => x.type === 'GROUND_STMT');
  assert.ok(t, 'GROUND_STMT expected');
  assert.strictEqual(t.value.op, 'open');
  assert.strictEqual(t.value.name, 'contacts');
  assert.strictEqual(t.value.path, 'app.db');
});

test('multi-word ground name is preserved', () => {
  const t = tok('ground customer records at "crm.db"').find(x => x.type === 'GROUND_STMT');
  assert.strictEqual(t.value.name, 'customer records');
});

test('ground set/get/remove still tokenize (backward compat)', () => {
  assert.strictEqual(tok('ground set x is 1')[0].value.op, 'set');
  assert.strictEqual(tok('ground get x into y')[0].value.op, 'get');
  assert.strictEqual(tok('ground remove x')[0].value.op, 'remove');
});

test('draw "<sql>" from g into r → DRAW_STMT, sql keeps its inner "from"', () => {
  const t = tok('draw "select * from contacts" from contacts into rows').find(x => x.type === 'DRAW_STMT');
  assert.ok(t, 'DRAW_STMT expected');
  assert.strictEqual(t.value.sql, 'select * from contacts');
  assert.strictEqual(t.value.from, 'contacts');
  assert.strictEqual(t.value.into, 'rows');
});

test('malformed draw → ERROR token', () => {
  const t = tok('draw nonsense').find(x => x.type === 'ERROR');
  assert.ok(t, 'ERROR token expected for malformed draw');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

test('GroundStmt open carries name + path', () => {
  const s = parse('ground contacts at "app.db"').statements.find(x => x.type === 'GroundStmt');
  assert.strictEqual(s.op, 'open');
  assert.strictEqual(s.path, 'app.db');
});

test('DrawStmt node carries sql/from/into', () => {
  const s = parse('draw "select 1" from g into r').statements.find(x => x.type === 'DrawStmt');
  assert.strictEqual(s.sql, 'select 1');
  assert.strictEqual(s.from, 'g');
  assert.strictEqual(s.into, 'r');
});

// ── Codegen ──────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

test('ground open emits EventMathGroundDB constructor', () => {
  const js = gen('ground contacts at "app.db"');
  assert.ok(js.includes('new EM.EventMathGroundDB("app.db")'), js);
});

test('draw emits a .draw(sql) call into the result var', () => {
  const js = gen('ground g at ":memory:"\ndraw "select 1 as n" from g into rows');
  assert.ok(js.includes('const rows = g.draw("select 1 as n");'), js);
});

test('SQL is emitted as a JSON-escaped string literal', () => {
  // Single-quoted SQL literals (the normal SQL escaping) pass through intact.
  const sql = "select * from t where name = 'O''Brien'";
  const js = gen('ground g at ":memory:"\ndraw "' + sql + '" from g into r');
  assert.ok(js.includes('g.draw(' + JSON.stringify(sql) + ')'), js);
});

// ── Formatter (round-trip) ───────────────────────────────────────────
console.log('\n─ Formatter ─');

test('ground open + draw round-trip through the formatter', () => {
  const src = 'ground contacts at "app.db"\ndraw "select * from contacts" from contacts into rows';
  const out = new EventMathFormatter().format(parse(src));
  assert.ok(out.includes('ground contacts at "app.db"'), out);
  assert.ok(out.includes('draw "select * from contacts" from contacts into rows'), out);
});

// ── Runtime (real SQLite round-trip) ─────────────────────────────────
console.log('\n─ Runtime: real SQLite round-trip ─');

test('EventMathGroundDB is exported', () => {
  assert.strictEqual(typeof EM.EventMathGroundDB, 'function');
});

test('create / insert / select against :memory:', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  assert.deepStrictEqual(g.draw('create table t (name, city)'), []);
  g.draw("insert into t values ('Ada','London'), ('Grace','New York')");
  const rows = g.draw('select name, city from t order by name');
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].name, 'Ada');
  assert.strictEqual(rows[1].city, 'New York');
});

test('non-select returns [] (write path)', () => {
  const g = new EM.EventMathGroundDB(':memory:');
  g.draw('create table t (a)');
  assert.deepStrictEqual(g.draw("insert into t values (1)"), []);
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
