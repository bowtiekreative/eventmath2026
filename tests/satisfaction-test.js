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
    .replace(/\/\/ ── Export for use ──[\s\S]*$/, '');
  const lines  = [];
  const mockCon = { log: (...a) => lines.push(a.join(' ')) };
  new Function('require', 'EM', '__weights', 'console', 'module', body)
    (require, EM, {}, mockCon, { exports: {} });
  return lines;
}

// ── EventMathDesire: constructor + condition parsing ─────────────────────────

console.log('\nRuntime — EventMathDesire');

test('desire stores name, scenario, direction, satisfiedWhen', () => {
  const d = new EM.EventMathDesire('fair payment', {
    scenario: 'brand negotiation',
    subjective: 'I want to be paid what I am worth',
    outcome: 'payment at market rate',
    direction: 'matches',
    state: 'desired',
    'satisfied when': 'payment matches market rate'
  });
  assert(d.name      === 'fair payment',   `name: ${d.name}`);
  assert(d.scenario  === 'brand negotiation', `scenario: ${d.scenario}`);
  assert(d.direction === 'matches',        `direction: ${d.direction}`);
  assert(d.satisfiedWhen.includes('payment'), `satisfiedWhen: ${d.satisfiedWhen}`);
});

test('desire parses condition operator "matches"', () => {
  const d = new EM.EventMathDesire('test', { 'satisfied when': 'payment matches market rate' });
  assert(d._condition.operator === 'matches', `operator: ${d._condition.operator}`);
  assert(d._condition.subject  === 'payment', `subject: ${d._condition.subject}`);
  assert(d._condition.target   === 'market rate', `target: ${d._condition.target}`);
});

test('desire parses condition operator "more than"', () => {
  const d = new EM.EventMathDesire('growth', { 'satisfied when': 'reach more than 20 percent' });
  assert(d._condition.operator === 'more than', `operator: ${d._condition.operator}`);
  assert(d._condition.target   === '20 percent', `target: ${d._condition.target}`);
});

test('desire parses condition operator "does not match"', () => {
  const d = new EM.EventMathDesire('avoid', { 'satisfied when': 'outcome does not match rejected' });
  assert(d._condition.operator === 'does not match', `operator: ${d._condition.operator}`);
});

test('desire parses condition with no operator — uses direction as fallback', () => {
  const d = new EM.EventMathDesire('simple', {
    direction: 'matches',
    'satisfied when': 'payment received'
  });
  assert(d._condition.target === 'payment received', `target: ${d._condition.target}`);
});

test('desire render shows all fields', () => {
  const d = new EM.EventMathDesire('fair payment', {
    scenario: 'brand negotiation',
    subjective: 'want fair pay',
    outcome: 'payment at market rate',
    direction: 'matches',
    'satisfied when': 'payment matches rate'
  });
  const r = d.render();
  assert(r.includes('fair payment'),      `missing name: ${r}`);
  assert(r.includes('brand negotiation'), `missing scenario: ${r}`);
  assert(r.includes('matches'),          `missing direction: ${r}`);
  assert(r.includes('Satisfied when'),   `missing satisfied when: ${r}`);
});

// ── EventMathSatisfactionEngine: core evaluation ─────────────────────────────

console.log('\nRuntime — EventMathSatisfactionEngine');

test('satisfaction engine evaluates single satisfied desire', () => {
  const chain = new EM.EventMathChain('revenue');
  chain.addLink('audience trust', 'brand interest');
  chain.addLink('brand interest', 'payment');

  const desire = new EM.EventMathDesire('fair payment', {
    direction: 'matches',
    'satisfied when': 'payment matches market rate'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.score === 100, `score should be 100, got ${engine.score}`);
  assert(engine.gaps.length === 0, `should have no gaps`);
  assert(engine.results[0].satisfied === true, `first result should be satisfied`);
});

test('satisfaction engine reports gap when chain does not reach desire', () => {
  const chain = new EM.EventMathChain('short');
  chain.addLink('premise', 'intermediate');

  const desire = new EM.EventMathDesire('closure', {
    direction: 'matches',
    'satisfied when': 'final outcome matches resolution'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.score === 0, `score should be 0, got ${engine.score}`);
  assert(engine.gaps.length === 1, `should have 1 gap`);
  assert(engine.results[0].satisfied === false, `result should be unsatisfied`);
});

test('satisfaction engine evaluates multiple desires — partial score', () => {
  const chain = new EM.EventMathChain('partial');
  chain.addLink('authentic voice', 'audience trust');
  chain.addLink('audience trust', 'payment');

  const d1 = new EM.EventMathDesire('fair payment', {
    direction: 'matches',
    'satisfied when': 'payment matches market rate'
  });
  const d2 = new EM.EventMathDesire('audience growth', {
    direction: 'more',
    'satisfied when': 'reach more than 20 percent'
  });
  const d3 = new EM.EventMathDesire('brand deal', {
    direction: 'matches',
    'satisfied when': 'sponsorship matches target'
  });

  const engine = new EM.EventMathSatisfactionEngine('multi', [d1, d2, d3], chain);
  // d1: payment is terminal — satisfied
  // d2: direction=more, no "reach" or "increase" in chain — unsatisfied
  // d3: "sponsorship" not in chain — unsatisfied
  assert(engine.score > 0,  `score should be > 0, got ${engine.score}`);
  assert(engine.score < 100, `score should be < 100, got ${engine.score}`);
  assert(engine.gaps.length > 0, `should have gaps, got ${engine.gaps.length}`);
});

test('satisfaction engine with empty chain marks all desires unsatisfied', () => {
  const chain = new EM.EventMathChain('empty');

  const desire = new EM.EventMathDesire('payment', {
    direction: 'matches',
    'satisfied when': 'payment matches rate'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.score === 0, `empty chain should score 0`);
  assert(engine.results[0].reason.includes('No chain'), `reason should mention no chain: ${engine.results[0].reason}`);
});

test('satisfaction engine with null chain marks all desires unsatisfied', () => {
  const desire = new EM.EventMathDesire('test desire', {
    direction: 'matches',
    'satisfied when': 'something matches target'
  });
  const engine = new EM.EventMathSatisfactionEngine('test', [desire], null);
  assert(engine.score === 0, `null chain should score 0`);
});

test('direction "does not match" satisfied when target absent from chain', () => {
  const chain = new EM.EventMathChain('clean');
  chain.addLink('good premise', 'valid conclusion');

  const desire = new EM.EventMathDesire('avoid bad outcome', {
    direction: 'does not match',
    'satisfied when': 'rejection does not match outcome'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied === true,
    `"does not match" should be satisfied when target absent: ${engine.results[0].reason}`);
});

test('direction "does not match" violated when target present in chain', () => {
  const chain = new EM.EventMathChain('bad');
  chain.addLink('action', 'rejection');

  const desire = new EM.EventMathDesire('avoid rejection', {
    direction: 'does not match',
    'satisfied when': 'rejection does not match outcome'
  });

  const engine = new EM.EventMathSatisfactionEngine('test', [desire], chain);
  assert(engine.results[0].satisfied === false,
    `"does not match" should be violated when target present`);
});

test('no desires → score is 0, statusLine is NO DESIRES', () => {
  const chain = new EM.EventMathChain('c');
  chain.addLink('a', 'b');
  const engine = new EM.EventMathSatisfactionEngine('empty desires', [], chain);
  assert(engine.score === 0, `score should be 0`);
  const r = engine.render();
  assert(r.includes('NO DESIRES'), `statusLine should say NO DESIRES: ${r.slice(-100)}`);
});

// ── Render output ─────────────────────────────────────────────────────────────

console.log('\nRuntime — SatisfactionEngine render');

test('render shows score and desire results', () => {
  const chain = new EM.EventMathChain('r');
  chain.addLink('voice', 'payment');
  const d = new EM.EventMathDesire('get paid', {
    direction: 'matches',
    'satisfied when': 'payment matches rate'
  });
  const engine = new EM.EventMathSatisfactionEngine('pay check', [d], chain);
  const r = engine.render();
  assert(r.includes('Satisfaction Engine: pay check'), `missing header: ${r.slice(0,100)}`);
  assert(r.includes('Score:'),    `missing score line: ${r.slice(0,200)}`);
  assert(r.includes('get paid'),  `missing desire name: ${r}`);
  assert(r.includes('Direction'), `missing direction: ${r}`);
  assert(r.includes('Result'),    `missing result field: ${r}`);
});

test('render shows INNOVATION COMPLETE when all desires satisfied', () => {
  const chain = new EM.EventMathChain('complete');
  chain.addLink('effort', 'payment');
  const d = new EM.EventMathDesire('payment', { direction: 'matches', 'satisfied when': 'payment matches rate' });
  const engine = new EM.EventMathSatisfactionEngine('test', [d], chain);
  const r = engine.render();
  assert(r.includes('INNOVATION COMPLETE'), `should say INNOVATION COMPLETE: ${r.slice(-150)}`);
});

test('render shows BLOCKED when majority unsatisfied', () => {
  const chain = new EM.EventMathChain('blocked');
  chain.addLink('a', 'b');
  const desires = [
    new EM.EventMathDesire('d1', { direction: 'matches', 'satisfied when': 'xyz matches abc' }),
    new EM.EventMathDesire('d2', { direction: 'matches', 'satisfied when': 'qrs matches tuv' }),
  ];
  const engine = new EM.EventMathSatisfactionEngine('test', desires, chain);
  const r = engine.render();
  assert(r.includes('BLOCKED'), `should say BLOCKED: ${r.slice(-150)}`);
});

test('render shows gap list when desires are unmet', () => {
  const chain = new EM.EventMathChain('partial');
  chain.addLink('a', 'b');
  const d = new EM.EventMathDesire('unmet', { direction: 'matches', 'satisfied when': 'xyz matches abc' });
  const engine = new EM.EventMathSatisfactionEngine('test', [d], chain);
  const r = engine.render();
  assert(r.includes('Unmet desires'), `should show gap section: ${r.slice(-200)}`);
  assert(r.includes('unmet'), `gap should list desire name: ${r.slice(-200)}`);
});

// ── Tokenizer ─────────────────────────────────────────────────────────────────

console.log('\nTokenizer — satisfy + evaluate');

test('tokenizes "satisfy DESIRE against CHAIN into RESULT"', () => {
  const toks = new EventMathTokenizer().tokenize('satisfy fair payment against creator revenue into payment check');
  const t = toks.find(t => t.type === 'SATISFY_STMT');
  assert(t, 'no SATISFY_STMT token');
  assert(t.value.desireName === 'fair payment',     `desireName: "${t.value.desireName}"`);
  assert(t.value.chainName  === 'creator revenue',  `chainName: "${t.value.chainName}"`);
  assert(t.value.intoName   === 'payment check',    `intoName: "${t.value.intoName}"`);
});

test('tokenizes "evaluate D1 and D2 against CHAIN into RESULT"', () => {
  const toks = new EventMathTokenizer().tokenize(
    'evaluate fair payment and audience growth against creator revenue into satisfaction report'
  );
  const t = toks.find(t => t.type === 'EVALUATE_STMT');
  assert(t, 'no EVALUATE_STMT token');
  assert(Array.isArray(t.value.desireNames),       'desireNames should be array');
  assert(t.value.desireNames.length === 2,          `should have 2 desires, got ${t.value.desireNames.length}`);
  assert(t.value.desireNames[0] === 'fair payment', `first: "${t.value.desireNames[0]}"`);
  assert(t.value.desireNames[1] === 'audience growth', `second: "${t.value.desireNames[1]}"`);
  assert(t.value.chainName === 'creator revenue',   `chainName: "${t.value.chainName}"`);
  assert(t.value.intoName  === 'satisfaction report', `intoName: "${t.value.intoName}"`);
});

test('tokenizes single desire evaluate (no "and")', () => {
  const toks = new EventMathTokenizer().tokenize(
    'evaluate fair payment against creator revenue into result'
  );
  const t = toks.find(t => t.type === 'EVALUATE_STMT');
  assert(t, 'no EVALUATE_STMT token');
  assert(t.value.desireNames.length === 1, `should have 1 desire`);
  assert(t.value.desireNames[0] === 'fair payment', `desire: "${t.value.desireNames[0]}"`);
});

// ── Parser ────────────────────────────────────────────────────────────────────

console.log('\nParser — SatisfyStmt + EvaluateStmt');

test('parses satisfy statement', () => {
  const ast = parse('satisfy fair payment against creator revenue into payment check');
  const node = ast.statements.find(s => s.type === 'SatisfyStmt');
  assert(node, 'no SatisfyStmt');
  assert(node.desireName === 'fair payment',    `desireName: ${node.desireName}`);
  assert(node.chainName  === 'creator revenue', `chainName: ${node.chainName}`);
  assert(node.intoName   === 'payment check',   `intoName: ${node.intoName}`);
});

test('parses evaluate statement with multiple desires', () => {
  const ast = parse('evaluate fair payment and audience growth against creator revenue into report');
  const node = ast.statements.find(s => s.type === 'EvaluateStmt');
  assert(node, 'no EvaluateStmt');
  assert(Array.isArray(node.desireNames), 'desireNames should be array');
  assert(node.desireNames.length === 2,   `should have 2 desires, got ${node.desireNames.length}`);
  assert(node.chainName === 'creator revenue', `chainName: ${node.chainName}`);
});

// ── Codegen: desire block emits EventMathDesire ───────────────────────────────

console.log('\nCodegen — desire block + satisfy/evaluate');

test('desire block compiles to EventMathDesire', () => {
  const js = compile(`
desire fair payment
matter
  direction is matches
  satisfied when is payment matches market rate
end
end
`);
  assert(js.includes('EventMathDesire'), `missing EventMathDesire: ${js.slice(0,300)}`);
  assert(!js.includes('EventMathEvent'), `should not emit EventMathEvent for desire: ${js.slice(0,300)}`);
});

test('satisfy compiles to EventMathSatisfactionEngine with single desire', () => {
  const js = compile(`
desire fair payment
matter
  direction is matches
  satisfied when is payment matches market rate
end
end
chain revenue
  voice leads to payment
end
satisfy fair payment against revenue into check
`);
  assert(js.includes('EventMathSatisfactionEngine'), `missing SatisfactionEngine: ${js.slice(0,400)}`);
});

test('evaluate compiles to EventMathSatisfactionEngine with desire array', () => {
  const js = compile(`
desire fair payment
matter
  direction is matches
  satisfied when is payment matches rate
end
end
desire audience growth
matter
  direction is more
  satisfied when is reach more than target
end
end
chain revenue
  voice leads to payment
end
evaluate fair payment and audience growth against revenue into report
`);
  assert(js.includes('EventMathSatisfactionEngine'), `missing SatisfactionEngine: ${js.slice(0,400)}`);
  assert(js.includes('fair_payment'), `missing fair_payment var: ${js.slice(0,400)}`);
  assert(js.includes('audience_growth'), `missing audience_growth var: ${js.slice(0,400)}`);
});

// ── End-to-end: compile + run ─────────────────────────────────────────────────

console.log('\nCodegen — end-to-end compile + run');

test('desire + chain + satisfy runs and shows satisfaction report', () => {
  const lines = run(`
desire fair payment
matter
  scenario is brand deal
  direction is matches
  satisfied when is payment matches market rate
end
end
chain creator revenue
  authentic voice leads to audience trust
  audience trust leads to brand interest
  brand interest leads to payment
end
satisfy fair payment against creator revenue into payment check
show payment check
`);
  const out = lines.join('\n');
  assert(out.includes('Satisfaction Engine'), `missing engine header: ${out}`);
  assert(out.includes('fair payment'),        `missing desire name: ${out}`);
  assert(out.includes('Score:'),              `missing score: ${out}`);
});

test('evaluate with multiple desires shows score and any gaps', () => {
  const lines = run(`
desire fair payment
matter
  direction is matches
  satisfied when is payment matches market rate
end
end
desire audience growth
matter
  direction is more
  satisfied when is reach more than current
end
end
chain revenue
  authentic voice leads to audience trust
  audience trust leads to payment
end
evaluate fair payment and audience growth against revenue into full report
show full report
`);
  const out = lines.join('\n');
  assert(out.includes('Score:'),    `missing Score: ${out}`);
  assert(out.includes('/2 desires'), `should evaluate 2 desires: ${out}`);
});

test('satisfy shows INNOVATION COMPLETE when chain covers desire', () => {
  const lines = run(`
desire reach payment
matter
  direction is matches
  satisfied when is payment matches target
end
end
chain direct
  effort leads to payment
end
satisfy reach payment against direct into check
show check
`);
  const out = lines.join('\n');
  assert(out.includes('INNOVATION COMPLETE'), `expected INNOVATION COMPLETE: ${out}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
