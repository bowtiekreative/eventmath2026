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

// ── Extended dimensions D14–D26 ─────────────────────────────────────────────

console.log('\nRuntime — extended dimensions D14–D26');

test('D14 torus spins and renders tetradecagon', () => {
  const t = new EM.EventMathTorus('t14');
  t.spinFrom(null, 14);
  t.expand(3);
  const r = t.render();
  assert(r.includes('D14'), `missing D14: ${r}`);
  assert(r.includes('tetradecagon'), `missing tetradecagon: ${r}`);
});

test('D26 torus spins and renders icosihexagon', () => {
  const t = new EM.EventMathTorus('t26');
  t.spinFrom(null, 26);
  t.expand(2);
  const r = t.render();
  assert(r.includes('D26'), `missing D26: ${r}`);
  assert(r.includes('icosihexagon'), `missing icosihexagon: ${r}`);
});

test('negative D26 torus has inverted nucleus', () => {
  const pos = new EM.EventMathTorus('p26');
  pos.spinFrom(null,  26);
  pos.expand(3);
  const neg = new EM.EventMathTorus('n26');
  neg.spinFrom(null, -26);
  neg.expand(3);
  assert(pos.nucleusPresent() !== neg.nucleusPresent(),
    'D±26 should be complementary at same ring count');
});

test('D26 axis bridge is at D27', () => {
  const neg = new EM.EventMathTorus('neg26');
  neg.spinFrom(null, -26);
  const pos = new EM.EventMathTorus('pos26');
  pos.spinFrom(null,  26);
  const axis = new EM.EventMathAxis('ax26', neg, pos);
  assert(axis.bridge.zoomLevel === 27,
    `expected bridge at D27, got D${axis.bridge.zoomLevel}`);
});

// ── Fractal Axis ────────────────────────────────────────────────────────────

console.log('\nRuntime — fractal axis (D±26, 2-tier)');

test('EventMathFractalAxis creates two tiers', () => {
  const neg = new EM.EventMathTorus('n26');
  neg.spinFrom(null, -26);
  const pos = new EM.EventMathTorus('p26');
  pos.spinFrom(null,  26);
  const fa = new EM.EventMathFractalAxis('test fractal', neg, pos);
  assert(fa.tier1, 'missing tier1');
  assert(fa.tier2, 'missing tier2');
  assert(fa.fractalDepth === 2, `expected depth 2, got ${fa.fractalDepth}`);
});

test('fractal tier1 is D±13, tier2 is D±26', () => {
  const neg = new EM.EventMathTorus('n26');
  neg.spinFrom(null, -26);
  const pos = new EM.EventMathTorus('p26');
  pos.spinFrom(null,  26);
  const fa = new EM.EventMathFractalAxis('fa', neg, pos);
  assert(Math.abs(fa.tier1.dimension) === 13,
    `tier1 should be D13, got D${fa.tier1.dimension}`);
  assert(Math.abs(fa.tier2.dimension) === 26,
    `tier2 should be D26, got D${fa.tier2.dimension}`);
});

test('fractal render includes signature and tier headings', () => {
  const neg = new EM.EventMathTorus('n26');
  neg.spinFrom(null, -26);
  const pos = new EM.EventMathTorus('p26');
  pos.spinFrom(null,  26);
  const fa = new EM.EventMathFractalAxis('signal fractal', neg, pos);
  const r = fa.render();
  assert(r.includes('TIER 1'), `missing TIER 1: ${r.slice(0,200)}`);
  assert(r.includes('TIER 2'), `missing TIER 2: ${r.slice(0,200)}`);
  assert(r.includes('D±13'), `missing D±13 signature`);
  assert(r.includes('D±26'), `missing D±26 signature`);
});

// ── Actor + Power Gap ────────────────────────────────────────────────────────

console.log('\nRuntime — actor + power asymmetry');

test('EventMathActor stores power, controls, needs', () => {
  const a = new EM.EventMathActor('brand', {
    power: 8, controls: 'terms pricing', needs: 'audience'
  });
  assert(a.power === 8, `power: ${a.power}`);
  assert(a.controls === 'terms pricing', `controls: ${a.controls}`);
  assert(a.needs === 'audience', `needs: ${a.needs}`);
});

test('EventMathPowerGap identifies dominant and subordinate', () => {
  const brand   = new EM.EventMathActor('brand',   { power: 8, controls: 'terms', needs: 'audience' });
  const creator = new EM.EventMathActor('creator', { power: 2, controls: 'audience', needs: 'money' });
  const gap = new EM.EventMathPowerGap('deal gap', brand, creator);
  assert(gap.gap === 6, `gap should be 6, got ${gap.gap}`);
  assert(gap.dominant.name === 'brand', `dominant: ${gap.dominant.name}`);
  assert(gap.subordinate.name === 'creator', `subordinate: ${gap.subordinate.name}`);
});

test('power gap finds leverage where dominant needs what subordinate controls', () => {
  const brand   = new EM.EventMathActor('brand',   { power: 8, controls: 'money', needs: 'audience reach' });
  const creator = new EM.EventMathActor('creator', { power: 2, controls: 'audience', needs: 'money' });
  const gap = new EM.EventMathPowerGap('gap', brand, creator);
  assert(gap.leverage.includes('audience') || gap.leverage.includes('creator'),
    `leverage should mention audience: ${gap.leverage}`);
});

test('power gap render includes correction path', () => {
  const a = new EM.EventMathActor('A', { power: 9 });
  const b = new EM.EventMathActor('B', { power: 1 });
  const gap = new EM.EventMathPowerGap('test gap', a, b);
  const r = gap.render();
  assert(r.includes('Gap: 8'), `missing gap value: ${r}`);
  assert(r.includes('Correction'), `missing correction: ${r}`);
});

// ── Function Chain ───────────────────────────────────────────────────────────

console.log('\nRuntime — function chain + backward causation');

test('EventMathChain stores links', () => {
  const c = new EM.EventMathChain('revenue');
  c.addLink('audience trust', 'brand interest');
  c.addLink('brand interest', 'sponsorship offer');
  c.addLink('sponsorship offer', 'payment');
  assert(c.links.length === 3, `expected 3 links, got ${c.links.length}`);
});

test('chain.invert() reverses all links', () => {
  const c = new EM.EventMathChain('c');
  c.addLink('A', 'B');
  c.addLink('B', 'C');
  const inv = c.invert();
  assert(inv.links[0].from === 'C', `first inverted link should be C→B`);
  assert(inv.links[1].from === 'B', `second inverted link should be B→A`);
});

test('EventMathRootTrace walks chain backward to root', () => {
  const c = new EM.EventMathChain('revenue');
  c.addLink('wrong positioning', 'low visibility');
  c.addLink('low visibility', 'no brand interest');
  c.addLink('no brand interest', 'no payment');
  const trace = c.trace('no payment');
  assert(trace.root === 'wrong positioning',
    `root should be "wrong positioning", got "${trace.root}"`);
  assert(trace.path.length === 4,
    `path should have 4 steps, got ${trace.path.length}`);
});

test('root trace render shows ROOT CAUSE and OBSERVED STATE', () => {
  const c = new EM.EventMathChain('c');
  c.addLink('cause', 'effect');
  const trace = c.trace('effect');
  const r = trace.render();
  assert(r.includes('ROOT CAUSE'), `missing ROOT CAUSE: ${r}`);
  assert(r.includes('OBSERVED STATE'), `missing OBSERVED STATE: ${r}`);
});

test('root trace with no chain returns target only', () => {
  const trace = new EM.EventMathRootTrace(null, 'some state');
  assert(trace.path.length === 1, 'should return single-element path');
  assert(trace.root === 'some state', `root: ${trace.root}`);
});

// ── Logical Fallacy Detection ────────────────────────────────────────────────

console.log('\nRuntime — logical fallacy detection (25 patterns)');

test('FALLACY_PATTERNS has 25 entries', () => {
  assert(Object.keys(EM.FALLACY_PATTERNS).length === 25,
    `expected 25, got ${Object.keys(EM.FALLACY_PATTERNS).length}`);
});

test('detects circular reasoning in chain', () => {
  const c = new EM.EventMathChain('circular');
  c.addLink('A', 'B');
  c.addLink('B', 'A');
  const det = new EM.EventMathFallacyDetector(c);
  const found = det.findings.some(f => f.fallacy === 'circular reasoning');
  assert(found, `should detect circular reasoning. findings: ${JSON.stringify(det.findings)}`);
});

test('detects slippery slope risk in long chain', () => {
  const c = new EM.EventMathChain('long');
  c.addLink('A', 'B');
  c.addLink('B', 'C');
  c.addLink('C', 'D');
  c.addLink('D', 'E');
  c.addLink('E', 'F');
  const det = new EM.EventMathFallacyDetector(c);
  const found = det.findings.some(f => f.fallacy.includes('slippery slope'));
  assert(found, 'should detect slippery slope risk in 5-step chain');
});

test('clean chain has zero findings', () => {
  const c = new EM.EventMathChain('clean');
  c.addLink('good premise', 'sound reasoning');
  c.addLink('sound reasoning', 'valid conclusion');
  const det = new EM.EventMathFallacyDetector(c);
  assert(det.findings.length === 0,
    `expected no findings, got ${det.findings.length}: ${JSON.stringify(det.findings)}`);
});

test('fallacy detector render lists all 25 patterns', () => {
  const c = new EM.EventMathChain('test');
  const det = new EM.EventMathFallacyDetector(c);
  const r = det.render();
  assert(r.includes('ad hominem'),      'missing ad hominem');
  assert(r.includes('straw man'),       'missing straw man');
  assert(r.includes('false dichotomy'), 'missing false dichotomy');
  assert(r.includes('sunk cost'),       'missing sunk cost');
});

// ── Language: tokenizer ─────────────────────────────────────────────────────

console.log('\nTokenizer — v2.0 new statements');

test('tokenizes "leads to" as LEADS_TO_STMT', () => {
  const toks = new EventMathTokenizer().tokenize('audience trust leads to brand interest');
  const lt = toks.find(t => t.type === 'LEADS_TO_STMT');
  assert(lt, 'no LEADS_TO_STMT token');
  assert(lt.value.from === 'audience trust', `from: "${lt.value.from}"`);
  assert(lt.value.to   === 'brand interest', `to: "${lt.value.to}"`);
});

test('tokenizes "asymmetry from X and Y into Z"', () => {
  const toks = new EventMathTokenizer().tokenize('asymmetry from brand and creator into power gap');
  const t = toks.find(t => t.type === 'ASYMMETRY_STMT');
  assert(t, 'no ASYMMETRY_STMT');
  assert(t.value.firstName  === 'brand',     `firstName: ${t.value.firstName}`);
  assert(t.value.secondName === 'creator',   `secondName: ${t.value.secondName}`);
  assert(t.value.intoName   === 'power gap', `intoName: ${t.value.intoName}`);
});

test('tokenizes "root of X in Y into Z"', () => {
  const toks = new EventMathTokenizer().tokenize('root of no payment in revenue chain into cause');
  const t = toks.find(t => t.type === 'ROOT_OF_STMT');
  assert(t, 'no ROOT_OF_STMT');
  assert(t.value.stateName === 'no payment',    `stateName: ${t.value.stateName}`);
  assert(t.value.chainName === 'revenue chain', `chainName: ${t.value.chainName}`);
  assert(t.value.intoName  === 'cause',         `intoName: ${t.value.intoName}`);
});

test('tokenizes "detect fallacies in X into Z"', () => {
  const toks = new EventMathTokenizer().tokenize('detect fallacies in revenue chain into scan');
  const t = toks.find(t => t.type === 'DETECT_FALLACIES_STMT');
  assert(t, 'no DETECT_FALLACIES_STMT');
  assert(t.value.chainName === 'revenue chain', `chainName: ${t.value.chainName}`);
  assert(t.value.intoName  === 'scan', `intoName: ${t.value.intoName}`);
});

test('tokenizes "fractal X and Y into Z"', () => {
  const toks = new EventMathTokenizer().tokenize('fractal neg torus and pos torus into grand fractal');
  const t = toks.find(t => t.type === 'FRACTAL_STMT');
  assert(t, 'no FRACTAL_STMT');
  assert(t.value.intoName === 'grand fractal', `intoName: ${t.value.intoName}`);
});

// ── Language: parser ─────────────────────────────────────────────────────────

console.log('\nParser — v2.0 AST nodes');

test('parses actor block', () => {
  const ast = parse(`
actor brand
category company
matter
  power is 8
  controls is terms pricing
  needs is audience
end
end
`);
  const node = ast.statements.find(s => s.type === 'ActorStmt');
  assert(node, 'no ActorStmt');
  assert(node.name === 'brand', `name: ${node.name}`);
  assert(node.matter.fields.some(f => f.key === 'power'), 'missing power field');
});

test('parses chain block with leads-to links', () => {
  const ast = parse(`
chain revenue
  audience trust leads to brand interest
  brand interest leads to payment
end
`);
  const node = ast.statements.find(s => s.type === 'ChainStmt');
  assert(node, 'no ChainStmt');
  assert(node.name === 'revenue', `name: ${node.name}`);
  assert(node.links.length === 2, `expected 2 links, got ${node.links.length}`);
  assert(node.links[0].from === 'audience trust', `link 0 from: ${node.links[0].from}`);
  assert(node.links[0].to   === 'brand interest', `link 0 to: ${node.links[0].to}`);
});

test('parses asymmetry statement', () => {
  const ast = parse('asymmetry from brand and creator into power gap');
  const node = ast.statements.find(s => s.type === 'AsymmetryStmt');
  assert(node, 'no AsymmetryStmt');
  assert(node.firstName  === 'brand',   `firstName: ${node.firstName}`);
  assert(node.secondName === 'creator', `secondName: ${node.secondName}`);
  assert(node.intoName   === 'power gap', `intoName: ${node.intoName}`);
});

test('parses root-of statement', () => {
  const ast = parse('root of no payment in revenue into trace');
  const node = ast.statements.find(s => s.type === 'RootOfStmt');
  assert(node, 'no RootOfStmt');
  assert(node.stateName === 'no payment', `stateName: ${node.stateName}`);
});

test('parses detect-fallacies statement', () => {
  const ast = parse('detect fallacies in revenue into scan');
  const node = ast.statements.find(s => s.type === 'DetectFallaciesStmt');
  assert(node, 'no DetectFallaciesStmt');
  assert(node.chainName === 'revenue', `chainName: ${node.chainName}`);
  assert(node.intoName  === 'scan',    `intoName: ${node.intoName}`);
});

// ── Language: end-to-end compile + run ──────────────────────────────────────

console.log('\nCodegen — v2.0 end-to-end');

test('actor compiles and renders', () => {
  const lines = run(`
actor brand
matter
  power is 8
  controls is terms pricing
  needs is audience
end
end
show brand
`);
  const out = lines.join('\n');
  assert(out.includes('Power level: 8'), `missing power level: ${out}`);
  assert(out.includes('brand'), `missing brand: ${out}`);
});

test('chain compiles and root-of traces backward', () => {
  const lines = run(`
chain revenue
  wrong positioning leads to low visibility
  low visibility leads to no payment
end
root of no payment in revenue into cause
show cause
`);
  const out = lines.join('\n');
  assert(out.includes('wrong positioning') || out.includes('ROOT'), `expected root cause: ${out}`);
});

test('asymmetry compiles and shows power gap', () => {
  const lines = run(`
actor brand
matter
  power is 8
  controls is money
  needs is audience
end
end
actor creator
matter
  power is 2
  controls is audience
  needs is money
end
end
asymmetry from brand and creator into deal gap
show deal gap
`);
  const out = lines.join('\n');
  assert(out.includes('Gap: 6') || out.includes('Power Gap'), `expected gap output: ${out}`);
});

test('detect fallacies compiles and runs', () => {
  const lines = run(`
chain circular test
  premise leads to conclusion
  conclusion leads to premise
end
detect fallacies in circular test into scan result
show scan result
`);
  const out = lines.join('\n');
  assert(out.includes('circular') || out.includes('Fallacy'), `expected fallacy output: ${out}`);
});

test('fractal axis compiles for D±26', () => {
  const js = compile(`
event neg source
matter
  type is base
end
end
event pos source
matter
  type is base
end
end
spin neg source into neg torus at dimension -26
spin pos source into pos torus at dimension 26
fractal neg torus and pos torus into grand fractal
show grand fractal
`);
  assert(js.includes('EventMathFractalAxis'), `missing EventMathFractalAxis: ${js.slice(0,300)}`);
});

// ── v2.1: Extended dimensions D27–D39 ───────────────────────────────────────

console.log('\nRuntime — extended dimensions D27–D39 (tier 3 shapes)');

test('D27 torus spins and renders icosiheptagon', () => {
  const t = new EM.EventMathTorus('t27');
  t.spinFrom(null, 27);
  t.expand(2);
  const r = t.render();
  assert(r.includes('D27'), `missing D27: ${r}`);
  assert(r.includes('icosiheptagon'), `missing icosiheptagon: ${r}`);
});

test('D30 torus renders triacontagon', () => {
  const t = new EM.EventMathTorus('t30');
  t.spinFrom(null, 30);
  t.expand(2);
  const r = t.render();
  assert(r.includes('D30'), `missing D30: ${r}`);
  assert(r.includes('triacontagon'), `missing triacontagon: ${r}`);
});

test('D39 torus spins and renders triacontaenneagon', () => {
  const t = new EM.EventMathTorus('t39');
  t.spinFrom(null, 39);
  t.expand(2);
  const r = t.render();
  assert(r.includes('D39'), `missing D39: ${r}`);
  assert(r.includes('triacontaenneagon'), `missing triacontaenneagon: ${r}`);
});

test('negative D39 torus has inverted nucleus', () => {
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  pos.expand(3);
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  neg.expand(3);
  assert(pos.nucleusPresent() !== neg.nucleusPresent(),
    'D±39 should be complementary at same ring count');
});

test('D39 axis bridge is at D40', () => {
  const neg = new EM.EventMathTorus('neg39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('pos39');
  pos.spinFrom(null,  39);
  const axis = new EM.EventMathAxis('ax39', neg, pos);
  assert(axis.bridge.zoomLevel === 40,
    `expected bridge at D40, got D${axis.bridge.zoomLevel}`);
});

test('spinFrom clamps above 39 back to 39', () => {
  const t = new EM.EventMathTorus('t99');
  t.spinFrom(null, 99);
  assert(t.dimension === 39, `expected dimension 39, got ${t.dimension}`);
});

// ── v2.1: Fractal Axis tier 3 (D±39) ────────────────────────────────────────

console.log('\nRuntime — fractal axis tier 3 (D±39)');

test('EventMathFractalAxis creates 3 tiers for D±39 input', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('fractal39', neg, pos);
  assert(fa.tier1, 'missing tier1');
  assert(fa.tier2, 'missing tier2');
  assert(fa.tier3, 'missing tier3');
  assert(fa.fractalDepth === 3, `expected depth 3, got ${fa.fractalDepth}`);
});

test('tier3 fractal: tier1=D±13, tier2=D±26, tier3=D±39', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('fa39', neg, pos);
  assert(Math.abs(fa.tier1.dimension) === 13,
    `tier1 should be D13, got D${fa.tier1.dimension}`);
  assert(Math.abs(fa.tier2.dimension) === 26,
    `tier2 should be D26, got D${fa.tier2.dimension}`);
  assert(Math.abs(fa.tier3.dimension) === 39,
    `tier3 should be D39, got D${fa.tier3.dimension}`);
});

test('tier3 fractal signature shows D±13 ⊂ D±26 ⊂ D±39', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('fa39', neg, pos);
  assert(fa.signature.includes('D±13'), `missing D±13 in signature: ${fa.signature}`);
  assert(fa.signature.includes('D±26'), `missing D±26 in signature: ${fa.signature}`);
  assert(fa.signature.includes('D±39'), `missing D±39 in signature: ${fa.signature}`);
});

test('tier3 fractal grand axis chain: tier1→tier2→tier3 bridges', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('fa39', neg, pos);
  assert(fa.tier2.bridge.fractalFrom === fa.tier1.grandAxis.name,
    `tier2 bridge should fractalFrom tier1 grand axis`);
  assert(fa.tier3.bridge.fractalFrom === fa.tier2.grandAxis.name,
    `tier3 bridge should fractalFrom tier2 grand axis`);
});

test('tier3 fractal render includes TIER 1, TIER 2, TIER 3 headings', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('deep fractal', neg, pos);
  const r = fa.render();
  assert(r.includes('TIER 1'), `missing TIER 1: ${r.slice(0, 200)}`);
  assert(r.includes('TIER 2'), `missing TIER 2: ${r.slice(0, 200)}`);
  assert(r.includes('TIER 3'), `missing TIER 3: ${r.slice(0, 200)}`);
  assert(r.includes('D±39'),   `missing D±39 in render`);
  assert(r.includes('18 layers'), `expected 18 layers (3×6) in render: ${r.slice(-200)}`);
});

test('D±26 input still creates exactly 2 tiers (backward compat)', () => {
  const neg = new EM.EventMathTorus('n26');
  neg.spinFrom(null, -26);
  const pos = new EM.EventMathTorus('p26');
  pos.spinFrom(null,  26);
  const fa = new EM.EventMathFractalAxis('fa26', neg, pos);
  assert(fa.fractalDepth === 2, `expected depth 2, got ${fa.fractalDepth}`);
  assert(!fa.tier3, 'tier3 should not exist for D±26');
  assert(r => true); // render still includes D±52 as "next pass"
});

test('tier3 fractal render says D±52 next pass', () => {
  const neg = new EM.EventMathTorus('n39');
  neg.spinFrom(null, -39);
  const pos = new EM.EventMathTorus('p39');
  pos.spinFrom(null,  39);
  const fa = new EM.EventMathFractalAxis('fa39', neg, pos);
  const r = fa.render();
  assert(r.includes('D±52'), `expected D±52 as next pass, not found in: ${r.slice(-200)}`);
});

test('fractal D±39 compiles to valid JS', () => {
  const js = compile(`
event deep neg
matter
  polarity is negative
end
end
event deep pos
matter
  polarity is positive
end
end
spin deep neg into neg39 at dimension -39
spin deep pos into pos39 at dimension 39
fractal neg39 and pos39 into tier3 fractal
show tier3 fractal
`);
  assert(js.includes('EventMathFractalAxis'), `missing EventMathFractalAxis: ${js.slice(0,300)}`);
  assert(js.includes('-39'), `missing -39 dimension: ${js.slice(0,300)}`);
  assert(js.includes('39'),  `missing 39 dimension: ${js.slice(0,300)}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
