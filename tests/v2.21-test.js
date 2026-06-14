'use strict';

/**
 * EventMath v2.21 — Intelligence Layer Tests
 *
 * Tests for the emerge, wifi map, lookup, and watch statement types.
 * Covers tokenizer, parser, codegen, and runtime for all four statement forms.
 */

const path = require('path');
const { EventMathTokenizer } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
const { EventMathParser }    = require(path.join(__dirname, '..', 'src', 'parser.js'));
const { EventMathCodeGen }   = require(path.join(__dirname, '..', 'src', 'codegen.js'));

// Intelligence runtime
const intelRuntimePath = path.join(__dirname, '..', 'runtime', 'eventmath-intelligence-runtime.js');
let IntelRuntime;
try {
  IntelRuntime = require(intelRuntimePath);
} catch (e) {
  IntelRuntime = null;
}

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

function testAsync(name, fn) {
  return fn().then(() => {
    console.log(`  ✓  ${name}`);
    passed++;
  }).catch(e => {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected "${expected}", got "${actual}"`);
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
  return new EventMathCodeGen().generate(parse(src));
}

console.log('═══════════════════════════════════════════════');
console.log('  EventMath v2.21 — Intelligence Layer Tests');
console.log('═══════════════════════════════════════════════');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// TOKENIZER TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Tokenizer: emerge ──');

test('emerge keyword is in KEYWORDS set', () => {
  const { KEYWORDS } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
  assert(KEYWORDS.has('emerge'), 'emerge should be in KEYWORDS');
});

test('tokenize emerge header emits KEYWORD:emerge and NAME', () => {
  const tokens = tokenize('emerge trump correlations');
  assert(tokens.length >= 1, 'Should produce tokens');
  assert(tokens[0].type === 'KEYWORD', `Expected KEYWORD, got ${tokens[0].type}`);
  assertEqual(tokens[0].value, 'emerge', 'First token should be emerge');
  assert(tokens[1] && tokens[1].type === 'NAME', 'Second token should be NAME');
  assertEqual(tokens[1].value, 'trump correlations', 'Name should be "trump correlations"');
});

test('tokenize from line emits KEYWORD:from and NAME', () => {
  const tokens = tokenize('from washington landscape');
  const fromTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'from');
  assert(fromTok, 'Should have KEYWORD:from');
});

console.log('\n── Tokenizer: wifi ──');

test('wifi keyword is in KEYWORDS set', () => {
  const { KEYWORDS } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
  assert(KEYWORDS.has('wifi'), 'wifi should be in KEYWORDS');
});

test('tokenize wifi map network into devices', () => {
  const tokens = tokenize('wifi map network into devices');
  assertEqual(tokens[0].type, 'KEYWORD', 'First token KEYWORD');
  assertEqual(tokens[0].value, 'wifi', 'First token value wifi');
  const mapTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'map');
  assert(mapTok, 'Should have KEYWORD:map');
  const intoTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'into');
  assert(intoTok, 'Should have KEYWORD:into');
  const nameTok = tokens.find(t => t.type === 'NAME');
  assert(nameTok, 'Should have NAME token');
  assertEqual(nameTok.value, 'devices', 'Name should be devices');
});

test('tokenize wifi locate emits KEYWORD:locate and LITERAL', () => {
  const tokens = tokenize('wifi locate "my laptop" into position');
  const locateTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'locate');
  assert(locateTok, 'Should have KEYWORD:locate');
  const litTok = tokens.find(t => t.type === 'LITERAL');
  assert(litTok, 'Should have LITERAL token for device name');
  assertEqual(litTok.value, 'my laptop', 'Literal should be unquoted');
});

console.log('\n── Tokenizer: lookup ──');

test('lookup keyword is in KEYWORDS set', () => {
  const { KEYWORDS } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
  assert(KEYWORDS.has('lookup'), 'lookup should be in KEYWORDS');
});

test('tokenize lookup phone emits KEYWORD:phone and LITERAL', () => {
  const tokens = tokenize('lookup phone "555-123-4567" into contact info');
  assertEqual(tokens[0].type, 'KEYWORD', 'First token KEYWORD');
  assertEqual(tokens[0].value, 'lookup', 'First token lookup');
  const phoneTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'phone');
  assert(phoneTok, 'Should have KEYWORD:phone');
  const litTok = tokens.find(t => t.type === 'LITERAL');
  assert(litTok, 'Should have LITERAL for phone number');
  assertEqual(litTok.value, '555-123-4567', 'Literal should be unquoted phone number');
});

test('tokenize lookup email emits KEYWORD:email and LITERAL', () => {
  const tokens = tokenize('lookup email "user@example.com" into account info');
  const emailTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'email');
  assert(emailTok, 'Should have KEYWORD:email');
  const litTok = tokens.find(t => t.type === 'LITERAL');
  assert(litTok, 'Should have LITERAL for email');
  assertEqual(litTok.value, 'user@example.com', 'Literal should be unquoted email');
});

test('tokenize lookup phone into multi-word name', () => {
  const tokens = tokenize('lookup phone "202-456-1414" into whitehouse contact');
  const intoTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'into');
  assert(intoTok, 'Should have KEYWORD:into');
  const nameTok = tokens.find(t => t.type === 'NAME');
  assert(nameTok, 'Should have NAME for result');
  assertEqual(nameTok.value, 'whitehouse contact', 'Name should be multi-word');
});

console.log('\n── Tokenizer: watch ──');

test('watch keyword is in KEYWORDS set', () => {
  const { KEYWORDS } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
  assert(KEYWORDS.has('watch'), 'watch should be in KEYWORDS');
});

test('tokenize watch feed emits KEYWORD:feed and KEYWORD:at and LITERAL', () => {
  const tokens = tokenize('watch feed at "https://traffic.example.com/cam1" for 30 seconds into frames');
  assertEqual(tokens[0].type, 'KEYWORD');
  assertEqual(tokens[0].value, 'watch');
  const feedTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'feed');
  assert(feedTok, 'Should have KEYWORD:feed');
  const litTok = tokens.find(t => t.type === 'LITERAL');
  assert(litTok, 'Should have LITERAL for URL');
  assertEqual(litTok.value, 'https://traffic.example.com/cam1', 'URL should be unquoted');
  const numTok = tokens.find(t => t.type === 'NUMBER');
  assert(numTok, 'Should have NUMBER for seconds');
  assertEqual(numTok.value, '30', 'Number should be 30');
});

test('tokenize watch cameras emits KEYWORD:cameras and KEYWORD:near and LITERAL', () => {
  const tokens = tokenize('watch cameras near "Washington DC" into live feeds');
  const cameraTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'cameras');
  assert(cameraTok, 'Should have KEYWORD:cameras');
  const nearTok = tokens.find(t => t.type === 'KEYWORD' && t.value === 'near');
  assert(nearTok, 'Should have KEYWORD:near');
  const litTok = tokens.find(t => t.type === 'LITERAL');
  assert(litTok, 'Should have LITERAL for location');
  assertEqual(litTok.value, 'Washington DC', 'Location should be unquoted');
});

// ─────────────────────────────────────────────────────────────────────────────
// PARSER TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Parser: emerge ──');

test('parse emerge block produces EmergeStmt AST node', () => {
  const src = `emerge trump correlations
  subject "Donald Trump"
  preference "McDonald's" and "golf"
  trigger "criticism"
  threshold unusual
  into emergent findings
end`;
  const ast = parse(src);
  assert(ast.statements.length > 0, 'Should produce statements');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'EmergeStmt', `Expected EmergeStmt, got ${stmt.type}`);
  assertEqual(stmt.name, 'trump correlations', 'name should be trump correlations');
  assertEqual(stmt.subject, "Donald Trump", 'subject should be Donald Trump');
  assert(stmt.preferences.length === 2, `Expected 2 preferences, got ${stmt.preferences.length}`);
  assertEqual(stmt.preferences[0], "McDonald's", 'First preference');
  assertEqual(stmt.preferences[1], 'golf', 'Second preference');
  assert(stmt.triggers.length === 1, 'Should have 1 trigger');
  assertEqual(stmt.threshold, 'unusual', 'Threshold should be unusual');
  assertEqual(stmt.intoName, 'emergent findings', 'intoName should be emergent findings');
});

test('parse emerge with from clause stores story name', () => {
  const src = `emerge analysis
  from my story
  subject "Test Subject"
  into results
end`;
  const ast = parse(src);
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'EmergeStmt', 'Should be EmergeStmt');
  assertEqual(stmt.story, 'my story', 'story should be my story');
});

test('parse emerge with reactions', () => {
  const src = `emerge behavior
  subject "Person"
  reaction "public statement" and "media attack"
  into findings
end`;
  const ast = parse(src);
  const stmt = ast.statements[0];
  assert(stmt.reactions.length === 2, `Expected 2 reactions, got ${stmt.reactions.length}`);
});

console.log('\n── Parser: wifi ──');

test('parse wifi map produces WifiMapStmt with op=map', () => {
  const ast = parse('wifi map network into home devices');
  assert(ast.statements.length > 0, 'Should produce statements');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'WifiMapStmt', `Expected WifiMapStmt, got ${stmt.type}`);
  assertEqual(stmt.op, 'map', 'op should be map');
  assertEqual(stmt.intoName, 'home devices', 'intoName should be home devices');
  assert(stmt.target === null, 'map target should be null');
});

test('parse wifi locate produces WifiMapStmt with op=locate', () => {
  const ast = parse('wifi locate "my laptop" into position');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'WifiMapStmt', `Expected WifiMapStmt, got ${stmt.type}`);
  assertEqual(stmt.op, 'locate', 'op should be locate');
  assertEqual(stmt.target, 'my laptop', 'target should be my laptop');
  assertEqual(stmt.intoName, 'position', 'intoName should be position');
});

console.log('\n── Parser: lookup ──');

test('parse lookup phone produces LookupStmt', () => {
  const ast = parse('lookup phone "555-123-4567" into contact info');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'LookupStmt', `Expected LookupStmt, got ${stmt.type}`);
  assertEqual(stmt.lookupType, 'phone', 'lookupType should be phone');
  assertEqual(stmt.target, '555-123-4567', 'target should be phone number');
  assertEqual(stmt.intoName, 'contact info', 'intoName should be contact info');
});

test('parse lookup email produces LookupStmt with email type', () => {
  const ast = parse('lookup email "user@example.com" into account info');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'LookupStmt', `Expected LookupStmt, got ${stmt.type}`);
  assertEqual(stmt.lookupType, 'email', 'lookupType should be email');
  assertEqual(stmt.target, 'user@example.com', 'target should be email');
  assertEqual(stmt.intoName, 'account info', 'intoName should be account info');
});

console.log('\n── Parser: watch ──');

test('parse watch feed produces WatchStmt with watchType=feed', () => {
  const ast = parse('watch feed at "https://traffic.example.com/cam1" for 30 seconds into frames');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'WatchStmt', `Expected WatchStmt, got ${stmt.type}`);
  assertEqual(stmt.watchType, 'feed', 'watchType should be feed');
  assertEqual(stmt.target, 'https://traffic.example.com/cam1', 'target should be URL');
  assertEqual(stmt.seconds, 30, 'seconds should be 30');
  assertEqual(stmt.intoName, 'frames', 'intoName should be frames');
});

test('parse watch cameras produces WatchStmt with watchType=cameras', () => {
  const ast = parse('watch cameras near "Washington DC" into live feeds');
  const stmt = ast.statements[0];
  assertEqual(stmt.type, 'WatchStmt', `Expected WatchStmt, got ${stmt.type}`);
  assertEqual(stmt.watchType, 'cameras', 'watchType should be cameras');
  assertEqual(stmt.location, 'Washington DC', 'location should be Washington DC');
  assertEqual(stmt.intoName, 'live feeds', 'intoName should be live feeds');
  assert(stmt.target === null, 'cameras target should be null');
});

// ─────────────────────────────────────────────────────────────────────────────
// CODEGEN TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Codegen: emerge ──');

test('codegen emerge produces __emIntel.emergeCorrelation call', () => {
  const src = `emerge trump correlations
  subject "Donald Trump"
  preference "McDonald's" and "golf"
  threshold unusual
  into emergent findings
end`;
  const out = compile(src);
  assert(out.includes('__emIntel'), `Expected __emIntel in output: ${out.slice(0, 200)}`);
  assert(out.includes('emergeCorrelation'), `Expected emergeCorrelation in output`);
  assert(out.includes('await'), 'emerge should use await');
});

test('codegen emerge includes intelligence runtime require', () => {
  const src = `emerge test
  into result
end`;
  const out = compile(src);
  assert(out.includes('eventmath-intelligence-runtime'), 'Should require intelligence runtime');
});

test('codegen emerge result variable uses safe name from intoName', () => {
  const src = `emerge test
  into emergent findings
end`;
  const out = compile(src);
  assert(out.includes('emergent_findings'), 'Result var should be emergent_findings');
});

console.log('\n── Codegen: wifi ──');

test('codegen wifi map produces __emIntel.wifiMapNetwork call', () => {
  const out = compile('wifi map network into devices');
  assert(out.includes('wifiMapNetwork'), 'Should call wifiMapNetwork');
  assert(out.includes('await'), 'wifi map should use await');
  assert(out.includes('__emIntel'), 'Should use __emIntel');
});

test('codegen wifi locate produces __emIntel.wifiLocate call', () => {
  const out = compile('wifi locate "my laptop" into position');
  assert(out.includes('wifiLocate'), 'Should call wifiLocate');
  assert(out.includes('my laptop'), 'Should include device name');
});

console.log('\n── Codegen: lookup ──');

test('codegen lookup phone produces __emIntel.lookupPhone call', () => {
  const out = compile('lookup phone "555-123-4567" into contact info');
  assert(out.includes('lookupPhone'), 'Should call lookupPhone');
  assert(out.includes('555-123-4567'), 'Should include phone number');
  assert(out.includes('await'), 'lookup should use await');
});

test('codegen lookup email produces __emIntel.lookupEmail call', () => {
  const out = compile('lookup email "user@example.com" into account info');
  assert(out.includes('lookupEmail'), 'Should call lookupEmail');
  assert(out.includes('user@example.com'), 'Should include email');
});

console.log('\n── Codegen: watch ──');

test('codegen watch feed produces __emIntel.watchFeed call', () => {
  const out = compile('watch feed at "https://traffic.example.com/cam1" for 30 seconds into frames');
  assert(out.includes('watchFeed'), 'Should call watchFeed');
  assert(out.includes('https://traffic.example.com/cam1'), 'Should include URL');
  assert(out.includes('30'), 'Should include seconds');
  assert(out.includes('await'), 'watch feed should use await');
});

test('codegen watch cameras produces __emIntel.watchCameras call', () => {
  const out = compile('watch cameras near "Washington DC" into live feeds');
  assert(out.includes('watchCameras'), 'Should call watchCameras');
  assert(out.includes('Washington DC'), 'Should include location');
});

test('codegen wraps program in async IIFE when intelligence stmts present', () => {
  const out = compile('wifi map network into devices');
  assert(out.includes('async'), 'Should use async');
  assert(out.includes('await'), 'Should use await');
});

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME TESTS (structure-only, no live network calls)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Runtime: emergeCorrelation ──');

const asyncTests = [];

if (IntelRuntime) {
  asyncTests.push(testAsync('emergeCorrelation returns correct shape with null story', async () => {
    const result = await IntelRuntime.emergeCorrelation(null, 'Test Subject', {
      preferences: ['coffee', 'golf'],
      triggers: ['criticism'],
      reactions: ['public statement'],
    }, 'unusual');
    assert(result && typeof result === 'object', 'Should return object');
    assert(Array.isArray(result.correlations), 'Should have correlations array');
    assert(Array.isArray(result.emergent), 'Should have emergent array');
    assert(typeof result.subject === 'string' || result.subject === 'Test Subject', 'Should have subject');
    assert(result.threshold === 'unusual', 'Should have threshold');
    assert(result.scannedAt, 'Should have scannedAt');
  }));

  asyncTests.push(testAsync('emergeCorrelation finds keyword overlap in story events', async () => {
    const story = [
      { title: 'Golf courses closed due to storm' },
      { title: 'Coffee shop prices rising' },
      { title: 'Unrelated news about trains' },
    ];
    const result = await IntelRuntime.emergeCorrelation(story, 'Test', {
      preferences: ['golf', 'coffee'],
      triggers: [],
      reactions: [],
    }, 'medium');
    assert(result.correlations.length > 0, 'Should find correlations with matching events');
    assert(result.eventCount === 3, `Expected eventCount=3, got ${result.eventCount}`);
  }));

  asyncTests.push(testAsync('emergeCorrelation with unusual threshold surfaces emergent findings', async () => {
    const story = [{ title: 'Fast food prices rise nationwide' }];
    const result = await IntelRuntime.emergeCorrelation(story, 'Donald Trump', {
      preferences: ["McDonald's"],
      triggers: ['business closure'],
      reactions: ['public statement'],
    }, 'unusual');
    assert(result.threshold === 'unusual', 'threshold should be unusual');
    assert(typeof result.emergent === 'object', 'Should have emergent');
    assert(result.note.toLowerCase().includes('unusual'), 'Note should mention unusual threshold');
  }));

  console.log('\n── Runtime: lookupPhone ──');

  asyncTests.push(testAsync('lookupPhone returns correct shape for valid NANP number', async () => {
    const result = await IntelRuntime.lookupPhone('202-456-1414');
    assert(result && typeof result === 'object', 'Should return object');
    assert(result.number, 'Should have number field');
    assert(result.formatted, 'Should have formatted field');
    assert(result.region, 'Should have region field');
    assert(result.carrier, 'Should have carrier field');
    assert(result.type, 'Should have type field');
    assert(Array.isArray(result.osintSources), 'Should have osintSources array');
    assert(result.note, 'Should have note field');
  }));

  asyncTests.push(testAsync('lookupPhone identifies DC area code 202', async () => {
    const result = await IntelRuntime.lookupPhone('2024561414');
    assert(result.region && result.region.includes('DC'), `Expected DC region, got ${result.region}`);
    assertEqual(result.areaCode, '202', 'Area code should be 202');
  }));

  asyncTests.push(testAsync('lookupPhone returns invalid for bad number', async () => {
    const result = await IntelRuntime.lookupPhone('123');
    assert(result.valid === false, 'Should be invalid for short number');
  }));

  asyncTests.push(testAsync('lookupPhone identifies toll-free 800 numbers', async () => {
    const result = await IntelRuntime.lookupPhone('800-555-1234');
    assert(result.type === 'toll-free', `Expected toll-free, got ${result.type}`);
    assert(result.carrier.toLowerCase().includes('toll'), `Expected toll-free carrier, got ${result.carrier}`);
  }));

  console.log('\n── Runtime: lookupEmail ──');

  asyncTests.push(testAsync('lookupEmail returns correct shape', async () => {
    const result = await IntelRuntime.lookupEmail('test@example.com');
    assert(result && typeof result === 'object', 'Should return object');
    assert(result.email, 'Should have email field');
    assert(result.domain, 'Should have domain field');
    assert(typeof result.valid === 'boolean', 'Should have valid boolean');
    assert(typeof result.spf === 'boolean', 'Should have spf boolean');
    assert(typeof result.dmarc === 'boolean', 'Should have dmarc boolean');
    assert(Array.isArray(result.osintSources), 'Should have osintSources');
  }));

  asyncTests.push(testAsync('lookupEmail rejects invalid email format', async () => {
    const result = await IntelRuntime.lookupEmail('not-an-email');
    assert(result.valid === false, 'Should be invalid');
    assert(result.error, 'Should have error message');
  }));

  asyncTests.push(testAsync('lookupEmail parses domain correctly', async () => {
    const result = await IntelRuntime.lookupEmail('user@gmail.com');
    assertEqual(result.domain, 'gmail.com', 'Domain should be gmail.com');
    assertEqual(result.email, 'user@gmail.com', 'Email should be preserved');
  }));

  console.log('\n── Runtime: watchCameras ──');

  asyncTests.push(testAsync('watchCameras returns correct shape', async () => {
    const result = await IntelRuntime.watchCameras('Washington DC');
    assert(result && typeof result === 'object', 'Should return object');
    assert(result.location, 'Should have location');
    assert(Array.isArray(result.sources), 'Should have sources array');
    assert(result.sources.length > 0, 'Should have at least one source');
    assert(result.note, 'Should have note');
  }));

  asyncTests.push(testAsync('watchCameras sources have required fields', async () => {
    const result = await IntelRuntime.watchCameras('New York');
    for (const src of result.sources) {
      assert(src.name, 'Source should have name');
      assert(src.url, 'Source should have url');
      assert(src.type, 'Source should have type');
      assert(src.authorization, 'Source should have authorization');
    }
  }));

  asyncTests.push(testAsync('watchCameras returns default sources for unknown location', async () => {
    const result = await IntelRuntime.watchCameras('Randomville');
    assert(Array.isArray(result.sources), 'Should have sources for unknown location');
    assert(result.sources.length > 0, 'Should have at least one default source');
  }));

  asyncTests.push(testAsync('watchCameras note mentions watch feed command', async () => {
    const result = await IntelRuntime.watchCameras('Chicago');
    assert(result.note.toLowerCase().includes('watch feed'), 'Note should mention watch feed');
  }));

  console.log('\n── Runtime: wifiMapNetwork ──');

  asyncTests.push(testAsync('wifiMapNetwork returns correct shape', async () => {
    const result = await IntelRuntime.wifiMapNetwork();
    assert(result && typeof result === 'object', 'Should return object');
    assert(Array.isArray(result.devices), 'Should have devices array');
    assert(result.scannedAt, 'Should have scannedAt');
    assert(result.note, 'Should have note');
  }));

  asyncTests.push(testAsync('wifiMapNetwork note mentions ARP', async () => {
    const result = await IntelRuntime.wifiMapNetwork();
    assert(result.note.toLowerCase().includes('arp'), 'Note should mention ARP');
  }));

  console.log('\n── Runtime: wifiLocate ──');

  asyncTests.push(testAsync('wifiLocate returns correct shape', async () => {
    const result = await IntelRuntime.wifiLocate('my-device');
    assert(result && typeof result === 'object', 'Should return object');
    assert(typeof result.device === 'string', 'Should have device name');
    assert(result.confidence, 'Should have confidence');
    assert(result.note, 'Should have note');
    assert(result.estimatedLocation, 'Should have estimatedLocation');
  }));
} else {
  console.log('  (skipping runtime tests — runtime module not available)');
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN ASYNC TESTS AND PRINT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
Promise.all(asyncTests).then(() => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  if (failed === 0) {
    console.log(`  All ${passed} tests passed.`);
  } else {
    console.log(`  ${passed} passed, ${failed} failed.`);
  }
  console.log('═══════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
});
