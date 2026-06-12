'use strict';
/**
 * EventMath v2.8 — desire weights, conflict detection, weigh trade-offs
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

// ── Runtime: Desire priority (weights) ───────────────────────────────
console.log('\n─ Desire priority ─');

{
  // Priority parsed from 'priority' matter field (not 'weight' — that's a statement keyword)
  const d = new EM.EventMathDesire('big payment', {
    direction: 'more than', 'satisfied when': 'payment more than 100', priority: '3',
  });
  assert('priority: parsed from string', d.weight === 3, d.weight);
}

{
  // API fallback: m.weight also works when calling EventMathDesire directly
  const d = new EM.EventMathDesire('d', {
    direction: 'more than', 'satisfied when': 'payment more than 0', weight: 5,
  });
  assert('priority: m.weight fallback works', d.weight === 5, d.weight);
}

{
  // Invalid / missing priority defaults to 1
  const d1 = new EM.EventMathDesire('d1', { direction: 'more than', 'satisfied when': 'payment more than 0' });
  assert('priority: missing defaults to 1', d1.weight === 1, d1.weight);

  const d2 = new EM.EventMathDesire('d2', { direction: 'more than', 'satisfied when': 'payment more than 0', priority: '-5' });
  assert('priority: negative defaults to 1', d2.weight === 1, d2.weight);
}

{
  // Weighted satisfaction engine: high-priority desire dominates the score
  const chain = new EM.EventMathChain('weighted chain');
  chain.addLink('work', 'payment', 200);
  chain.addLink('payment', 'savings', 5);

  const dHigh = new EM.EventMathDesire('big payment', {
    direction: 'more than', 'satisfied when': 'payment more than 100', priority: '5',
  });
  const dLow = new EM.EventMathDesire('big savings', {
    direction: 'more than', 'satisfied when': 'savings more than 1000', priority: '1',
  });

  const eng = new EM.EventMathSatisfactionEngine('w-test', [dHigh, dLow], chain, []);
  // dHigh: actualValue=200, target=100 → partialScore=100, priority=5 → contributes 500
  // dLow: actualValue=5, target=1000 → partialScore=0, priority=1 → contributes 0
  // weighted avg = 500 / 6 ≈ 83
  assert('weighted engine: high-priority desire dominates', eng.score > 70 && eng.score < 95, eng.score);
}

{
  // Equal priority = simple average
  const chain = new EM.EventMathChain('equal chain');
  chain.addLink('work', 'payment', 200);
  chain.addLink('payment', 'savings', 200);

  const d1 = new EM.EventMathDesire('d1', {
    direction: 'more than', 'satisfied when': 'payment more than 100', priority: '1',
  });
  const d2 = new EM.EventMathDesire('d2', {
    direction: 'more than', 'satisfied when': 'savings more than 100', priority: '1',
  });

  const eng = new EM.EventMathSatisfactionEngine('eq-test', [d1, d2], chain, []);
  assert('weighted engine: equal priority = 100% when both satisfied', eng.score === 100, eng.score);
}

// ── Runtime: EventMathConflict ────────────────────────────────────────
console.log('\n─ Conflict detection ─');

{
  // ALIGNED: two desires that can both be satisfied in the same chain
  const chain = new EM.EventMathChain('aligned chain');
  chain.addLink('work', 'payment', 200);
  chain.addLink('payment', 'savings', 200);

  const d1 = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than 100',
  });
  const d2 = new EM.EventMathDesire('good savings', {
    direction: 'more than', 'satisfied when': 'savings more than 100',
  });

  const conflict = new EM.EventMathConflict('aligned test', d1, d2, chain, []);
  assert('conflict ALIGNED: label correct', conflict.label === 'ALIGNED', conflict.label);
  assert('conflict ALIGNED: verdict non-empty', conflict.verdict.length > 0);
  assert('conflict ALIGNED: score1 = 100', conflict.score1 === 100, conflict.score1);
  assert('conflict ALIGNED: score2 = 100', conflict.score2 === 100, conflict.score2);
  assert('conflict ALIGNED: tensionScore ≤ 5', conflict.tensionScore <= 5, conflict.tensionScore);
}

{
  // OPPOSED: one desire satisfied, the other not — same chain can't do both
  const chain = new EM.EventMathChain('opposed chain');
  chain.addLink('work', 'payment', 200);
  // No path to 'savings' — savings = 0

  const d1 = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than 100',
  });
  const d2 = new EM.EventMathDesire('big savings', {
    direction: 'more than', 'satisfied when': 'savings more than 100',
  });

  const conflict = new EM.EventMathConflict('opposed test', d1, d2, chain, []);
  assert('conflict OPPOSED or COMPETITIVE: not ALIGNED', conflict.label !== 'ALIGNED', conflict.label);
  assert('conflict OPPOSED: score1=100, score2=0', conflict.score1 === 100 && conflict.score2 === 0, { s1: conflict.score1, s2: conflict.score2 });
  // tensionScore measures cost of pursuing both together vs separately;
  // when one desire always scores 0 it doesn't drag the other down, so tension=0 is correct
  assert('conflict OPPOSED: label is OPPOSED (minScore===0 path)', conflict.label === 'OPPOSED', conflict.label);
}

{
  // Missing desire/chain — graceful handling
  const d = new EM.EventMathDesire('d', { direction: 'more than', 'satisfied when': 'x more than 0' });
  const c = new EM.EventMathConflict('missing', d, null, null, []);
  assert('conflict: missing desires → UNKNOWN label', c.label === 'UNKNOWN', c.label);
  assert('conflict: missing desires → verdict non-empty', c.verdict.length > 0);
}

{
  // render produces CONFLICT header
  const chain = new EM.EventMathChain('r');
  chain.addLink('a', 'b', 50);
  const d1 = new EM.EventMathDesire('want b', { direction: 'more than', 'satisfied when': 'b more than 10' });
  const d2 = new EM.EventMathDesire('want more', { direction: 'more than', 'satisfied when': 'b more than 100' });
  const conflict = new EM.EventMathConflict('render test', d1, d2, chain, []);
  const rendered = conflict.render();
  assert('conflict render: includes CONFLICT header', rendered.includes('CONFLICT'));
  assert('conflict render: includes Status', rendered.includes('Status'));
  assert('conflict render: includes Tension', rendered.includes('Tension') || rendered.includes('tension'));
}

// ── Runtime: EventMathWeigh ───────────────────────────────────────────
console.log('\n─ Weigh (trade-off resolution) ─');

{
  // ALIGNED conflict → recommend both
  const chain = new EM.EventMathChain('aligned chain');
  chain.addLink('work', 'payment', 200);
  chain.addLink('payment', 'savings', 200);
  const d1 = new EM.EventMathDesire('fair payment', { direction: 'more than', 'satisfied when': 'payment more than 100' });
  const d2 = new EM.EventMathDesire('good savings', { direction: 'more than', 'satisfied when': 'savings more than 100' });
  const conflict = new EM.EventMathConflict('aligned', d1, d2, chain, []);
  const weigh = new EM.EventMathWeigh('resolution', conflict);
  assert('weigh ALIGNED: winner is both', weigh.winner === 'both', weigh.winner);
  assert('weigh ALIGNED: recommendation mentions both', weigh.recommendation.includes('both'));
}

{
  // Unequal weights — heavier desire wins
  const chain = new EM.EventMathChain('opposed chain');
  chain.addLink('work', 'payment', 200);
  const d1 = new EM.EventMathDesire('fair payment', {
    direction: 'more than', 'satisfied when': 'payment more than 100', priority: '10',
  });
  const d2 = new EM.EventMathDesire('big savings', {
    direction: 'more than', 'satisfied when': 'savings more than 100', priority: '1',
  });
  const conflict = new EM.EventMathConflict('heavy test', d1, d2, chain, []);
  const weigh = new EM.EventMathWeigh('heavy resolution', conflict);
  assert('weigh: higher priority desire wins', weigh.winner === 'fair payment', weigh.winner);
  assert('weigh: weightedScore1 > weightedScore2', weigh.weightedScore1 > weigh.weightedScore2, { ws1: weigh.weightedScore1, ws2: weigh.weightedScore2 });
}

{
  // render output
  const chain = new EM.EventMathChain('r');
  chain.addLink('a', 'payment', 50);
  const d1 = new EM.EventMathDesire('d1', { direction: 'more than', 'satisfied when': 'payment more than 10' });
  const d2 = new EM.EventMathDesire('d2', { direction: 'more than', 'satisfied when': 'savings more than 100' });
  const conflict = new EM.EventMathConflict('c', d1, d2, chain, []);
  const weigh = new EM.EventMathWeigh('w', conflict);
  const rendered = weigh.render();
  assert('weigh render: includes WEIGH header', rendered.includes('WEIGH'));
  assert('weigh render: includes Winner', rendered.includes('Winner'));
  assert('weigh render: includes Trade-off', rendered.includes('Trade-off'));
}

{
  // null conflict — graceful
  const w = new EM.EventMathWeigh('null weigh', null);
  assert('weigh: null conflict → recommendation non-empty', w.recommendation.length > 0);
}

// ── Tokenizer ─────────────────────────────────────────────────────────
console.log('\n─ Tokenizer ─');

{
  const tokens = tok('conflict fair payment and creative freedom for leverage chain into tension report');
  assert('conflict tokenizer: emits CONFLICT_STMT', tokens[0].type === 'CONFLICT_STMT', tokens[0].type);
  assert('conflict tokenizer: desire1', tokens[0].value.desire1 === 'fair payment', tokens[0].value);
  assert('conflict tokenizer: desire2', tokens[0].value.desire2 === 'creative freedom', tokens[0].value);
  assert('conflict tokenizer: chainName', tokens[0].value.chainName === 'leverage chain', tokens[0].value);
  assert('conflict tokenizer: intoName', tokens[0].value.intoName === 'tension report', tokens[0].value);
}

{
  const tokens = tok('weigh tension report into resolution');
  assert('weigh tokenizer: emits WEIGH_STMT', tokens[0].type === 'WEIGH_STMT', tokens[0].type);
  assert('weigh tokenizer: conflictName', tokens[0].value.conflictName === 'tension report', tokens[0].value);
  assert('weigh tokenizer: intoName', tokens[0].value.intoName === 'resolution', tokens[0].value);
}

// ── Parser ────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');

{
  const ast = parse('conflict fair payment and creative freedom for leverage chain into tension report');
  const s = ast.statements[0];
  assert('conflict parser: ConflictStmt type', s.type === 'ConflictStmt', s.type);
  assert('conflict parser: desire1Name', s.desire1Name === 'fair payment');
  assert('conflict parser: desire2Name', s.desire2Name === 'creative freedom');
  assert('conflict parser: chainName', s.chainName === 'leverage chain');
  assert('conflict parser: intoName', s.intoName === 'tension report');
}

{
  const ast = parse('weigh tension report into resolution');
  const s = ast.statements[0];
  assert('weigh parser: WeighStmt type', s.type === 'WeighStmt', s.type);
  assert('weigh parser: conflictName', s.conflictName === 'tension report');
  assert('weigh parser: intoName', s.intoName === 'resolution');
}

// ── Codegen ───────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');

{
  const js = compile('conflict fair payment and creative freedom for leverage chain into tension report');
  assert('conflict codegen: EventMathConflict constructor', js.includes('EventMathConflict'));
  assert('conflict codegen: desire1 var', js.includes('fair_payment'));
  assert('conflict codegen: desire2 var', js.includes('creative_freedom'));
  assert('conflict codegen: chain var', js.includes('leverage_chain'));
}

{
  const js = compile('weigh tension report into resolution');
  assert('weigh codegen: EventMathWeigh constructor', js.includes('EventMathWeigh'));
  assert('weigh codegen: conflict var', js.includes('tension_report'));
}

// ── Formatter ─────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');

{
  assert('conflict formatter: round-trips',
    format('conflict fair payment and creative freedom for leverage chain into tension report')
      .includes('conflict fair payment and creative freedom for leverage chain into tension report'));
  assert('weigh formatter: round-trips',
    format('weigh tension report into resolution').includes('weigh tension report into resolution'));
}

// ── End-to-end ────────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');

{
  const src = `
assume market rate is 500

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
  direction is more than
  satisfied when is payment more than market rate
  priority is 3
end
end

desire creative freedom
category creator goal
matter
  scenario is brand negotiation
  direction is more than
  satisfied when is creative control more than 50
  priority is 2
end
end

conflict fair payment and creative freedom for leverage chain into tension report
show tension report

weigh tension report into resolution
show resolution
`;
  try {
    const js = compile(src);
    const fn = new Function('require', 'console', 'module', js +
      '\nreturn { tr: typeof tension_report !== "undefined" ? tension_report : null, res: typeof resolution !== "undefined" ? resolution : null };');
    let out = '';
    const { tr, res } = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });

    assert('e2e conflict: tension_report created', tr !== null);
    assert('e2e conflict: has label', tr && ['ALIGNED','COMPETITIVE','OPPOSED'].includes(tr.label), tr && tr.label);
    assert('e2e conflict: render in output', out.includes('CONFLICT'));

    assert('e2e weigh: resolution created', res !== null);
    assert('e2e weigh: winner non-empty', res && res.winner.length > 0);
    assert('e2e weigh: render in output', out.includes('WEIGH'));

    // fair payment is satisfied (620 > 500), creative control not in chain → score 0
    // weight 3 vs weight 2 → fair payment wins
    assert('e2e weigh: fair payment wins (weight×score dominates)', res && res.winner === 'fair payment', res && res.winner);
  } catch (e) {
    assert('e2e: no runtime error', false, e.message);
  }
}

// ── Priority in end-to-end compile ───────────────────────────────────
console.log('\n─ Priority in compiled desire ─');

{
  const src = `
desire priority desire
matter
  direction is more than
  satisfied when is payment more than 100
  priority is 7
end
end
`;
  const js = compile(src);
  assert('priority in codegen: priority field emitted', js.includes('priority') && js.includes('"7"'), js.slice(0, 400));
}

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
