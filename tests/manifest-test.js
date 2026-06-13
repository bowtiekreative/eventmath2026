/**
 * EventMath — manifest mode (Phase 6 capstone)
 *
 * `manifest NAME … end` is a self-generating app declaration. Write what
 * you want; EventMath generates the full working program — ground, live draw,
 * HTTP server, and AI routes — from a handful of readable lines.
 *
 * Covers tokenizer, parser, codegen (node + bun), and formatter round-trip.
 */

'use strict';

const assert = require('assert');
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

const MANIFEST_SRC = `manifest contacts app
  store contacts in "app.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  summarize contacts with ai at "/api/summary"
end`;

console.log('\nEventMath — manifest mode (Phase 6 capstone)\n');

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('─ Tokenizer ─');

test('manifest NAME → MANIFEST_STMT with name', () => {
  const t = tok('manifest contacts app').find(x => x.type === 'MANIFEST_STMT');
  assert.ok(t, 'MANIFEST_STMT expected');
  assert.strictEqual(t.value.name, 'contacts app');
});

test('store TABLE in "FILE" with fields → MANIFEST_STORE', () => {
  const t = tok('store contacts in "app.db" with name and city').find(x => x.type === 'MANIFEST_STORE');
  assert.ok(t, 'MANIFEST_STORE expected');
  assert.strictEqual(t.value.table, 'contacts');
  assert.strictEqual(t.value.path, 'app.db');
  assert.deepStrictEqual(t.value.fields, ['name', 'city']);
});

test('store without with clause → fields is empty array', () => {
  const t = tok('store contacts in "app.db"').find(x => x.type === 'MANIFEST_STORE');
  assert.ok(t, 'MANIFEST_STORE expected');
  assert.deepStrictEqual(t.value.fields, []);
});

test('serve on N → SERVE_STMT port (manifest variant)', () => {
  const t = tok('serve on 3000').find(x => x.type === 'SERVE_STMT');
  assert.ok(t, 'SERVE_STMT expected');
  assert.strictEqual(t.value.port, 3000);
});

test('serve port N still works (backward compat)', () => {
  const t = tok('serve port 8080').find(x => x.type === 'SERVE_STMT');
  assert.ok(t, 'SERVE_STMT expected');
  assert.strictEqual(t.value.port, 8080);
});

test('show all TABLE at "/path" → MANIFEST_SHOW_ALL', () => {
  const t = tok('show all contacts at "/api/contacts"').find(x => x.type === 'MANIFEST_SHOW_ALL');
  assert.ok(t, 'MANIFEST_SHOW_ALL expected');
  assert.strictEqual(t.value.table, 'contacts');
  assert.strictEqual(t.value.path, '/api/contacts');
});

test('show MARK still works for old show usage (backward compat)', () => {
  const t = tok('show total').find(x => x.type === 'KEYWORD' && x.value === 'show');
  assert.ok(t, 'show keyword token expected for old-style show');
});

test('summarize TABLE with ai at "/path" → MANIFEST_SUMMARIZE', () => {
  const t = tok('summarize contacts with ai at "/api/summary"').find(x => x.type === 'MANIFEST_SUMMARIZE');
  assert.ok(t, 'MANIFEST_SUMMARIZE expected');
  assert.strictEqual(t.value.table, 'contacts');
  assert.strictEqual(t.value.path, '/api/summary');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

test('ManifestStmt carries name', () => {
  const s = parse(MANIFEST_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.ok(s, 'ManifestStmt expected');
  assert.strictEqual(s.name, 'contacts app');
});

test('ManifestStmt.stores has the store clause', () => {
  const s = parse(MANIFEST_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.strictEqual(s.stores.length, 1);
  assert.strictEqual(s.stores[0].table, 'contacts');
  assert.strictEqual(s.stores[0].path, 'app.db');
  assert.deepStrictEqual(s.stores[0].fields, ['name', 'city']);
});

test('ManifestStmt.port is 3000', () => {
  const s = parse(MANIFEST_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.strictEqual(s.port, 3000);
});

test('ManifestStmt.showAlls has one entry', () => {
  const s = parse(MANIFEST_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.strictEqual(s.showAlls.length, 1);
  assert.strictEqual(s.showAlls[0].path, '/api/contacts');
});

test('ManifestStmt.summarizes has one entry', () => {
  const s = parse(MANIFEST_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.strictEqual(s.summarizes.length, 1);
  assert.strictEqual(s.summarizes[0].path, '/api/summary');
});

// ── Codegen — node target ────────────────────────────────────────────
console.log('\n─ Codegen (node) ─');

test('node: emits EventMathGroundDB for the store', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes('new EM.EventMathGroundDB("app.db")'), js);
});

test('node: emits create table if not exists with inferred columns', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes('create table if not exists contacts (id integer primary key autoincrement, name text, city text)'), js);
});

test('node: emits live draw (let + onWrite)', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes('let all_contacts = contacts.draw'), js);
  assert.ok(js.includes('contacts.onWrite(function()'), js);
});

test('node: emits http.createServer', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes(`require('node:http').createServer`), js);
});

test('node: show all route emits GET handler returning live variable', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes(`_path === "/api/contacts"`), js);
  assert.ok(js.includes('JSON.stringify(all_contacts)'), js);
});

test('node: summarize route emits GET handler with EventMathAsker.ask', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes(`_path === "/api/summary"`), js);
  assert.ok(js.includes('EM.EventMathAsker.ask("Summarize these contacts", all_contacts)'), js);
});

test('node: 404 fallback emitted', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes(`res.writeHead(404)`), js);
});

test('node: listen on correct port', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes('.listen(3000'), js);
});

test('node: no async wrapper at top level (manifest handles async internally)', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(!js.includes('(async () => {'), 'manifest should not add outer async wrapper');
});

// ── Codegen — bun target ─────────────────────────────────────────────
console.log('\n─ Codegen (bun) ─');

test('bun: emits Bun.serve()', () => {
  const js = gen(MANIFEST_SRC, { target: 'bun' });
  assert.ok(js.includes('Bun.serve({'), js);
});

test('bun: show all route returns Response.json', () => {
  const js = gen(MANIFEST_SRC, { target: 'bun' });
  assert.ok(js.includes('return Response.json(all_contacts)'), js);
});

test('bun: summarize route returns Response.json({ summary })', () => {
  const js = gen(MANIFEST_SRC, { target: 'bun' });
  assert.ok(js.includes('return Response.json({ summary: _summary })'), js);
});

// ── Default schema (no with clause) ─────────────────────────────────
console.log('\n─ Default schema ─');

test('store without fields defaults to "data text" column', () => {
  const src = `manifest simple app
  store things in "t.db"
  serve on 4000
  show all things at "/things"
end`;
  const js = gen(src);
  assert.ok(js.includes('id integer primary key autoincrement, data text'), js);
});

// ── Formatter (round-trip) ───────────────────────────────────────────
console.log('\n─ Formatter ─');

test('manifest round-trips through formatter', () => {
  const out = new EventMathFormatter().format(parse(MANIFEST_SRC));
  assert.ok(out.includes('manifest contacts app'), out);
  assert.ok(out.includes('store contacts in "app.db" with name and city'), out);
  assert.ok(out.includes('serve on 3000'), out);
  assert.ok(out.includes('show all contacts at "/api/contacts"'), out);
  assert.ok(out.includes('summarize contacts with ai at "/api/summary"'), out);
  assert.ok(out.includes('end'), out);
});

// ── accept NOUN at "/path" — POST write route ────────────────────────
console.log('\n─ accept clause ─');

const MANIFEST_FULL_SRC = `manifest contacts app
  store contacts in "app.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  summarize contacts as "List these contacts briefly" with ai at "/api/summary"
  accept contacts at "/api/contacts"
end`;

test('accept NOUN at "/path" → MANIFEST_ACCEPT token', () => {
  const t = tok('accept contacts at "/api/contacts"').find(x => x.type === 'MANIFEST_ACCEPT');
  assert.ok(t, 'MANIFEST_ACCEPT expected');
  assert.strictEqual(t.value.noun, 'contacts');
  assert.strictEqual(t.value.path, '/api/contacts');
});

test('accept without quotes on path still parses', () => {
  const t = tok('accept things at /api/things').find(x => x.type === 'MANIFEST_ACCEPT');
  assert.ok(t, 'MANIFEST_ACCEPT expected');
  assert.strictEqual(t.value.noun, 'things');
  assert.strictEqual(t.value.path, '/api/things');
});

test('summarize with custom as-prompt → prompt field set', () => {
  const t = tok('summarize contacts as "List these contacts briefly" with ai at "/api/summary"')
    .find(x => x.type === 'MANIFEST_SUMMARIZE');
  assert.ok(t, 'MANIFEST_SUMMARIZE expected');
  assert.strictEqual(t.value.prompt, 'List these contacts briefly');
  assert.strictEqual(t.value.path, '/api/summary');
});

test('summarize without as-prompt → prompt is null', () => {
  const t = tok('summarize contacts with ai at "/api/summary"').find(x => x.type === 'MANIFEST_SUMMARIZE');
  assert.ok(t, 'MANIFEST_SUMMARIZE expected');
  assert.strictEqual(t.value.prompt, null);
});

test('parser: ManifestStmt.accepts has one entry', () => {
  const s = parse(MANIFEST_FULL_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.ok(s, 'ManifestStmt expected');
  assert.strictEqual(s.accepts.length, 1);
  assert.strictEqual(s.accepts[0].noun, 'contacts');
  assert.strictEqual(s.accepts[0].path, '/api/contacts');
});

test('parser: summarize carries custom prompt through to AST', () => {
  const s = parse(MANIFEST_FULL_SRC).statements.find(x => x.type === 'ManifestStmt');
  assert.strictEqual(s.summarizes[0].prompt, 'List these contacts briefly');
});

test('node: accept clause emits POST handler', () => {
  const js = gen(MANIFEST_FULL_SRC);
  assert.ok(js.includes(`_method === "post" && _path === "/api/contacts"`), js);
});

test('node: accept clause emits body parsing', () => {
  const js = gen(MANIFEST_FULL_SRC);
  assert.ok(js.includes(`await new Promise`), js);
  assert.ok(js.includes(`Buffer.concat`), js);
});

test('node: accept clause emits INSERT into contacts', () => {
  const js = gen(MANIFEST_FULL_SRC);
  assert.ok(js.includes(`insert into contacts`), js);
});

test('node: accept clause returns 201 with live variable', () => {
  const js = gen(MANIFEST_FULL_SRC);
  assert.ok(js.includes(`res.writeHead(201`), js);
  assert.ok(js.includes(`JSON.stringify(all_contacts)`), js);
});

test('node: custom prompt used in summarize (not hardcoded)', () => {
  const js = gen(MANIFEST_FULL_SRC);
  assert.ok(js.includes(`"List these contacts briefly"`), js);
  assert.ok(!js.includes(`"Summarize these contacts"`), `should use custom prompt, not default: ${js}`);
});

test('node: default prompt used when no as-clause', () => {
  const js = gen(MANIFEST_SRC);
  assert.ok(js.includes(`"Summarize these contacts"`), js);
});

test('node: manifest handler is always async (even without summarize)', () => {
  const src = `manifest simple app
  store things in "t.db"
  serve on 4000
  show all things at "/things"
end`;
  const js = gen(src);
  assert.ok(js.includes('async function(req, res)'), `expected async even without summarize: ${js}`);
});

test('bun: accept clause emits POST handler with req.json()', () => {
  const js = gen(MANIFEST_FULL_SRC, { target: 'bun' });
  assert.ok(js.includes(`_method === "post" && _path === "/api/contacts"`), js);
  assert.ok(js.includes(`await req.json()`), js);
});

test('bun: accept clause returns Response.json with status 201', () => {
  const js = gen(MANIFEST_FULL_SRC, { target: 'bun' });
  assert.ok(js.includes(`Response.json(all_contacts, { status: 201 })`), js);
});

test('bun: manifest fetch handler is always async', () => {
  const src = `manifest simple app
  store things in "t.db"
  serve on 4000
  show all things at "/things"
end`;
  const js = gen(src, { target: 'bun' });
  assert.ok(js.includes('async fetch(req)'), `expected async fetch: ${js}`);
});

test('formatter: accept clause round-trips', () => {
  const out = new EventMathFormatter().format(parse(MANIFEST_FULL_SRC));
  assert.ok(out.includes('accept contacts at "/api/contacts"'), out);
});

test('formatter: custom summarize prompt round-trips', () => {
  const out = new EventMathFormatter().format(parse(MANIFEST_FULL_SRC));
  assert.ok(out.includes('summarize contacts as "List these contacts briefly" with ai at "/api/summary"'), out);
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
