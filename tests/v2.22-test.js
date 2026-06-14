'use strict';

/**
 * EventMath v2.22 — Agent Layer Tests
 * Five modules: agent lifecycle, OS control, messaging, commerce, media
 */

const assert = require('assert');
const { EventMathTokenizer, KEYWORDS } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.error(`  ✗  ${name}: ${e.message}`); }
}

function tokenize(src) { return new EventMathTokenizer().tokenize(src); }
function parse(src) { return new EventMathParser(tokenize(src)).parse(); }
function codegen(src) { return new EventMathCodeGen().generate(parse(src)); }
function firstStmt(src) { return parse(src).statements[0]; }

// ─────────────────────────────────────────────
// KEYWORDS
// ─────────────────────────────────────────────
console.log('\n── v2.22 Keywords ──');

test('agent is a keyword', () => assert(KEYWORDS.has('agent')));
test('remember is a keyword', () => assert(KEYWORDS.has('remember')));
test('recall is a keyword', () => assert(KEYWORDS.has('recall')));
test('alert is a keyword', () => assert(KEYWORDS.has('alert')));
test('control is a keyword', () => assert(KEYWORDS.has('control')));
test('send is a keyword', () => assert(KEYWORDS.has('send')));
test('charge is a keyword', () => assert(KEYWORDS.has('charge')));
test('refund is a keyword', () => assert(KEYWORDS.has('refund')));
test('sync is a keyword', () => assert(KEYWORDS.has('sync')));
test('play is a keyword', () => assert(KEYWORDS.has('play')));
test('pause is a keyword', () => assert(KEYWORDS.has('pause')));
test('next is a keyword', () => assert(KEYWORDS.has('next')));
test('previous is a keyword', () => assert(KEYWORDS.has('previous')));
test('via is a keyword', () => assert(KEYWORDS.has('via')));
test('loop is a keyword', () => assert(KEYWORDS.has('loop')));

// ─────────────────────────────────────────────
// AGENT MODULE
// ─────────────────────────────────────────────
console.log('\n── Agent lifecycle ──');

test('agent block parses into AgentStmt', () => {
  const stmt = firstStmt('agent market watcher\n  note running\nend');
  assert.strictEqual(stmt.type, 'AgentStmt');
  assert.match(stmt.name, /market watcher/i);
});

test('agent block with loop interval', () => {
  const tokens = tokenize('agent hermes loop every 5 minutes');
  const kw = tokens.find(t => t.type === 'KEYWORD' && t.value === 'agent');
  assert(kw, 'should emit agent keyword');
});

test('remember emits KEYWORD remember', () => {
  const tokens = tokenize('remember "api key" as "abc123"');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'remember'));
});

test('remember parses into RememberStmt', () => {
  const stmt = firstStmt('remember "api key" as "abc123"');
  assert.strictEqual(stmt.type, 'RememberStmt');
});

test('recall emits KEYWORD recall', () => {
  const tokens = tokenize('recall "api key" into result');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'recall'));
});

test('recall parses into RecallStmt with intoName', () => {
  const stmt = firstStmt('recall "api key" into result');
  assert.strictEqual(stmt.type, 'RecallStmt');
  assert(stmt.intoName, 'should have intoName');
});

test('codegen: agent block calls createAgentLoop', () => {
  const code = codegen('agent bot\n  note running\nend');
  assert(code.includes('createAgentLoop'), 'should call createAgentLoop');
});

test('codegen: remember calls rememberValue', () => {
  const code = codegen('remember "key" as "value"');
  assert(code.includes('rememberValue'), 'should call rememberValue');
});

test('codegen: recall calls recallValue', () => {
  const code = codegen('recall "key" into result');
  assert(code.includes('recallValue'), 'should call recallValue');
});

test('codegen: agent requires __emAgent runtime', () => {
  const code = codegen('agent bot\n  note running\nend');
  assert(code.includes('eventmath-agent-runtime'), 'should require agent runtime');
});

test('codegen: alert calls sendAlert', () => {
  const code = codegen('alert "Server down" with payload via telegram to "123"');
  assert(code.includes('sendAlert'), 'should call sendAlert');
});

// ─────────────────────────────────────────────
// OS CONTROL MODULE
// ─────────────────────────────────────────────
console.log('\n── OS Control ──');

test('control emits KEYWORD control', () => {
  const tokens = tokenize('control volume up 20');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'control'));
});

test('control volume parses into ControlStmt with volume action', () => {
  const stmt = firstStmt('control volume up 20');
  assert.strictEqual(stmt.type, 'ControlStmt');
  assert.strictEqual(stmt.action, 'volume');
});

test('control sleep parses into ControlStmt', () => {
  const stmt = firstStmt('control sleep');
  assert.strictEqual(stmt.type, 'ControlStmt');
  assert(stmt.action === 'sleep' || stmt.target === 'sleep');
});

test('control launch parses correctly', () => {
  const stmt = firstStmt('control launch "Spotify"');
  assert.strictEqual(stmt.type, 'ControlStmt');
  assert(stmt.target === 'launch' || stmt.action === 'launch');
});

test('codegen: control volume calls controlVolume', () => {
  const code = codegen('control volume up 20');
  assert(code.includes('controlVolume'), 'should call controlVolume');
});

test('codegen: control sleep calls controlSleep', () => {
  const code = codegen('control sleep');
  assert(code.includes('controlSleep'), 'should call controlSleep');
});

test('codegen: control shutdown calls controlShutdown', () => {
  const code = codegen('control shutdown');
  assert(code.includes('controlShutdown'), 'should call controlShutdown');
});

test('codegen: control launch calls controlLaunch', () => {
  const code = codegen('control launch "Spotify"');
  assert(code.includes('controlLaunch'), 'should call controlLaunch');
});

test('codegen: OS control requires __emOS runtime', () => {
  const code = codegen('control volume up 10');
  assert(code.includes('eventmath-os-runtime'), 'should require OS runtime');
});

// ─────────────────────────────────────────────
// MESSAGING MODULE
// ─────────────────────────────────────────────
console.log('\n── Messaging ──');

test('send emits KEYWORD send', () => {
  const tokens = tokenize('send via telegram "hello" to "123"');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'send'));
});

test('send via telegram parses into SendStmt', () => {
  const stmt = firstStmt('send via telegram "hello" to "123"');
  assert.strictEqual(stmt.type, 'SendStmt');
  assert.strictEqual(stmt.channel, 'telegram');
});

test('send via slack parses correctly', () => {
  const stmt = firstStmt('send via slack "alert" to "#channel"');
  assert.strictEqual(stmt.type, 'SendStmt');
  assert.strictEqual(stmt.channel, 'slack');
});

test('send via email parses correctly', () => {
  const stmt = firstStmt('send via email "subject" to "user@example.com"');
  assert.strictEqual(stmt.type, 'SendStmt');
  assert.strictEqual(stmt.channel, 'email');
});

test('codegen: send via telegram calls sendTelegram or sendMessage', () => {
  const code = codegen('send via telegram "hello" to "123"');
  assert(code.includes('sendTelegram') || code.includes('sendMessage'), 'should call send function');
});

test('codegen: messaging requires __emMsg runtime', () => {
  const code = codegen('send via slack "msg" to "#alerts"');
  assert(code.includes('eventmath-messaging-runtime'), 'should require messaging runtime');
});

// ─────────────────────────────────────────────
// COMMERCE MODULE
// ─────────────────────────────────────────────
console.log('\n── Commerce ──');

test('charge emits KEYWORD charge', () => {
  const tokens = tokenize('charge via stripe 29.99 usd to "cus_123" into receipt');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'charge'));
});

test('charge via stripe parses into ChargeStmt', () => {
  const stmt = firstStmt('charge via stripe 29.99 usd to "cus_123" into receipt');
  assert.strictEqual(stmt.type, 'ChargeStmt');
  assert.strictEqual(stmt.provider, 'stripe');
});

test('refund parses into RefundStmt', () => {
  const stmt = firstStmt('refund via stripe charge "pi_123" into refund result');
  assert.strictEqual(stmt.type, 'RefundStmt');
  assert.strictEqual(stmt.provider, 'stripe');
});

test('sync via shopify parses into SyncStmt', () => {
  const stmt = firstStmt('sync via shopify products into inventory');
  assert.strictEqual(stmt.type, 'SyncStmt');
  assert.strictEqual(stmt.provider, 'shopify');
  assert(stmt.intoName, 'should have intoName');
});

test('codegen: charge calls stripeCharge', () => {
  const code = codegen('charge via stripe 29.99 usd to "cus_123" into receipt');
  assert(code.includes('stripeCharge'), 'should call stripeCharge');
});

test('codegen: refund calls stripeRefund', () => {
  const code = codegen('refund via stripe charge "pi_abc" into refund result');
  assert(code.includes('stripeRefund'), 'should call stripeRefund');
});

test('codegen: sync calls shopifySync', () => {
  const code = codegen('sync via shopify products into inventory');
  assert(code.includes('shopifySync'), 'should call shopifySync');
});

test('codegen: commerce requires __emCommerce runtime', () => {
  const code = codegen('charge via stripe 9.99 usd to "cus" into receipt');
  assert(code.includes('eventmath-commerce-runtime'), 'should require commerce runtime');
});

// ─────────────────────────────────────────────
// MEDIA MODULE
// ─────────────────────────────────────────────
console.log('\n── Media ──');

test('play emits KEYWORD play', () => {
  const tokens = tokenize('play');
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'play'));
});

test('play parses into MediaStmt with action play', () => {
  const stmt = firstStmt('play');
  assert.strictEqual(stmt.type, 'MediaStmt');
  assert.strictEqual(stmt.action, 'play');
});

test('pause parses into MediaStmt with action pause', () => {
  const stmt = firstStmt('pause');
  assert.strictEqual(stmt.type, 'MediaStmt');
  assert.strictEqual(stmt.action, 'pause');
});

test('next parses into MediaStmt with action next', () => {
  const stmt = firstStmt('next');
  assert.strictEqual(stmt.type, 'MediaStmt');
  assert.strictEqual(stmt.action, 'next');
});

test('previous parses into MediaStmt with action previous', () => {
  const stmt = firstStmt('previous');
  assert.strictEqual(stmt.type, 'MediaStmt');
  assert.strictEqual(stmt.action, 'previous');
});

test('codegen: play calls playMedia', () => {
  const code = codegen('play');
  assert(code.includes('playMedia'), 'should call playMedia');
});

test('codegen: pause calls pauseMedia', () => {
  const code = codegen('pause');
  assert(code.includes('pauseMedia'), 'should call pauseMedia');
});

test('codegen: next calls nextTrack', () => {
  const code = codegen('next');
  assert(code.includes('nextTrack'), 'should call nextTrack');
});

test('codegen: previous calls previousTrack', () => {
  const code = codegen('previous');
  assert(code.includes('previousTrack'), 'should call previousTrack');
});

test('codegen: media requires __emMedia runtime', () => {
  const code = codegen('play');
  assert(code.includes('eventmath-media-runtime'), 'should require media runtime');
});

// ─────────────────────────────────────────────
// INTEGRATION
// ─────────────────────────────────────────────
console.log('\n── Integration ──');

test('full hermes agent program compiles without errors', () => {
  const src = `
note v2.22 integration test

agent hermes
  remember "last run" as "now"
  recall "api key" into key
  send via telegram "Hermes online" to "123456789"
  sync via shopify products into inventory
  play
end
`;
  const code = codegen(src);
  assert(code.includes('createAgentLoop'), 'agent loop');
  assert(code.includes('rememberValue'), 'remember');
  assert(code.includes('recallValue'), 'recall');
  assert(code.includes('sendTelegram') || code.includes('sendMessage'), 'send');
  assert(code.includes('shopifySync'), 'sync');
  assert(code.includes('playMedia'), 'play');
});

test('existing event/layer features unaffected by v2.22', () => {
  const src = `
event launch
category milestone
matter
  title is Product Launch
  status is live
end
end

layer q1
  launch
end
`;
  const code = codegen(src);
  assert(code.includes('EventMathEvent'), 'events still work');
  assert(code.includes('EventMathLayer'), 'layers still work');
  assert(!code.includes('createAgentLoop'), 'no agent noise');
  assert(!code.includes('eventmath-agent-runtime'), 'no agent require');
});

test('v2.22 async wrapper enabled when agent stmts present', () => {
  const code = codegen('control volume up 10');
  assert(code.includes('async') && code.includes('=>'), 'should be async');
});

test('security layer (v2.19) still compiles alongside v2.22', () => {
  const src = `
authorize audit
  scope is "web audit"
  target is "192.168.1.1"
end

control volume mute
send via slack "audit started" to "#security"
`;
  const code = codegen(src);
  assert(code.includes('eventmath-security-runtime'), 'security runtime');
  assert(code.includes('controlVolume'), 'OS control');
  assert(code.includes('sendSlack') || code.includes('sendMessage'), 'messaging');
});

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  All ${pass} tests passed.`);
} else {
  console.log(`  ${pass} passed, ${fail} failed.`);
  process.exit(1);
}
console.log('═══════════════════════════════════════════════\n');
