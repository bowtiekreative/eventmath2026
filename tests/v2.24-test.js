/**
 * EventMath v2.24 — Defense Layer test suite
 *
 * Covers: watchdog, sweep, quarantine, inoculate
 *
 * Run: node tests/v2.24-test.js
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function tokenize(src) {
  return new EventMathTokenizer().tokenize(src);
}

function parse(src) {
  const tokens = tokenize(src);
  return new EventMathParser(tokens).parse();
}

function compile(src) {
  const ast = parse(src);
  return new EventMathCodeGen().generate(ast);
}

// ── Tokenizer ─────────────────────────────────────────────────────

console.log('\n── Tokenizer: watchdog ──');
{
  const toks = tokenize('watchdog "my-server" every 5 minutes into server guard');
  assert('WATCHDOG_STMT emitted', toks[0].type === 'WATCHDOG_STMT');
  assert('target extracted', toks[0].value.target === 'my-server');
  assert('intervalVal extracted', toks[0].value.intervalVal === 5);
  assert('intervalUnit extracted', toks[0].value.intervalUnit === 'minute');
  assert('intoName extracted', toks[0].value.intoName === 'server guard');
}

{
  const toks = tokenize('watchdog "http://localhost:3000/health" every 30 seconds into health');
  assert('watchdog seconds: target extracted', toks[0].value.target === 'http://localhost:3000/health');
  assert('watchdog seconds: intervalVal', toks[0].value.intervalVal === 30);
  assert('watchdog seconds: intervalUnit is second', toks[0].value.intervalUnit === 'second');
}

console.log('\n── Tokenizer: sweep ──');
{
  const toks = tokenize('sweep system into threat report');
  assert('SWEEP_STMT emitted', toks[0].type === 'SWEEP_STMT');
  assert('sub is system', toks[0].value.sub === 'system');
  assert('intoName is threat report', toks[0].value.intoName === 'threat report');
}

{
  const toks = tokenize('sweep processes into process threats');
  assert('sweep processes: sub', toks[0].value.sub === 'processes');
  assert('sweep processes: intoName', toks[0].value.intoName === 'process threats');
}

{
  const toks = tokenize('sweep files at "/tmp" into file threats');
  assert('sweep files: sub', toks[0].value.sub === 'files');
  assert('sweep files: path', toks[0].value.path === '/tmp');
  assert('sweep files: intoName', toks[0].value.intoName === 'file threats');
}

console.log('\n── Tokenizer: quarantine ──');
{
  const toks = tokenize('quarantine from threat report into quarantine log');
  assert('QUARANTINE_STMT emitted', toks[0].type === 'QUARANTINE_STMT');
  assert('source from threat report', toks[0].value.source === 'threat report');
  assert('intoName is quarantine log', toks[0].value.intoName === 'quarantine log');
}

{
  const toks = tokenize('quarantine "/tmp/bad.sh" into removed files');
  assert('quarantine direct: source', toks[0].value.source === '"/tmp/bad.sh"');
  assert('quarantine direct: intoName', toks[0].value.intoName === 'removed files');
}

console.log('\n── Tokenizer: inoculate ──');
{
  const toks = tokenize('inoculate from threat report');
  assert('INOCULATE_STMT emitted', toks[0].type === 'INOCULATE_STMT');
  assert('source is threat report', toks[0].value.source === 'threat report');
  assert('pid is null (no pid given)', toks[0].value.pid === null);
}

{
  const toks = tokenize('inoculate 1234 from threats');
  assert('inoculate with pid: source', toks[0].value.source === 'threats');
  assert('inoculate with pid: pid', toks[0].value.pid === '1234');
}

// ── Parser ────────────────────────────────────────────────────────

console.log('\n── Parser: watchdog ──');
{
  const ast = parse('watchdog "my-service" every 5 minutes into svc guard');
  const stmt = ast.statements[0];
  assert('WatchdogStmt type', stmt.type === 'WatchdogStmt');
  assert('WatchdogStmt target', stmt.target === 'my-service');
  assert('WatchdogStmt intervalVal', stmt.intervalVal === 5);
  assert('WatchdogStmt intervalUnit', stmt.intervalUnit === 'minute');
  assert('WatchdogStmt intoName', stmt.intoName === 'svc guard');
}

console.log('\n── Parser: sweep ──');
{
  const ast = parse('sweep system into threats');
  const stmt = ast.statements[0];
  assert('SweepStmt type', stmt.type === 'SweepStmt');
  assert('SweepStmt sub', stmt.sub === 'system');
  assert('SweepStmt intoName', stmt.intoName === 'threats');
}

{
  const ast = parse('sweep files at "/var/tmp" into file scan');
  const stmt = ast.statements[0];
  assert('sweep files: sub', stmt.sub === 'files');
  assert('sweep files: path', stmt.path === '/var/tmp');
}

console.log('\n── Parser: quarantine ──');
{
  const ast = parse('quarantine from threats into quarantine log');
  const stmt = ast.statements[0];
  assert('QuarantineStmt type', stmt.type === 'QuarantineStmt');
  assert('QuarantineStmt source', stmt.source === 'threats');
  assert('QuarantineStmt intoName', stmt.intoName === 'quarantine log');
}

console.log('\n── Parser: inoculate ──');
{
  const ast = parse('inoculate from threats');
  const stmt = ast.statements[0];
  assert('InoculateStmt type', stmt.type === 'InoculateStmt');
  assert('InoculateStmt source', stmt.source === 'threats');
  assert('InoculateStmt pid null', stmt.pid === null);
}

{
  const ast = parse('inoculate 9999 from threats');
  const stmt = ast.statements[0];
  assert('inoculate with pid: pid', stmt.pid === '9999');
  assert('inoculate with pid: source', stmt.source === 'threats');
}

// ── Codegen ───────────────────────────────────────────────────────

console.log('\n── Codegen: watchdog ──');
{
  const code = compile('watchdog "api" every 1 minutes into api status');
  assert('requires watchdog runtime', code.includes('eventmath-watchdog-runtime'));
  assert('calls watchProcess', code.includes('watchProcess'));
  assert('api_status variable hoisted', code.includes('api_status'));
  assert('60000ms interval for 1 minute', code.includes('60000'));
}

{
  const code = compile('watchdog "check" every 10 seconds into chk');
  assert('watchdog seconds: 10000ms interval', code.includes('10000'));
}

console.log('\n── Codegen: sweep ──');
{
  const code = compile('sweep system into threats');
  assert('requires defense runtime', code.includes('eventmath-defense-runtime'));
  assert('calls sweepSystem', code.includes('sweepSystem'));
  assert('threats variable hoisted', code.includes('threats'));
  assert('sweep is async — async wrapper present', code.includes('(async () => {'));
}

{
  const code = compile('sweep processes into proc list');
  assert('sweep processes: calls sweepProcesses', code.includes('sweepProcesses'));
}

{
  const code = compile('sweep files at "/tmp" into file results');
  assert('sweep files: calls sweepFiles', code.includes('sweepFiles'));
  assert('sweep files: passes path', code.includes('"/tmp"'));
}

console.log('\n── Codegen: quarantine ──');
{
  const code = compile('sweep system into found\nquarantine from found into safe');
  assert('calls quarantineFile', code.includes('quarantineFile'));
  assert('safe variable hoisted', code.includes('safe'));
  assert('async wrapper present', code.includes('(async () => {'));
}

console.log('\n── Codegen: inoculate ──');
{
  const code = compile('sweep system into found\ninoculate from found');
  assert('calls inoculateProcess', code.includes('inoculateProcess'));
  assert('async wrapper present', code.includes('(async () => {'));
}

// ── Integration ───────────────────────────────────────────────────

console.log('\n── Integration ──');
{
  // Full defense program
  const src = `
sweep system into system threats
sweep processes into process threats
sweep files at "/tmp" into temp threats
quarantine from system threats into quarantine log
inoculate from process threats
show quarantine log
`;
  const code = compile(src);
  assert('full defense program compiles', !!code);
  assert('all defense functions present',
    code.includes('sweepSystem') &&
    code.includes('sweepProcesses') &&
    code.includes('sweepFiles') &&
    code.includes('quarantineFile') &&
    code.includes('inoculateProcess'));
  assert('single async wrapper', (code.match(/\(async \(\) => \{/g) || []).length === 1);
  assert('no parse errors', !parse(src).errors);
}

{
  // Watchdog does not force async
  const code = compile('watchdog "service" every 2 minutes into wdog');
  assert('watchdog alone: no async wrapper needed', !code.includes('(async () => {'));
}

{
  // v2.23 + v2.24 together
  const src = `
role CEO
  focus profit growth
end
sweep system into threats
credibility statement into signals
`;
  const code = compile(src);
  assert('v2.23 + v2.24 together: incentive runtime', code.includes('eventmath-incentive-runtime'));
  assert('v2.23 + v2.24 together: defense runtime', code.includes('eventmath-defense-runtime'));
  assert('v2.23 + v2.24 together: credibility runtime', code.includes('eventmath-credibility-runtime'));
}

{
  // v2.22 + v2.24 together
  const src = `
remember "last sweep" as "2026-06-14"
sweep system into threats
quarantine from threats into log
`;
  const code = compile(src);
  assert('v2.22 + v2.24: agent runtime', code.includes('eventmath-agent-runtime'));
  assert('v2.22 + v2.24: defense runtime', code.includes('eventmath-defense-runtime'));
  assert('v2.22 + v2.24: compiles cleanly', !!code);
}

// ── Summary ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  All ${passed} tests passed.`);
} else {
  console.log(`  ${passed} passed, ${failed} failed.`);
}
console.log('═══════════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
