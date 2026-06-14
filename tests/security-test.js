'use strict';

/**
 * EventMath v2.19 Test Suite — Security Layer
 *
 * Tests:
 *  1. Authorization statement
 *  2. Probe statement — DNS
 *  3. Probe statement — headers
 *  4. Probe statement — SSL
 *  5. Probe statement — ports with range
 *  6. Discover statement
 *  7. Intercept statement
 *  8. Intercept with filter
 *  9. Threat statement
 * 10. Harden statement
 * 11. No regressions (security require guard)
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function tokenize(src) {
  return new EventMathTokenizer().tokenize(src);
}

function parse(src) {
  return new EventMathParser(tokenize(src)).parse();
}

function compile(src) {
  return new EventMathCodeGen().generate(parse(src));
}

function format(src) {
  return new EventMathFormatter().format(parse(src));
}

// ─────────────────────────────────────────────────────────────────────
// Section 1: Authorization statement
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Authorization statement ─');

test('tokenizer: authorize ... scope is ... target is ... end → KEYWORD:authorize token', () => {
  const tokens = tokenize('authorize audit scope is "web app test" target is "192.168.1.1" end');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'authorize');
  assert(t, 'Expected KEYWORD:authorize token');
});

test('parser: AuthorizeStmt AST node has name=audit', () => {
  const ast = parse('authorize audit scope is "web app test" target is "192.168.1.1" end');
  const stmt = ast.statements[0];
  assert(stmt.type === 'AuthorizeStmt', `Expected AuthorizeStmt, got ${stmt.type}`);
  assert(stmt.name === 'audit', `Expected name=audit, got ${stmt.name}`);
});

test('parser: AuthorizeStmt has scope and target', () => {
  const ast = parse('authorize audit scope is "web app test" target is "192.168.1.1" end');
  const stmt = ast.statements[0];
  assert(stmt.scope === 'web app test', `Expected scope="web app test", got ${stmt.scope}`);
  assert(stmt.target === '192.168.1.1', `Expected target="192.168.1.1", got ${stmt.target}`);
});

test('codegen: AuthorizeStmt output contains __auth_audit and [AUTHORIZED SCOPE]', () => {
  const src = 'authorize audit scope is "web app test" target is "192.168.1.1" end';
  const out = compile(src);
  assert(out.includes('__auth_audit'), `Expected __auth_audit in: ${out}`);
  assert(out.includes('[AUTHORIZED SCOPE]'), `Expected [AUTHORIZED SCOPE] in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 2: Probe statement — DNS
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Probe statement — DNS ─');

test('tokenizer: probe dns "example.com" into dns records → KEYWORD:probe', () => {
  const tokens = tokenize('probe dns "example.com" into dns records');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'probe');
  assert(t, 'Expected KEYWORD:probe token');
});

test('tokenizer: probe dns → NAME:dns token present', () => {
  const tokens = tokenize('probe dns "example.com" into dns records');
  const t = tokens.find(t => t.type === 'NAME' && t.value === 'dns');
  assert(t, 'Expected NAME:dns token');
});

test('tokenizer: probe dns "example.com" → LITERAL:example.com', () => {
  const tokens = tokenize('probe dns "example.com" into dns records');
  const t = tokens.find(t => t.type === 'LITERAL' && t.value === 'example.com');
  assert(t, 'Expected LITERAL:example.com token');
});

test('tokenizer: probe dns ... into dns records → KEYWORD:into and NAME:dns records', () => {
  const tokens = tokenize('probe dns "example.com" into dns records');
  const intoTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'into');
  assert(intoTok, 'Expected KEYWORD:into token');
  const nameTok = tokens.find(t => t.type === 'NAME' && t.value === 'dns records');
  assert(nameTok, 'Expected NAME:dns records token');
});

test('parser: ProbeStmt AST with probeType=dns and target=example.com', () => {
  const ast = parse('probe dns "example.com" into dns records');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ProbeStmt', `Expected ProbeStmt, got ${stmt.type}`);
  assert(stmt.probeType === 'dns', `Expected probeType=dns, got ${stmt.probeType}`);
  assert(stmt.target === 'example.com', `Expected target=example.com, got ${stmt.target}`);
  assert(stmt.intoName === 'dns records', `Expected intoName="dns records", got ${stmt.intoName}`);
});

test('codegen: DNS probe output contains probeDNS and example.com and record type A', () => {
  const src = `
authorize audit scope is "example.com" target is "example.com" end
probe dns "example.com" into dns records
`;
  const out = compile(src);
  assert(out.includes('probeDNS'), `Expected probeDNS in: ${out}`);
  assert(out.includes("'example.com'"), `Expected 'example.com' in: ${out}`);
  assert(out.includes("'A'"), `Expected 'A' record type in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 3: Probe statement — headers
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Probe statement — headers ─');

test('tokenizer: probe headers at "https://example.com" into http headers → KEYWORD:probe', () => {
  const tokens = tokenize('probe headers at "https://example.com" into http headers');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'probe');
  assert(t, 'Expected KEYWORD:probe token');
});

test('tokenizer: probe headers → NAME:headers token', () => {
  const tokens = tokenize('probe headers at "https://example.com" into http headers');
  const t = tokens.find(t => t.type === 'NAME' && t.value === 'headers');
  assert(t, 'Expected NAME:headers token');
});

test('tokenizer: probe headers at → KEYWORD:at token', () => {
  const tokens = tokenize('probe headers at "https://example.com" into http headers');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'at');
  assert(t, 'Expected KEYWORD:at token');
});

test('tokenizer: probe headers → LITERAL:https://example.com', () => {
  const tokens = tokenize('probe headers at "https://example.com" into http headers');
  const t = tokens.find(t => t.type === 'LITERAL' && t.value === 'https://example.com');
  assert(t, 'Expected LITERAL:https://example.com token');
});

test('parser: ProbeStmt with probeType=headers and target=https://example.com', () => {
  const ast = parse('probe headers at "https://example.com" into http headers');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ProbeStmt', `Expected ProbeStmt, got ${stmt.type}`);
  assert(stmt.probeType === 'headers', `Expected probeType=headers, got ${stmt.probeType}`);
  assert(stmt.target === 'https://example.com', `Expected target=https://example.com, got ${stmt.target}`);
});

test('codegen: headers probe output contains probeHeaders', () => {
  const src = `
authorize audit scope is "example.com" target is "example.com" end
probe headers at "https://example.com" into http headers
`;
  const out = compile(src);
  assert(out.includes('probeHeaders'), `Expected probeHeaders in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 4: Probe statement — SSL
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Probe statement — SSL ─');

test('tokenizer: probe ssl at "example.com" into cert info → correct tokens', () => {
  const tokens = tokenize('probe ssl at "example.com" into cert info');
  const probeTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'probe');
  assert(probeTok, 'Expected KEYWORD:probe token');
  const sslTok = tokens.find(t => t.type === 'NAME' && t.value === 'ssl');
  assert(sslTok, 'Expected NAME:ssl token');
  const litTok = tokens.find(t => t.type === 'LITERAL' && t.value === 'example.com');
  assert(litTok, 'Expected LITERAL:example.com token');
});

test('parser: ProbeStmt with probeType=ssl, target=example.com, intoName=cert info', () => {
  const ast = parse('probe ssl at "example.com" into cert info');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ProbeStmt', `Expected ProbeStmt, got ${stmt.type}`);
  assert(stmt.probeType === 'ssl', `Expected probeType=ssl, got ${stmt.probeType}`);
  assert(stmt.target === 'example.com', `Expected target=example.com, got ${stmt.target}`);
  assert(stmt.intoName === 'cert info', `Expected intoName="cert info", got ${stmt.intoName}`);
});

test('codegen: SSL probe output contains probeSSL', () => {
  const src = `
authorize audit scope is "example.com" target is "example.com" end
probe ssl at "example.com" into cert info
`;
  const out = compile(src);
  assert(out.includes('probeSSL'), `Expected probeSSL in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 5: Probe statement — ports with range
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Probe statement — ports with range ─');

test('tokenizer: probe ports at "192.168.1.1" from 1 through 1024 into open ports → NUMBER:1 and NUMBER:1024', () => {
  const tokens = tokenize('probe ports at "192.168.1.1" from 1 through 1024 into open ports');
  const one = tokens.find(t => t.type === 'NUMBER' && Number(t.value) === 1);
  assert(one, 'Expected NUMBER:1 token');
  const tentwentyfour = tokens.find(t => t.type === 'NUMBER' && Number(t.value) === 1024);
  assert(tentwentyfour, 'Expected NUMBER:1024 token');
});

test('tokenizer: probe ports → KEYWORD:probe and NAME:ports', () => {
  const tokens = tokenize('probe ports at "192.168.1.1" from 1 through 1024 into open ports');
  const probeTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'probe');
  assert(probeTok, 'Expected KEYWORD:probe token');
  const portsTok = tokens.find(t => t.type === 'NAME' && t.value === 'ports');
  assert(portsTok, 'Expected NAME:ports token');
});

test('parser: ProbeStmt with probeType=ports, fromPort=1, toPort=1024', () => {
  const ast = parse('probe ports at "192.168.1.1" from 1 through 1024 into open ports');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ProbeStmt', `Expected ProbeStmt, got ${stmt.type}`);
  assert(stmt.probeType === 'ports', `Expected probeType=ports, got ${stmt.probeType}`);
  assert(stmt.target === '192.168.1.1', `Expected target=192.168.1.1, got ${stmt.target}`);
  assert(stmt.fromPort === 1, `Expected fromPort=1, got ${stmt.fromPort}`);
  assert(stmt.toPort === 1024, `Expected toPort=1024, got ${stmt.toPort}`);
  assert(stmt.intoName === 'open ports', `Expected intoName="open ports", got ${stmt.intoName}`);
});

test('codegen: ports probe output contains probePorts and 1 and 1024', () => {
  const src = `
authorize audit scope is "192.168.1.1" target is "192.168.1.1" end
probe ports at "192.168.1.1" from 1 through 1024 into open ports
`;
  const out = compile(src);
  assert(out.includes('probePorts'), `Expected probePorts in: ${out}`);
  assert(out.includes('1,'), `Expected port 1 in: ${out}`);
  assert(out.includes('1024'), `Expected port 1024 in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 6: Discover statement
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Discover statement ─');

test('tokenizer: discover hosts on "192.168.1.0/24" into live hosts → KEYWORD:discover', () => {
  const tokens = tokenize('discover hosts on "192.168.1.0/24" into live hosts');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'discover');
  assert(t, 'Expected KEYWORD:discover token');
});

test('tokenizer: discover hosts → NAME:hosts token', () => {
  const tokens = tokenize('discover hosts on "192.168.1.0/24" into live hosts');
  const t = tokens.find(t => t.type === 'NAME' && t.value === 'hosts');
  assert(t, 'Expected NAME:hosts token');
});

test('tokenizer: discover → KEYWORD:on and LITERAL:192.168.1.0/24', () => {
  const tokens = tokenize('discover hosts on "192.168.1.0/24" into live hosts');
  const onTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'on');
  assert(onTok, 'Expected KEYWORD:on token');
  const litTok = tokens.find(t => t.type === 'LITERAL' && t.value === '192.168.1.0/24');
  assert(litTok, 'Expected LITERAL:192.168.1.0/24 token');
});

test('parser: DiscoverStmt with target=192.168.1.0/24 and intoName=live hosts', () => {
  const ast = parse('discover hosts on "192.168.1.0/24" into live hosts');
  const stmt = ast.statements[0];
  assert(stmt.type === 'DiscoverStmt', `Expected DiscoverStmt, got ${stmt.type}`);
  assert(stmt.target === '192.168.1.0/24', `Expected target=192.168.1.0/24, got ${stmt.target}`);
  assert(stmt.intoName === 'live hosts', `Expected intoName="live hosts", got ${stmt.intoName}`);
});

test('codegen: discover output contains discoverHosts and 192.168.1.0/24', () => {
  const src = `
authorize audit scope is "192.168.1.0/24" target is "192.168.1.0/24" end
discover hosts on "192.168.1.0/24" into live hosts
`;
  const out = compile(src);
  assert(out.includes('discoverHosts'), `Expected discoverHosts in: ${out}`);
  assert(out.includes("'192.168.1.0/24'"), `Expected '192.168.1.0/24' in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 7: Intercept statement
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Intercept statement ─');

test('tokenizer: intercept traffic on "eth0" for 10 seconds into packets → KEYWORD:intercept', () => {
  const tokens = tokenize('intercept traffic on "eth0" for 10 seconds into packets');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'intercept');
  assert(t, 'Expected KEYWORD:intercept token');
});

test('tokenizer: intercept → KEYWORD:on and LITERAL:eth0', () => {
  const tokens = tokenize('intercept traffic on "eth0" for 10 seconds into packets');
  const onTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'on');
  assert(onTok, 'Expected KEYWORD:on token');
  const litTok = tokens.find(t => t.type === 'LITERAL' && t.value === 'eth0');
  assert(litTok, 'Expected LITERAL:eth0 token');
});

test('tokenizer: intercept → NUMBER:10 and KEYWORD:into and NAME:packets', () => {
  const tokens = tokenize('intercept traffic on "eth0" for 10 seconds into packets');
  const numTok = tokens.find(t => t.type === 'NUMBER' && Number(t.value) === 10);
  assert(numTok, 'Expected NUMBER:10 token');
  const intoTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'into');
  assert(intoTok, 'Expected KEYWORD:into token');
  const nameTok = tokens.find(t => t.type === 'NAME' && t.value === 'packets');
  assert(nameTok, 'Expected NAME:packets token');
});

test('parser: InterceptStmt with interface=eth0, seconds=10, filter=null, intoName=packets', () => {
  const ast = parse('intercept traffic on "eth0" for 10 seconds into packets');
  const stmt = ast.statements[0];
  assert(stmt.type === 'InterceptStmt', `Expected InterceptStmt, got ${stmt.type}`);
  assert(stmt.interface === 'eth0', `Expected interface=eth0, got ${stmt.interface}`);
  assert(stmt.seconds === 10, `Expected seconds=10, got ${stmt.seconds}`);
  assert(stmt.filter === null, `Expected filter=null, got ${stmt.filter}`);
  assert(stmt.intoName === 'packets', `Expected intoName=packets, got ${stmt.intoName}`);
});

test('codegen: intercept output contains captureTraffic and eth0 and 10', () => {
  const src = `
authorize audit scope is "eth0" target is "eth0" end
intercept traffic on "eth0" for 10 seconds into packets
`;
  const out = compile(src);
  assert(out.includes('captureTraffic'), `Expected captureTraffic in: ${out}`);
  assert(out.includes("'eth0'"), `Expected 'eth0' in: ${out}`);
  assert(out.includes('10'), `Expected 10 in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 8: Intercept with filter
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Intercept with filter ─');

test('tokenizer: intercept with matching filter → LITERAL:tcp port 80', () => {
  const tokens = tokenize('intercept traffic on "eth0" matching "tcp port 80" for 30 seconds into http traffic');
  const t = tokens.find(t => t.type === 'LITERAL' && t.value === 'tcp port 80');
  assert(t, 'Expected LITERAL:tcp port 80 token');
});

test('tokenizer: intercept with matching → KEYWORD:matching', () => {
  const tokens = tokenize('intercept traffic on "eth0" matching "tcp port 80" for 30 seconds into http traffic');
  const t = tokens.find(t => t.type === 'KEYWORD' && t.value === 'matching');
  assert(t, 'Expected KEYWORD:matching token');
});

test('parser: InterceptStmt with filter=tcp port 80, seconds=30, intoName=http traffic', () => {
  const ast = parse('intercept traffic on "eth0" matching "tcp port 80" for 30 seconds into http traffic');
  const stmt = ast.statements[0];
  assert(stmt.type === 'InterceptStmt', `Expected InterceptStmt, got ${stmt.type}`);
  assert(stmt.filter === 'tcp port 80', `Expected filter="tcp port 80", got ${stmt.filter}`);
  assert(stmt.seconds === 30, `Expected seconds=30, got ${stmt.seconds}`);
  assert(stmt.intoName === 'http traffic', `Expected intoName="http traffic", got ${stmt.intoName}`);
});

test('codegen: filtered intercept output contains tcp port 80', () => {
  const src = `
authorize audit scope is "eth0" target is "eth0" end
intercept traffic on "eth0" matching "tcp port 80" for 30 seconds into http traffic
`;
  const out = compile(src);
  assert(out.includes("'tcp port 80'"), `Expected 'tcp port 80' in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 9: Threat statement
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Threat statement ─');

test('parser: ThreatStmt AST node — basic threat block', () => {
  const src = `
threat sql injection
category web
matter
  vector is database
  severity is high
end
end
`;
  const ast = parse(src);
  const stmt = ast.statements[0];
  assert(stmt.type === 'ThreatStmt', `Expected ThreatStmt, got ${stmt.type}`);
  assert(stmt.name === 'sql injection', `Expected name="sql injection", got ${stmt.name}`);
});

test('parser: ThreatStmt has category and matter', () => {
  const src = `
threat sql injection
category web
matter
  vector is database
  severity is high
end
end
`;
  const ast = parse(src);
  const stmt = ast.statements[0];
  assert(stmt.category === 'web', `Expected category=web, got ${stmt.category}`);
  assert(stmt.matter, 'Expected matter block');
  assert(stmt.matter.vector === 'database', `Expected vector=database, got ${stmt.matter.vector}`);
});

test('codegen: ThreatStmt output contains threat name as variable', () => {
  const src = `
threat sql injection
category web
matter
  vector is database
  severity is high
end
end
`;
  const out = compile(src);
  assert(out.includes('sql_injection'), `Expected sql_injection variable in: ${out}`);
});

test('formatter: ThreatStmt round-trips', () => {
  const src = `threat sql injection
category web
matter
  vector is database
  severity is high
end
end`;
  const out = format(src);
  assert(out.includes('threat sql injection'), `Expected "threat sql injection" in: ${out}`);
  assert(out.includes('category web'), `Expected "category web" in: ${out}`);
  assert(out.includes('end'), `Expected end block in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 10: Harden statement
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Harden statement ─');

test('tokenizer: harden from cert info and http headers into report → sources parsed', () => {
  const tokens = tokenize('harden from cert info and http headers into report');
  const hardenTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'harden');
  assert(hardenTok, 'Expected KEYWORD:harden token');
  const fromTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'from');
  assert(fromTok, 'Expected KEYWORD:from token');
  const intoTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'into');
  assert(intoTok, 'Expected KEYWORD:into token');
});

test('tokenizer: harden → NAME tokens for cert info and http headers', () => {
  const tokens = tokenize('harden from cert info and http headers into report');
  const certInfo = tokens.find(t => t.type === 'NAME' && t.value === 'cert info');
  assert(certInfo, 'Expected NAME:cert info token');
  const httpHeaders = tokens.find(t => t.type === 'NAME' && t.value === 'http headers');
  assert(httpHeaders, 'Expected NAME:http headers token');
});

test('parser: HardenStmt with sources=[cert info, http headers] and intoName=report', () => {
  const ast = parse('harden from cert info and http headers into report');
  const stmt = ast.statements[0];
  assert(stmt.type === 'HardenStmt', `Expected HardenStmt, got ${stmt.type}`);
  assert(Array.isArray(stmt.sources), 'Expected sources to be an array');
  assert(stmt.sources.includes('cert info'), `Expected cert info in sources: ${stmt.sources}`);
  assert(stmt.sources.includes('http headers'), `Expected http headers in sources: ${stmt.sources}`);
  assert(stmt.intoName === 'report', `Expected intoName=report, got ${stmt.intoName}`);
});

test('codegen: harden output contains generateHardening', () => {
  const src = `
authorize audit scope is "example.com" target is "example.com" end
probe ssl at "example.com" into cert info
probe headers at "https://example.com" into http headers
harden from cert info and http headers into report
`;
  const out = compile(src);
  assert(out.includes('generateHardening'), `Expected generateHardening in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 11: No regressions
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ No regressions ─');

test('codegen: program without security statements does NOT require __emSec', () => {
  const src = `
event system ready
category state
matter
  status is online
end
end

show system ready
`;
  const out = compile(src);
  assert(!out.includes('__emSec'), `Unexpected __emSec require in non-security program: ${out}`);
});

test('codegen: program WITH probe DOES require __emSec', () => {
  const src = `
authorize audit scope is "example.com" target is "example.com" end
probe dns "example.com" into dns records
show dns records
`;
  const out = compile(src);
  assert(out.includes('__emSec'), `Expected __emSec require in security program: ${out}`);
});

test('codegen: existing event/chain features unaffected by security layer', () => {
  const src = `
event revenue goal
category target
matter
  amount is 100000
end
end

chain growth path
  effort leads to results at value 7
  results leads to revenue at value 9
end

show revenue goal
`;
  const out = compile(src);
  assert(out.includes('revenue_goal'), `Expected revenue_goal in: ${out}`);
  assert(out.includes('growth_path'), `Expected growth_path in: ${out}`);
  assert(!out.includes('__emSec'), `Unexpected __emSec in non-security program: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────
console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
