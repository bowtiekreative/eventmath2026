/**
 * EventMath Z-axis Zoom Test Suite (v1.2)
 *
 * Tests all 6 aspects of the zoom feature:
 *  1. zoom in statement parses to ZoomIn AST node
 *  2. zoom in compiles — event to event
 *  3. zoom in compiles — layer to layer
 *  4. zoom out statement parses to ZoomOut AST node
 *  5. zoom out compiles
 *  6. zoom level of expression compiles
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');
const vm = require('vm');
const path = require('path');
const EM = require('../runtime/eventmath-runtime.js');

console.log('\n' + '='.repeat(60));
console.log('EventMath Z-axis Zoom Test Suite');
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

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

function tokenize(source) {
  return new EventMathTokenizer().tokenize(source);
}

function parse(source) {
  const tokens = tokenize(source);
  const parser = new EventMathParser(tokens);
  const ast = parser.parse();
  if (ast.errors && ast.errors.length > 0) {
    throw new Error('Parse errors: ' + ast.errors.join(', '));
  }
  return ast;
}

function compile(source) {
  const ast = parse(source);
  const codegen = new EventMathCodeGen();
  return codegen.generate(ast);
}

// ── Test 1: zoom in statement parses ───────────────────────────────
test('zoom in statement parses to ZoomIn AST node', () => {
  const src = `
event event a
category test
end

event event b
category test
end

zoom in on event a and event b into gap
`;
  const ast = parse(src);
  const zoomNode = ast.statements.find(s => s.type === 'ZoomIn');
  if (!zoomNode) throw new Error('No ZoomIn node found in AST');
  if (zoomNode.fromType !== 'event') throw new Error(`Wrong fromType: "${zoomNode.fromType}"`);
  if (zoomNode.intoName !== 'gap') throw new Error(`Wrong intoName: "${zoomNode.intoName}"`);
});

// ── Test 2: zoom in compiles — event to event ──────────────────────
test('zoom in compiles — event to event creates EventMathTimeline', () => {
  const src = `
event x event
category test
end

event y event
category test
end

zoom in on x event and y event into z timeline
`;
  const js = compile(src);
  if (!js.includes('EventMathTimeline')) throw new Error('Expected EventMathTimeline in output');
  if (!js.includes('zoomLevel')) throw new Error('Expected zoomLevel in output');
});

// ── Test 3: zoom in compiles — layer to layer ──────────────────────
test('zoom in compiles — layer to layer creates EventMathLayer with control: true', () => {
  const src = `
event item a
category test
end

event item b
category test
end

layer layer a
  item a
end

layer layer b
  item b
end

zoom in on layer layer a and layer layer b into bridge layer
`;
  const js = compile(src);
  if (!js.includes('EventMathLayer')) throw new Error('Expected EventMathLayer in output');
  if (!js.includes('control: true')) throw new Error('Expected control: true in output');
});

// ── Test 4: zoom out statement parses ─────────────────────────────
test('zoom out statement parses to ZoomOut AST node with sourceType timeline', () => {
  const src = `
timeline game session
past
end
present
end
future
end
end

zoom out on timeline game session as event game summary
`;
  const ast = parse(src);
  const zoomNode = ast.statements.find(s => s.type === 'ZoomOut');
  if (!zoomNode) throw new Error('No ZoomOut node found in AST');
  if (zoomNode.sourceType !== 'timeline') throw new Error(`Wrong sourceType: "${zoomNode.sourceType}"`);
  if (zoomNode.sourceName !== 'game session') throw new Error(`Wrong sourceName: "${zoomNode.sourceName}"`);
  if (zoomNode.asName !== 'game summary') throw new Error(`Wrong asName: "${zoomNode.asName}"`);
});

// ── Test 5: zoom out compiles ──────────────────────────────────────
test('zoom out compiles — output contains zoom_level and entry_count or event_count', () => {
  const src = `
timeline game session
past
end
present
end
future
end
end

zoom out on timeline game session as event game summary
`;
  const js = compile(src);
  if (!js.includes('zoom_level')) throw new Error('Expected zoom_level in compiled output');
  const hasCount = js.includes('entry_count') || js.includes('event_count');
  if (!hasCount) throw new Error('Expected entry_count or event_count in compiled output');
});

// ── Test 6: zoom level of expression compiles ─────────────────────
test('zoom level of expression compiles to .zoomLevel reference', () => {
  const src = `
timeline my timeline
past
end
present
end
future
end
end

zoom in on timeline my timeline and timeline my timeline into zoomed timeline
mark depth as zoom level of zoomed timeline
`;
  const js = compile(src);
  if (!js.includes('.zoomLevel')) throw new Error('Expected .zoomLevel in compiled output');
});

// ── Summary ──────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
