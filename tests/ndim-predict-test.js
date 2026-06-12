'use strict';
/**
 * EventMath v2.5 — N-dimensional predict + through FRACTAL routing
 * Tests that predict now accepts any number of condition dimensions
 * and that 'through FRACTAL' routes them through the three structural tiers.
 */

const { EventMathTokenizer }  = require('../src/tokenizer.js');
const { EventMathParser }     = require('../src/parser.js');
const { EventMathCodeGen }    = require('../src/codegen.js');
const { EventMathFormatter }  = require('../src/formatter.js');
const { EventMathValidator }  = require('../src/validator.js');

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
function format(src) {
  const ast = parse(src);
  return new EventMathFormatter().format(ast);
}
function validate(src) {
  const ast = parse(src);
  return new EventMathValidator().validate(ast);
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

{
  const tokens = tokenize('predict blueprint across industry and price and awareness into results');
  const types  = tokens.map(t => `${t.type}:${t.value}`);
  assert('3-dim single-line: predict keyword first',
    types[0] === 'KEYWORD:predict');
  assert('3-dim single-line: subject NAME',
    types[1] === 'NAME:blueprint');
  assert('3-dim single-line: across keyword',
    types[2] === 'KEYWORD:across');
  assert('3-dim single-line: first dim',
    types[3] === 'NAME:industry');
  assert('3-dim single-line: and keyword',
    types[4] === 'KEYWORD:and');
  assert('3-dim single-line: second dim',
    types[5] === 'NAME:price');
  assert('3-dim single-line: and keyword (2)',
    types[6] === 'KEYWORD:and');
  assert('3-dim single-line: third dim',
    types[7] === 'NAME:awareness');
  assert('3-dim single-line: into keyword',
    types[8] === 'KEYWORD:into');
  assert('3-dim single-line: result NAME',
    types[9] === 'NAME:results');
}

{
  const tokens = tokenize('predict blueprint across industry and price and awareness and frequency through leverage axis into predictions');
  const types  = tokens.map(t => `${t.type}:${t.value}`);
  assert('4-dim + through: emits through keyword',
    types.some(t => t === 'KEYWORD:through'));
  assert('4-dim + through: fractal name present',
    types.some(t => t === 'NAME:leverage axis'));
  assert('4-dim + through: 4 dimension NAME tokens before through',
    types.filter(t => t === 'KEYWORD:and').length === 3);
}

{
  const tokens = tokenize('predict blueprint across d1 and d2 and d3 and d4 and d5 and d6 into out');
  assert('6-dim no through: emits 5 "and" keywords',
    tokens.filter(t => t.type === 'KEYWORD' && t.value === 'and').length === 5);
  assert('6-dim no through: no through keyword',
    !tokens.some(t => t.type === 'KEYWORD' && t.value === 'through'));
}

// multi-line with through
{
  const src = 'predict blueprint\nacross industry\nand price\nand awareness\nthrough leverage axis\ninto predictions';
  const tokens = tokenize(src);
  assert('multi-line through: through keyword emitted',
    tokens.some(t => t.type === 'KEYWORD' && t.value === 'through'));
  assert('multi-line through: fractal name captured',
    tokens.some(t => t.type === 'NAME' && t.value === 'leverage axis'));
}

// ── Parser ────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

{
  const ast = parse('predict blueprint across industry and price and awareness into results');
  const stmt = ast.statements[0];
  assert('3-dim parse: type is PredictStmt', stmt.type === 'PredictStmt');
  assert('3-dim parse: dimensions array length 3',
    stmt.dimensions && stmt.dimensions.length === 3, stmt.dimensions);
  assert('3-dim parse: dimensions[0] = industry',
    stmt.dimensions && stmt.dimensions[0] === 'industry');
  assert('3-dim parse: dimensions[2] = awareness',
    stmt.dimensions && stmt.dimensions[2] === 'awareness');
  assert('3-dim parse: no fractalName', stmt.fractalName === null);
  assert('3-dim parse: backward compat directionsLayer', stmt.directionsLayer === 'industry');
  assert('3-dim parse: backward compat lensesLayer', stmt.lensesLayer === 'price');
  assert('3-dim parse: backward compat quantitiesLayer', stmt.quantitiesLayer === 'awareness');
}

{
  const ast = parse('predict blueprint across industry and price and awareness and frequency through leverage axis into predictions');
  const stmt = ast.statements[0];
  assert('4-dim + through parse: dimensions length 4',
    stmt.dimensions && stmt.dimensions.length === 4, stmt.dimensions);
  assert('4-dim + through parse: fractalName set',
    stmt.fractalName === 'leverage axis', stmt.fractalName);
  assert('4-dim + through parse: intoLayer correct',
    stmt.intoLayer === 'predictions', stmt.intoLayer);
}

{
  const src = 'predict blueprint\nacross industry\nand price\nand awareness\nand frequency\nand mindset\nand channel\nthrough leverage axis\ninto predictions';
  const ast  = parse(src);
  const stmt = ast.statements[0];
  assert('6-dim multi-line: dimensions length 6',
    stmt.dimensions && stmt.dimensions.length === 6, stmt.dimensions);
  assert('6-dim multi-line: fractalName set',
    stmt.fractalName === 'leverage axis');
}

// ── Codegen ───────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

{
  const js = compile('predict blueprint across industry and price and awareness into results');
  assert('3-dim codegen: emits industry forEach',
    js.includes('industry.events.forEach'));
  assert('3-dim codegen: emits price forEach',
    js.includes('price.events.forEach'));
  assert('3-dim codegen: emits awareness forEach',
    js.includes('awareness.events.forEach'));
  assert('3-dim codegen: no through comment (flat)',
    js.includes('flat'));
  assert('3-dim codegen: backward compat direction field',
    js.includes('direction:'));
}

{
  const js = compile('predict blueprint across industry and price and awareness and frequency through leverage axis into predictions');
  assert('4-dim through codegen: emits frequency forEach',
    js.includes('frequency.events.forEach'));
  assert('4-dim through codegen: emits _tierCtx',
    js.includes('_tierCtx'));
  assert('4-dim through codegen: tier1 check for D±13',
    js.includes('>= 13'));
  assert('4-dim through codegen: tier2 check for D±26',
    js.includes('>= 26'));
  assert('4-dim through codegen: tier3 check for D±39',
    js.includes('>= 39'));
  assert('4-dim through codegen: dimensions array in matter',
    js.includes("dimensions: ["));
  assert('4-dim through codegen: tier_routing in matter',
    js.includes('tier_routing: _tierCtx'));
}

{
  const src = ['predict funnel',
    'across industry', 'and price', 'and awareness',
    'and frequency', 'and channel', 'and mindset',
    'through leverage axis', 'into funnel predictions'].join('\n');
  const js = compile(src);
  const forEach = (js.match(/\.events\.forEach/g) || []).length;
  assert('6-dim codegen: 6 forEach loops generated', forEach === 6, forEach);
  assert('6-dim codegen: mindset forEach present',
    js.includes('mindset.events.forEach'));
}

// ── Formatter ─────────────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

{
  const src = 'predict blueprint across industry and price and awareness into results';
  const out = format(src);
  assert('formatter: 3-dim round-trips without through', out.includes('predict blueprint'));
  assert('formatter: first dim preserved', out.includes('across industry'));
  assert('formatter: no through in output', !out.includes('through'));
}

{
  const src = 'predict blueprint across industry and price and awareness and frequency through leverage axis into predictions';
  const out = format(src);
  assert('formatter: through clause preserved', out.includes('through leverage axis'));
  assert('formatter: 4th dim preserved', out.includes('and frequency'));
}

// ── Validator ─────────────────────────────────────────────────────────────────
console.log('\n─ Validator ─');

{
  const result = validate('predict blueprint across industry and price and awareness into results');
  assert('validator: 3-dim without through → no warning',
    result.warnings.length === 0, result.warnings);
}

{
  const src = 'predict blueprint across d1 and d2 and d3 and d4 into out';
  const result = validate(src);
  assert('validator: 4-dim without through → warning emitted',
    result.warnings.some(w => w.includes('through')), result.warnings);
  assert('validator: warning mentions three structural tiers',
    result.warnings.some(w => w.includes('three structural tiers')));
}

{
  const src = 'predict blueprint across d1 and d2 and d3 and d4 through my axis into out';
  const result = validate(src);
  assert('validator: 4-dim WITH through → no warning',
    result.warnings.length === 0, result.warnings);
}

// ── End-to-end: compile + run ─────────────────────────────────────────────────
console.log('\n─ End-to-end ─');

{
  const src = `
event saas
matter
  name is SaaS
end
end
event high price
matter
  name is High
end
end
event problem aware
matter
  name is Problem Aware
end
end
event frequent buyer
matter
  name is Frequent
end
end
layer industry conditions
  saas
end
layer price conditions
  high price
end
layer awareness conditions
  problem aware
end
layer frequency conditions
  frequent buyer
end
predict funnel blueprint across industry conditions and price conditions and awareness conditions and frequency conditions into funnel predictions
`;
  try {
    const js = compile(src);
    const fn = new Function('require', 'console', 'module', js + '\nreturn funnel_predictions;');
    let out = '';
    const fakeConsole = { log: s => { out += s + '\n'; } };
    const result = fn(require, fakeConsole, { exports: {} });
    assert('end-to-end 4-dim flat: runs without error', result !== undefined);
    assert('end-to-end 4-dim flat: 1×1×1×1 = 1 prediction', result && result.events && result.events.length === 1, result && result.events && result.events.length);
    assert('end-to-end 4-dim flat: has dimensions array on matter',
      result && result.events[0] && result.events[0].matter && Array.isArray(result.events[0].matter.dimensions));
    assert('end-to-end 4-dim flat: dimensions array length 4',
      result && result.events[0].matter.dimensions.length === 4);
  } catch (e) {
    assert('end-to-end 4-dim flat: runs without error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
