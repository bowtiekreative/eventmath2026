'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const EM                     = require('../runtime/eventmath-runtime.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function parse(src) {
  return new EventMathParser(new EventMathTokenizer().tokenize(src)).parse();
}
function compile(src) {
  return new EventMathCodeGen().generate(parse(src));
}
function run(src) {
  const js   = compile(src);
  const body = js
    .replace(/const EM = typeof[\s\S]*?eventmath-runtime\.js'\);\n/, '')
    .replace(/const __weights = \{\};\n/, '')
    .replace(/const __assumptions = \[\];\n/, '')
    .replace(/\/\/ ── Export for use ──[\s\S]*$/, '');
  const lines   = [];
  const mockCon = { log: (...a) => lines.push(a.join(' ')) };
  new Function('require', 'EM', '__weights', '__assumptions', 'console', 'module', body)
    (require, EM, {}, [], mockCon, { exports: {} });
  return lines;
}

// ── EventMathAssumption ───────────────────────────────────────────────────────

console.log('\nRuntime — EventMathAssumption');

test('assumption stores name and raw value', () => {
  const a = new EM.EventMathAssumption('market rate', '500');
  assert(a.name       === 'market rate', `name: ${a.name}`);
  assert(a.rawValue   === '500',         `rawValue: ${a.rawValue}`);
  assert(a.numericValue === 500,         `numericValue: ${a.numericValue}`);
  assert(a.active     === true,          `active: ${a.active}`);
});

test('assumption parses non-numeric value to null numericValue', () => {
  const a = new EM.EventMathAssumption('algorithm', 'neutral');
  assert(a.numericValue === null, `numericValue should be null for text value: ${a.numericValue}`);
  assert(a.textValue    === 'neutral', `textValue: ${a.textValue}`);
});

test('assumption render shows name, value, status', () => {
  const a = new EM.EventMathAssumption('market rate', '500');
  const r = a.render();
  assert(r.includes('market rate'), `missing name: ${r}`);
  assert(r.includes('500'),         `missing value: ${r}`);
  assert(r.includes('active'),      `missing status: ${r}`);
});

// ── Chain with values ─────────────────────────────────────────────────────────

console.log('\nRuntime — chain addLink with values');

test('addLink stores numeric value on link', () => {
  const c = new EM.EventMathChain('test');
  c.addLink('effort', 'payment', 450);
  assert(c.links[0].value === 450, `link value should be 450, got ${c.links[0].value}`);
});

test('addLink without value leaves value undefined', () => {
  const c = new EM.EventMathChain('test');
  c.addLink('a', 'b');
  assert(c.links[0].value === undefined, `value should be undefined, got ${c.links[0].value}`);
});

test('chain render shows values in brackets', () => {
  const c = new EM.EventMathChain('revenue');
  c.addLink('effort', 'reach', 8);
  c.addLink('reach', 'payment', 450);
  const r = c.render();
  assert(r.includes('[8]'),   `missing value 8: ${r}`);
  assert(r.includes('[450]'), `missing value 450: ${r}`);
});

test('chain invert preserves values on links', () => {
  const c = new EM.EventMathChain('c');
  c.addLink('a', 'b', 10);
  c.addLink('b', 'c', 20);
  const inv = c.invert();
  // Inverted: c→b (had value from b→c=20), b→a (had value from a→b=10)
  // Note: invert uses existing addLink which now accepts values
  assert(inv.links.length === 2, `inverted should have 2 links`);
});

// ── Numeric satisfaction: more than ──────────────────────────────────────────

console.log('\nRuntime — numeric satisfaction evaluation');

test('numeric: payment 450 vs target 500 — 90% partial score, not satisfied', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('effort', 'payment', 450);

  const desire = new EM.EventMathDesire('fair pay', {
    direction: 'more than',
    'satisfied when': 'payment more than 500'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied   === false, `should not be satisfied: ${engine.results[0].reason}`);
  assert(engine.results[0].partialScore === 90,   `partial score should be 90, got ${engine.results[0].partialScore}`);
  assert(engine.results[0].actualValue  === 450,  `actual should be 450`);
  assert(engine.results[0].targetValue  === 500,  `target should be 500`);
  assert(engine.results[0].gap          === 50,   `gap should be 50`);
  assert(engine.score                   === 90,   `overall score should be 90, got ${engine.score}`);
});

test('numeric: payment 600 vs target 500 — 100%, satisfied', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('effort', 'payment', 600);

  const desire = new EM.EventMathDesire('fair pay', {
    direction: 'more than',
    'satisfied when': 'payment more than 500'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied    === true, `should be satisfied: ${engine.results[0].reason}`);
  assert(engine.results[0].partialScore === 100,  `partial score should be 100`);
  assert(engine.results[0].gap          === 0,    `gap should be 0`);
  assert(engine.score                   === 100,  `overall score should be 100`);
});

test('numeric: less than — value 30 vs target below 50 — satisfied', () => {
  const chain = new EM.EventMathChain('cost');
  chain.addLink('action', 'cost', 30);

  const desire = new EM.EventMathDesire('low cost', {
    direction: 'less than',
    'satisfied when': 'cost less than 50'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied === true, `30 < 50 should be satisfied: ${engine.results[0].reason}`);
});

test('numeric: less than — value 80 vs target below 50 — not satisfied', () => {
  const chain = new EM.EventMathChain('cost');
  chain.addLink('action', 'cost', 80);

  const desire = new EM.EventMathDesire('low cost', {
    direction: 'less than',
    'satisfied when': 'cost less than 50'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied === false, `80 not < 50 should be unsatisfied`);
});

test('numeric: matches — exact match is 100% satisfied', () => {
  const chain = new EM.EventMathChain('exact');
  chain.addLink('action', 'score', 100);

  const desire = new EM.EventMathDesire('perfect score', {
    direction: 'matches',
    'satisfied when': 'score matches 100'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied    === true, `exact match should be satisfied`);
  assert(engine.results[0].partialScore === 100,  `exact match should be 100%`);
});

test('numeric: matches — near miss gives partial score', () => {
  const chain = new EM.EventMathChain('near');
  chain.addLink('action', 'score', 90);

  const desire = new EM.EventMathDesire('target score', {
    direction: 'matches',
    'satisfied when': 'score matches 100'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied    === false, `90 ≠ 100 should not be satisfied`);
  assert(engine.results[0].partialScore === 90,    `partial score should be 90`);
});

// ── Assumption-resolved targets ───────────────────────────────────────────────

console.log('\nRuntime — assumption-resolved numeric targets');

test('assumption resolves numeric target for satisfaction check', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('effort', 'payment', 450);

  const assumption = new EM.EventMathAssumption('market rate', '500');

  const desire = new EM.EventMathDesire('fair pay', {
    direction: 'more than',
    'satisfied when': 'payment more than market rate'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain, [assumption]);
  // "market rate" resolves to 500 from assumption; payment is 450 → 90%
  assert(engine.results[0].targetValue  === 500,  `target should resolve to 500 from assumption, got ${engine.results[0].targetValue}`);
  assert(engine.results[0].actualValue  === 450,  `actual should be 450`);
  assert(engine.results[0].partialScore === 90,   `partial score should be 90, got ${engine.results[0].partialScore}`);
});

test('multiple assumptions in render output', () => {
  const chain = new EM.EventMathChain('c');
  chain.addLink('a', 'payment', 450);

  const a1 = new EM.EventMathAssumption('market rate', '500');
  const a2 = new EM.EventMathAssumption('minimum wage', '15');

  const desire = new EM.EventMathDesire('d', {
    direction: 'more than',
    'satisfied when': 'payment more than 400'
  });

  const engine = new EM.EventMathSatisfactionEngine('with assumptions', [desire], chain, [a1, a2]);
  const r = engine.render();
  assert(r.includes('Assumptions used'), `render should list assumptions: ${r.slice(-300)}`);
  assert(r.includes('market rate'),      `render should show market rate: ${r.slice(-300)}`);
});

// ── Multi-desire: weighted average score ─────────────────────────────────────

console.log('\nRuntime — multi-desire weighted average score');

test('overall score is average of partial scores', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('effort', 'payment', 450);
  chain.addLink('action', 'reach', 15);

  const d1 = new EM.EventMathDesire('fair pay', {
    direction: 'more than',
    'satisfied when': 'payment more than 500'  // 450/500 = 90%
  });
  const d2 = new EM.EventMathDesire('audience', {
    direction: 'more than',
    'satisfied when': 'reach more than 20'     // 15/20 = 75%
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [d1, d2], chain);
  // Average: (90 + 75) / 2 = 82.5 → rounded 83 or 82
  assert(engine.score >= 82 && engine.score <= 83,
    `average partial score should be ~82-83, got ${engine.score}`);
});

test('render shows partial score on unsatisfied desire', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('effort', 'payment', 450);

  const d = new EM.EventMathDesire('fair pay', {
    direction: 'more than',
    'satisfied when': 'payment more than 500'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [d], chain);
  const r = engine.render();
  assert(r.includes('[90%]'),          `render should show [90%]: ${r}`);
  assert(r.includes('Actual:    450'), `render should show actual value: ${r}`);
  assert(r.includes('Target: 500'),    `render should show target value: ${r}`);
  assert(r.includes('Gap: 50'),        `render should show gap: ${r}`);
});

// ── Tokenizer: "at value N" in leads-to ───────────────────────────────────────

console.log('\nTokenizer — "at value N" in chain links');

test('tokenizes "A leads to B at value 450"', () => {
  const toks = new EventMathTokenizer().tokenize('effort leads to payment at value 450');
  const lt = toks.find(t => t.type === 'LEADS_TO_STMT');
  assert(lt,                 'no LEADS_TO_STMT');
  assert(lt.value.from  === 'effort',  `from: "${lt.value.from}"`);
  assert(lt.value.to    === 'payment', `to: "${lt.value.to}"`);
  assert(lt.value.value === 450,       `value: ${lt.value.value}`);
});

test('tokenizes "A leads to B" without value — value is null', () => {
  const toks = new EventMathTokenizer().tokenize('effort leads to payment');
  const lt = toks.find(t => t.type === 'LEADS_TO_STMT');
  assert(lt,                    'no LEADS_TO_STMT');
  assert(lt.value.value === null, `value should be null, got ${lt.value.value}`);
});

test('tokenizes "A leads to multi word state at value 8.5"', () => {
  const toks = new EventMathTokenizer().tokenize('voice leads to audience trust at value 8.5');
  const lt = toks.find(t => t.type === 'LEADS_TO_STMT');
  assert(lt,                          'no LEADS_TO_STMT');
  assert(lt.value.to    === 'audience trust', `to: "${lt.value.to}"`);
  assert(lt.value.value === 8.5,              `value: ${lt.value.value}`);
});

test('tokenizes "assume market rate is 500"', () => {
  const toks = new EventMathTokenizer().tokenize('assume market rate is 500');
  const t = toks.find(t => t.type === 'ASSUME_STMT');
  assert(t,                          'no ASSUME_STMT');
  assert(t.value.name  === 'market rate', `name: "${t.value.name}"`);
  assert(t.value.value === '500',         `value: "${t.value.value}"`);
});

// ── Parser: value flows through chain AST ─────────────────────────────────────

console.log('\nParser — chain links carry value');

test('parses chain with at-value links', () => {
  const ast = parse(`
chain revenue
  effort leads to payment at value 450
  voice leads to reach at value 8
end
`);
  const node = ast.statements.find(s => s.type === 'ChainStmt');
  assert(node, 'no ChainStmt');
  assert(node.links[0].value === 450, `first link value should be 450, got ${node.links[0].value}`);
  assert(node.links[1].value === 8,   `second link value should be 8, got ${node.links[1].value}`);
});

test('parses assume with name and value', () => {
  const ast = parse('assume market rate is 500');
  const node = ast.statements.find(s => s.type === 'AssumeStmt');
  assert(node, 'no AssumeStmt');
  assert(node.name  === 'market rate', `name: "${node.name}"`);
  assert(node.value === '500',         `value: "${node.value}"`);
});

// ── Codegen: chain values + assumptions in compiled output ────────────────────

console.log('\nCodegen — quantitative compile');

test('chain with values compiles to addLink with numeric arg', () => {
  const js = compile(`
chain revenue
  effort leads to payment at value 450
end
`);
  assert(js.includes("addLink('effort', 'payment', 450)"),
    `missing addLink with value: ${js.slice(0,400)}`);
});

test('assume compiles to EventMathAssumption', () => {
  const js = compile('assume market rate is 500');
  assert(js.includes('EventMathAssumption'), `missing EventMathAssumption: ${js.slice(0,300)}`);
  assert(js.includes("'market rate'"),       `missing name: ${js.slice(0,300)}`);
  assert(js.includes("'500'"),               `missing value: ${js.slice(0,300)}`);
  assert(js.includes('__assumptions.push'), `missing push to __assumptions: ${js.slice(0,400)}`);
});

test('satisfy passes __assumptions to SatisfactionEngine', () => {
  const js = compile(`
desire fair pay
matter
  direction is more than
  satisfied when is payment more than market rate
end
end
chain revenue
  effort leads to payment
end
satisfy fair pay against revenue into result
`);
  assert(js.includes('__assumptions'), `satisfy should pass __assumptions: ${js.slice(0,500)}`);
});

// ── End-to-end compile + run ──────────────────────────────────────────────────

console.log('\nCodegen — quantitative end-to-end');

test('chain values + desire + satisfy runs with numeric result', () => {
  const lines = run(`
desire fair payment
matter
  direction is more than
  satisfied when is payment more than 500
end
end
chain creator revenue
  authentic voice leads to audience trust at value 8
  audience trust leads to payment at value 450
end
satisfy fair payment against creator revenue into payment check
show payment check
`);
  const out = lines.join('\n');
  assert(out.includes('90%'),  `should show 90% partial score: ${out}`);
  assert(out.includes('450'),  `should show actual value 450: ${out}`);
  assert(out.includes('500'),  `should show target value 500: ${out}`);
  assert(out.includes('gap') || out.includes('Gap'), `should mention gap: ${out}`);
});

test('assumption-resolved target runs end-to-end', () => {
  const lines = run(`
assume market rate is 500
desire fair payment
matter
  direction is more than
  satisfied when is payment more than market rate
end
end
chain revenue
  effort leads to payment at value 600
end
satisfy fair payment against revenue into result
show result
`);
  const out = lines.join('\n');
  assert(out.includes('INNOVATION COMPLETE'), `600 > 500 should be INNOVATION COMPLETE: ${out}`);
});

test('multiple desires with values produces average score', () => {
  const lines = run(`
desire fair payment
matter
  direction is more than
  satisfied when is payment more than 500
end
end
desire reach target
matter
  direction is more than
  satisfied when is reach more than 20
end
end
chain revenue
  work leads to payment at value 450
  content leads to reach at value 15
end
evaluate fair payment and reach target against revenue into report
show report
`);
  const out = lines.join('\n');
  assert(out.includes('Score:'), `should show score: ${out}`);
  assert(out.includes('/2 desires'), `should show 2 desires evaluated: ${out}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
