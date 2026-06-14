/**
 * EventMath v2.27 — Network + Offline test suite
 *
 * Covers: network scan, network connect, offline cache, offline read, offline check
 *
 * Run: node tests/v2.27-test.js
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0;
let failed = 0;
let asyncDone = false;

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

// ── Tokenizer: network scan ──────────────────────────────────────────────────

console.log('\n── Tokenizer: network scan ──');
{
  const toks = tokenize('network scan into available networks');
  assert('NETWORK_STMT emitted', toks[0].type === 'NETWORK_STMT');
  assert('op is scan', toks[0].value.op === 'scan');
  assert('intoName extracted', toks[0].value.intoName === 'available networks');
}

{
  const toks = tokenize('network scan into connections');
  assert('scan default intoName', toks[0].value.intoName === 'connections');
}

console.log('\n── Tokenizer: network connect ──');
{
  const toks = tokenize('network connect to "CoffeeShop_WiFi" into connection result');
  assert('connect: op is connect', toks[0].value.op === 'connect');
  assert('connect: ssid extracted', toks[0].value.ssid === 'CoffeeShop_WiFi');
  assert('connect: no password', toks[0].value.password === null);
  assert('connect: intoName', toks[0].value.intoName === 'connection result');
}

{
  const toks = tokenize('network connect to "HomeNetwork" with password "secret123" into status');
  assert('connect with password: ssid', toks[0].value.ssid === 'HomeNetwork');
  assert('connect with password: password', toks[0].value.password === 'secret123');
  assert('connect with password: intoName', toks[0].value.intoName === 'status');
}

{
  const toks = tokenize('network connect to "Open_Cafe" into wifi');
  assert('open wifi connect', toks[0].value.ssid === 'Open_Cafe');
  assert('open wifi no password', toks[0].value.password === null);
}

console.log('\n── Tokenizer: offline cache ──');
{
  const toks = tokenize('offline cache "market-data" for 6 hours');
  assert('OFFLINE_STMT emitted', toks[0].type === 'OFFLINE_STMT');
  assert('op is cache', toks[0].value.op === 'cache');
  assert('key extracted', toks[0].value.key === 'market-data');
  assert('ttlHours extracted', toks[0].value.ttlHours === 6);
}

{
  const toks = tokenize('offline cache "prices" for 24 hours');
  assert('ttlHours 24', toks[0].value.ttlHours === 24);
}

{
  const toks = tokenize('offline cache "session" for 1 hours');
  assert('ttlHours 1', toks[0].value.ttlHours === 1);
}

console.log('\n── Tokenizer: offline read ──');
{
  const toks = tokenize('offline read "market-data" into cached prices');
  assert('read: op', toks[0].value.op === 'read');
  assert('read: key', toks[0].value.key === 'market-data');
  assert('read: intoName', toks[0].value.intoName === 'cached prices');
}

console.log('\n── Tokenizer: offline check ──');
{
  const toks = tokenize('offline check into connection status');
  assert('check: op', toks[0].value.op === 'check');
  assert('check: intoName', toks[0].value.intoName === 'connection status');
}

// ── Parser: NetworkStmt ──────────────────────────────────────────────────────

console.log('\n── Parser: NetworkStmt ──');
{
  const ast = parse('network scan into available networks');
  const stmt = ast.statements[0];
  assert('type is NetworkStmt', stmt.type === 'NetworkStmt');
  assert('op is scan', stmt.op === 'scan');
  assert('intoName', stmt.intoName === 'available networks');
}

{
  const ast = parse('network connect to "CoffeeShop_WiFi" into wifi status');
  const stmt = ast.statements[0];
  assert('connect: type NetworkStmt', stmt.type === 'NetworkStmt');
  assert('connect: op', stmt.op === 'connect');
  assert('connect: ssid', stmt.ssid === 'CoffeeShop_WiFi');
  assert('connect: intoName', stmt.intoName === 'wifi status');
}

// ── Parser: OfflineStmt ──────────────────────────────────────────────────────

console.log('\n── Parser: OfflineStmt ──');
{
  const ast = parse('offline cache "my-data" for 12 hours');
  const stmt = ast.statements[0];
  assert('type is OfflineStmt', stmt.type === 'OfflineStmt');
  assert('op is cache', stmt.op === 'cache');
  assert('key', stmt.key === 'my-data');
  assert('ttlHours', stmt.ttlHours === 12);
}

{
  const ast = parse('offline read "my-data" into cached');
  const stmt = ast.statements[0];
  assert('read: type OfflineStmt', stmt.type === 'OfflineStmt');
  assert('read: op', stmt.op === 'read');
  assert('read: key', stmt.key === 'my-data');
  assert('read: intoName', stmt.intoName === 'cached');
}

{
  const ast = parse('offline check into status');
  const stmt = ast.statements[0];
  assert('check: op', stmt.op === 'check');
  assert('check: intoName', stmt.intoName === 'status');
}

// ── Codegen: NetworkStmt ─────────────────────────────────────────────────────

console.log('\n── Codegen: network scan ──');
{
  const js = compile('network scan into available networks');
  assert('requires network runtime', js.includes('eventmath-network-runtime'));
  assert('async wrapper', js.includes('async () =>'));
  assert('discoverNetworks call', js.includes('discoverNetworks'));
  assert('variable hoisted', js.includes('let available_networks') || js.includes('availablenetworks') || js.includes('available_networks'));
}

console.log('\n── Codegen: network connect ──');
{
  const js = compile('network connect to "HomeNet" with password "pw123" into conn');
  assert('connectToNetwork call', js.includes('connectToNetwork'));
  assert('ssid in call', js.includes('"HomeNet"'));
  assert('password in call', js.includes('"pw123"'));
}

{
  const js = compile('network connect to "OpenWifi" into result');
  assert('open connect call', js.includes('connectToNetwork'));
  assert('ssid present', js.includes('"OpenWifi"'));
}

// ── Codegen: OfflineStmt ─────────────────────────────────────────────────────

console.log('\n── Codegen: offline cache ──');
{
  const js = compile('offline cache "data" for 6 hours');
  assert('network runtime present', js.includes('eventmath-network-runtime'));
  assert('cacheData call', js.includes('cacheData'));
  assert('key in call', js.includes('"data"'));
  assert('ttl in call', js.includes('6'));
}

console.log('\n── Codegen: offline read ──');
{
  const js = compile('offline read "data" into cached');
  assert('readCache call', js.includes('readCache'));
  assert('key in call', js.includes('"data"'));
  assert('variable hoisted', js.includes('let cached'));
}

console.log('\n── Codegen: offline check ──');
{
  const js = compile('offline check into connectivity');
  assert('checkConnectivity call', js.includes('checkConnectivity'));
  assert('async for check', js.includes('await'));
  assert('variable hoisted', js.includes('let connectivity'));
}

console.log('\n── Codegen: offline does not need fundamental runtime ──');
{
  const js = compile('offline check into status');
  assert('no fundamental runtime', !js.includes('eventmath-fundamental-runtime'));
  assert('no task runtime', !js.includes('eventmath-task-runtime'));
  assert('has network runtime', js.includes('eventmath-network-runtime'));
}

// ── Runtime: network runtime exports ─────────────────────────────────────────

console.log('\n── Runtime: network runtime exports ──');
{
  const rt = require('../runtime/eventmath-network-runtime.js');
  assert('discoverNetworks exported', typeof rt.discoverNetworks === 'function');
  assert('connectToNetwork exported', typeof rt.connectToNetwork === 'function');
  assert('connectToBestAvailable exported', typeof rt.connectToBestAvailable === 'function');
  assert('cacheData exported', typeof rt.cacheData === 'function');
  assert('readCache exported', typeof rt.readCache === 'function');
  assert('checkConnectivity exported', typeof rt.checkConnectivity === 'function');
}

console.log('\n── Runtime: cacheData + readCache ──');
{
  const rt = require('../runtime/eventmath-network-runtime.js');
  const data = { price: 150.25, volume: 3000000 };
  rt.cacheData('test-market-data', data, 2);
  const cached = rt.readCache('test-market-data');
  assert('cacheData + readCache roundtrip', cached !== null);
  assert('cached data correct', cached && cached.price === 150.25);

  // Expired data
  rt.cacheData('expired-key', { x: 1 }, -1);
  const expired = rt.readCache('expired-key');
  assert('expired cache returns null', expired === null);

  // Missing key
  const missing = rt.readCache('nonexistent-key-xyz-12345');
  assert('missing key returns null', missing === null);
}

console.log('\n── Runtime: discoverNetworks ──');
{
  const rt = require('../runtime/eventmath-network-runtime.js');
  rt.discoverNetworks().then(nets => {
    assert('discoverNetworks returns array', Array.isArray(nets));
    // Returns empty array if wifi tool unavailable — that's fine in CI
    if (nets.length > 0) {
      assert('network has ssid', typeof nets[0].ssid === 'string');
      assert('network has signal', typeof nets[0].signal === 'number');
    } else {
      assert('empty array valid in CI', true);
    }

    return rt.checkConnectivity('8.8.8.8');
  }).then(conn => {
    assert('checkConnectivity returns object', typeof conn === 'object');
    assert('has online field', typeof conn.online === 'boolean');
    assert('latencyMs is number or null', conn.latencyMs === null || typeof conn.latencyMs === 'number');

    asyncDone = true;
    const summary = `\n${'─'.repeat(50)}\nv2.27 tests: ${passed} passed, ${failed} failed\n`;
    console.log(summary);
    if (failed > 0) process.exit(1);
  }).catch(err => {
    console.error('Runtime error:', err.message);
    process.exit(1);
  });
}
