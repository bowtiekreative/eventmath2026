/**
 * Mender Unit Tests (v0.8)
 *
 * Tests the non-interactive parts of the Mender by monkey-patching
 * _ask() to return scripted answers. No actual readline prompts are used.
 *
 * Tests:
 *  1. Fast path matches known error patterns correctly (5 patterns from FAST_PATH_TABLE)
 *  2. Evidence classification: SEEN=0.9, TOLD=0.8, GUESSED=0.5
 *  3. Hypothesis ranking sorts by confidence descending
 *  4. Memory file: save after "yes", load on next session, memory patterns get confidence 1.0
 *  5. Source context display: correct lines extracted with ±2 context
 *
 * Run with: node tests/mender-test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { Mender, FAST_PATH_TABLE } = require('../mender/mender.js');

// ── Helpers ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertApprox(actual, expected, label, tolerance = 0.001) {
  if (Math.abs(actual - expected) <= tolerance) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    console.log(`     Expected: ~${expected}, Got: ${actual}`);
    failed++;
  }
}

/**
 * Create a Mender with _ask monkey-patched to return scripted answers in order.
 */
function makeMockMender(answers) {
  const m = new Mender();
  const queue = [...answers];
  m._ask = async function(_question) {
    if (queue.length === 0) return 'no';
    return queue.shift();
  };
  // Suppress readline creation
  m._getRL = function() {
    return {
      question: (_q, cb) => cb('no'),
      close: () => {},
    };
  };
  return m;
}

// Suppress console output during tests that would clutter results
function silenced(fn) {
  const origLog = console.log;
  console.log = () => {};
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = origLog; });
  }
  console.log = origLog;
  return result;
}

// ── Test 1: Fast path matches known error patterns ────────────────

console.log('\n══════════════════════════════════════════════════════════');
console.log('Test 1: Fast path matches known error patterns (5 checks)');
console.log('══════════════════════════════════════════════════════════');

{
  const testCases = [
    {
      label: 'E001 — missing name for block',
      msg: 'I was looking for the name of a event',
      expectedClassify: 'E001',
    },
    {
      label: 'E002 — unknown word',
      msg: 'I don\'t know the word "variable"',
      expectedClassify: 'E002',
    },
    {
      label: 'E003 — missing end',
      msg: 'I was expecting "end" but found "event"',
      expectedClassify: 'E003',
    },
    {
      label: 'E005 — matter line needs is or from',
      msg: 'After "title" I expected "is" (literal) or "from" (reference), not "nothing".',
      expectedClassify: 'E005',
    },
    {
      label: 'E015 — reserved word used as name',
      msg: '"event" is reserved and cannot be used as a name',
      expectedClassify: 'E015',
    },
  ];

  for (const tc of testCases) {
    let matched = false;
    let matchedClassify = null;
    for (const entry of FAST_PATH_TABLE) {
      const m = tc.msg.match(entry.matcher);
      if (m) {
        matched = true;
        matchedClassify = entry.classify;
        break;
      }
    }
    assert(matched, `${tc.label}: pattern matched`);
    assertEqual(matchedClassify, tc.expectedClassify, `${tc.label}: correct classify code`);
  }
}

// ── Test 2: Evidence classification confidences ───────────────────

console.log('\n══════════════════════════════════════════════════════════');
console.log('Test 2: Evidence classification confidences');
console.log('══════════════════════════════════════════════════════════');

{
  const m = makeMockMender([
    'I see an error message on screen', // SEEN answer
    'I think I forgot the end keyword', // GUESSED answer
  ]);

  // Simulate what _phase3 does for a single error
  const errors = [{ message: 'I was expecting "end" but found "event"', source: 'parse' }];
  m.session.errors = errors;

  const run = silenced(async () => {
    await m._phase3(errors, 'event foo\nevent bar\nevent baz\nend\n');

    const toldEvidence = m.session.evidence.find(e => e.class === 'TOLD');
    const seenEvidence = m.session.evidence.find(e => e.class === 'SEEN');
    const guessedEvidence = m.session.evidence.find(e => e.class === 'GUESSED');

    assert(!!toldEvidence, 'TOLD evidence was added');
    assertApprox(toldEvidence ? toldEvidence.confidence : -1, 0.8, 'TOLD confidence is 0.8');

    assert(!!seenEvidence, 'SEEN evidence was added');
    assertApprox(seenEvidence ? seenEvidence.confidence : -1, 0.9, 'SEEN confidence is 0.9');

    assert(!!guessedEvidence, 'GUESSED evidence was added');
    assertApprox(guessedEvidence ? guessedEvidence.confidence : -1, 0.5, 'GUESSED confidence is 0.5');
  });

  run.catch(err => {
    console.log(`  ❌ Test 2 threw: ${err.message}`);
    failed += 5;
  });

  // We need to await here but we're in a sync context — run tests sequentially via promise chain
  // We'll collect all promises and resolve at end
  if (!global._testPromises) global._testPromises = [];
  global._testPromises.push(run);
}

// ── Test 3: Hypothesis ranking sorts by confidence descending ─────

console.log('\n══════════════════════════════════════════════════════════');
console.log('Test 3: Hypothesis ranking sorts by confidence descending');
console.log('══════════════════════════════════════════════════════════');

{
  const m = makeMockMender([]);
  m.session.errors = [{ message: 'I don\'t know the word "variable"', source: 'parse' }];
  m.session.evidence = [
    { text: 'I think the word is wrong', class: 'GUESSED', confidence: 0.5 },
  ];

  const run = silenced(async () => {
    await m._phase4({ purpose: 'test', recent: 'no' });

    const fixes = m.session.candidateFixes;
    assert(fixes.length > 0, 'candidateFixes is populated');

    // Check sorted descending
    let sorted = true;
    for (let i = 1; i < fixes.length; i++) {
      if (fixes[i].confidence > fixes[i - 1].confidence) {
        sorted = false;
        break;
      }
    }
    assert(sorted, 'candidateFixes sorted by confidence descending');

    // The catalog match (E002) should be first at 0.95
    assert(fixes[0].confidence >= 0.95, 'top fix has confidence >= 0.95 (catalog match for E002)');
  });

  run.catch(err => {
    console.log(`  ❌ Test 3 threw: ${err.message}`);
    failed += 3;
  });

  global._testPromises.push(run);
}

// ── Test 4: Memory file — save, load, confidence 1.0 ─────────────

console.log('\n══════════════════════════════════════════════════════════');
console.log('Test 4: Memory file save/load and confidence 1.0');
console.log('══════════════════════════════════════════════════════════');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mender-test-'));
  const memoryPath = path.join(tmpDir, '.mender-memory.json');

  // Session A: save a pattern
  const m1 = makeMockMender([]);
  m1._memoryPath = memoryPath;
  m1._memory = m1._loadMemory();

  const errorMsg = 'I was expecting "end" but found "event" — test pattern';
  const fixText = 'Add a closing end before the next event block.';

  m1._saveToMemory(errorMsg, fixText);

  // Verify written to disk
  assert(fs.existsSync(memoryPath), 'memory file was created');

  const raw = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
  assert(raw.patterns && raw.patterns.length > 0, 'memory file contains patterns');
  assertEqual(raw.patterns[0].seenCount, 1, 'seenCount starts at 1');

  // Save again — seenCount should increment
  m1._saveToMemory(errorMsg, fixText);
  const raw2 = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
  assertEqual(raw2.patterns[0].seenCount, 2, 'seenCount incremented to 2');

  // Session B: load memory and check that pattern gets confidence 1.0 in phase4
  const m2 = makeMockMender([]);
  m2._memoryPath = memoryPath;
  m2._memory = m2._loadMemory();

  const shortPattern = errorMsg.slice(0, 40).trim();
  m2.session.errors = [{ message: errorMsg, source: 'parse' }];
  m2.session.evidence = [];

  const run = silenced(async () => {
    await m2._phase4({ purpose: 'test', recent: 'no' });

    const memoryFix = m2.session.candidateFixes.find(f => f.source === 'memory');
    assert(!!memoryFix, 'memory-sourced fix is in candidateFixes');
    assertApprox(memoryFix ? memoryFix.confidence : -1, 1.0, 'memory fix has confidence 1.0');

    // Memory fix should be first (highest confidence)
    assert(
      m2.session.candidateFixes[0].source === 'memory',
      'memory fix is ranked first'
    );
  });

  run.catch(err => {
    console.log(`  ❌ Test 4 threw: ${err.message}`);
    failed += 4;
  });

  // Cleanup temp dir after test
  run.finally(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) { /* ignore */ }
  });

  global._testPromises.push(run);
}

// ── Test 5: Source context display ───────────────────────────────

console.log('\n══════════════════════════════════════════════════════════');
console.log('Test 5: Source context display — correct lines with ±2');
console.log('══════════════════════════════════════════════════════════');

{
  const m = makeMockMender([]);

  // 10-line source
  const source = [
    'event apple',
    'matter',
    '  name is apple',
    'end',
    'event banana',
    'matter',
    '  name is banana',
    'end',
    'layer fruits',
    'end',
  ].join('\n');

  // Capture console output
  const outputLines = [];
  const origLog = console.log;
  console.log = (line) => outputLines.push(line == null ? '' : String(line));

  // Show context for line 5 ("event banana") — expect lines 3–7 (±2)
  m._showSourceContext(source, 5);

  console.log = origLog;

  // Line 5 should be marked with >>>
  const markedLine = outputLines.find(l => l.includes('>>>') && l.includes('5'));
  assert(!!markedLine, 'error line 5 is marked with >>>');

  // Should include line 3 (two before)
  const line3 = outputLines.find(l => l.includes('Line   3') || l.includes('Line 3'));
  assert(!!line3, 'line 3 is shown (2 lines before error)');

  // Should include line 7 (two after)
  const line7 = outputLines.find(l => l.includes('Line   7') || l.includes('Line 7'));
  assert(!!line7, 'line 7 is shown (2 lines after error)');

  // Should NOT include line 1 (3 before — out of range for ±2)
  const line1 = outputLines.find(l => /Line\s+1[^\d]/.test(l));
  assert(!line1, 'line 1 is NOT shown (outside ±2 range)');

  // Should NOT include line 9 (4 after — out of range for ±2)
  const line9 = outputLines.find(l => /Line\s+9[^\d]/.test(l));
  assert(!line9, 'line 9 is NOT shown (outside ±2 range)');

  // Extract line number helper
  assertEqual(m._extractLineNumber('Line 7: something broke here'), 7, '_extractLineNumber finds "Line N"');
  assertEqual(m._extractLineNumber('[line 12] unexpected end'), 12, '_extractLineNumber finds "[line N]"');
  assertEqual(m._extractLineNumber('no line info here'), null, '_extractLineNumber returns null when absent');
}

// ── Final results ─────────────────────────────────────────────────

// Wait for all async tests to finish
Promise.all(global._testPromises || []).then(() => {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);

  if (failed === 0) {
    console.log('\n✅ All mender tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some mender tests failed.\n');
    process.exit(1);
  }
}).catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
