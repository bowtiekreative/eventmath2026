/**
 * EventMath — AI ask primitive (Phase 4)
 *
 * `ask "prompt" [with data] into result` sends a prompt to any
 * OpenAI-compatible endpoint and stores the reply. Covers
 * tokenizer/parser/codegen/formatter and runtime exports. Actual HTTP
 * calls are not made — the generated code structure is verified instead.
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

console.log('\nEventMath — AI ask primitive (Phase 4)\n');

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('─ Tokenizer ─');

test('ask "prompt" into result → ASK_STMT no data', () => {
  const t = tok('ask "Hello" into greeting').find(x => x.type === 'ASK_STMT');
  assert.ok(t, 'ASK_STMT expected');
  assert.strictEqual(t.value.prompt, 'Hello');
  assert.strictEqual(t.value.data, null);
  assert.strictEqual(t.value.into, 'greeting');
});

test('ask "prompt" with rows into summary → ASK_STMT with data', () => {
  const t = tok('ask "Summarize" with rows into summary').find(x => x.type === 'ASK_STMT');
  assert.ok(t, 'ASK_STMT expected');
  assert.strictEqual(t.value.prompt, 'Summarize');
  assert.strictEqual(t.value.data, 'rows');
  assert.strictEqual(t.value.into, 'summary');
});

test('ask with multi-word data name → data preserved', () => {
  const t = tok('ask "Sort these" with contact list into sorted').find(x => x.type === 'ASK_STMT');
  assert.ok(t, 'ASK_STMT expected');
  assert.strictEqual(t.value.data, 'contact list');
});

test('ask with prompt containing commas → prompt preserved', () => {
  const t = tok('ask "List names, cities, and emails" into report').find(x => x.type === 'ASK_STMT');
  assert.ok(t, 'ASK_STMT expected');
  assert.strictEqual(t.value.prompt, 'List names, cities, and emails');
});

test('malformed ask → ERROR token', () => {
  const t = tok('ask without quotes').find(x => x.type === 'ERROR');
  assert.ok(t, 'ERROR token expected for malformed ask');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

test('AskStmt node carries prompt, data=null, into', () => {
  const s = parse('ask "Hello" into greeting').statements.find(x => x.type === 'AskStmt');
  assert.ok(s, 'AskStmt expected');
  assert.strictEqual(s.prompt, 'Hello');
  assert.strictEqual(s.data, null);
  assert.strictEqual(s.into, 'greeting');
});

test('AskStmt node carries data when with is present', () => {
  const s = parse('ask "Summarize" with rows into summary').statements.find(x => x.type === 'AskStmt');
  assert.strictEqual(s.data, 'rows');
  assert.strictEqual(s.into, 'summary');
});

// ── Codegen ──────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

test('ask emits await EM.EventMathAsker.ask(prompt)', () => {
  const js = gen('ask "Hello" into greeting');
  assert.ok(js.includes('await EM.EventMathAsker.ask("Hello")'), js);
});

test('ask with data passes data as second arg', () => {
  const js = gen('ask "Summarize" with rows into summary');
  assert.ok(js.includes('await EM.EventMathAsker.ask("Summarize", rows)'), js);
});

test('ask result is assigned to a const', () => {
  const js = gen('ask "Hello" into greeting');
  assert.ok(js.includes('const greeting = await EM.EventMathAsker.ask'), js);
});

test('ask into _ discards result (no const assignment)', () => {
  const js = gen('ask "fire and forget" into _');
  assert.ok(!js.includes('const _ ='), 'should not declare const _');
  assert.ok(js.includes('await EM.EventMathAsker.ask'), js);
});

test('ask triggers top-level async wrapper', () => {
  const js = gen('ask "Hello" into greeting');
  assert.ok(js.includes('(async () => {'), js);
});

test('program without ask does NOT get async wrapper (no regression)', () => {
  const js = gen('event login\n  title is User logged in\nend');
  assert.ok(!js.includes('(async () => {'), 'no async wrapper without ask');
});

test('ask works alongside draw in same program', () => {
  const src = `ground g at ":memory:"
draw "select 1 as n" from g into rows
ask "Explain this" with rows into summary`;
  const js = gen(src);
  assert.ok(js.includes(`g.draw("select 1 as n")`), js);
  assert.ok(js.includes('await EM.EventMathAsker.ask("Explain this", rows)'), js);
});

test('bun target: ask still emits await (same pattern, no target difference)', () => {
  const js = gen('ask "Hello" into greeting', { target: 'bun' });
  assert.ok(js.includes('await EM.EventMathAsker.ask("Hello")'), js);
});

test('serve handler is async (so ask works inside routes)', () => {
  const src = `serve port 3000
  route get "/"
    reply result
  end
end`;
  const js = gen(src);
  assert.ok(js.includes('async function(req, res)'), js);
});

test('bun serve handler is async fetch', () => {
  const src = `serve port 3000
  route get "/"
    reply result
  end
end`;
  const js = gen(src, { target: 'bun' });
  assert.ok(js.includes('async fetch(req)'), js);
});

// ── Formatter (round-trip) ───────────────────────────────────────────
console.log('\n─ Formatter ─');

test('ask without data round-trips through formatter', () => {
  const src = 'ask "Hello world" into greeting';
  const out = new EventMathFormatter().format(parse(src));
  assert.ok(out.includes('ask "Hello world" into greeting'), out);
});

test('ask with data round-trips through formatter', () => {
  const src = 'ask "Summarize" with rows into summary';
  const out = new EventMathFormatter().format(parse(src));
  assert.ok(out.includes('ask "Summarize" with rows into summary'), out);
});

// ── Runtime ──────────────────────────────────────────────────────────
console.log('\n─ Runtime ─');

test('EventMathAsker is exported from runtime', () => {
  assert.ok(EM.EventMathAsker, 'EventMathAsker should be exported');
});

test('EventMathAsker.ask is a function', () => {
  assert.strictEqual(typeof EM.EventMathAsker.ask, 'function');
});

test('EventMathAsker.endpoint defaults to localhost:11434', () => {
  assert.ok(EM.EventMathAsker.endpoint.includes('localhost:11434'), EM.EventMathAsker.endpoint);
});

test('EventMathAsker.model defaults to llama3', () => {
  assert.strictEqual(EM.EventMathAsker.model, 'llama3');
});

test('EventMathAsker.ask returns a Promise (fetch-based)', () => {
  // We don't have a running server, so we just verify the return shape.
  // A real integration test would stub fetch. Here we just confirm it returns
  // a thenable (Promise) — the catch proves it's promise-shaped even on failure.
  const result = EM.EventMathAsker.ask('hello');
  assert.ok(result && typeof result.then === 'function', 'ask() should return a Promise');
  result.catch(() => {}); // suppress unhandled rejection
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
