/**
 * EventMath — Bun target (Phase 1)
 *
 * Covers the --target bun codegen path and the runtime-path fix that lets a
 * compiled file run from any directory (not just a sibling of runtime/).
 */

'use strict';

const assert = require('assert');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓  ' + name); passed++; }
  catch (e) { console.log('  ✗  ' + name + '\n     ' + e.message); failed++; }
}

function gen(src, options) {
  const ast = new EventMathParser(new EventMathTokenizer().tokenize(src)).parse();
  return new EventMathCodeGen().generate(ast, options);
}

const SRC = 'rain greeting is "hello"\nshow greeting\n';

console.log('\nEventMath — Bun target (Phase 1)\n');

// ── Backward compatibility ───────────────────────────────────────────
console.log('─ Backward compatibility ─');

test('generate(ast) with no options still works (node default)', () => {
  const js = gen(SRC);
  assert.ok(!js.startsWith('#!/usr/bin/env bun'), 'no bun shebang on default target');
  assert.ok(js.includes("require('../runtime/eventmath-runtime.js')"),
    'default runtime path preserved');
});

test('explicit node target matches default', () => {
  assert.strictEqual(gen(SRC, { target: 'node' }), gen(SRC));
});

// ── Bun target ───────────────────────────────────────────────────────
console.log('\n─ Bun target ─');

test('bun target emits a shebang as the first line', () => {
  const js = gen(SRC, { target: 'bun' });
  assert.strictEqual(js.split('\n')[0], '#!/usr/bin/env bun');
});

test('bun target marks the header', () => {
  const js = gen(SRC, { target: 'bun' });
  assert.ok(js.includes('(target: bun)'), 'header notes the bun target');
});

test('bun target still loads the UMD runtime via require', () => {
  const js = gen(SRC, { target: 'bun' });
  assert.ok(js.includes("require('"), 'bun output requires the runtime');
  assert.ok(js.includes("typeof EventMathRuntime !== 'undefined'"),
    'global-or-require shim preserved');
});

// ── Runtime path fix ─────────────────────────────────────────────────
console.log('\n─ Runtime path fix ─');

test('runtimePath option is honored verbatim', () => {
  const js = gen(SRC, { runtimePath: '../../some/where/eventmath-runtime.js' });
  assert.ok(js.includes("require('../../some/where/eventmath-runtime.js')"),
    'custom runtime path emitted');
});

test('runtimePath works together with bun target', () => {
  const js = gen(SRC, { target: 'bun', runtimePath: './rt.js' });
  assert.strictEqual(js.split('\n')[0], '#!/usr/bin/env bun');
  assert.ok(js.includes("require('./rt.js')"), 'path + target compose');
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
