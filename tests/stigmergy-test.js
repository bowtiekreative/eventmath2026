'use strict';
/**
 * EventMath v2.29 — The Stigmergy Layer (relocating memory)
 *
 * An animal is a near-stateless agent. Its memory lives in a shared analog
 * medium — the physical world — as trails. When the animal is gone, the trail
 * remains: the memory never disappears, it relocates. Statements:
 *   world NAME              — declare the shared analog memory
 *   animal NAME             — declare a stateless agent
 *   trail NAME in WORLD by N — lay (deposit) onto a trail
 *   sense NAME in WORLD into LOCAL — stateless read of a trail
 *   fade WORLD by N         — analog decay (never disappears)
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
function validate(src) { const v = new EventMathValidator(); v.validate(parse(src)); return v; }

function runCode(src) {
  const js = compile(src);
  const fn = new Function('require', 'console', 'module',
    js + '\nreturn typeof meadow !== "undefined" ? meadow : null;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

// ── Runtime unit tests ────────────────────────────────────────────────────────
console.log('\n─ Runtime: EventMathWorld ─');
{
  const w = new EM.EventMathWorld('meadow');
  assert('world starts empty', Object.keys(w.trails).length === 0);
  assert('sensing an absent trail returns 0', w.sense('food') === 0, w.sense('food'));

  w.lay('food', 1);
  assert('lay deposits strength', w.sense('food') === 1, w.sense('food'));

  w.lay('food', 2);
  assert('lay accumulates (reinforcement)', w.sense('food') === 3, w.sense('food'));

  w.lay('water', 5);
  assert('separate trails are independent', w.sense('water') === 5, w.sense('water'));

  w.fade(1);
  assert('fade weakens every trail', w.sense('food') === 2 && w.sense('water') === 4,
    [w.sense('food'), w.sense('water')]);

  w.fade(10);
  assert('fade floors at 0 — never goes negative', w.sense('food') === 0, w.sense('food'));
  assert('faded trail still exists (memory never disappears)',
    Object.prototype.hasOwnProperty.call(w.trails, 'food'), Object.keys(w.trails));

  assert('render shows the world name', w.render().indexOf('meadow') >= 0);
}

console.log('\n─ Runtime: EventMathAnimal ─');
{
  const a = new EM.EventMathAnimal('ant');
  assert('animal is stateless', a.isStateless() === true);
  assert('animal state is frozen empty', Object.keys(a.state).length === 0);
  assert('animal cannot gain internal state', (function () {
    'use strict';
    try { a.state.x = 1; } catch (_e) {}
    return Object.keys(a.state).length === 0;
  })());
  assert('render names the animal', a.render().indexOf('ant') >= 0);
}

// ── Memory relocates: animal gone, world persists ──────────────────────────────
console.log('\n─ Concept: memory relocates from animal to world ─');
{
  const w = new EM.EventMathWorld('meadow');
  (function oneAnimalLives() {
    const ant = new EM.EventMathAnimal('ant');
    const here = w.sense('food'); // stateless read
    w.lay('food', here + 1);      // lay, then leave
  })(); // the animal is now gone — it held nothing
  assert('after the animal is gone, the trail remains', w.sense('food') === 1, w.sense('food'));
}

// ── Tokenizer ──────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');
{
  const t1 = tokenize('world meadow');
  assert('world tokenizes to KEYWORD + NAME', t1[0].type === 'KEYWORD' && t1[0].value === 'world');

  const t2 = tokenize('animal ant');
  assert('animal tokenizes to KEYWORD', t2[0].type === 'KEYWORD' && t2[0].value === 'animal');

  const t3 = tokenize('trail food in meadow by 1');
  assert('trail tokenizes to TRAIL_STMT', t3[0].type === 'TRAIL_STMT', t3[0].type);
  assert('trail captures name/world/amount',
    t3[0].value.name === 'food' && t3[0].value.world === 'meadow' && t3[0].value.amount === '1',
    t3[0].value);

  const t4 = tokenize('sense food in meadow into here');
  assert('sense tokenizes to SENSE_STMT', t4[0].type === 'SENSE_STMT', t4[0].type);
  assert('sense captures into target', t4[0].value.intoName === 'here', t4[0].value);

  const t5 = tokenize('fade meadow by 2');
  assert('fade tokenizes to FADE_STMT', t5[0].type === 'FADE_STMT', t5[0].type);
  assert('fade captures world/amount', t5[0].value.world === 'meadow' && t5[0].value.amount === '2', t5[0].value);
}

// ── Parser ──────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');
{
  const ast = parse('world meadow\nanimal ant\ntrail food in meadow by 1\nsense food in meadow into here\nfade meadow by 1');
  assert('WorldStmt parsed', ast.statements[0].type === 'WorldStmt' && ast.statements[0].name === 'meadow');
  assert('AnimalStmt parsed', ast.statements[1].type === 'AnimalStmt' && ast.statements[1].name === 'ant');
  assert('TrailStmt parsed', ast.statements[2].type === 'TrailStmt' && ast.statements[2].world === 'meadow');
  assert('SenseStmt parsed', ast.statements[3].type === 'SenseStmt' && ast.statements[3].intoName === 'here');
  assert('FadeStmt parsed', ast.statements[4].type === 'FadeStmt' && ast.statements[4].amount === '1');
}

// ── Codegen ──────────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');
{
  const js = compile('world meadow\nanimal ant\ntrail food in meadow by 1\nsense food in meadow into here\nfade meadow by 1');
  assert('emits EventMathWorld', js.indexOf('new EM.EventMathWorld') >= 0);
  assert('emits EventMathAnimal', js.indexOf('new EM.EventMathAnimal') >= 0);
  assert('emits .lay()', js.indexOf(".lay('food', 1, 'hand')") >= 0);
  assert('emits .sense()', js.indexOf(".sense('food')") >= 0);
  assert('emits .fade()', js.indexOf('.fade(1)') >= 0);
  assert('hoists the sense target', js.indexOf('let here') >= 0);
}

// ── Formatter (round-trip) ────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  const src = 'world meadow\nanimal ant\ntrail food in meadow by 1\nsense food in meadow into here\nfade meadow by 1';
  const out = format(src);
  assert('formats world', out.indexOf('world meadow') >= 0);
  assert('formats animal', out.indexOf('animal ant') >= 0);
  assert('formats trail', out.indexOf('trail food in meadow by 1') >= 0);
  assert('formats sense', out.indexOf('sense food in meadow into here') >= 0);
  assert('formats fade', out.indexOf('fade meadow by 1') >= 0);
}

// ── Validator ──────────────────────────────────────────────────────────────────────
console.log('\n─ Validator ─');
{
  const v = validate('world meadow\nanimal ant\ntrail food in meadow by 1\nsense food in meadow into total\nshow total');
  assert('valid program has no errors', v.errors.length === 0, v.errors);
}

// ── End-to-end ──────────────────────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');
{
  const src = [
    'world meadow',
    'animal ant',
    'animal beetle',
    'sense food in meadow into here',
    'trail food in meadow by 1',
    'sense food in meadow into here',
    'trail food in meadow by 1',
    'sense food in meadow into total',
    'show meadow',
  ].join('\n');
  const { out, result } = runCode(src);
  assert('two stateless animals built a shared count of 2', result && result.sense('food') === 2,
    result && result.sense('food'));
  assert('the world renders its memory', out.indexOf('food: 2') >= 0, out);

  // fade then read back — memory weakened but persists
  const src2 = src + '\nfade meadow by 1\nshow meadow';
  const r2 = runCode(src2);
  assert('after fade the memory persists at 1', r2.result.sense('food') === 1, r2.result.sense('food'));
}

// ── Summary ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
