'use strict';
/**
 * EventMath v2.12 — core language completion
 * void, guard, match/arm, escape, skip, observe, every, clear,
 * on birth/death/shift/EVENT, off, trigger, emit, pull,
 * raindrop, ground, new, await, slot, burst
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

// ── Runtime: EventMathGround ─────────────────────────────────────────
console.log('\n─ Runtime: EventMathGround ─');
{
  assert('ground: singleton exists', EM.EventMathGround !== undefined);
  assert('ground: has .get',    typeof EM.EventMathGround.get    === 'function');
  assert('ground: has .set',    typeof EM.EventMathGround.set    === 'function');
  assert('ground: has .remove', typeof EM.EventMathGround.remove === 'function');
  assert('ground: has .clear',  typeof EM.EventMathGround.clear  === 'function');
}
{
  // In Node.js, localStorage is not available — methods should not throw
  assert('ground: set does not throw',    (() => { try { EM.EventMathGround.set('k','v'); return true; } catch(_) { return false; } })());
  assert('ground: get returns null',      EM.EventMathGround.get('k') === null, EM.EventMathGround.get('k'));
  assert('ground: remove does not throw', (() => { try { EM.EventMathGround.remove('k'); return true; } catch(_) { return false; } })());
  assert('ground: clear does not throw',  (() => { try { EM.EventMathGround.clear(); return true; } catch(_) { return false; } })());
}

// ── Runtime: EventMathRaindrop ────────────────────────────────────────
console.log('\n─ Runtime: EventMathRaindrop ─');
{
  const rd = new EM.EventMathRaindrop('text', 'username', {});
  assert('raindrop: constructor sets rdType', rd.rdType === 'text', rd.rdType);
  assert('raindrop: constructor sets name',   rd.name   === 'username', rd.name);
  assert('raindrop: has render()',  typeof rd.render === 'function');
  const html = rd.render();
  assert('raindrop: render returns string', typeof html === 'string', html);
  assert('raindrop: render has input tag',  html.includes('<input'), html);
  assert('raindrop: render has type attr',  html.includes('type="text"'), html);
  assert('raindrop: render has name attr',  html.includes('name="username"'), html);
}
{
  const rd = new EM.EventMathRaindrop('email', 'contact', { placeholder: 'you@example.com' });
  const html = rd.render();
  assert('raindrop: placeholder in render', html.includes('placeholder'), html);
}
{
  const rd = new EM.EventMathRaindrop('checkbox', 'agree', { label: 'I agree' });
  const html = rd.render();
  assert('raindrop: label wraps input', html.includes('<label>'), html);
}

// ── Tokenizer: void ───────────────────────────────────────────────────
console.log('\n─ Tokenizer: void ─');
{
  const tokens = tok('rain x is void');
  assert('void tok: RAIN_STMT with value void', tokens[0].type === 'RAIN_STMT' && tokens[0].value.value === 'void', tokens[0]);
}

// ── Tokenizer: guard ─────────────────────────────────────────────────
console.log('\n─ Tokenizer: guard ─');
{
  const tokens = tok('guard data else reflect void');
  assert('guard tok: GUARD_STMT', tokens[0].type === 'GUARD_STMT', tokens[0].type);
  assert('guard tok: condition', tokens[0].value.condition === 'data', tokens[0].value.condition);
  assert('guard tok: fallback',  tokens[0].value.fallback  === 'void', tokens[0].value.fallback);
}
{
  const tokens = tok('guard name else return');
  assert('guard tok: no-reflect fallback', tokens[0].value.fallback === 'return', tokens[0].value.fallback);
}

// ── Tokenizer: match / arm ────────────────────────────────────────────
console.log('\n─ Tokenizer: match / arm ─');
{
  const tokens = tok('match status');
  assert('match tok: MATCH_STMT', tokens[0].type === 'MATCH_STMT', tokens[0].type);
  assert('match tok: subject',    tokens[0].value.subject === 'status', tokens[0].value.subject);
}
{
  const tokens = tok('arm published');
  assert('arm tok: ARM_STMT',   tokens[0].type === 'ARM_STMT', tokens[0].type);
  assert('arm tok: pattern',    tokens[0].value.pattern === 'published', tokens[0].value.pattern);
}
{
  const tokens = tok('arm else');
  assert('arm else tok: pattern else', tokens[0].value.pattern === 'else', tokens[0].value.pattern);
}

// ── Tokenizer: escape / skip ─────────────────────────────────────────
console.log('\n─ Tokenizer: escape / skip ─');
{
  const tokens = tok('escape');
  assert('escape tok: KEYWORD escape', tokens[0].type === 'KEYWORD' && tokens[0].value === 'escape', tokens[0]);
}
{
  const tokens = tok('skip');
  assert('skip tok: KEYWORD skip', tokens[0].type === 'KEYWORD' && tokens[0].value === 'skip', tokens[0]);
}

// ── Tokenizer: observe / every / clear ───────────────────────────────
console.log('\n─ Tokenizer: observe / every / clear ─');
{
  const tokens = tok('observe user data');
  assert('observe tok: OBSERVE_STMT', tokens[0].type === 'OBSERVE_STMT', tokens[0].type);
  assert('observe tok: name',         tokens[0].value.name === 'user data', tokens[0].value.name);
}
{
  const tokens = tok('every 5000 ping into ticker');
  assert('every tok: EVERY_STMT',    tokens[0].type === 'EVERY_STMT', tokens[0].type);
  assert('every tok: interval',      tokens[0].value.interval  === '5000', tokens[0].value.interval);
  assert('every tok: cloudName',     tokens[0].value.cloudName === 'ping', tokens[0].value.cloudName);
  assert('every tok: intoName',      tokens[0].value.intoName  === 'ticker', tokens[0].value.intoName);
}
{
  const tokens = tok('clear ticker');
  assert('clear tok: CLEAR_STMT', tokens[0].type === 'CLEAR_STMT', tokens[0].type);
  assert('clear tok: name',       tokens[0].value.name === 'ticker', tokens[0].value.name);
}

// ── Tokenizer: on lifecycle / on event ───────────────────────────────
console.log('\n─ Tokenizer: on lifecycle / on event ─');
{
  const tokens = tok('on birth');
  assert('on birth tok: ON_LIFECYCLE_STMT', tokens[0].type === 'ON_LIFECYCLE_STMT', tokens[0].type);
  assert('on birth tok: phase birth',       tokens[0].value.phase === 'birth', tokens[0].value.phase);
  assert('on birth tok: not async',         tokens[0].value.isAsync === false, tokens[0].value.isAsync);
}
{
  const tokens = tok('on death');
  assert('on death tok: phase death', tokens[0].value.phase === 'death', tokens[0].value.phase);
}
{
  const tokens = tok('on shift');
  assert('on shift tok: phase shift', tokens[0].value.phase === 'shift', tokens[0].value.phase);
}
{
  const tokens = tok('expand on birth');
  assert('expand on birth tok: ON_LIFECYCLE_STMT', tokens[0].type === 'ON_LIFECYCLE_STMT', tokens[0].type);
  assert('expand on birth tok: isAsync',           tokens[0].value.isAsync === true, tokens[0].value.isAsync);
}
{
  const tokens = tok('on data updated');
  assert('on event tok: ON_EVENT_STMT', tokens[0].type === 'ON_EVENT_STMT', tokens[0].type);
  assert('on event tok: event name',   tokens[0].value.event === 'data updated', tokens[0].value.event);
}

// ── Tokenizer: off / trigger ─────────────────────────────────────────
console.log('\n─ Tokenizer: off / trigger ─');
{
  const tokens = tok('off data updated');
  assert('off tok: OFF_STMT', tokens[0].type === 'OFF_STMT', tokens[0].type);
  assert('off tok: event',    tokens[0].value.event === 'data updated', tokens[0].value.event);
}
{
  const tokens = tok('trigger page loaded');
  assert('trigger tok: TRIGGER_STMT',   tokens[0].type === 'TRIGGER_STMT', tokens[0].type);
  assert('trigger tok: event',          tokens[0].value.event === 'page loaded', tokens[0].value.event);
  assert('trigger tok: no payload',     tokens[0].value.payload === null, tokens[0].value.payload);
}
{
  const tokens = tok('trigger page loaded with page data');
  assert('trigger with tok: payload',   tokens[0].value.payload === 'page data', tokens[0].value.payload);
}

// ── Tokenizer: emit / pull ────────────────────────────────────────────
console.log('\n─ Tokenizer: emit / pull ─');
{
  const tokens = tok('emit greeting');
  assert('emit tok: EMIT_STMT', tokens[0].type === 'EMIT_STMT', tokens[0].type);
  assert('emit tok: kind value', tokens[0].value.kind === 'value', tokens[0].value.kind);
  assert('emit tok: name',       tokens[0].value.name === 'greeting', tokens[0].value.name);
}
{
  const tokens = tok('emit cloud greeting');
  assert('emit cloud tok: kind cloud', tokens[0].value.kind === 'cloud', tokens[0].value.kind);
}
{
  const tokens = tok('emit default greeting');
  assert('emit default tok: kind default', tokens[0].value.kind === 'default', tokens[0].value.kind);
}
{
  const tokens = tok('pull greeting from utils');
  assert('pull tok: PULL_STMT', tokens[0].type === 'PULL_STMT', tokens[0].type);
  assert('pull tok: names',     JSON.stringify(tokens[0].value.names) === '["greeting"]', tokens[0].value.names);
  assert('pull tok: path',      tokens[0].value.path === 'utils', tokens[0].value.path);
}
{
  const tokens = tok('pull greeting and farewell from utils');
  assert('pull multi tok: two names', tokens[0].value.names.length === 2, tokens[0].value.names);
  assert('pull multi tok: farewell',  tokens[0].value.names.includes('farewell'), tokens[0].value.names);
}

// ── Tokenizer: raindrop / ground / new / await / slot / burst ────────
console.log('\n─ Tokenizer: raindrop / ground / new / await / slot / burst ─');
{
  const tokens = tok('raindrop text username');
  assert('raindrop tok: RAINDROP_STMT', tokens[0].type === 'RAINDROP_STMT', tokens[0].type);
  assert('raindrop tok: rdType',        tokens[0].value.rdType === 'text', tokens[0].value.rdType);
  assert('raindrop tok: name',          tokens[0].value.name === 'username', tokens[0].value.name);
}
{
  const tokens = tok('ground set token is abc123');
  assert('ground set tok: GROUND_STMT', tokens[0].type === 'GROUND_STMT', tokens[0].type);
  assert('ground set tok: op',   tokens[0].value.op    === 'set', tokens[0].value.op);
  assert('ground set tok: key',  tokens[0].value.key   === 'token', tokens[0].value.key);
  assert('ground set tok: value',tokens[0].value.value === 'abc123', tokens[0].value.value);
}
{
  const tokens = tok('ground get token into stored token');
  assert('ground get tok: op',     tokens[0].value.op       === 'get', tokens[0].value.op);
  assert('ground get tok: key',    tokens[0].value.key      === 'token', tokens[0].value.key);
  assert('ground get tok: into',   tokens[0].value.intoName === 'stored token', tokens[0].value.intoName);
}
{
  const tokens = tok('ground remove token');
  assert('ground remove tok: op', tokens[0].value.op === 'remove', tokens[0].value.op);
}
{
  const tokens = tok('new Planet into my planet');
  assert('new tok: NEW_STMT', tokens[0].type === 'NEW_STMT', tokens[0].type);
  assert('new tok: schema',   tokens[0].value.schema   === 'Planet', tokens[0].value.schema);
  assert('new tok: intoName', tokens[0].value.intoName === 'my planet', tokens[0].value.intoName);
}
{
  const tokens = tok('await fetch data into result');
  assert('await tok: AWAIT_STMT',   tokens[0].type === 'AWAIT_STMT', tokens[0].type);
  assert('await tok: expression',   tokens[0].value.expression === 'fetch data', tokens[0].value.expression);
  assert('await tok: intoName',     tokens[0].value.intoName   === 'result', tokens[0].value.intoName);
}
{
  const tokens = tok('slot children');
  assert('slot tok: SLOT_STMT', tokens[0].type === 'SLOT_STMT', tokens[0].type);
  assert('slot tok: name',      tokens[0].value.name === 'children', tokens[0].value.name);
}
{
  const tokens = tok('slot');
  assert('slot bare tok: default name children', tokens[0].value.name === 'children', tokens[0].value.name);
}
{
  const tokens = tok('burst config and overrides into merged');
  assert('burst tok: BURST_STMT', tokens[0].type === 'BURST_STMT', tokens[0].type);
  assert('burst tok: two sources', tokens[0].value.sources.length === 2, tokens[0].value.sources);
  assert('burst tok: intoName',    tokens[0].value.intoName === 'merged', tokens[0].value.intoName);
}

// ── Parser ────────────────────────────────────────────────────────────
console.log('\n─ Parser ─');
{
  const s = parse('guard data else reflect void').statements[0];
  assert('guard parser: GuardStmt',  s.type === 'GuardStmt', s.type);
  assert('guard parser: condition',  s.condition === 'data', s.condition);
  assert('guard parser: fallback',   s.fallback  === 'void', s.fallback);
}
{
  const src = 'match status\narm published\nshow page\narm draft\nshow preview\narm else\nshow other\nend';
  const s = parse(src).statements[0];
  assert('match parser: MatchStmt',   s.type === 'MatchStmt', s.type);
  assert('match parser: subject',     s.subject === 'status', s.subject);
  assert('match parser: two arms',    s.arms.length === 2, s.arms.length);
  assert('match parser: first arm',   s.arms[0].pattern === 'published', s.arms[0].pattern);
  assert('match parser: second arm',  s.arms[1].pattern === 'draft', s.arms[1].pattern);
  assert('match parser: defaultBody', Array.isArray(s.defaultBody) && s.defaultBody.length > 0, s.defaultBody);
}
{
  const s = parse('escape').statements[0];
  assert('escape parser: EscapeStmt', s.type === 'EscapeStmt', s.type);
}
{
  const s = parse('skip').statements[0];
  assert('skip parser: SkipStmt', s.type === 'SkipStmt', s.type);
}
{
  const s = parse('observe user\nshow user\nend').statements[0];
  assert('observe parser: ObserveStmt',  s.type === 'ObserveStmt', s.type);
  assert('observe parser: name',         s.name === 'user', s.name);
  assert('observe parser: body',         s.body.length > 0, s.body.length);
}
{
  const s = parse('every 5000 ping into ticker').statements[0];
  assert('every parser: EveryStmt', s.type === 'EveryStmt', s.type);
  assert('every parser: interval',  s.interval === '5000', s.interval);
}
{
  const s = parse('clear ticker').statements[0];
  assert('clear parser: ClearStmt', s.type === 'ClearStmt', s.type);
  assert('clear parser: name',      s.name === 'ticker', s.name);
}
{
  const s = parse('on birth\nshow hello\nend').statements[0];
  assert('on birth parser: OnLifecycleStmt', s.type === 'OnLifecycleStmt', s.type);
  assert('on birth parser: phase',           s.phase === 'birth', s.phase);
  assert('on birth parser: body',            s.body.length > 0, s.body.length);
}
{
  const s = parse('expand on birth\nshow hello\nend').statements[0];
  assert('expand on birth parser: isAsync', s.isAsync === true, s.isAsync);
}
{
  const s = parse('on death\nshow bye\nend').statements[0];
  assert('on death parser: phase death', s.phase === 'death', s.phase);
}
{
  const s = parse('on data updated\nshow update\nend').statements[0];
  assert('on event parser: OnEventStmt', s.type === 'OnEventStmt', s.type);
  assert('on event parser: event name',  s.event === 'data updated', s.event);
}
{
  const s = parse('off data updated').statements[0];
  assert('off parser: OffStmt', s.type === 'OffStmt', s.type);
  assert('off parser: event',   s.event === 'data updated', s.event);
}
{
  const s = parse('trigger page loaded with page data').statements[0];
  assert('trigger parser: TriggerStmt', s.type === 'TriggerStmt', s.type);
  assert('trigger parser: event',       s.event === 'page loaded', s.event);
  assert('trigger parser: payload',     s.payload === 'page data', s.payload);
}
{
  const s = parse('emit greeting').statements[0];
  assert('emit parser: EmitStmt', s.type === 'EmitStmt', s.type);
  assert('emit parser: kind',     s.kind === 'value', s.kind);
}
{
  const s = parse('pull greeting and farewell from utils').statements[0];
  assert('pull parser: PullStmt',    s.type === 'PullStmt', s.type);
  assert('pull parser: two names',   s.names.length === 2, s.names.length);
  assert('pull parser: path',        s.path === 'utils', s.path);
}
{
  const s = parse('raindrop text username').statements[0];
  assert('raindrop parser: RaindropStmt', s.type === 'RaindropStmt', s.type);
  assert('raindrop parser: rdType',       s.rdType === 'text', s.rdType);
}
{
  const s = parse('ground get token into stored').statements[0];
  assert('ground parser: GroundStmt', s.type === 'GroundStmt', s.type);
  assert('ground parser: op',         s.op === 'get', s.op);
}
{
  const s = parse('new Planet into my planet').statements[0];
  assert('new parser: NewStmt',   s.type === 'NewStmt', s.type);
  assert('new parser: schema',    s.schema === 'Planet', s.schema);
  assert('new parser: intoName',  s.intoName === 'my planet', s.intoName);
}
{
  const s = parse('await fetch data into result').statements[0];
  assert('await parser: AwaitStmt',    s.type === 'AwaitStmt', s.type);
  assert('await parser: expression',   s.expression === 'fetch data', s.expression);
  assert('await parser: intoName',     s.intoName === 'result', s.intoName);
}
{
  const s = parse('cloud view\nslot children\nend').statements[0];
  assert('slot parser: in cloud body', s.body[0].type === 'SlotStmt', s.body[0] && s.body[0].type);
}
{
  const s = parse('burst config and overrides into merged').statements[0];
  assert('burst parser: BurstStmt',  s.type === 'BurstStmt', s.type);
  assert('burst parser: two sources', s.sources.length === 2, s.sources.length);
  assert('burst parser: intoName',    s.intoName === 'merged', s.intoName);
}

// ── Codegen ───────────────────────────────────────────────────────────
console.log('\n─ Codegen ─');
{
  // void → null
  const js = compile('rain x is void');
  assert('void codegen: null literal', js.includes('null'), js);
  assert('void codegen: not "void"',   !js.includes("= 'void'") && !js.includes('= void'), js);
}
{
  const js = compile('guard data else reflect void');
  assert('guard codegen: if (!...)', js.includes('if (!'), js);
  assert('guard codegen: return',    js.includes('return'), js);
  assert('guard codegen: null fallback', js.includes('null'), js);
}
{
  const js = compile('match status\narm published\nshow page\narm else\nshow other\nend');
  assert('match codegen: switch', js.includes('switch'), js);
  assert('match codegen: case',   js.includes('case'), js);
  assert('match codegen: break',  js.includes('break'), js);
  assert('match codegen: default',js.includes('default'), js);
}
{
  const js = compile('escape');
  assert('escape codegen: break', js.includes('break'), js);
}
{
  const js = compile('skip');
  assert('skip codegen: continue', js.includes('continue'), js);
}
{
  const js = compile('observe user\nshow user\nend');
  assert('observe codegen: observe comment', js.includes('observe'), js);
  assert('observe codegen: IIFE',            js.includes('function'), js);
}
{
  const js = compile('every 5000 ping into ticker');
  assert('every codegen: setInterval', js.includes('setInterval'), js);
  assert('every codegen: interval',    js.includes('5000'), js);
  assert('every codegen: intoName',    js.includes('ticker'), js);
}
{
  const js = compile('clear ticker');
  assert('clear codegen: clearInterval', js.includes('clearInterval'), js);
  assert('clear codegen: var name',      js.includes('ticker'), js);
}
{
  const js = compile('on birth\nshow hello\nend');
  assert('on birth codegen: lifecycle comment', js.includes('birth'), js);
  assert('on birth codegen: function',          js.includes('function'), js);
}
{
  const js = compile('on death\nshow bye\nend');
  assert('on death codegen: unload listener', js.includes('unload'), js);
}
{
  const js = compile('on data updated\nshow update\nend');
  assert('on event codegen: addEventListener', js.includes('addEventListener'), js);
  assert('on event codegen: event name',       js.includes('data updated'), js);
}
{
  const js = compile('off data updated');
  assert('off codegen: removeEventListener', js.includes('removeEventListener'), js);
}
{
  const js = compile('trigger page loaded');
  assert('trigger codegen: dispatchEvent', js.includes('dispatchEvent'), js);
  assert('trigger codegen: CustomEvent',   js.includes('CustomEvent'), js);
}
{
  const js = compile('trigger page loaded with page data');
  assert('trigger with codegen: detail', js.includes('detail'), js);
}
{
  const js = compile('emit greeting');
  assert('emit codegen: module.exports', js.includes('module.exports'), js);
  assert('emit codegen: name',           js.includes('greeting'), js);
}
{
  const js = compile('pull greeting from utils');
  assert('pull codegen: require', js.includes('require'), js);
  assert('pull codegen: path',    js.includes('utils'), js);
  assert('pull codegen: destructure', js.includes('{'), js);
}
{
  const js = compile('raindrop text username');
  assert('raindrop codegen: EventMathRaindrop', js.includes('EventMathRaindrop'), js);
  assert('raindrop codegen: type',              js.includes('text'), js);
}
{
  const js = compile('ground set token is abc123');
  assert('ground set codegen: EventMathGround.set', js.includes('EventMathGround.set'), js);
  assert('ground set codegen: key',                 js.includes("'token'"), js);
}
{
  const js = compile('ground get token into stored');
  assert('ground get codegen: EventMathGround.get', js.includes('EventMathGround.get'), js);
  assert('ground get codegen: intoName',            js.includes('stored'), js);
}
{
  const js = compile('ground remove token');
  assert('ground remove codegen: EventMathGround.remove', js.includes('EventMathGround.remove'), js);
}
{
  const js = compile('new Planet into my planet');
  assert('new codegen: new Planet', js.includes('new Planet'), js);
  assert('new codegen: intoName',   js.includes('my_planet'), js);
}
{
  const js = compile('expand cloud loader\nawait fetch data into result\nend');
  assert('await codegen: await keyword', js.includes('await'), js);
  assert('await codegen: intoName',      js.includes('result'), js);
}
{
  const js = compile('cloud view\nslot children\nend');
  assert('slot codegen: slot comment',  js.includes('slot'), js);
  assert('slot codegen: children check', js.includes('children'), js);
}
{
  const js = compile('burst config and overrides into merged');
  assert('burst codegen: spread syntax', js.includes('...config'), js);
  assert('burst codegen: both spreads',  js.includes('...overrides'), js);
  assert('burst codegen: into var',      js.includes('merged'), js);
}

// ── Formatter ─────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  assert('void fmt: rain is void',  format('rain x is void').includes('rain x is void'));
  assert('guard fmt: round-trips',  format('guard data else reflect void').includes('guard data else reflect void'));
  assert('escape fmt',              format('escape').includes('escape'));
  assert('skip fmt',                format('skip').includes('skip'));
  assert('every fmt',               format('every 5000 ping into ticker').includes('every 5000 ping into ticker'));
  assert('clear fmt',               format('clear ticker').includes('clear ticker'));
  assert('off fmt',                 format('off data updated').includes('off data updated'));
  assert('trigger fmt',             format('trigger page loaded').includes('trigger page loaded'));
  assert('trigger with fmt',        format('trigger page loaded with page data').includes('trigger page loaded with page data'));
  assert('emit fmt',                format('emit greeting').includes('emit greeting'));
  assert('emit cloud fmt',          format('emit cloud greeting').includes('emit cloud greeting'));
  assert('pull fmt',                format('pull greeting from utils').includes('pull greeting from utils'));
  assert('raindrop fmt',            format('raindrop text username').includes('raindrop text username'));
  assert('ground set fmt',          format('ground set token is abc123').includes('ground set token is abc123'));
  assert('ground get fmt',          format('ground get token into stored').includes('ground get token into stored'));
  assert('ground remove fmt',       format('ground remove token').includes('ground remove token'));
  assert('new fmt',                 format('new Planet into my planet').includes('new Planet into my planet'));
  assert('await fmt',               format('expand cloud l\nawait fetch data into result\nend').includes('await fetch data into result'));
  assert('slot fmt',                format('cloud v\nslot children\nend').includes('slot children'));
  assert('burst fmt',               format('burst config and overrides into merged').includes('burst config and overrides into merged'));
}
{
  const f = format('match status\narm published\nshow page\narm else\nshow other\nend');
  assert('match fmt: has match',    f.includes('match'), f);
  assert('match fmt: has arm',      f.includes('arm'), f);
  assert('match fmt: has end',      f.includes('end'), f);
  assert('match fmt: has arm else', f.includes('arm else'), f);
}
{
  const f = format('observe user\nshow user\nend');
  assert('observe fmt: has observe', f.includes('observe'), f);
  assert('observe fmt: has end',     f.includes('end'), f);
}
{
  const f = format('on birth\nshow hello\nend');
  assert('on birth fmt: has on birth', f.includes('on birth'), f);
  assert('on birth fmt: has end',      f.includes('end'), f);
}
{
  const f = format('expand on birth\nshow hello\nend');
  assert('expand on birth fmt: has expand on birth', f.includes('expand on birth'), f);
}
{
  const f = format('on data updated\nshow update\nend');
  assert('on event fmt: has on', f.includes('on data updated'), f);
}

// ── Validator ─────────────────────────────────────────────────────────
console.log('\n─ Validator ─');
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();

  // void keyword does not trigger reserved-word error
  const r1 = v.validate(parse('rain deletedAt is void'));
  assert('validator: void is allowed in name check', r1.errors.length === 0, r1.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const r2 = v.validate(parse('pull greeting from utils'));
  assert('validator: pull ok', r2.errors.length === 0, r2.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const r3 = v.validate(parse('on birth\nshow hello\nend'));
  assert('validator: on birth ok', r3.errors.length === 0, r3.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const r4 = v.validate(parse('match status\narm published\nshow page\narm else\nshow other\nend'));
  assert('validator: match ok', r4.errors.length === 0, r4.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const r5 = v.validate(parse('every 5000 ping into ticker'));
  assert('validator: every registers intoName', r5.errors.length === 0, r5.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const r6 = v.validate(parse('burst config and overrides into merged'));
  assert('validator: burst ok', r6.errors.length === 0, r6.errors);
}

// ── End-to-end ────────────────────────────────────────────────────────
console.log('\n─ End-to-end ─');
{
  const src = `
rain token is void
rain status is loading

guard token else reflect void

match status
  arm loading
    show loading screen
  arm ready
    show dashboard
  arm else
    show error page
end

observe status
  show status
end

on birth
  ground get session token into token
end

on death
  ground remove session token
end

trigger app started

every 30000 sync data into sync timer
clear sync timer

pull greeting and farewell from utils

emit star token

ground set user name is ryan
ground get user name into stored name

new User into current user

cloud sidebar
  slot navigation
end

burst defaults and overrides into config
`;
  try {
    const js = compile(src);
    assert('e2e: compiles without throw', true);
    assert('e2e: null for void',     js.includes('null'), js.substring(0, 300));
    assert('e2e: if for guard',      js.includes('if (!'), js.substring(0, 300));
    assert('e2e: switch for match',  js.includes('switch'), js.substring(0, 300));
    assert('e2e: observe IIFE',      js.includes('__observe'), js.substring(0, 300));
    assert('e2e: birth lifecycle',   js.includes('__birth'), js.substring(0, 300));
    assert('e2e: death listener',    js.includes('unload'), js.substring(0, 300));
    assert('e2e: dispatchEvent',     js.includes('dispatchEvent'), js.substring(0, 300));
    assert('e2e: setInterval',       js.includes('setInterval'), js.substring(0, 300));
    assert('e2e: clearInterval',     js.includes('clearInterval'), js.substring(0, 300));
    assert('e2e: require pull',      js.includes('require'), js.substring(0, 300));
    assert('e2e: module.exports',    js.includes('module.exports'), js.substring(0, 300));
    assert('e2e: ground.set',        js.includes('EventMathGround.set'), js.substring(0, 300));
    assert('e2e: ground.get',        js.includes('EventMathGround.get'), js.substring(0, 300));
    assert('e2e: new User',          js.includes('new User'), js.substring(0, 300));
    assert('e2e: slot',              js.includes('slot'), js.substring(0, 300));
    assert('e2e: spread burst',      js.includes('...defaults'), js.substring(0, 300));
  } catch(e) {
    assert('e2e: no compile error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
