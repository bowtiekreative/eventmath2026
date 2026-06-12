'use strict';
/**
 * EventMath v2.7 — challenge, compare, branching chains
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');
const EM = require('../runtime/eventmath-runtime.js');

let passed = 0, failed = 0;

function assert(label, condition, detail) {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else { console.error(`  ✗  ${label}`); if (detail !== undefined) console.error(`       got: ${JSON.stringify(detail)}`); failed++; }
}

function tok(src)     { return new EventMathTokenizer().tokenize(src); }
function parse(src)   { return new EventMathParser(tok(src)).parse(); }
function compile(src) { return new EventMathCodeGen().generate(parse(src)); }
function format(src)  { return new EventMathFormatter().format(parse(src)); }
function run(src, returnVar) {
  const js = compile(src);
  const fn = new Function('require', 'console', 'module', js + `\nreturn typeof ${returnVar} !== 'undefined' ? ${returnVar} : null;`);
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}

// ── Runtime: branching chains (max-value path selection) ──────────────────────
console.log('\n─ Branching chains ─');

{
  // Two paths to the same goal — satisfaction engine should use the MAX value
  const chain = new EM.EventMathChain('branching');
  chain.addLink('root', 'weak path', 10);
  chain.addLink('root', 'strong path', 90);
  chain.addLink('weak path', 'goal', 10);
  chain.addLink('strong path', 'goal', 90);

  const desire = new EM.EventMathDesire('reach goal', {
    direction: 'more than', 'satisfied when': 'goal more than 80',
  });
  const eng = new EM.EventMathSatisfactionEngine('test', [desire], chain, []);
  assert('branching: uses max path value (90, not 10)', eng.score === 100, eng.score);
}

{
  // Branching where one path is blocked — still finds the active path
  const chain = new EM.EventMathChain('mixed');
  chain.addLink('start', 'dead end', 0);
  chain.addLink('start', 'live path', 75);
  chain.addLink('dead end', 'outcome', 0);
  chain.addLink('live path', 'outcome', 75);

  const desire = new EM.EventMathDesire('get outcome', {
    direction: 'more than', 'satisfied when': 'outcome more than 50',
  });
  const eng = new EM.EventMathSatisfactionEngine('test', [desire], chain, []);
  assert('branching: finds live path through blocked branch', eng.score === 100, eng.score);
}

{
  // Diagnosis backward walk picks the highest-value predecessor
  const chain = new EM.EventMathChain('branching diag');
  chain.addLink('root', 'path A', 5);
  chain.addLink('root', 'path B', 80);
  chain.addLink('path A', 'goal', 5);
  chain.addLink('path B', 'goal', 0);

  const desire = new EM.EventMathDesire('reach goal', {
    direction: 'more than', 'satisfied when': 'goal more than 50',
  });
  const diag = new EM.EventMathDiagnosis('branching diag', desire, chain, []);
  assert('branching diagnosis: runs without error', diag !== null);
  assert('branching diagnosis: goal not satisfied', !diag.isSatisfied);
}

// ── Runtime: EventMathChallenge ───────────────────────────────────────────────
console.log('\n─ Challenge ─');

{
  const chain = new EM.EventMathChain('leverage chain');
  chain.addLink('authentic voice', 'rate card published', 9);
  chain.addLink('rate card published', 'direct outreach', 12);
  chain.addLink('direct outreach', 'inbound brand interest', 8);
  chain.addLink('inbound brand interest', 'negotiation', 6);
  chain.addLink('negotiation', 'payment', 620);
  chain.addLink('payment', 'reach expansion', 18500);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const assumptions = [assumption];

  const desire = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than market rate',
  });

  const eng = new EM.EventMathSatisfactionEngine('test', [desire], chain, assumptions);
  const challenge = new EM.EventMathChallenge('test challenge', 'market rate', eng, assumptions);

  assert('challenge: found the assumption', challenge.found === true);
  assert('challenge: assumption re-activated after test', assumption.active === true);
  assert('challenge: sensitivity label set', ['HIGH','MEDIUM','LOW'].includes(challenge.sensitivity), challenge.sensitivity);
  assert('challenge: verdict non-empty', challenge.verdict.length > 0);
  assert('challenge: originalScores captured', challenge.originalScores.tier1 >= 0);
  assert('challenge: deltas computed', typeof challenge.deltas.tier1 === 'number');

  const rendered = challenge.render();
  assert('challenge render: includes CHALLENGE header', rendered.includes('CHALLENGE'));
  assert('challenge render: includes Before/After', rendered.includes('Before'));
  assert('challenge render: includes Sensitivity', rendered.includes('Sensitivity'));
}

{
  // Unknown assumption — graceful failure
  const chain = new EM.EventMathChain('c');
  chain.addLink('A', 'B', 50);
  const desire = new EM.EventMathDesire('d', { direction: 'more than', 'satisfied when': 'B more than 10' });
  const eng    = new EM.EventMathSatisfactionEngine('e', [desire], chain, []);
  const ch     = new EM.EventMathChallenge('ch', 'nonexistent assumption', eng, []);
  assert('challenge: missing assumption sets found=false', !ch.found);
  assert('challenge: verdict explains missing assumption', ch.verdict.includes('not found'));
}

// ── Runtime: EventMathComparison ─────────────────────────────────────────────
console.log('\n─ Comparison ─');

{
  const waiting = new EM.EventMathChain('waiting chain');
  waiting.addLink('great content', 'post', 7);
  waiting.addLink('post', 'algorithmic reach', 3000);
  waiting.addLink('algorithmic reach', 'brand visibility', 1);
  waiting.addLink('brand visibility', 'inbound inquiries', 0);
  waiting.addLink('inbound inquiries', 'deals closed', 0);
  waiting.addLink('deals closed', 'payment', 0);

  const leverage = new EM.EventMathChain('leverage chain');
  leverage.addLink('authentic voice', 'rate card published', 9);
  leverage.addLink('rate card published', 'direct outreach', 12);
  leverage.addLink('direct outreach', 'inbound brand interest', 8);
  leverage.addLink('inbound brand interest', 'negotiation', 6);
  leverage.addLink('negotiation', 'payment', 620);
  leverage.addLink('payment', 'reach expansion', 18500);

  const assumption = new EM.EventMathAssumption('market rate', '500');
  const desire = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than market rate',
  });

  const comp = new EM.EventMathComparison('path comparison', waiting, leverage, desire, [assumption]);

  assert('comparison: result1 present', comp.result1 !== null);
  assert('comparison: result2 present', comp.result2 !== null);
  assert('comparison: waiting surface = 0', comp.result1.surface === 0, comp.result1.surface);
  assert('comparison: leverage surface = 100', comp.result2.surface === 100, comp.result2.surface);
  assert('comparison: overall winner is leverage chain', comp.winners.overall === 'leverage chain', comp.winners.overall);
  assert('comparison: verdict non-empty', comp.verdict.length > 0);

  const rendered = comp.render();
  assert('comparison render: COMPARE header', rendered.includes('COMPARE'));
  assert('comparison render: Chain A present', rendered.includes('Chain A'));
  assert('comparison render: Chain B present', rendered.includes('Chain B'));
  assert('comparison render: Winners section', rendered.includes('Winners'));
  assert('comparison render: Recommendation', rendered.includes('Recommendation'));
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

{
  const tokens = tok('challenge market rate in leverage report into market sensitivity');
  assert('challenge tokenizer: emits CHALLENGE_STMT', tokens[0].type === 'CHALLENGE_STMT', tokens[0].type);
  assert('challenge tokenizer: assumptionName', tokens[0].value.assumptionName === 'market rate', tokens[0].value);
  assert('challenge tokenizer: reportName', tokens[0].value.reportName === 'leverage report', tokens[0].value);
  assert('challenge tokenizer: intoName', tokens[0].value.intoName === 'market sensitivity', tokens[0].value);
}

{
  const tokens = tok('compare waiting chain and leverage chain for fair payment into path comparison');
  assert('compare tokenizer: emits COMPARE_STMT', tokens[0].type === 'COMPARE_STMT', tokens[0].type);
  assert('compare tokenizer: chain1', tokens[0].value.chain1 === 'waiting chain', tokens[0].value);
  assert('compare tokenizer: chain2', tokens[0].value.chain2 === 'leverage chain', tokens[0].value);
  assert('compare tokenizer: desireName', tokens[0].value.desireName === 'fair payment', tokens[0].value);
  assert('compare tokenizer: intoName', tokens[0].value.intoName === 'path comparison', tokens[0].value);
}

// ── Parser ────────────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

{
  const ast = parse('challenge market rate in leverage report into market sensitivity');
  const s = ast.statements[0];
  assert('challenge parser: ChallengeStmt type', s.type === 'ChallengeStmt', s.type);
  assert('challenge parser: assumptionName', s.assumptionName === 'market rate');
  assert('challenge parser: reportName', s.reportName === 'leverage report');
  assert('challenge parser: intoName', s.intoName === 'market sensitivity');
}

{
  const ast = parse('compare waiting chain and leverage chain for fair payment into path comparison');
  const s = ast.statements[0];
  assert('compare parser: CompareStmt type', s.type === 'CompareStmt', s.type);
  assert('compare parser: chain1Name', s.chain1Name === 'waiting chain');
  assert('compare parser: chain2Name', s.chain2Name === 'leverage chain');
  assert('compare parser: desireName', s.desireName === 'fair payment');
  assert('compare parser: intoName', s.intoName === 'path comparison');
}

// ── Codegen ───────────────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

{
  const js = compile('challenge market rate in leverage report into market sensitivity');
  assert('challenge codegen: EventMathChallenge constructor', js.includes('EventMathChallenge'));
  assert('challenge codegen: passes assumption name string', js.includes("'market rate'"));
  assert('challenge codegen: passes report var', js.includes('leverage_report'));
  assert('challenge codegen: passes __assumptions', js.includes('__assumptions'));
}

{
  const js = compile('compare waiting chain and leverage chain for fair payment into path comparison');
  assert('compare codegen: EventMathComparison constructor', js.includes('EventMathComparison'));
  assert('compare codegen: chain1 var', js.includes('waiting_chain'));
  assert('compare codegen: chain2 var', js.includes('leverage_chain'));
  assert('compare codegen: desire var', js.includes('fair_payment'));
}

// ── Formatter ─────────────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

{
  assert('challenge formatter: round-trips',
    format('challenge market rate in leverage report into market sensitivity')
      .includes('challenge market rate in leverage report into market sensitivity'));
  assert('compare formatter: round-trips',
    format('compare waiting chain and leverage chain for fair payment into path comparison')
      .includes('compare waiting chain and leverage chain for fair payment into path comparison'));
}

// ── End-to-end ────────────────────────────────────────────────────────────────
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

chain leverage chain
  authentic voice leads to rate card published at value 9
  rate card published leads to direct outreach at value 12
  direct outreach leads to inbound brand interest at value 8
  inbound brand interest leads to negotiation at value 6
  negotiation leads to payment at value 620
  payment leads to reach expansion at value 18500
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

spin market noise into noise torus at dimension -39
spin market signal into signal torus at dimension 39
fractal signal torus and noise torus into market axis

evaluate fair payment against leverage chain across fractal market axis into leverage report

challenge market rate in leverage report into market sensitivity
show market sensitivity

compare waiting chain and leverage chain for fair payment into path comparison
show path comparison
`;
  try {
    const js = compile(src);
    const fn = new Function('require', 'console', 'module', js +
      '\nreturn { ms: typeof market_sensitivity !== "undefined" ? market_sensitivity : null, pc: typeof path_comparison !== "undefined" ? path_comparison : null };');
    let out = '';
    const { ms, pc } = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });

    assert('e2e challenge: market_sensitivity created', ms !== null);
    assert('e2e challenge: found assumption', ms && ms.found === true);
    assert('e2e challenge: render in output', out.includes('CHALLENGE'));

    assert('e2e compare: path_comparison created', pc !== null);
    assert('e2e compare: leverage chain wins overall', pc && pc.winners.overall === 'leverage chain', pc && pc.winners.overall);
    assert('e2e compare: render in output', out.includes('COMPARE'));
  } catch (e) {
    assert('e2e: no runtime error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
