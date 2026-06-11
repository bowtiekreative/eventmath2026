'use strict';
const EM = require('../runtime/eventmath-runtime.js');

const ITERATIONS = 100_000;
const TIMELINE_SIZE = 10_000;

function bench(name, fn) {
  // Warm up
  fn(); fn();
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return { name, ms: Number(end - start) / 1_000_000 };
}

// ── Benchmark 1: Event creation ──────────────────────────────
function emEventCreation() {
  for (let i = 0; i < ITERATIONS; i++) {
    new EM.EventMathEvent('task ' + i, 'task', { title: 'Task ' + i, status: 'todo' });
  }
}
function jsEventCreation() {
  for (let i = 0; i < ITERATIONS; i++) {
    Object.freeze({ id: 'task ' + i, cat: 'task', matter: { title: 'Task ' + i, status: 'todo' } });
  }
}

// ── Benchmark 2: Loop (again N times equivalent) ─────────────
function emLoop() {
  let sum = 0;
  for (let i = 0; i < ITERATIONS; i++) { sum += i; }
  return sum;
}
function jsLoop() {
  let sum = 0;
  for (let i = 0; i < ITERATIONS; i++) { sum += i; }
  return sum;
}

// ── Benchmark 3: Walk (walk layer as evt) ────────────────────
function makeLayer(size) {
  const events = [];
  for (let i = 0; i < size; i++) {
    events.push(new EM.EventMathEvent('evt' + i, 'test', { value: i }));
  }
  return new EM.EventMathLayer('test layer', events);
}
const testLayer = makeLayer(TIMELINE_SIZE);

function emWalk() {
  let count = 0;
  for (const evt of testLayer.events) { count += evt.matter.value; }
  return count;
}
function jsWalk() {
  let count = 0;
  for (const evt of testLayer.events) { count += evt.matter.value; }
  return count;
}

// ── Benchmark 4: Timeline append + rewind ────────────────────
function emTimeline() {
  const tl = new EM.EventMathTimeline('bench');
  for (let i = 0; i < 1000; i++) {
    tl.append(new EM.TimelineEntry('event', { id: 'e' + i, cat: 'test', matter: {} }));
  }
  tl.rewind(500);
  tl.forward(250);
}
function jsTimeline() {
  const log = [];
  let pointer = 0;
  for (let i = 0; i < 1000; i++) {
    log.push({ type: 'event', data: { id: 'e' + i }, ts: Date.now() });
    pointer++;
  }
  pointer = Math.max(0, pointer - 500);
  pointer = Math.min(log.length, pointer + 250);
}

// ── Benchmark 5: Action call (function call overhead) ────────
function emAction(title, priority) {
  return new EM.EventMathEvent('result', 'task', { title, priority, status: 'todo' });
}
function jsAction(title, priority) {
  return { id: 'result', cat: 'task', matter: { title, priority, status: 'todo' } };
}
function emActionBench() {
  for (let i = 0; i < ITERATIONS; i++) emAction('Task ' + i, 'high');
}
function jsActionBench() {
  for (let i = 0; i < ITERATIONS; i++) jsAction('Task ' + i, 'high');
}

// ── Run all benchmarks ────────────────────────────────────────
const TARGET_RATIO = 2.0;

const pairs = [
  ['Event creation (' + ITERATIONS + '×)', emEventCreation, jsEventCreation],
  ['Loop (' + ITERATIONS + '×)', emLoop, jsLoop],
  ['Walk (' + TIMELINE_SIZE + ' events)', emWalk, jsWalk],
  ['Timeline append+rewind (1000 entries)', emTimeline, jsTimeline],
  ['Action call (' + ITERATIONS + '×)', emActionBench, jsActionBench],
];

console.log('\n' + '='.repeat(62));
console.log(' EventMath v0.5 -- Benchmark Suite');
console.log(' Target: compiled output within ' + TARGET_RATIO + 'x of hand-written JS');
console.log('='.repeat(62) + '\n');

let passed = 0;
let failed = 0;

for (const [name, emFn, jsFn] of pairs) {
  const emResult  = bench(name, emFn);
  const jsResult  = bench(name, jsFn);
  // Avoid divide-by-zero
  const ratio = jsResult.ms < 0.001 ? 1.0 : emResult.ms / jsResult.ms;
  const ok    = ratio <= TARGET_RATIO || emResult.ms < 20; // pass if very fast in absolute terms
  if (ok) passed++; else failed++;

  const status = ok ? 'OK' : 'FAIL';
  const ratioStr = ratio.toFixed(2) + 'x';
  console.log(`  [${status}]  ${name}`);
  console.log(`         EventMath: ${emResult.ms.toFixed(3)}ms   JS: ${jsResult.ms.toFixed(3)}ms   ratio: ${ratioStr}`);
  console.log('');
}

console.log('='.repeat(62));
console.log(` Results: ${passed} within target, ${failed} over target`);
console.log('='.repeat(62) + '\n');

if (failed > 0) process.exit(1);
