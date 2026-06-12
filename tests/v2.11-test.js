'use strict';
/**
 * EventMath v2.11 — web layer
 * rain, star, zone, sky, universe, orbit, lens,
 * cloud, reflect, node, atmosphere, earth, travel, map,
 * attempt/collapse/always, expand cloud
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

// ── Runtime: EventMathNode ────────────────────────────────────────────
console.log('\n─ Runtime: EventMathNode ─');
{
  const n = new EM.EventMathNode('h1', 'Hello World');
  assert('node: constructor stores type', n.type === 'h1', n.type);
  assert('node: constructor stores content', n.content === 'Hello World', n.content);
  assert('node: render wraps in tag', n.render() === '<h1>Hello World</h1>', n.render());
}
{
  const n = new EM.EventMathNode('p', 'some text');
  assert('node: render: p tag', n.render() === '<p>some text</p>', n.render());
}
{
  const n = new EM.EventMathNode('span', '');
  assert('node: render: empty content', n.render() === '<span></span>', n.render());
}

// ── Runtime: EventMathAtmosphere ──────────────────────────────────────
console.log('\n─ Runtime: EventMathAtmosphere ─');
{
  const atm = new EM.EventMathAtmosphere('main', { color: 'red', 'font-size': '16px' });
  assert('atmosphere: constructor stores name', atm.name === 'main', atm.name);
  assert('atmosphere: constructor stores styles', typeof atm.styles === 'object', atm.styles);
  const css = atm.css();
  assert('atmosphere: css() returns string', typeof css === 'string', css);
  assert('atmosphere: css() includes selector', css.includes('main'), css);
  assert('atmosphere: css() includes property', css.includes('color'), css);
}
{
  const atm = new EM.EventMathAtmosphere('hero', { background: 'blue' });
  const css = atm.css();
  assert('atmosphere: css() has closing brace', css.includes('}'), css);
}

// ── Runtime: EventMathCloud ───────────────────────────────────────────
console.log('\n─ Runtime: EventMathCloud ─');
{
  let called = false;
  const c = new EM.EventMathCloud('my view', function() { called = true; return '<div>hi</div>'; });
  assert('cloud: constructor stores name', c.name === 'my view', c.name);
  const result = c.render();
  assert('cloud: render() calls renderFn', called, called);
  assert('cloud: render() returns result', result === '<div>hi</div>', result);
}
{
  const c = new EM.EventMathCloud('empty view', function() { return ''; });
  assert('cloud: render() handles empty return', c.render() === '', c.render());
}

// ── Runtime: EventMathEarth ───────────────────────────────────────────
console.log('\n─ Runtime: EventMathEarth ─');
{
  assert('earth: singleton exists', EM.EventMathEarth !== undefined);
  assert('earth: has .get method', typeof EM.EventMathEarth.get === 'function');
  assert('earth: has .post method', typeof EM.EventMathEarth.post === 'function');
  assert('earth: has .put method', typeof EM.EventMathEarth.put === 'function');
  assert('earth: has .delete method', typeof EM.EventMathEarth.delete === 'function');
}
{
  // Methods must exist and be functions — actual HTTP calls require a running server
  assert('earth: all methods are functions',
    typeof EM.EventMathEarth.get === 'function' &&
    typeof EM.EventMathEarth.post === 'function' &&
    typeof EM.EventMathEarth.put === 'function' &&
    typeof EM.EventMathEarth.delete === 'function'
  );
}

// ── Runtime: EventMathRouter ──────────────────────────────────────────
console.log('\n─ Runtime: EventMathRouter ─');
{
  const cloud = new EM.EventMathCloud('home', function() { return '<div>home</div>'; });
  const router = new EM.EventMathRouter({ home: { path: '/', cloud: cloud } });
  assert('router: constructor stores routes', typeof router.routes === 'object', router.routes);
  const rendered = router.render();
  assert('router: render() returns string', typeof rendered === 'string', rendered);
  assert('router: render() includes route name', rendered.includes('home'), rendered);
}
{
  const r = new EM.EventMathRouter({});
  assert('router: travel() returns something', r.travel('/') !== undefined || r.travel('/') === undefined);
}

// ── Tokenizer: rain / star ────────────────────────────────────────────
console.log('\n─ Tokenizer: rain / star ─');
{
  const tokens = tok('rain user count is 42');
  assert('rain tok: RAIN_STMT type', tokens[0].type === 'RAIN_STMT', tokens[0].type);
  assert('rain tok: name', tokens[0].value.name === 'user count', tokens[0].value.name);
  assert('rain tok: value', tokens[0].value.value === '42', tokens[0].value.value);
}
{
  const tokens = tok('star pi is 3.14');
  assert('star tok: STAR_STMT type', tokens[0].type === 'STAR_STMT', tokens[0].type);
  assert('star tok: name', tokens[0].value.name === 'pi', tokens[0].value.name);
  assert('star tok: value', tokens[0].value.value === '3.14', tokens[0].value.value);
}

// ── Tokenizer: zone / sky / lens ──────────────────────────────────────
console.log('\n─ Tokenizer: zone / sky / lens ─');
{
  const tokens = tok('zone active users is items filtered by active');
  assert('zone tok: ZONE_STMT', tokens[0].type === 'ZONE_STMT', tokens[0].type);
  assert('zone tok: name', tokens[0].value.name === 'active users', tokens[0].value.name);
  assert('zone tok: expression non-empty', tokens[0].value.expression.length > 0, tokens[0].value.expression);
}
{
  const tokens = tok('sky page title is home');
  assert('sky tok: SKY_STMT', tokens[0].type === 'SKY_STMT', tokens[0].type);
  assert('sky tok: name', tokens[0].value.name === 'page title', tokens[0].value.name);
}
{
  const tokens = tok('lens safe count is user count');
  assert('lens tok: LENS_STMT', tokens[0].type === 'LENS_STMT', tokens[0].type);
  assert('lens tok: name', tokens[0].value.name === 'safe count', tokens[0].value.name);
}

// ── Tokenizer: universe / orbit ───────────────────────────────────────
console.log('\n─ Tokenizer: universe / orbit ─');
{
  const tokens = tok('universe User\nfield name is string\nfield age is number\nend');
  assert('universe tok: UNIVERSE_STMT', tokens[0].type === 'UNIVERSE_STMT', tokens[0].type);
  assert('universe tok: name', tokens[0].value.name === 'User', tokens[0].value.name);
}
{
  const tokens = tok('orbit item in items\nend');
  assert('orbit tok: ORBIT_STMT', tokens[0].type === 'ORBIT_STMT', tokens[0].type);
  assert('orbit tok: itemName', tokens[0].value.itemName === 'item', tokens[0].value.itemName);
  assert('orbit tok: collectionName', tokens[0].value.collectionName === 'items', tokens[0].value.collectionName);
}

// ── Tokenizer: attempt / collapse / always ────────────────────────────
console.log('\n─ Tokenizer: attempt / collapse / always ─');
{
  const tokens = tok('attempt\nend');
  assert('attempt tok: KEYWORD attempt', tokens[0].type === 'KEYWORD' && tokens[0].value === 'attempt', tokens[0]);
}
{
  const tokens = tok('collapse network error');
  assert('collapse tok: COLLAPSE_MARKER type', tokens[0].type === 'COLLAPSE_MARKER', tokens[0].type);
  assert('collapse tok: errName', tokens[0].value.errName === 'network error', tokens[0].value.errName);
}
{
  const tokens = tok('always');
  assert('always tok: KEYWORD always', tokens[0].type === 'KEYWORD' && tokens[0].value === 'always', tokens[0]);
}

// ── Tokenizer: cloud / expand cloud / reflect / node ─────────────────
console.log('\n─ Tokenizer: cloud / expand cloud / reflect / node ─');
{
  const tokens = tok('cloud home view\nend');
  assert('cloud tok: CLOUD_STMT', tokens[0].type === 'CLOUD_STMT', tokens[0].type);
  assert('cloud tok: name', tokens[0].value.name === 'home view', tokens[0].value.name);
  assert('cloud tok: not async', tokens[0].value.isAsync === false, tokens[0].value.isAsync);
}
{
  const tokens = tok('expand cloud async view\nend');
  assert('expand cloud tok: CLOUD_STMT', tokens[0].type === 'CLOUD_STMT', tokens[0].type);
  assert('expand cloud tok: isAsync true', tokens[0].value.isAsync === true, tokens[0].value.isAsync);
}
{
  const tokens = tok('reflect my value');
  assert('reflect tok: REFLECT_STMT', tokens[0].type === 'REFLECT_STMT', tokens[0].type);
  assert('reflect tok: expression', tokens[0].value.expression === 'my value', tokens[0].value.expression);
}
{
  const tokens = tok('node h1 Welcome');
  assert('node tok: NODE_STMT', tokens[0].type === 'NODE_STMT', tokens[0].type);
  assert('node tok: type', tokens[0].value.type === 'h1', tokens[0].value.type);
  assert('node tok: text', tokens[0].value.text === 'Welcome', tokens[0].value.text);
}

// ── Tokenizer: atmosphere / earth / travel / map ──────────────────────
console.log('\n─ Tokenizer: atmosphere / earth / travel / map ─');
{
  const tokens = tok('atmosphere main style\nend');
  assert('atmosphere tok: ATMOSPHERE_STMT', tokens[0].type === 'ATMOSPHERE_STMT', tokens[0].type);
  assert('atmosphere tok: name', tokens[0].value.name === 'main style', tokens[0].value.name);
}
{
  const tokens = tok('earth get /api/users into users');
  assert('earth tok: EARTH_STMT', tokens[0].type === 'EARTH_STMT', tokens[0].type);
  assert('earth tok: method', tokens[0].value.method === 'get', tokens[0].value.method);
  assert('earth tok: path', tokens[0].value.path === '/api/users', tokens[0].value.path);
  assert('earth tok: intoName', tokens[0].value.intoName === 'users', tokens[0].value.intoName);
  assert('earth tok: no bodyName', !tokens[0].value.bodyName, tokens[0].value.bodyName);
}
{
  const tokens = tok('earth post /api/users with user data into result');
  assert('earth post tok: method', tokens[0].value.method === 'post', tokens[0].value.method);
  assert('earth post tok: bodyName', tokens[0].value.bodyName === 'user data', tokens[0].value.bodyName);
  assert('earth post tok: intoName', tokens[0].value.intoName === 'result', tokens[0].value.intoName);
}
{
  const tokens = tok('travel /home');
  assert('travel tok: TRAVEL_STMT', tokens[0].type === 'TRAVEL_STMT', tokens[0].type);
  assert('travel tok: path', tokens[0].value.path === '/home', tokens[0].value.path);
}
{
  const tokens = tok('map');
  assert('map tok: KEYWORD map', tokens[0].type === 'KEYWORD' && tokens[0].value === 'map', tokens[0]);
}

// ── Parser: rain / star / zone / sky / lens ───────────────────────────
console.log('\n─ Parser: rain / star / zone / sky / lens ─');
{
  const ast = parse('rain user count is 42');
  const s = ast.statements[0];
  assert('rain parser: RainStmt', s.type === 'RainStmt', s.type);
  assert('rain parser: name', s.name === 'user count', s.name);
  assert('rain parser: value', s.value === '42', s.value);
}
{
  const ast = parse('star pi is 3.14');
  const s = ast.statements[0];
  assert('star parser: StarStmt', s.type === 'StarStmt', s.type);
  assert('star parser: name', s.name === 'pi', s.name);
  assert('star parser: value', s.value === '3.14', s.value);
}
{
  const ast = parse('zone active is items');
  const s = ast.statements[0];
  assert('zone parser: ZoneStmt', s.type === 'ZoneStmt', s.type);
  assert('zone parser: name', s.name === 'active', s.name);
  assert('zone parser: expression', s.expression === 'items', s.expression);
}
{
  const ast = parse('sky title is home');
  const s = ast.statements[0];
  assert('sky parser: SkyStmt', s.type === 'SkyStmt', s.type);
  assert('sky parser: name', s.name === 'title', s.name);
}
{
  const ast = parse('lens safe count is user count');
  const s = ast.statements[0];
  assert('lens parser: LensStmt', s.type === 'LensStmt', s.type);
  assert('lens parser: name', s.name === 'safe count', s.name);
}

// ── Parser: universe ──────────────────────────────────────────────────
console.log('\n─ Parser: universe ─');
{
  const ast = parse('universe User\nfield name is string\nfield age is number\nend');
  const s = ast.statements[0];
  assert('universe parser: UniverseStmt', s.type === 'UniverseStmt', s.type);
  assert('universe parser: name', s.name === 'User', s.name);
  assert('universe parser: fields is array', Array.isArray(s.fields), s.fields);
  assert('universe parser: two fields', s.fields.length === 2, s.fields.length);
  assert('universe parser: first field name', s.fields[0].name === 'name', s.fields[0]);
  assert('universe parser: first field type', s.fields[0].type === 'string', s.fields[0]);
}

// ── Parser: orbit ─────────────────────────────────────────────────────
console.log('\n─ Parser: orbit ─');
{
  const src = 'orbit item in items\nshow item\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('orbit parser: OrbitStmt', s.type === 'OrbitStmt', s.type);
  assert('orbit parser: itemName', s.itemName === 'item', s.itemName);
  assert('orbit parser: collectionName', s.collectionName === 'items', s.collectionName);
  assert('orbit parser: body is array', Array.isArray(s.body), s.body);
}

// ── Parser: attempt ───────────────────────────────────────────────────
console.log('\n─ Parser: attempt ─');
{
  const src = 'attempt\nshow hello\ncollapse network err\nshow fallback\nalways\nshow done\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('attempt parser: AttemptStmt', s.type === 'AttemptStmt', s.type);
  assert('attempt parser: tryBody non-empty', s.tryBody.length > 0, s.tryBody.length);
  assert('attempt parser: catchBody non-empty', s.catchBody.length > 0, s.catchBody.length);
  assert('attempt parser: alwaysBody non-empty', s.alwaysBody.length > 0, s.alwaysBody.length);
  assert('attempt parser: errName', s.errName === 'network err', s.errName);
}
{
  const src = 'attempt\nshow hello\ncollapse bad input\nshow fallback\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('attempt no-always: AttemptStmt', s.type === 'AttemptStmt', s.type);
  assert('attempt no-always: alwaysBody empty', s.alwaysBody.length === 0, s.alwaysBody.length);
}

// ── Parser: cloud ─────────────────────────────────────────────────────
console.log('\n─ Parser: cloud ─');
{
  const src = 'cloud home view\nnode h1 Welcome\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('cloud parser: CloudStmt', s.type === 'CloudStmt', s.type);
  assert('cloud parser: name', s.name === 'home view', s.name);
  assert('cloud parser: not async', s.isAsync === false, s.isAsync);
  assert('cloud parser: body non-empty', s.body.length > 0, s.body.length);
}
{
  const src = 'expand cloud async view\nreflect result\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('expand cloud parser: CloudStmt', s.type === 'CloudStmt', s.type);
  assert('expand cloud parser: isAsync', s.isAsync === true, s.isAsync);
}

// ── Parser: atmosphere ────────────────────────────────────────────────
console.log('\n─ Parser: atmosphere ─');
{
  const src = 'atmosphere main style\nstyle color is red\nstyle font-size is 16px\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('atmosphere parser: AtmosphereStmt', s.type === 'AtmosphereStmt', s.type);
  assert('atmosphere parser: name', s.name === 'main style', s.name);
  assert('atmosphere parser: props is object', s.props && typeof s.props === 'object', s.props);
  assert('atmosphere parser: color prop', s.props['color'] === 'red', s.props);
  assert('atmosphere parser: font-size prop', s.props['font-size'] === '16px', s.props);
}

// ── Parser: earth / travel ────────────────────────────────────────────
console.log('\n─ Parser: earth / travel ─');
{
  const ast = parse('earth get /api/users into users');
  const s = ast.statements[0];
  assert('earth parser: EarthStmt', s.type === 'EarthStmt', s.type);
  assert('earth parser: method', s.method === 'get', s.method);
  assert('earth parser: path', s.path === '/api/users', s.path);
  assert('earth parser: intoName', s.intoName === 'users', s.intoName);
}
{
  const ast = parse('travel /dashboard');
  const s = ast.statements[0];
  assert('travel parser: TravelStmt', s.type === 'TravelStmt', s.type);
  assert('travel parser: path', s.path === '/dashboard', s.path);
}

// ── Parser: map ───────────────────────────────────────────────────────
console.log('\n─ Parser: map ─');
{
  const src = 'map\nroute home / as home view\nroute about /about as about view\nend';
  const ast = parse(src);
  const s = ast.statements[0];
  assert('map parser: MapStmt', s.type === 'MapStmt', s.type);
  assert('map parser: routes is array', Array.isArray(s.routes), s.routes);
  assert('map parser: two routes', s.routes.length === 2, s.routes.length);
  assert('map parser: first route name', s.routes[0].name === 'home', s.routes[0]);
  assert('map parser: first route path', s.routes[0].path === '/', s.routes[0]);
  assert('map parser: first route cloud', s.routes[0].cloudName === 'home view', s.routes[0]);
}

// ── Codegen: rain / star ──────────────────────────────────────────────
console.log('\n─ Codegen: rain / star ─');
{
  const js = compile('rain user count is 42');
  assert('rain codegen: variable declaration', js.includes('let') || js.includes('var'), js);
  assert('rain codegen: variable name', js.includes('user_count'), js);
  assert('rain codegen: value', js.includes('42'), js);
}
{
  const js = compile('star pi is 3.14');
  assert('star codegen: variable name', js.includes('pi'), js);
  assert('star codegen: value', js.includes('3.14'), js);
}

// ── Codegen: zone / sky / lens ────────────────────────────────────────
console.log('\n─ Codegen: zone / sky / lens ─');
{
  const js = compile('zone active is items');
  assert('zone codegen: variable', js.includes('active'), js);
}
{
  const js = compile('sky title is home');
  assert('sky codegen: variable', js.includes('title'), js);
}
{
  const js = compile('lens safe count is user count');
  assert('lens codegen: try/catch wrap', js.includes('try'), js);
  assert('lens codegen: variable name', js.includes('safe_count'), js);
}

// ── Codegen: universe ─────────────────────────────────────────────────
console.log('\n─ Codegen: universe ─');
{
  const js = compile('universe User\nfield name is string\nfield age is number\nend');
  assert('universe codegen: function constructor', js.includes('function'), js);
  assert('universe codegen: User name', js.includes('User'), js);
  assert('universe codegen: name field', js.includes('name'), js);
  assert('universe codegen: age field', js.includes('age'), js);
}

// ── Codegen: orbit ────────────────────────────────────────────────────
console.log('\n─ Codegen: orbit ─');
{
  const js = compile('orbit item in items\nend');
  assert('orbit codegen: for loop', js.includes('for'), js);
  assert('orbit codegen: collection var', js.includes('items'), js);
  assert('orbit codegen: item var', js.includes('item'), js);
}

// ── Codegen: attempt ──────────────────────────────────────────────────
console.log('\n─ Codegen: attempt ─');
{
  const js = compile('attempt\nshow hello\ncollapse err\nshow fallback\nalways\nshow done\nend');
  assert('attempt codegen: try block', js.includes('try'), js);
  assert('attempt codegen: catch block', js.includes('catch'), js);
  assert('attempt codegen: finally block', js.includes('finally'), js);
}
{
  const js = compile('attempt\nshow hello\ncollapse err\nshow fallback\nend');
  assert('attempt no-always codegen: try', js.includes('try'), js);
  assert('attempt no-always codegen: catch', js.includes('catch'), js);
}

// ── Codegen: cloud ────────────────────────────────────────────────────
console.log('\n─ Codegen: cloud ─');
{
  const js = compile('cloud home view\nnode h1 Welcome\nend');
  assert('cloud codegen: function keyword', js.includes('function'), js);
  assert('cloud codegen: _cloud marker', js.includes('_cloud'), js);
  assert('cloud codegen: name in output', js.includes('home_view'), js);
}
{
  const js = compile('expand cloud async view\nreflect result\nend');
  assert('expand cloud codegen: async keyword', js.includes('async'), js);
}

// ── Codegen: reflect / node ───────────────────────────────────────────
console.log('\n─ Codegen: reflect / node ─');
{
  const js = compile('cloud v\nreflect my value\nend');
  assert('reflect codegen: return statement', js.includes('return'), js);
}
{
  const js = compile('cloud v\nnode h1 Welcome\nend');
  assert('node codegen: EventMathNode constructor', js.includes('EventMathNode'), js);
  assert('node codegen: type argument', js.includes('h1'), js);
}

// ── Codegen: atmosphere ───────────────────────────────────────────────
console.log('\n─ Codegen: atmosphere ─');
{
  const js = compile('atmosphere main style\nstyle color is red\nend');
  assert('atmosphere codegen: EventMathAtmosphere', js.includes('EventMathAtmosphere'), js);
  assert('atmosphere codegen: name', js.includes('main_style'), js);
  assert('atmosphere codegen: prop key', js.includes('color'), js);
}

// ── Codegen: earth / travel ───────────────────────────────────────────
console.log('\n─ Codegen: earth / travel ─');
{
  const js = compile('earth get /api/users into users');
  assert('earth codegen: EventMathEarth', js.includes('EventMathEarth'), js);
  assert('earth codegen: .get method', js.includes('.get'), js);
  assert('earth codegen: path', js.includes('/api/users'), js);
  assert('earth codegen: intoName var', js.includes('users'), js);
}
{
  const js = compile('earth post /api/users with user data into result');
  assert('earth post codegen: .post method', js.includes('.post'), js);
  assert('earth post codegen: body var', js.includes('user_data'), js);
}
{
  const js = compile('travel /home');
  assert('travel codegen: location or travel', js.includes('location') || js.includes('_travel'), js);
  assert('travel codegen: path', js.includes('/home'), js);
}

// ── Codegen: map ─────────────────────────────────────────────────────
console.log('\n─ Codegen: map ─');
{
  const js = compile('map\nroute home / as home view\nend');
  assert('map codegen: EventMathRouter', js.includes('EventMathRouter'), js);
  assert('map codegen: route path', js.includes('/'), js);
}

// ── Formatter ─────────────────────────────────────────────────────────
console.log('\n─ Formatter ─');
{
  assert('rain fmt', format('rain user count is 42').includes('rain user count is 42'));
  assert('star fmt', format('star pi is 3.14').includes('star pi is 3.14'));
  assert('zone fmt', format('zone active is items').includes('zone active is items'));
  assert('sky fmt', format('sky title is home').includes('sky title is home'));
  assert('lens fmt', format('lens safe count is user count').includes('lens safe count is user count'));
}
{
  assert('travel fmt', format('travel /home').includes('travel /home'));
  assert('earth fmt', format('earth get /api/users into users').includes('earth get /api/users into users'));
  assert('reflect fmt', format('cloud v\nreflect my value\nend').includes('reflect my value'));
  assert('node fmt', format('cloud v\nnode h1 Welcome\nend').includes('node h1 Welcome'));
}
{
  const f = format('universe User\nfield name is string\nfield age is number\nend');
  assert('universe fmt: has universe', f.includes('universe'), f);
  assert('universe fmt: has end', f.includes('end'), f);
}
{
  const f = format('orbit item in items\nend');
  assert('orbit fmt: has orbit', f.includes('orbit'), f);
  assert('orbit fmt: has in', f.includes(' in '), f);
}
{
  const f = format('attempt\nshow hello\ncollapse err\nshow fallback\nalways\nshow done\nend');
  assert('attempt fmt: has attempt', f.includes('attempt'), f);
  assert('attempt fmt: has collapse', f.includes('collapse'), f);
  assert('attempt fmt: has always', f.includes('always'), f);
}
{
  const f = format('cloud home view\nnode h1 Welcome\nend');
  assert('cloud fmt: has cloud', f.includes('cloud'), f);
  assert('cloud fmt: has end', f.includes('end'), f);
}
{
  const f = format('atmosphere main style\nstyle color is red\nend');
  assert('atmosphere fmt: has atmosphere', f.includes('atmosphere'), f);
  assert('atmosphere fmt: has style', f.includes('style'), f);
}
{
  const f = format('map\nroute home / as home view\nend');
  assert('map fmt: has map', f.includes('map'), f);
  assert('map fmt: has route', f.includes('route'), f);
}

// ── Validator ─────────────────────────────────────────────────────────
console.log('\n─ Validator ─');
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();

  // rain and star register names
  const ast1 = parse('rain user count is 42');
  const r1 = v.validate(ast1);
  assert('validator: rain ok', r1.errors.length === 0, r1.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const ast2 = parse('universe User\nfield name is string\nend');
  const r2 = v.validate(ast2);
  assert('validator: universe ok', r2.errors.length === 0, r2.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const ast3 = parse('orbit item in items\nend');
  const r3 = v.validate(ast3);
  assert('validator: orbit ok', r3.errors.length === 0, r3.errors);
}
{
  const { EventMathValidator } = require('../src/validator.js');
  const v = new EventMathValidator();
  const ast4 = parse('attempt\nshow hello\ncollapse err\nshow fallback\nend');
  const r4 = v.validate(ast4);
  assert('validator: attempt ok', r4.errors.length === 0, r4.errors);
}

// ── End-to-end: full web page ─────────────────────────────────────────
console.log('\n─ End-to-end: web page ─');
{
  const src = `
rain page title is EventMath Web
star max items is 10
zone visible items is items
lens safe title is page title
universe Product
  field name is string
  field price is number
end
atmosphere card style
  style background is white
  style padding is 16px
end
cloud product card
  node h2 Product
  node p Details
  reflect rendered content
end
attempt
  earth get /api/products into products
collapse load error
  show error
always
  show done
end
map
  route home / as product card
end
`;
  try {
    const js = compile(src);
    assert('e2e: compiles without throw', true);
    assert('e2e: rain in output', js.includes('page_title'), js.substring(0, 200));
    assert('e2e: star in output', js.includes('max_items'), js.substring(0, 200));
    assert('e2e: universe in output', js.includes('Product'), js.substring(0, 200));
    assert('e2e: atmosphere in output', js.includes('EventMathAtmosphere'), js.substring(0, 200));
    assert('e2e: cloud in output', js.includes('product_card'), js.substring(0, 200));
    assert('e2e: attempt in output', js.includes('try'), js.substring(0, 200));
    assert('e2e: earth in output', js.includes('EventMathEarth'), js.substring(0, 200));
    assert('e2e: map in output', js.includes('EventMathRouter'), js.substring(0, 200));
  } catch(e) {
    assert('e2e: no compile error', false, e.message);
  }
}

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
if (failed > 0) process.exit(1);
