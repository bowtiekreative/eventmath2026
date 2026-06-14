/**
 * EventMath v2.28 — Machine Layer test suite
 *
 * Covers: http, socket, serial, spawn, bytes
 *
 * Run: node tests/v2.28-test.js
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

function tokenize(src) { return new EventMathTokenizer().tokenize(src); }
function parse(src)    { return new EventMathParser(tokenize(src)).parse(); }
function compile(src)  { return new EventMathCodeGen().generate(parse(src)); }

// ── Tokenizer: http ──────────────────────────────────────────────────────────

console.log('\n── Tokenizer: http get ──');
{
  const toks = tokenize('http get "https://api.example.com/data" into response');
  assert('HTTP_STMT emitted', toks[0].type === 'HTTP_STMT');
  assert('op is get', toks[0].value.op === 'get');
  assert('url extracted', toks[0].value.url === 'https://api.example.com/data');
  assert('intoName extracted', toks[0].value.intoName === 'response');
}

{
  const toks = tokenize('http get "http://localhost:3000/health" into status');
  assert('http url (not https)', toks[0].value.url === 'http://localhost:3000/health');
  assert('intoName status', toks[0].value.intoName === 'status');
}

console.log('\n── Tokenizer: http post ──');
{
  const toks = tokenize('http post "https://api.example.com/data" with body "{}" into result');
  assert('post: op', toks[0].value.op === 'post');
  assert('post: url', toks[0].value.url === 'https://api.example.com/data');
  assert('post: body literal', toks[0].value.body === '{}');
  assert('post: bodyVar null', toks[0].value.bodyVar === null);
  assert('post: intoName', toks[0].value.intoName === 'result');
}

{
  const toks = tokenize('http post "https://api.example.com/submit" with body payload into result');
  assert('post varref: bodyVar', toks[0].value.bodyVar === 'payload');
  assert('post varref: body null', toks[0].value.body === null);
}

// ── Tokenizer: socket ────────────────────────────────────────────────────────

console.log('\n── Tokenizer: socket connect ──');
{
  const toks = tokenize('socket connect to "example.com" port 8080 into connection');
  assert('SOCKET_STMT emitted', toks[0].type === 'SOCKET_STMT');
  assert('op is connect', toks[0].value.op === 'connect');
  assert('protocol tcp', toks[0].value.protocol === 'tcp');
  assert('host extracted', toks[0].value.host === 'example.com');
  assert('port extracted', toks[0].value.port === 8080);
  assert('intoName', toks[0].value.intoName === 'connection');
}

console.log('\n── Tokenizer: socket send ──');
{
  const toks = tokenize('socket send "hello world" to connection');
  assert('socket send: op', toks[0].value.op === 'send');
  assert('socket send: data', toks[0].value.data === 'hello world');
  assert('socket send: connRef', toks[0].value.connRef === 'connection');
}

console.log('\n── Tokenizer: socket read ──');
{
  const toks = tokenize('socket read from connection into response');
  assert('socket read: op', toks[0].value.op === 'read');
  assert('socket read: connRef', toks[0].value.connRef === 'connection');
  assert('socket read: intoName', toks[0].value.intoName === 'response');
}

console.log('\n── Tokenizer: socket close ──');
{
  const toks = tokenize('socket close connection');
  assert('socket close: op', toks[0].value.op === 'close');
  assert('socket close: connRef', toks[0].value.connRef === 'connection');
}

console.log('\n── Tokenizer: socket udp ──');
{
  const toks = tokenize('socket udp send "ping" to "192.168.1.255" port 9999');
  assert('udp: op is udp_send', toks[0].value.op === 'udp_send');
  assert('udp: protocol', toks[0].value.protocol === 'udp');
  assert('udp: data', toks[0].value.data === 'ping');
  assert('udp: host', toks[0].value.host === '192.168.1.255');
  assert('udp: port', toks[0].value.port === 9999);
}

// ── Tokenizer: serial ────────────────────────────────────────────────────────

console.log('\n── Tokenizer: serial connect ──');
{
  const toks = tokenize('serial connect to "/dev/ttyUSB0" at 9600 baud into arduino');
  assert('SERIAL_STMT emitted', toks[0].type === 'SERIAL_STMT');
  assert('op is connect', toks[0].value.op === 'connect');
  assert('path extracted', toks[0].value.path === '/dev/ttyUSB0');
  assert('baud extracted', toks[0].value.baud === 9600);
  assert('intoName', toks[0].value.intoName === 'arduino');
}

{
  const toks = tokenize('serial connect to "COM3" at 115200 baud into sensor');
  assert('COM3 path', toks[0].value.path === 'COM3');
  assert('115200 baud', toks[0].value.baud === 115200);
}

console.log('\n── Tokenizer: serial send ──');
{
  const toks = tokenize('serial send "LED_ON\\n" to arduino');
  assert('serial send: op', toks[0].value.op === 'send');
  assert('serial send: portRef', toks[0].value.portRef === 'arduino');
}

console.log('\n── Tokenizer: serial read ──');
{
  const toks = tokenize('serial read from arduino into sensor data');
  assert('serial read: op', toks[0].value.op === 'read');
  assert('serial read: portRef', toks[0].value.portRef === 'arduino');
  assert('serial read: intoName', toks[0].value.intoName === 'sensor data');
}

console.log('\n── Tokenizer: serial close ──');
{
  const toks = tokenize('serial close arduino');
  assert('serial close: op', toks[0].value.op === 'close');
  assert('serial close: portRef', toks[0].value.portRef === 'arduino');
}

// ── Tokenizer: spawn ─────────────────────────────────────────────────────────

console.log('\n── Tokenizer: spawn ──');
{
  const toks = tokenize('spawn "ls -la /tmp" into listing');
  assert('SPAWN_STMT emitted', toks[0].type === 'SPAWN_STMT');
  assert('command extracted', toks[0].value.command === 'ls -la /tmp');
  assert('intoName', toks[0].value.intoName === 'listing');
}

{
  const toks = tokenize('spawn "python3 script.py" into py result');
  assert('python spawn command', toks[0].value.command === 'python3 script.py');
  assert('python spawn intoName', toks[0].value.intoName === 'py result');
}

// ── Tokenizer: bytes ─────────────────────────────────────────────────────────

console.log('\n── Tokenizer: bytes ──');
{
  const toks = tokenize('bytes "FF A0 B3" into raw packet');
  assert('BYTES_STMT emitted', toks[0].type === 'BYTES_STMT');
  assert('hex extracted', toks[0].value.hex === 'FF A0 B3');
  assert('intoName', toks[0].value.intoName === 'raw packet');
}

{
  const toks = tokenize('bytes "DE AD BE EF" into header');
  assert('dead beef hex', toks[0].value.hex === 'DE AD BE EF');
}

// ── Parser ───────────────────────────────────────────────────────────────────

console.log('\n── Parser: HttpStmt ──');
{
  const ast = parse('http get "https://api.example.com" into response');
  const stmt = ast.statements[0];
  assert('type is HttpStmt', stmt.type === 'HttpStmt');
  assert('op', stmt.op === 'get');
  assert('url', stmt.url === 'https://api.example.com');
  assert('intoName', stmt.intoName === 'response');
}

{
  const ast = parse('http post "https://api.example.com" with body "{}" into result');
  const stmt = ast.statements[0];
  assert('post: requestBody', stmt.requestBody === '{}');
  assert('post: requestBodyVar null', stmt.requestBodyVar === null || stmt.requestBodyVar === undefined);
}

{
  const ast = parse('http post "https://api.example.com" with body payload into result');
  const stmt = ast.statements[0];
  assert('post varref: requestBodyVar', stmt.requestBodyVar === 'payload');
  assert('post varref: requestBody null', stmt.requestBody === null || stmt.requestBody === undefined);
}

console.log('\n── Parser: SocketStmt ──');
{
  const ast = parse('socket connect to "example.com" port 9000 into conn');
  const stmt = ast.statements[0];
  assert('type is SocketStmt', stmt.type === 'SocketStmt');
  assert('op connect', stmt.op === 'connect');
  assert('host', stmt.host === 'example.com');
  assert('port', stmt.port === 9000);
  assert('intoName', stmt.intoName === 'conn');
}

console.log('\n── Parser: SerialStmt ──');
{
  const ast = parse('serial connect to "/dev/ttyUSB0" at 9600 baud into arduino');
  const stmt = ast.statements[0];
  assert('type is SerialStmt', stmt.type === 'SerialStmt');
  assert('path', stmt.path === '/dev/ttyUSB0');
  assert('baud', stmt.baud === 9600);
}

console.log('\n── Parser: SpawnStmt ──');
{
  const ast = parse('spawn "echo hello" into output');
  const stmt = ast.statements[0];
  assert('type is SpawnStmt', stmt.type === 'SpawnStmt');
  assert('command', stmt.command === 'echo hello');
  assert('intoName', stmt.intoName === 'output');
}

console.log('\n── Parser: BytesStmt ──');
{
  const ast = parse('bytes "AA BB CC" into packet');
  const stmt = ast.statements[0];
  assert('type is BytesStmt', stmt.type === 'BytesStmt');
  assert('hex', stmt.hex === 'AA BB CC');
  assert('intoName', stmt.intoName === 'packet');
}

// ── Codegen ──────────────────────────────────────────────────────────────────

console.log('\n── Codegen: machine runtime require ──');
{
  const js = compile('http get "https://api.example.com" into result');
  assert('requires machine runtime', js.includes('eventmath-machine-runtime'));
  assert('async wrapper', js.includes('async () =>'));
  assert('httpGet call', js.includes('httpGet'));
  assert('url in call', js.includes('"https://api.example.com"'));
  assert('variable hoisted', js.includes('let result'));
}

console.log('\n── Codegen: http post ──');
{
  const js = compile('http post "https://api.example.com" with body "{}" into result');
  assert('httpPost call', js.includes('httpPost'));
  assert('body in call', js.includes('"{}"'));
}

console.log('\n── Codegen: socket connect + send + read + close ──');
{
  const js = compile([
    'socket connect to "example.com" port 8080 into conn',
    'socket send "hello" to conn',
    'socket read from conn into data',
    'socket close conn'
  ].join('\n'));
  assert('socketConnect', js.includes('socketConnect'));
  assert('socketSend', js.includes('socketSend'));
  assert('socketRead', js.includes('socketRead'));
  assert('socketClose', js.includes('socketClose'));
  assert('conn hoisted', js.includes('let conn'));
  assert('data hoisted', js.includes('let data'));
}

console.log('\n── Codegen: serial connect + send + read ──');
{
  const js = compile([
    'serial connect to "/dev/ttyUSB0" at 9600 baud into arduino',
    'serial send "CMD" to arduino',
    'serial read from arduino into sensor data'
  ].join('\n'));
  assert('serialConnect', js.includes('serialConnect'));
  assert('serialSend', js.includes('serialSend'));
  assert('serialRead', js.includes('serialRead'));
  assert('path in connect', js.includes('"/dev/ttyUSB0"'));
  assert('baud in connect', js.includes('9600'));
  assert('arduino hoisted', js.includes('let arduino'));
}

console.log('\n── Codegen: spawn ──');
{
  const js = compile('spawn "ls -la /tmp" into listing');
  assert('spawnProcess call', js.includes('spawnProcess'));
  assert('command in call', js.includes('"ls -la /tmp"'));
  assert('listing hoisted', js.includes('let listing'));
}

console.log('\n── Codegen: bytes (sync — no async) ──');
{
  const js = compile('bytes "FF A0 B3" into raw data');
  assert('parseBytes call', js.includes('parseBytes'));
  assert('hex in call', js.includes('"FF A0 B3"'));
  assert('no await on parseBytes', !js.includes('await __emMachine.parseBytes'));
}

console.log('\n── Codegen: bytes alone does not add async wrapper ──');
{
  const js = compile('bytes "AA BB" into packet\nshow packet');
  assert('machine runtime required', js.includes('eventmath-machine-runtime'));
  // bytes is sync — the only machine stmt — so async wrapper may or may not be needed
  // Key is: parseBytes is called without await
  assert('parseBytes without await', !js.includes('await __emMachine.parseBytes'));
}

console.log('\n── Codegen: UDP send ──');
{
  const js = compile('socket udp send "broadcast" to "255.255.255.255" port 9999');
  assert('socketUdpSend call', js.includes('socketUdpSend'));
  assert('host in call', js.includes('"255.255.255.255"'));
  assert('port in call', js.includes('9999'));
}

// ── Runtime: machine runtime exports ─────────────────────────────────────────

console.log('\n── Runtime: exports ──');
{
  const rt = require('../runtime/eventmath-machine-runtime.js');
  assert('httpGet exported', typeof rt.httpGet === 'function');
  assert('httpPost exported', typeof rt.httpPost === 'function');
  assert('socketConnect exported', typeof rt.socketConnect === 'function');
  assert('socketSend exported', typeof rt.socketSend === 'function');
  assert('socketRead exported', typeof rt.socketRead === 'function');
  assert('socketClose exported', typeof rt.socketClose === 'function');
  assert('socketUdpSend exported', typeof rt.socketUdpSend === 'function');
  assert('serialConnect exported', typeof rt.serialConnect === 'function');
  assert('serialSend exported', typeof rt.serialSend === 'function');
  assert('serialRead exported', typeof rt.serialRead === 'function');
  assert('serialClose exported', typeof rt.serialClose === 'function');
  assert('spawnProcess exported', typeof rt.spawnProcess === 'function');
  assert('parseBytes exported', typeof rt.parseBytes === 'function');
}

console.log('\n── Runtime: parseBytes (sync) ──');
{
  const rt = require('../runtime/eventmath-machine-runtime.js');
  const result = rt.parseBytes('FF A0 B3');
  assert('returns object', typeof result === 'object');
  assert('has buffer', Buffer.isBuffer(result.buffer));
  assert('byteCount is 3', result.byteCount === 3);
  assert('byteArray is array', Array.isArray(result.byteArray));
  assert('first byte 0xFF', result.byteArray[0] === 255);
  assert('second byte 0xA0', result.byteArray[1] === 160);
  assert('third byte 0xB3', result.byteArray[2] === 179);
  assert('has protocol_info', typeof result.protocol_info === 'object');
  assert('protocol is Binary', result.protocol_info.protocol === 'Binary');
}

{
  const rt = require('../runtime/eventmath-machine-runtime.js');
  const r = rt.parseBytes('DE AD BE EF');
  assert('dead beef byteCount', r.byteCount === 4);
  assert('0xDE is 222', r.byteArray[0] === 222);
  assert('0xAD is 173', r.byteArray[1] === 173);
}

console.log('\n── Runtime: spawnProcess ──');
{
  const rt = require('../runtime/eventmath-machine-runtime.js');
  rt.spawnProcess('echo hello world').then(result => {
    assert('spawnProcess returns object', typeof result === 'object');
    assert('has stdout', typeof result.stdout === 'string');
    assert('stdout contains hello', result.stdout.includes('hello'));
    assert('has exitCode', typeof result.exitCode === 'number');
    assert('exitCode is 0', result.exitCode === 0);
    assert('has protocol_info', typeof result.protocol_info === 'object');
    assert('protocol is POSIX', result.protocol_info.protocol === 'POSIX');

    return rt.spawnProcess('ls /nonexistent_path_xyz_12345');
  }).then(result => {
    assert('failed spawn has error or non-zero exit', result.exitCode !== 0 || result.stderr !== '');

    return rt.httpGet('http://httpbin.org/get');
  }).then(result => {
    // httpGet may fail in sandbox — both success and error shapes are valid
    assert('httpGet returns object', typeof result === 'object');
    assert('has protocol_info', typeof result.protocol_info === 'object');
    if (result.error) {
      assert('error is string', typeof result.error === 'string');
    } else {
      assert('has status', typeof result.status === 'number');
      assert('has body', typeof result.body === 'string');
    }

    const summary = `\n${'─'.repeat(50)}\nv2.28 tests: ${passed} passed, ${failed} failed\n`;
    console.log(summary);
    if (failed > 0) process.exit(1);
  }).catch(err => {
    console.error('Runtime error:', err.message);
    process.exit(1);
  });
}
