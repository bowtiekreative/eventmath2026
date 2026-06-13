/**
 * EventMath — HTTP server (Phase 3)
 *
 * `serve port N` opens an HTTP block; `route METHOD "path"` defines a route;
 * `reply NAME` sends the response. Covers tokenizer/parser/codegen/formatter
 * for all three verbs, both targets (node + bun), and backward-compat for the
 * existing v2.11 `route NAME PATH as CLOUD` syntax.
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

console.log('\nEventMath — HTTP server: serve + route + reply (Phase 3)\n');

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('─ Tokenizer ─');

test('serve port 3000 → SERVE_STMT with port=3000', () => {
  const t = tok('serve port 3000').find(x => x.type === 'SERVE_STMT');
  assert.ok(t, 'SERVE_STMT expected');
  assert.strictEqual(t.value.port, 3000);
});

test('serve port defaults to 3000 when port word is missing', () => {
  const t = tok('serve').find(x => x.type === 'SERVE_STMT');
  assert.ok(t, 'SERVE_STMT expected');
  assert.strictEqual(t.value.port, 3000);
});

test('route get "/api/items" → SERVE_ROUTE_STMT method=get path=/api/items', () => {
  const t = tok('route get "/api/items"').find(x => x.type === 'SERVE_ROUTE_STMT');
  assert.ok(t, 'SERVE_ROUTE_STMT expected');
  assert.strictEqual(t.value.method, 'get');
  assert.strictEqual(t.value.path, '/api/items');
});

test('route POST "/api/items" → SERVE_ROUTE_STMT method=post (case normalised)', () => {
  const t = tok('route POST "/api/items"').find(x => x.type === 'SERVE_ROUTE_STMT');
  assert.ok(t, 'SERVE_ROUTE_STMT expected');
  assert.strictEqual(t.value.method, 'post');
});

test('reply rows → REPLY_STMT name=rows', () => {
  const t = tok('reply rows').find(x => x.type === 'REPLY_STMT');
  assert.ok(t, 'REPLY_STMT expected');
  assert.strictEqual(t.value.name, 'rows');
});

test('reply with multi-word name → REPLY_STMT preserves name', () => {
  const t = tok('reply contact list').find(x => x.type === 'REPLY_STMT');
  assert.ok(t, 'REPLY_STMT expected');
  assert.strictEqual(t.value.name, 'contact list');
});

test('old-style route NAME PATH as CLOUD still works (backward compat)', () => {
  const t = tok('route home / as landing').find(x => x.type === 'ROUTE_LINE');
  assert.ok(t, 'ROUTE_LINE expected for v2.11-style route');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

const SERVE_SRC = `serve port 3000
  route get "/api/contacts"
    reply rows
  end
end`;

test('ServeStmt node carries port and routes array', () => {
  const s = parse(SERVE_SRC).statements.find(x => x.type === 'ServeStmt');
  assert.ok(s, 'ServeStmt expected');
  assert.strictEqual(s.port, 3000);
  assert.ok(Array.isArray(s.routes));
  assert.strictEqual(s.routes.length, 1);
});

test('ServeRouteStmt carries method, path, and body', () => {
  const s = parse(SERVE_SRC).statements.find(x => x.type === 'ServeStmt');
  const r = s.routes[0];
  assert.strictEqual(r.type, 'ServeRouteStmt');
  assert.strictEqual(r.method, 'get');
  assert.strictEqual(r.path, '/api/contacts');
  assert.ok(Array.isArray(r.body));
  assert.strictEqual(r.body.length, 1);
});

test('ReplyStmt inside route body carries name', () => {
  const s = parse(SERVE_SRC).statements.find(x => x.type === 'ServeStmt');
  const reply = s.routes[0].body[0];
  assert.strictEqual(reply.type, 'ReplyStmt');
  assert.strictEqual(reply.name, 'rows');
});

test('multiple routes are all captured', () => {
  const src = `serve port 8080
  route get "/"
    reply index
  end
  route post "/submit"
    reply result
  end
end`;
  const s = parse(src).statements.find(x => x.type === 'ServeStmt');
  assert.strictEqual(s.routes.length, 2);
  assert.strictEqual(s.routes[0].method, 'get');
  assert.strictEqual(s.routes[1].method, 'post');
});

// ── Codegen — node target ────────────────────────────────────────────
console.log('\n─ Codegen (node target) ─');

const FULL_SRC = `ground contacts at ":memory:"
serve port 3000
  route get "/api/contacts"
    draw "select * from contacts" from contacts into rows
    reply rows
  end
end`;

test('node: emits require("node:http").createServer', () => {
  const js = gen(FULL_SRC);
  assert.ok(js.includes(`require('node:http').createServer`), js);
});

test('node: .listen() with correct port', () => {
  const js = gen(FULL_SRC);
  assert.ok(js.includes(`.listen(3000`), js);
});

test('node: route emits if block checking _method and _path', () => {
  const js = gen(FULL_SRC);
  assert.ok(js.includes(`_method === "get" && _path === "/api/contacts"`), js);
});

test('node: reply emits res.writeHead + res.end + return', () => {
  const js = gen(FULL_SRC);
  assert.ok(js.includes(`res.writeHead(200`), js);
  assert.ok(js.includes(`res.end(JSON.stringify(rows))`), js);
});

test('node: 404 fallback emitted after all routes', () => {
  const js = gen(FULL_SRC);
  assert.ok(js.includes(`res.writeHead(404)`), js);
});

// ── Codegen — bun target ─────────────────────────────────────────────
console.log('\n─ Codegen (bun target) ─');

test('bun: emits Bun.serve()', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes('Bun.serve({'), js);
});

test('bun: port number present in Bun.serve config', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes('port: 3000'), js);
});

test('bun: fetch handler emitted', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes('fetch(req)'), js);
});

test('bun: route emits if block checking _method and _path', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes(`_method === "get" && _path === "/api/contacts"`), js);
});

test('bun: reply emits return Response.json()', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes('return Response.json(rows)'), js);
});

test('bun: 404 fallback is new Response(..., { status: 404 })', () => {
  const js = gen(FULL_SRC, { target: 'bun' });
  assert.ok(js.includes(`new Response('Not found', { status: 404 })`), js);
});

// ── Discard sentinel ────────────────────────────────────────────────
console.log('\n─ Discard sentinel (_) ─');

test('draw into _ emits bare call with no assignment (discard)', () => {
  const js = gen('ground g at ":memory:"\ndraw "create table t (a)" from g into _');
  assert.ok(!js.includes('const _ ='), 'should not declare const _');
  assert.ok(js.includes(`g.draw("create table t (a)")`), js);
});

test('draw into _ twice compiles cleanly (no const re-declaration)', () => {
  const src = 'ground g at ":memory:"\ndraw "create table t (a)" from g into _\ndraw "insert into t values (1)" from g into _';
  assert.doesNotThrow(() => gen(src), 'double _ should not throw');
  const js = gen(src);
  assert.strictEqual((js.match(/const _ =/g) || []).length, 0);
});

// ── Formatter (round-trip) ───────────────────────────────────────────
console.log('\n─ Formatter ─');

test('serve + route + reply round-trip through the formatter', () => {
  const src = `serve port 3000
  route get "/api/contacts"
    reply rows
  end
end`;
  const out = new EventMathFormatter().format(parse(src));
  assert.ok(out.includes('serve port 3000'), out);
  assert.ok(out.includes('route get "/api/contacts"'), out);
  assert.ok(out.includes('reply rows'), out);
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
