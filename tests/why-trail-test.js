'use strict';
/**
 * EventMath v2.31 — why over trails (the relocated memory explains itself)
 *
 * The world records who laid what onto each trail. "why TRAIL in WORLD" traces
 * a trail's strength back to its deposits — by contributor — and accounts for
 * decay. The memory is not just stored in the world, it is accountable.
 *   why TRAIL in WORLD [into NAME]
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');
const { EventMathValidator } = require('../src/validator.js');
const EM = require('../runtime/eventmath-runtime.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    if (detail !== undefined) console.error(`       got: ${JSON.stringify(detail)}`);
    failed++;
  }
}

function tokenize(src) { return new EventMathTokenizer().tokenize(src); }
function parse(src)    { return new EventMathParser(tokenize(src)).parse(); }
function compile(src)  { return new EventMathCodeGen().generate(parse(src)); }
function format(src)   { return new EventMathFormatter().format(parse(src)); }
function validate(src) { const v = new EventMathValidator(); return v.validate(parse(src)); }

function runCode(src) {
  const js = compile(src);
  const fn = new Function('require', 'console', 'module',
    js + '\nreturn typeof report !== "undefined" ? report : null;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

const PROGRAM = [
  'world meadow',
  'trail food in meadow by 1',
  'forage scout on meadow',
  '  sense food into strength',
  '  when strength is more than 0',
  '    trail food by 2',
  '  end',
  'end',
  'step scout 4 times',
].join('\n');

// ── Runtime: the deposit ledger and trace ──────────────────────────────────────
console.log('\n─ Runtime: ledger + why ─');
{
  const w = new EM.EventMathWorld('meadow');
  w.lay('food', 1, 'hand');
  w.lay('food', 2, 'scout');
  w.lay('food', 2, 'scout');

  const trace = w.why('food');
  assert('trace reports current strength', trace.strength === 5, trace.strength);
  assert('trace totals all deposits', trace.totalDeposit === 5, trace.totalDeposit);
  assert('trace groups by contributor in first-seen order',
    trace.byContributor.length === 2 &&
    trace.byContributor[0].by === 'hand' &&
    trace.byContributor[1].by === 'scout', trace.byContributor);
  assert('contributor totals and visits aggregate',
    trace.byContributor[1].total === 4 && trace.byContributor[1].visits === 2, trace.byContributor[1]);

  w.fade(3); // food: 5 -> 2, decayed 3
  const t2 = w.why('food');
  assert('trace accounts for decay', t2.decayed === 3, t2.decayed);
  assert('strength reflects decay', t2.strength === 2, t2.strength);
  assert('render mentions decay', t2.render().indexOf('worn away 3') >= 0, t2.render());

  // lay defaults the contributor when none is given (v2.29 compatibility)
  const w2 = new EM.EventMathWorld('w');
  w2.lay('x', 1);
  assert('lay without a contributor defaults to hand', w2.why('x').byContributor[0].by === 'hand');

  // unknown trail
  const empty = w.why('water');
  assert('why on an unlaid trail says so', empty.render().indexOf('Nothing has been laid') >= 0, empty.render());
}

// ── Tokenizer / Parser: the two forms of why ───────────────────────────────────
console.log('\n─ Tokenizer / Parser ─');
{
  const tTrail = tokenize('why food in meadow');
  assert('why TRAIL in WORLD → WHY_TRAIL_STMT', tTrail[0].type === 'WHY_TRAIL_STMT', tTrail[0].type);
  assert('captures trail + world', tTrail[0].value.trail === 'food' && tTrail[0].value.world === 'meadow', tTrail[0].value);

  const tInto = tokenize('why food in meadow into report');
  assert('why ... into NAME captured', tInto[0].value.intoName === 'report', tInto[0].value);

  // the existing satisfaction form must still tokenize as WHY_STMT
  const tSat = tokenize('why fair payment is not satisfied in leverage chain into diagnosis');
  assert('satisfaction why still → WHY_STMT', tSat[0].type === 'WHY_STMT', tSat[0].type);

  const ast = parse('world meadow\ntrail food in meadow by 1\nwhy food in meadow into report');
  assert('WhyTrailStmt parsed', ast.statements[2].type === 'WhyTrailStmt' && ast.statements[2].intoName === 'report');
}

// ── Codegen ──────────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');
{
  const js = compile(PROGRAM + '\nwhy food in meadow');
  assert('forage deposits are attributed to the forager',
    js.indexOf("meadow.lay('food', 2, 'scout')") >= 0, 'no scout attribution');
  assert('top-level deposits are attributed to hand',
    js.indexOf("meadow.lay('food', 1, 'hand')") >= 0, 'no hand attribution');
  assert('why without into prints the trace', js.indexOf(".why('food').render()") >= 0);

  const js2 = compile(PROGRAM + '\nwhy food in meadow into report');
  assert('why into NAME assigns the trace', js2.indexOf("report = meadow.why('food')") >= 0);
  assert('why target is hoisted', js2.indexOf('let report') >= 0);
}

// ── Formatter (round-trip) ────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  const out = format('why food in meadow\nwhy food in meadow into report');
  assert('formats why TRAIL in WORLD', out.indexOf('why food in meadow') >= 0);
  assert('formats why ... into NAME', out.indexOf('why food in meadow into report') >= 0);
}

// ── Validator ──────────────────────────────────────────────────────────────────────
console.log('\n─ Validator ─');
{
  const v = validate(PROGRAM + '\nwhy food in meadow into report\nshow report');
  assert('why-trail program has no errors', v.errors.length === 0, v.errors);
}

// ── End-to-end ──────────────────────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');
{
  const { out } = runCode(PROGRAM + '\nwhy food in meadow');
  assert('trace narrates the emergent strength of 9', out.indexOf('food now measures 9') >= 0, out);
  assert('trace credits the stateless scout', /scout laid 8 over 4 visit/.test(out), out);
  assert('trace credits the by-hand seed', /hand laid 1 over 1 visit/.test(out), out);

  const captured = runCode(PROGRAM + '\nfade meadow by 5\nwhy food in meadow into report\nshow report');
  assert('captured trace is a real object', captured.result && captured.result.strength === 4, captured.result && captured.result.strength);
  assert('captured trace renders with decay', captured.out.indexOf('worn away 5') >= 0, captured.out);
}

// ── Summary ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
