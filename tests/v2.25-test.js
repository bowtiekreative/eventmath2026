/**
 * EventMath v2.25 — Agent Commands test suite
 *
 * Covers: instruct (agent command dispatch)
 *
 * Run: node tests/v2.25-test.js
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

// ── Tokenizer: instruct ──────────────────────────────────────────────────────

console.log('\n── Tokenizer: instruct basic ──');
{
  const toks = tokenize('instruct hermes "scan my system" into scan result');
  assert('INSTRUCT_STMT emitted', toks[0].type === 'INSTRUCT_STMT');
  assert('agentName extracted', toks[0].value.agentName === 'hermes');
  assert('command extracted', toks[0].value.command === 'scan my system');
  assert('intoName extracted', toks[0].value.intoName === 'scan result');
}

console.log('\n── Tokenizer: instruct various agents ──');
{
  const toks = tokenize('instruct Athena "analyze this data" into analysis');
  assert('agent Athena name', toks[0].value.agentName === 'Athena');
  assert('agent Athena command', toks[0].value.command === 'analyze this data');
  assert('agent Athena intoName', toks[0].value.intoName === 'analysis');
}

{
  const toks = tokenize('instruct my agent "send alert to team" into alert result');
  assert('multi-word agent name', toks[0].value.agentName === 'my agent');
  assert('multi-word agent command', toks[0].value.command === 'send alert to team');
}

console.log('\n── Tokenizer: instruct trade commands ──');
{
  const toks = tokenize('instruct hermes "buy 100 shares of AAPL" into trade result');
  assert('buy command', toks[0].value.command === 'buy 100 shares of AAPL');
  assert('trade result', toks[0].value.intoName === 'trade result');
}

{
  const toks = tokenize('instruct hermes "sell 50 shares of TSLA" into sell result');
  assert('sell command', toks[0].value.command === 'sell 50 shares of TSLA');
}

{
  const toks = tokenize('instruct hermes "monitor CPU usage" into monitor result');
  assert('monitor command', toks[0].value.command === 'monitor CPU usage');
}

console.log('\n── Tokenizer: instruct without into ──');
{
  const toks = tokenize('instruct hermes "run diagnostics"');
  assert('no into: INSTRUCT_STMT', toks[0].type === 'INSTRUCT_STMT');
  assert('no into: intoName is null', toks[0].value.intoName === null);
  assert('no into: command', toks[0].value.command === 'run diagnostics');
}

// ── Parser: InstructStmt ─────────────────────────────────────────────────────

console.log('\n── Parser: InstructStmt ──');
{
  const ast = parse('instruct hermes "scan my system" into scan result');
  const stmt = ast.statements[0];
  assert('type is InstructStmt', stmt.type === 'InstructStmt');
  assert('agentName', stmt.agentName === 'hermes');
  assert('command', stmt.command === 'scan my system');
  assert('intoName', stmt.intoName === 'scan result');
}

{
  const ast = parse('instruct Athena "analyze trends" into trend analysis');
  const stmt = ast.statements[0];
  assert('parser: agentName Athena', stmt.agentName === 'Athena');
  assert('parser: command analyze', stmt.command === 'analyze trends');
  assert('parser: intoName trend analysis', stmt.intoName === 'trend analysis');
}

{
  const ast = parse('instruct hermes "buy 10 MSFT" into buy order\nshow buy order');
  assert('statement count is 2', ast.statements.length === 2);
  assert('second stmt is Show', ast.statements[1].type === 'Show');
}

// ── Codegen: InstructStmt ────────────────────────────────────────────────────

console.log('\n── Codegen: instruct requires task runtime ──');
{
  const js = compile('instruct hermes "scan my system" into scan result');
  assert('requires task runtime', js.includes('eventmath-task-runtime'));
  assert('async wrapper present', js.includes('async () =>'));
  assert('instructAgent call present', js.includes('instructAgent'));
  assert('agent name in call', js.includes('"hermes"'));
  assert('command in call', js.includes('"scan my system"'));
}

console.log('\n── Codegen: instruct variable hoisted ──');
{
  const js = compile('instruct hermes "analyze data" into analysis\nshow analysis');
  assert('variable hoisted', js.includes('let analysis'));
  assert('assignment present', js.includes('analysis ='));
  assert('show analysis', js.includes('analysis'));
}

console.log('\n── Codegen: instruct without into ──');
{
  const js = compile('instruct hermes "run diagnostics"');
  assert('still calls instructAgent', js.includes('instructAgent'));
  assert('no assignment arrow', !js.includes('undefined ='));
}

console.log('\n── Codegen: multiple instruct calls ──');
{
  const js = compile([
    'instruct hermes "scan system" into scan',
    'instruct hermes "analyze threats" into analysis',
    'show scan',
    'show analysis'
  ].join('\n'));
  assert('two instructAgent calls', (js.match(/instructAgent/g) || []).length >= 2);
  assert('scan hoisted', js.includes('let scan'));
  assert('analysis hoisted', js.includes('let analysis'));
}

console.log('\n── Codegen: instruct trade command ──');
{
  const js = compile('instruct hermes "buy 100 AAPL" into buy result');
  assert('buy command compiled', js.includes('"buy 100 AAPL"'));
  assert('buy result hoisted', js.includes('let buy_result') || js.includes('let buyresult') || js.includes('let buy result') || js.includes('buy_result'));
}

// ── Integration: instruct with show ──────────────────────────────────────────

console.log('\n── Integration: instruct + show ──');
{
  const js = compile([
    'instruct hermes "monitor network traffic" into monitor result',
    'show monitor result'
  ].join('\n'));
  assert('monitor command', js.includes('"monitor network traffic"'));
  assert('show monitor result', js.includes('monitor_result') || js.includes('monitorresult'));
}

// ── Runtime: task runtime exports ─────────────────────────────────────────────

console.log('\n── Runtime: task runtime ──');
{
  const rt = require('../runtime/eventmath-task-runtime.js');
  assert('instructAgent exported', typeof rt.instructAgent === 'function');
  assert('queueTask exported', typeof rt.queueTask === 'function');
  assert('taskStatus exported', typeof rt.taskStatus === 'function');
  assert('clearTasks exported', typeof rt.clearTasks === 'function');
}

{
  const rt = require('../runtime/eventmath-task-runtime.js');
  rt.instructAgent('hermes', 'scan the system', {}).then(result => {
    assert('instructAgent returns object', typeof result === 'object');
    assert('result has parsed action', result.parsed && typeof result.parsed.action === 'string');
    assert('result has agentName', result.agentName === 'hermes');
    assert('result has taskId', typeof result.taskId === 'string');
    assert('result has status', typeof result.status === 'string');

    const summary = `\n${'─'.repeat(50)}\nv2.25 tests: ${passed} passed, ${failed} failed\n`;
    console.log(summary);
    if (failed > 0) process.exit(1);
  }).catch(err => {
    console.error('Runtime error:', err.message);
    process.exit(1);
  });
}
