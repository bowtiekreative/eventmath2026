/**
 * EventMath v2.23 — Organizational Intelligence test suite
 *
 * Covers: role, hierarchy, incentive, align, credibility
 *
 * Run: node tests/v2.23-test.js
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ': ' + detail : ''}`);
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

// ── Tokenizer ─────────────────────────────────────────────────────

console.log('\n── Tokenizer: role ──');
{
  const toks = tokenize('role CEO');
  assert('role keyword emitted', toks[0].type === 'KEYWORD' && toks[0].value === 'role');
  assert('role name emitted', toks[1].type === 'NAME' && toks[1].value === 'CEO');
}

console.log('\n── Tokenizer: hierarchy ──');
{
  const toks = tokenize('hierarchy company');
  assert('hierarchy keyword emitted', toks[0].type === 'KEYWORD' && toks[0].value === 'hierarchy');
  assert('hierarchy name emitted', toks[1].type === 'NAME' && toks[1].value === 'company');
}

console.log('\n── Tokenizer: incentive ──');
{
  const toks = tokenize('incentive CEO and Manager in company into gap');
  assert('INCENTIVE_STMT token emitted', toks[0].type === 'INCENTIVE_STMT');
  assert('raw line preserved', toks[0].value.raw.includes('incentive'));
}

console.log('\n── Tokenizer: align ──');
{
  const toks = tokenize('align CEO and VP into alignment result');
  assert('ALIGN_STMT token emitted', toks[0].type === 'ALIGN_STMT');
  assert('raw line preserved', toks[0].value.raw.includes('align'));
}

console.log('\n── Tokenizer: credibility ──');
{
  const toks = tokenize('credibility speech text into signals');
  assert('CREDIBILITY_STMT emitted', toks[0].type === 'CREDIBILITY_STMT');
  assert('subject extracted', toks[0].value.subject === 'speech text');
  assert('intoName extracted', toks[0].value.intoName === 'signals');
}

{
  const toks = tokenize('credibility statement against baseline into report');
  assert('credibility against baseline: subject', toks[0].value.subject === 'statement');
  assert('credibility against baseline: baseline', toks[0].value.baseline === 'baseline');
  assert('credibility against baseline: into', toks[0].value.intoName === 'report');
}

// ── Parser ────────────────────────────────────────────────────────

console.log('\n── Parser: role block ──');
{
  const ast = parse('role CEO\nfocus profit growth\nhorizon yearly\nend');
  const stmt = ast.statements[0];
  assert('RoleStmt type', stmt.type === 'RoleStmt');
  assert('RoleStmt name', stmt.name === 'CEO');
  assert('RoleStmt focus field', stmt.fields.focus === 'profit growth');
  assert('RoleStmt horizon field', stmt.fields.horizon === 'yearly');
}

console.log('\n── Parser: hierarchy block ──');
{
  const ast = parse('hierarchy company\nCEO\nVP\nManager\nend');
  const stmt = ast.statements[0];
  assert('HierarchyStmt type', stmt.type === 'HierarchyStmt');
  assert('HierarchyStmt name', stmt.name === 'company');
  assert('HierarchyStmt roleNames includes CEO', stmt.roleNames.includes('CEO'));
  assert('HierarchyStmt roleNames includes VP', stmt.roleNames.includes('VP'));
  assert('HierarchyStmt roleNames includes Manager', stmt.roleNames.includes('Manager'));
}

console.log('\n── Parser: incentive statement ──');
{
  const ast = parse('incentive CEO and Manager in company into gap');
  const stmt = ast.statements[0];
  assert('IncentiveStmt type', stmt.type === 'IncentiveStmt');
  assert('IncentiveStmt role1', stmt.role1 === 'CEO');
  assert('IncentiveStmt role2', stmt.role2 === 'Manager');
  assert('IncentiveStmt hierarchyName', stmt.hierarchyName === 'company');
  assert('IncentiveStmt intoName', stmt.intoName === 'gap');
}

{
  const ast = parse('incentive CEO and Engineer into alignment');
  const stmt = ast.statements[0];
  assert('incentive without hierarchy: role1', stmt.role1 === 'CEO');
  assert('incentive without hierarchy: hierarchyName null', stmt.hierarchyName === null);
  assert('incentive without hierarchy: intoName', stmt.intoName === 'alignment');
}

console.log('\n── Parser: align statement ──');
{
  const ast = parse('align CEO and VP and Manager in company into team sync');
  const stmt = ast.statements[0];
  assert('AlignStmt type', stmt.type === 'AlignStmt');
  assert('AlignStmt roleNames has CEO', stmt.roleNames.includes('CEO'));
  assert('AlignStmt roleNames has VP', stmt.roleNames.includes('VP'));
  assert('AlignStmt hierarchyName', stmt.hierarchyName === 'company');
  assert('AlignStmt intoName', stmt.intoName === 'team sync');
}

{
  const ast = parse('align CEO and Manager for cost reduction in org into results');
  const stmt = ast.statements[0];
  assert('align with topic: topic', stmt.topic === 'cost reduction');
  assert('align with topic: hierarchyName', stmt.hierarchyName === 'org');
}

console.log('\n── Parser: credibility statement ──');
{
  const ast = parse('credibility speech text into analysis');
  const stmt = ast.statements[0];
  assert('CredibilityStmt type', stmt.type === 'CredibilityStmt');
  assert('CredibilityStmt subject', stmt.subject === 'speech text');
  assert('CredibilityStmt baseline null', stmt.baseline === null);
  assert('CredibilityStmt intoName', stmt.intoName === 'analysis');
}

{
  const ast = parse('credibility statement against reference text into signals');
  const stmt = ast.statements[0];
  assert('credibility with baseline: subject', stmt.subject === 'statement');
  assert('credibility with baseline: baseline', stmt.baseline === 'reference text');
  assert('credibility with baseline: intoName', stmt.intoName === 'signals');
}

// ── Codegen ───────────────────────────────────────────────────────

console.log('\n── Codegen: role ──');
{
  const code = compile('role CEO\nfocus profit growth\nend');
  assert('requires incentive runtime', code.includes('eventmath-incentive-runtime'));
  assert('calls defineRole', code.includes('defineRole'));
  assert('passes CEO name', code.includes('"CEO"'));
}

console.log('\n── Codegen: hierarchy ──');
{
  const code = compile('role CEO\nend\nhierarchy company\nCEO\nend');
  assert('calls buildHierarchy', code.includes('buildHierarchy'));
  assert('passes company name', code.includes('"company"'));
  assert('includes CEO in roles array', code.includes('"CEO"'));
}

console.log('\n── Codegen: incentive ──');
{
  const code = compile('incentive CEO and Engineer into gap report');
  assert('calls mapIncentives', code.includes('mapIncentives'));
  assert('gap_report variable hoisted', code.includes('gap_report'));
}

console.log('\n── Codegen: align ──');
{
  const code = compile('align CEO and VP into sync result');
  assert('calls alignRoles', code.includes('alignRoles'));
  assert('sync_result variable hoisted', code.includes('sync_result'));
}

console.log('\n── Codegen: credibility ──');
{
  const code = compile('mark speech text as "We have always won."\ncredibility speech text into signals');
  assert('requires credibility runtime', code.includes('eventmath-credibility-runtime'));
  assert('calls analyzeCredibility', code.includes('analyzeCredibility'));
  assert('signals variable hoisted', code.includes('signals'));
}

console.log('\n── Codegen: async not forced by incentive/credibility ──');
{
  const code = compile('credibility speech text into signals');
  // credibility is synchronous — should NOT force async wrapper
  assert('no async wrapper from credibility alone', !code.includes('(async () => {'));
}

{
  const code = compile('role CEO\nend\nhierarchy company\nCEO\nend');
  // incentive/hierarchy is synchronous
  assert('no async wrapper from role/hierarchy alone', !code.includes('(async () => {'));
}

// ── Integration ───────────────────────────────────────────────────

console.log('\n── Integration ──');
{
  // Full org mapping program
  const src = `
role CEO
  focus profit growth
  horizon yearly
end

role Engineer
  focus shipping quality
  horizon weekly
end

hierarchy company
  CEO
  Engineer
end

incentive CEO and Engineer in company into alignment gap
show alignment gap
`;
  const code = compile(src);
  assert('full incentive program compiles', !!code);
  assert('all three statements included', code.includes('defineRole') && code.includes('buildHierarchy') && code.includes('mapIncentives'));
  assert('no parse errors', !parse(src).errors);
}

{
  // Credibility analysis program
  const src = `
mark statement as "We absolutely never had any problems whatsoever."
credibility statement into linguistic signals
show linguistic signals
`;
  const code = compile(src);
  assert('credibility program compiles', !!code);
  assert('analyzeCredibility called', code.includes('analyzeCredibility'));
}

{
  // Existing v2.22 features unaffected
  const src = `
remember "test key" as "hello"
recall "test key" into stored value
show stored value
`;
  const code = compile(src);
  assert('v2.22 recall still works alongside v2.23', code.includes('recallValue'));
}

// ── Summary ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  All ${passed} tests passed.`);
} else {
  console.log(`  ${passed} passed, ${failed} failed.`);
}
console.log('═══════════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
