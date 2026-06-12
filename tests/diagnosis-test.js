'use strict';
/**
 * EventMath v2.6 — why DESIRE is not satisfied in CHAIN into RESULT
 * Backward satisfaction tracing with tier-aware failure localization.
 */

const { EventMathTokenizer }  = require('../src/tokenizer.js');
const { EventMathParser }     = require('../src/parser.js');
const { EventMathCodeGen }    = require('../src/codegen.js');
const { EventMathFormatter }  = require('../src/formatter.js');
const { EventMathValidator }  = require('../src/validator.js');
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
function runCode(src) {
  const js = compile(src);
  const fn = new Function('require', 'console', 'module', js + '\nreturn typeof __diag !== "undefined" ? __diag : null;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

// ── Runtime unit tests ────────────────────────────────────────────────────────
console.log('\n─ Runtime: EventMathDiagnosis ─');

{
  // Build the waiting chain and a desire manually
  const chain = new EM.EventMathChain('waiting chain');
  chain.addLink('great content', 'post', 7);
  chain.addLink('post', 'algorithmic reach', 3000);
  chain.addLink('algorithmic reach', 'brand visibility', 1);
  chain.addLink('brand visibility', 'inbound inquiries', 0);
  chain.addLink('inbound inquiries', 'deals closed', 0);
  chain.addLink('deals closed', 'payment', 0);

  const desire = new EM.EventMathDesire('fair payment', {
    scenario: 'brand negotiation',
    subjective: 'I want to be paid what I am worth',
    outcome: 'payment at market rate',
    direction: 'more than',
    state: 'desired',
    'satisfied when': 'payment more than 500',
  });

  const diag = new EM.EventMathDiagnosis('waiting diagnosis', desire, chain, []);

  assert('diagnosis: not satisfied', !diag.isSatisfied);
  assert('diagnosis: currentScore is 0', diag.currentScore === 0, diag.currentScore);
  assert('diagnosis: backwardPath has links', diag.backwardPath.length > 0, diag.backwardPath.length);
  assert('diagnosis: blockingLink exists', diag.blockingLink !== null);
  assert('diagnosis: blockingLink has value 0', diag.blockingLink && diag.blockingLink.value === 0);
  assert('diagnosis: interventionPoint is non-empty', diag.interventionPoint.length > 0);
  assert('diagnosis: lever is non-empty', diag.lever.length > 0);
  assert('diagnosis: 3 tier entries', diag.tierAnalysis.length === 3, diag.tierAnalysis.length);
  assert('diagnosis: tier 1 is BLOCKED', diag.tierAnalysis[0].status === 'BLOCKED', diag.tierAnalysis[0].status);
  assert('diagnosis: tier 2 has fallacy info', diag.tierAnalysis[1].detail.length > 0);
  assert('diagnosis: tier 3 notes fractal required', diag.tierAnalysis[2].status === 'REQUIRES FRACTAL');
}

{
  // Leverage chain — desire IS satisfied (payment = 620 > 500)
  const chain = new EM.EventMathChain('leverage chain');
  chain.addLink('authentic voice', 'rate card published', 9);
  chain.addLink('rate card published', 'direct outreach', 12);
  chain.addLink('direct outreach', 'inbound brand interest', 8);
  chain.addLink('inbound brand interest', 'negotiation', 6);
  chain.addLink('negotiation', 'payment', 620);
  chain.addLink('payment', 'reach expansion', 18500);

  const desire = new EM.EventMathDesire('fair payment', {
    direction: 'more than',
    state: 'desired',
    'satisfied when': 'payment more than 500',
  });
  const assumption = new EM.EventMathAssumption('market rate', '500');

  const diag = new EM.EventMathDiagnosis('leverage diagnosis', desire, chain, [assumption]);
  assert('already satisfied: isSatisfied true', diag.isSatisfied, diag.currentScore);
  assert('already satisfied: lever says satisfied', diag.lever.includes('satisfied'));
}

{
  // Non-numeric chain — graceful handling
  const chain = new EM.EventMathChain('qualitative chain');
  chain.addLink('A', 'B');
  chain.addLink('B', 'C');
  chain.addLink('C', 'D');

  const desire = new EM.EventMathDesire('reach goal', {
    direction: 'matches',
    'satisfied when': 'Z',
  });

  const diag = new EM.EventMathDiagnosis('qualitative diagnosis', desire, chain, []);
  assert('non-numeric: does not crash', true);
  assert('non-numeric: interventionPoint is string', typeof diag.interventionPoint === 'string');
}

{
  // render() produces readable output
  const chain = new EM.EventMathChain('test chain');
  chain.addLink('A', 'B', 5);
  chain.addLink('B', 'C', 0);

  const desire = new EM.EventMathDesire('reach C', {
    direction: 'more than',
    'satisfied when': 'C more than 10',
  });

  const diag = new EM.EventMathDiagnosis('test', desire, chain, []);
  const rendered = diag.render();
  assert('render: includes WHY header', rendered.includes('WHY'));
  assert('render: includes Tier 1', rendered.includes('Tier 1'));
  assert('render: includes Tier 2', rendered.includes('Tier 2'));
  assert('render: includes Tier 3', rendered.includes('Tier 3'));
  assert('render: includes BLOCKED', rendered.includes('BLOCKED'));
  assert('render: includes intervention', rendered.includes('Minimum intervention'));
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

{
  const tokens = tokenize('why fair payment is not satisfied in leverage chain into diagnosis');
  assert('tokenizer: emits WHY_STMT token',
    tokens.length === 1 && tokens[0].type === 'WHY_STMT', tokens.map(t => t.type));
  assert('tokenizer: desireName correct',
    tokens[0].value.desireName === 'fair payment', tokens[0].value.desireName);
  assert('tokenizer: chainName correct',
    tokens[0].value.chainName === 'leverage chain', tokens[0].value.chainName);
  assert('tokenizer: intoName correct',
    tokens[0].value.intoName === 'diagnosis', tokens[0].value.intoName);
}

{
  // Wrong sequence — missing "not satisfied in"
  const tokens = tokenize('why fair payment is leverage chain into diagnosis');
  assert('malformed why: falls back to KEYWORD',
    tokens[0].type === 'KEYWORD' && tokens[0].value === 'why', tokens[0]);
}

// ── Parser ────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

{
  const ast = parse('why fair payment is not satisfied in leverage chain into diagnosis');
  const stmt = ast.statements[0];
  assert('parser: type is DiagnoseStmt', stmt.type === 'DiagnoseStmt', stmt.type);
  assert('parser: desireName correct', stmt.desireName === 'fair payment', stmt.desireName);
  assert('parser: chainName correct', stmt.chainName === 'leverage chain', stmt.chainName);
  assert('parser: intoName correct', stmt.intoName === 'diagnosis', stmt.intoName);
}

// ── Codegen ───────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

{
  const js = compile('why fair payment is not satisfied in leverage chain into diagnosis');
  assert('codegen: emits EventMathDiagnosis constructor',
    js.includes('EventMathDiagnosis'));
  assert('codegen: passes desire var',
    js.includes('fair_payment'));
  assert('codegen: passes chain var',
    js.includes('leverage_chain'));
  assert('codegen: passes __assumptions',
    js.includes('__assumptions'));
}

// ── Formatter ─────────────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

{
  const src = 'why fair payment is not satisfied in leverage chain into diagnosis';
  const out = format(src);
  assert('formatter: round-trips correctly', out.includes('why fair payment is not satisfied in leverage chain into diagnosis'));
}

// ── Validator ─────────────────────────────────────────────────────────────────
console.log('\n─ Validator ─');

{
  const result = new EventMathValidator().validate(
    parse('why fair payment is not satisfied in leverage chain into diagnosis')
  );
  assert('validator: no errors on valid why stmt', result.errors.length === 0, result.errors);
  assert('validator: intoName registered', true); // indirect — no E017 for "diagnosis"
}

// ── End-to-end: compile + run ─────────────────────────────────────────────────
console.log('\n─ End-to-end ─');

{
  const src = `
assume market rate is 500

chain waiting chain
  great content leads to post at value 7
  post leads to algorithmic reach at value 3000
  algorithmic reach leads to brand visibility at value 1
  brand visibility leads to inbound inquiries at value 0
  inbound inquiries leads to deals closed at value 0
  deals closed leads to payment at value 0
end

desire fair payment
category creator goal
matter
  scenario is brand negotiation
  subjective is I want to be paid what I am worth
  outcome is payment at market rate
  direction is more than
  state is desired
  satisfied when is payment more than market rate
end
end

why fair payment is not satisfied in waiting chain into __diag
show __diag
`;
  try {
    const { out, result } = runCode(src);
    assert('e2e: compiles and runs', result !== null, 'result was null');
    assert('e2e: result is EventMathDiagnosis', result && typeof result.render === 'function');
    assert('e2e: not satisfied', result && !result.isSatisfied);
    assert('e2e: blocking link found', result && result.blockingLink !== null);
    assert('e2e: render output includes WHY', out.includes('WHY'), out.slice(0, 200));
    assert('e2e: render includes BLOCKED', out.includes('BLOCKED'));
    assert('e2e: render includes Tier analysis', out.includes('Tier analysis'));
    assert('e2e: render includes intervention', out.includes('Minimum intervention'));
  } catch (e) {
    assert('e2e: no runtime error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
