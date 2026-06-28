'use strict';
/**
 * EventMath v2.32 — colony + march (consensus no single forager chose)
 *
 * A colony is a population of stateless foragers sharing one world, with
 * evaporation between rounds. Marching it produces emergent consensus:
 * reinforcement piles onto the stronger trail, decay erases the rest, and the
 * colony converges on a choice no single forager made.
 *   colony NAME of COUNT on WORLD [fade F] ... end
 *   march NAME [R rounds]
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');
const { EventMathValidator } = require('../src/validator.js');

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
    js + '\nreturn typeof paths !== "undefined" ? paths : null;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

const PROGRAM = [
  'world paths',
  'trail short in paths by 2',
  'trail long in paths by 1',
  'colony ants of 10 on paths fade 4',
  '  sense short into s',
  '  sense long into l',
  '  when s is more than l',
  '    trail short by 6',
  '  end',
  '  when l is more than s',
  '    trail long by 3',
  '  end',
  'end',
  'march ants 3 rounds',
].join('\n');

// ── Tokenizer ──────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');
{
  const c = tokenize('colony ants of 10 on paths fade 4');
  assert('colony header tokenizes', c[0].type === 'COLONY_HEADER', c[0].type);
  assert('colony captures name/count/world/fade',
    c[0].value.name === 'ants' && c[0].value.count === '10' &&
    c[0].value.world === 'paths' && c[0].value.fade === '4', c[0].value);

  const c2 = tokenize('colony ants of 5 on meadow');
  assert('colony fade defaults to 0', c2[0].value.fade === '0', c2[0].value);

  const m = tokenize('march ants 3 rounds');
  assert('march tokenizes to MARCH_STMT', m[0].type === 'MARCH_STMT', m[0].type);
  assert('march captures rounds', m[0].value.name === 'ants' && m[0].value.rounds === 3, m[0].value);

  const m1 = tokenize('march ants');
  assert('march defaults to 1 round', m1[0].value.rounds === 1, m1[0].value);
}

// ── Parser ──────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');
{
  const ast = parse(PROGRAM);
  const colony = ast.statements.find(s => s.type === 'ColonyStmt');
  assert('ColonyStmt parsed', !!colony && colony.name === 'ants' && colony.count === '10');
  assert('colony keeps world + fade', colony.world === 'paths' && colony.fade === '4');
  assert('colony body collected', colony.body.length === 4, colony.body.length);
  const march = ast.statements.find(s => s.type === 'MarchStmt');
  assert('MarchStmt parsed with rounds', march && march.rounds === 3, march);
}

// ── Codegen ──────────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');
{
  const js = compile(PROGRAM);
  assert('colony compiles to a forager function', js.indexOf('function __forage_ants()') >= 0);
  assert('deposits attributed to the colony', js.indexOf("paths.lay('short', 6, 'ants')") >= 0);
  assert('march loops rounds', js.indexOf('for (let __r = 0; __r < 3;') >= 0);
  assert('each round runs the whole population', js.indexOf('for (let __a = 0; __a < 10;') >= 0);
  assert('evaporation applied each round', js.indexOf('paths.fade(4)') >= 0);
}

// ── Formatter (round-trip) ────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  const out = format(PROGRAM);
  assert('formats colony header with fade', out.indexOf('colony ants of 10 on paths fade 4') >= 0);
  assert('formats march N rounds', out.indexOf('march ants 3 rounds') >= 0);
  assert('colony block closes with end', /colony ants of 10 on paths fade 4[\s\S]*end/.test(out));
  // no-fade colony omits the clause
  const out2 = format('world w\ncolony c of 3 on w\n  sense x into y\nend');
  assert('no-fade colony omits fade clause', /colony c of 3 on w\n/.test(out2) && out2.indexOf('fade') < 0, out2);
}

// ── Validator ──────────────────────────────────────────────────────────────────────
console.log('\n─ Validator ─');
{
  const ok = validate(PROGRAM);
  assert('a well-formed colony has no errors', ok.errors.length === 0, ok.errors);

  const live = validate('world w\ncolony c of 3 on w\n  live rain hoard is 0\nend');
  assert('colony enforces statelessness (no live)',
    live.errors.some(e => e.indexOf('holds no memory') >= 0), live.errors);

  const noWorld = validate('world w\ncolony c of 3\n  sense x into y\nend');
  assert('colony without a world is rejected',
    noWorld.errors.some(e => e.indexOf('needs a world') >= 0), noWorld.errors);

  const ghost = validate('world w\nmarch ghosts 2 rounds');
  assert('march to an undeclared colony warns',
    ghost.warnings.some(w => w.indexOf('not declared') >= 0), ghost.warnings);
}

// ── End-to-end: emergent consensus ────────────────────────────────────────────────
console.log('\n─ End-to-end: consensus ─');
{
  const { out, result } = runCode(PROGRAM + '\nshow paths');
  assert('the colony converged on the short route', result.sense('short') === 170, result.sense('short'));
  assert('the long route evaporated to 0', result.sense('long') === 0, result.sense('long'));
  assert('world shows the decision', out.indexOf('short: 170') >= 0 && out.indexOf('long: 0') >= 0, out);

  // why explains the colony's choice
  const w = runCode(PROGRAM + '\nwhy short in paths\nwhy long in paths');
  assert('why credits the population (30 visits)', /ants laid 180 over 30 visit/.test(w.out), w.out);
  assert('why shows the loser got no colony reinforcement',
    w.out.indexOf('long now measures 0') >= 0, w.out);

  // a smaller, slower march has not yet converged — consensus takes rounds
  const oneRound = runCode([
    'world paths',
    'trail short in paths by 2',
    'trail long in paths by 1',
    'colony ants of 1 on paths fade 1',
    '  sense short into s',
    '  sense long into l',
    '  when s is more than l',
    '    trail short by 3',
    '  end',
    'end',
    'march ants',
    'show paths',
  ].join('\n'));
  assert('one ant, one round: short=2+3-1=4', oneRound.result.sense('short') === 4, oneRound.result.sense('short'));
  assert('one round: long fades 1→0', oneRound.result.sense('long') === 0, oneRound.result.sense('long'));
}

// ── Summary ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
