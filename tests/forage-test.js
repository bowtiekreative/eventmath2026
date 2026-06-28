'use strict';
/**
 * EventMath v2.30 — The forage block (a stateless rule) + step
 *
 * A forager is the rule, not the memory. It senses the world, lays a trail,
 * and keeps nothing. The headline guarantee: a forager holds no memory of its
 * own — durable in-agent state (`live`, `remember`) is forbidden inside it;
 * persistence must go through the world. Statements:
 *   forage NAME on WORLD ... end   — a stateless rule, world implicit in body
 *   step NAME [N times]            — run the forager (its state lives in WORLD)
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
    js + '\nreturn typeof meadow !== "undefined" ? meadow : null;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

const FORAGER = [
  'world meadow',
  'trail food in meadow by 1',
  'forage scout on meadow',
  '  sense food into strength',
  '  when strength is more than 0',
  '    trail food by 2',
  '  end',
  'end',
  'step scout 4 times',
  'show meadow',
].join('\n');

// ── Tokenizer ──────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');
{
  const t = tokenize('forage scout on meadow');
  assert('forage header tokenizes', t[0].type === 'FORAGE_HEADER', t[0].type);
  assert('forage captures name + world',
    t[0].value.name === 'scout' && t[0].value.world === 'meadow', t[0].value);

  const s = tokenize('step scout 4 times');
  assert('step tokenizes to STEP_STMT', s[0].type === 'STEP_STMT', s[0].type);
  assert('step captures times', s[0].value.name === 'scout' && s[0].value.times === 4, s[0].value);

  const s1 = tokenize('step scout');
  assert('step defaults to 1 time', s1[0].value.times === 1, s1[0].value);

  // implicit world inside forage
  const se = tokenize('sense food into strength');
  assert('sense allows implicit world', se[0].type === 'SENSE_STMT' && se[0].value.world === '', se[0].value);
  const tr = tokenize('trail food by 2');
  assert('trail allows implicit world', tr[0].type === 'TRAIL_STMT' && tr[0].value.world === '', tr[0].value);
  // explicit world still works
  const se2 = tokenize('sense food in meadow into strength');
  assert('sense keeps explicit world', se2[0].value.world === 'meadow', se2[0].value);
}

// ── Parser ──────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');
{
  const ast = parse(FORAGER);
  const forage = ast.statements.find(s => s.type === 'ForageStmt');
  assert('ForageStmt parsed', !!forage && forage.name === 'scout' && forage.world === 'meadow');
  assert('forage body collected', forage.body.length === 2, forage.body.length);
  assert('forage body has a when block', forage.body.some(s => s.type === 'When'));
  const step = ast.statements.find(s => s.type === 'StepStmt');
  assert('StepStmt parsed with times', step && step.times === 4, step);
}

// ── Codegen ──────────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');
{
  const js = compile(FORAGER);
  assert('emits a forage function', js.indexOf('function __forage_scout()') >= 0);
  assert('resolves implicit world in body', js.indexOf("meadow.sense('food')") >= 0);
  assert('resolves implicit world for trail', js.indexOf("meadow.lay('food', 2, 'scout')") >= 0);
  assert('step emits a loop', js.indexOf('__forage_scout()') >= 0 && js.indexOf('< 4;') >= 0);
}

// ── Formatter (round-trip) ────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  const out = format(FORAGER);
  assert('formats forage header', out.indexOf('forage scout on meadow') >= 0);
  assert('formats implicit-world sense', out.indexOf('sense food into strength') >= 0);
  assert('formats implicit-world trail', out.indexOf('trail food by 2') >= 0);
  assert('formats step N times', out.indexOf('step scout 4 times') >= 0);
  assert('forage block closes with end', /forage scout on meadow[\s\S]*end/.test(out));
}

// ── Validator: the statelessness guarantee ────────────────────────────────────────
console.log('\n─ Validator: statelessness guarantee ─');
{
  const ok = validate(FORAGER);
  assert('a well-formed forager has no errors', ok.errors.length === 0, ok.errors);

  const live = validate('world meadow\nforage bad on meadow\n  live rain hoard is 0\nend');
  assert('live rain inside forage is rejected',
    live.errors.some(e => e.indexOf('holds no memory') >= 0), live.errors);

  const rem = validate('world meadow\nforage bad on meadow\n  remember hoard as "h"\nend');
  assert('remember inside forage is rejected',
    rem.errors.some(e => e.indexOf('holds no memory') >= 0), rem.errors);

  const noWorld = validate('world meadow\nforage bad\n  sense food into x\nend');
  assert('forage without a world is rejected',
    noWorld.errors.some(e => e.indexOf('needs a world') >= 0), noWorld.errors);

  const looseSense = validate('world meadow\nsense food into x');
  assert('sense outside forage needs a world',
    looseSense.errors.some(e => e.indexOf('needs a world') >= 0), looseSense.errors);

  const unknownStep = validate('world meadow\nstep ghost');
  assert('step to an undeclared forager warns',
    unknownStep.warnings.some(w => w.indexOf('not declared') >= 0), unknownStep.warnings);

  // live rain is fine OUTSIDE a forage block
  const liveOk = validate('live rain price is 10');
  assert('live rain outside forage is allowed', liveOk.errors.length === 0, liveOk.errors);
}

// ── End-to-end: emergence with all state in the world ─────────────────────────────
console.log('\n─ End-to-end: emergence ─');
{
  const { out, result } = runCode(FORAGER);
  assert('stateless scout amplified the trail to 9 (1 + 4×2)',
    result && result.sense('food') === 9, result && result.sense('food'));
  assert('the world renders the emergent memory', out.indexOf('food: 9') >= 0, out);

  // running again with decay — the strong memory survives
  const withFade = FORAGER + '\nfade meadow by 5\nshow meadow';
  const r2 = runCode(withFade);
  assert('after decay the strong trail persists at 4', r2.result.sense('food') === 4, r2.result.sense('food'));

  // statelessness proof: the forager keeps nothing between steps — the only
  // thing that changed across 4 steps is the world.
  const single = runCode([
    'world meadow',
    'trail food in meadow by 1',
    'forage scout on meadow',
    '  sense food into strength',
    '  trail food by 1',
    'end',
    'step scout',
    'step scout',
    'show meadow',
  ].join('\n'));
  assert('two separate steps both read+wrote the shared world (1→2→3)',
    single.result.sense('food') === 3, single.result.sense('food'));
}

// ── Summary ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
