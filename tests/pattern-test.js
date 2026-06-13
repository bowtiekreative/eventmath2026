/**
 * EventMath v2.17 — named patterns (human-readable regex)
 *
 * Covers tokenizer, parser, codegen (pattern compiler), formatter round-trip,
 * and validator integration.
 */

'use strict';

const assert = require('assert');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓  ' + name); passed++; }
  catch (e) { console.log('  ✗  ' + name + '\n     ' + e.message); failed++; }
}

function tok(src) { return new EventMathTokenizer().tokenize(src); }
function parse(src) { return new EventMathParser(tok(src)).parse(); }
function gen(src, opts) { return new EventMathCodeGen().generate(parse(src), opts); }

// ── Tokenizer ────────────────────────────────────────────────────────
console.log('\nEventMath v2.17 — named patterns\n');
console.log('─ Tokenizer ─');

test('pattern NAME → PATTERN_STMT with name', () => {
  const t = tok('pattern email address').find(x => x.type === 'PATTERN_STMT');
  assert.ok(t, 'PATTERN_STMT expected');
  assert.strictEqual(t.value.name, 'email address');
});

test('pattern single word name → PATTERN_STMT', () => {
  const t = tok('pattern html heading').find(x => x.type === 'PATTERN_STMT');
  assert.ok(t, 'PATTERN_STMT expected');
  assert.strictEqual(t.value.name, 'html heading');
});

test('scan TEXT with PATTERN into RESULTS → SCAN_STMT', () => {
  const t = tok('scan page with email address into found emails').find(x => x.type === 'SCAN_STMT');
  assert.ok(t, 'SCAN_STMT expected');
  assert.strictEqual(t.value.text, 'page');
  assert.strictEqual(t.value.pattern, 'email address');
  assert.strictEqual(t.value.into, 'found emails');
});

test('seek TEXT with PATTERN into RESULT → SEEK_STMT', () => {
  const t = tok('seek html with heading finder into first heading').find(x => x.type === 'SEEK_STMT');
  assert.ok(t, 'SEEK_STMT expected');
  assert.strictEqual(t.value.text, 'html');
  assert.strictEqual(t.value.pattern, 'heading finder');
  assert.strictEqual(t.value.into, 'first heading');
});

test('scan with single-word names → SCAN_STMT', () => {
  const t = tok('scan source with phone into matches').find(x => x.type === 'SCAN_STMT');
  assert.ok(t, 'SCAN_STMT expected');
  assert.strictEqual(t.value.text, 'source');
  assert.strictEqual(t.value.pattern, 'phone');
  assert.strictEqual(t.value.into, 'matches');
});

test('seek with single-word names → SEEK_STMT', () => {
  const t = tok('seek content with url into link').find(x => x.type === 'SEEK_STMT');
  assert.ok(t, 'SEEK_STMT expected');
  assert.strictEqual(t.value.text, 'content');
  assert.strictEqual(t.value.pattern, 'url');
  assert.strictEqual(t.value.into, 'link');
});

test('body line inside pattern is a matter line (NAME KEYWORD LITERAL)', () => {
  // The body lines use the existing _matterLine dispatch
  const tokens = tok('user is letters and digits and "._%-+" repeated');
  const nameTok = tokens.find(x => x.type === 'NAME');
  const kwTok   = tokens.find(x => x.type === 'KEYWORD' && x.value === 'is');
  const litTok  = tokens.find(x => x.type === 'LITERAL');
  assert.ok(nameTok, 'NAME token expected');
  assert.ok(kwTok,   'KEYWORD(is) token expected');
  assert.ok(litTok,  'LITERAL token expected');
  assert.strictEqual(nameTok.value, 'user');
  assert.strictEqual(litTok.value, 'letters and digits and "._%-+" repeated');
});

// ── Parser ───────────────────────────────────────────────────────────
console.log('─ Parser ─');

const PATTERN_SRC = `pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end`;

test('PatternStmt has correct name', () => {
  const ast = parse(PATTERN_SRC);
  const stmt = ast.statements.find(s => s.type === 'PatternStmt');
  assert.ok(stmt, 'PatternStmt expected');
  assert.strictEqual(stmt.name, 'email address');
});

test('PatternStmt has 4 parts', () => {
  const ast = parse(PATTERN_SRC);
  const stmt = ast.statements.find(s => s.type === 'PatternStmt');
  assert.ok(stmt, 'PatternStmt expected');
  assert.strictEqual(stmt.parts.length, 4);
});

test('PatternStmt parts have correct names', () => {
  const ast = parse(PATTERN_SRC);
  const stmt = ast.statements.find(s => s.type === 'PatternStmt');
  const names = stmt.parts.map(p => p.name);
  assert.deepStrictEqual(names, ['user', 'at', 'domain', 'extension']);
});

test('PatternStmt parts have correct exprs', () => {
  const ast = parse(PATTERN_SRC);
  const stmt = ast.statements.find(s => s.type === 'PatternStmt');
  assert.strictEqual(stmt.parts[0].expr, 'letters and digits and "._%-+" repeated');
  assert.strictEqual(stmt.parts[1].expr, '"@"');
  assert.strictEqual(stmt.parts[2].expr, 'letters and digits and "." and "-" repeated');
  assert.strictEqual(stmt.parts[3].expr, '"." then letters at least 2');
});

test('ScanStmt parses correctly', () => {
  const ast = parse('scan page with email address into found emails');
  const stmt = ast.statements.find(s => s.type === 'ScanStmt');
  assert.ok(stmt, 'ScanStmt expected');
  assert.strictEqual(stmt.text, 'page');
  assert.strictEqual(stmt.pattern, 'email address');
  assert.strictEqual(stmt.into, 'found emails');
});

test('SeekStmt parses correctly', () => {
  const ast = parse('seek html with heading finder into first heading');
  const stmt = ast.statements.find(s => s.type === 'SeekStmt');
  assert.ok(stmt, 'SeekStmt expected');
  assert.strictEqual(stmt.text, 'html');
  assert.strictEqual(stmt.pattern, 'heading finder');
  assert.strictEqual(stmt.into, 'first heading');
});

// ── Pattern Expression Compiler ──────────────────────────────────────
console.log('─ Pattern Expression Compiler ─');

// We test the compiler indirectly via full codegen

test('letters → [a-zA-Z] in generated regex', () => {
  const src = `pattern alpha\n  chars is letters\nend`;
  const code = gen(src);
  assert.ok(code.includes('[a-zA-Z]'), 'Expected [a-zA-Z] in output, got: ' + code);
});

test('digits repeated → [0-9]+ in generated regex', () => {
  const src = `pattern nums\n  digits is digits repeated\nend`;
  const code = gen(src);
  assert.ok(code.includes('[0-9]+'), 'Expected [0-9]+ in output, got: ' + code);
});

test('any text lazily → [\\\\s\\\\S]*? in generated regex', () => {
  const src = `pattern anything\n  body is any text lazily\nend`;
  const code = gen(src);
  // The compiled regex will contain [\s\S]*? but JSON.stringify doubles the backslashes
  assert.ok(code.includes('[\\s\\S]') || code.includes('[\\\\s\\\\S]'), 'Expected any text wildcard in output');
});

test('letters and digits and quoted string → char class in generated regex', () => {
  const src = `pattern userchars\n  chars is letters and digits and "._%-+" repeated\nend`;
  const code = gen(src);
  assert.ok(code.includes('[a-zA-Z0-9'), 'Expected char class in output');
  assert.ok(code.includes('._%-+'), 'Expected quoted chars in output');
});

test('"h" then digit 1 through 6 → h[1-6] in generated regex', () => {
  const src = `pattern heading tag\n  tag is "h" then digit 1 through 6\nend`;
  const code = gen(src);
  assert.ok(code.includes('h'), 'Expected h literal in output');
  assert.ok(code.includes('[1-6]'), 'Expected digit range [1-6] in output');
});

test('letters or digits → alternation in generated regex', () => {
  const src = `pattern alphanum\n  char is letters or digits\nend`;
  const code = gen(src);
  assert.ok(code.includes('|'), 'Expected alternation | in output');
  assert.ok(code.includes('[a-zA-Z]'), 'Expected letters in output');
  assert.ok(code.includes('[0-9]'), 'Expected digits in output');
});

test('letters at least 2 → [a-zA-Z]{2,} in generated regex', () => {
  const src = `pattern tld\n  ext is letters at least 2\nend`;
  const code = gen(src);
  assert.ok(code.includes('[a-zA-Z]{2,}'), 'Expected {2,} quantifier in output, got: ' + code);
});

test('not ">" → [^>] in generated regex', () => {
  const src = `pattern attribs\n  notclose is not ">"\nend`;
  const code = gen(src);
  assert.ok(code.includes('[^>]'), 'Expected [^>] in output');
});

test('matches PART → \\\\k<partname> backreference in generated regex', () => {
  const src = `pattern backref\n  tag is "h" then digit 1 through 6\n  close is matches tag\nend`;
  const code = gen(src);
  assert.ok(code.includes('\\k<tag>'), 'Expected \\k<tag> backreference in output, got: ' + code);
});

// ── Full Codegen Tests ───────────────────────────────────────────────
console.log('─ Codegen ─');

test('PatternStmt emits new RegExp(...)', () => {
  const src = `pattern email address\n  user is letters repeated\n  at is "@"\nend`;
  const code = gen(src);
  assert.ok(code.includes('new RegExp('), 'Expected new RegExp() in output');
});

test('safeName converts spaces: email address → email_address', () => {
  const src = `pattern email address\n  user is letters repeated\nend`;
  const code = gen(src);
  assert.ok(code.includes('email_address'), 'Expected email_address variable name in output');
});

test('Named capture groups appear in generated regex', () => {
  const src = `pattern email address\n  user is letters repeated\n  at is "@"\nend`;
  const code = gen(src);
  assert.ok(code.includes('(?<user>'), 'Expected (?<user> named group in output');
  assert.ok(code.includes('(?<at>'), 'Expected (?<at> named group in output');
});

test('scan emits matchAll with map(m => m.groups)', () => {
  const src = `mark page as "test"\npattern email\n  user is letters\nend\nscan page with email into found`;
  const code = gen(src);
  assert.ok(code.includes('matchAll('), 'Expected matchAll in output');
  assert.ok(code.includes('.map(function(m)'), 'Expected .map(function(m) in output');
  assert.ok(code.includes('m.groups'), 'Expected m.groups in output');
});

test('seek emits exec with .groups access', () => {
  const src = `mark page as "test"\npattern email\n  user is letters\nend\nseek page with email into found`;
  const code = gen(src);
  assert.ok(code.includes('.exec('), 'Expected .exec( in output');
  assert.ok(code.includes('.groups'), 'Expected .groups in output');
});

test('seek creates non-global regex copy via RegExp(pattern.source)', () => {
  const src = `mark page as "test"\npattern email\n  user is letters\nend\nseek page with email into found`;
  const code = gen(src);
  assert.ok(code.includes('.source'), 'Expected .source in output for seek');
});

test('scan result uses safeName for into variable', () => {
  const src = `mark page as "test"\npattern email\n  user is letters\nend\nscan page with email into found emails`;
  const code = gen(src);
  assert.ok(code.includes('found_emails'), 'Expected found_emails variable in output');
});

test('gm flags on pattern regex', () => {
  const src = `pattern test\n  part is letters\nend`;
  const code = gen(src);
  assert.ok(code.includes("'gm'"), "Expected 'gm' flags on pattern RegExp");
});

test('inline part reference expands previously defined part regex', () => {
  const src = `pattern html heading\n  tag is "h" then digit 1 through 6\n  opening is "<" then tag then ">"\nend`;
  const code = gen(src);
  // 'tag' should be expanded inline in 'opening' — the opening group should contain h[1-6]
  assert.ok(code.includes('h[1-6]'), 'Expected tag expansion h[1-6] in output');
  // The opening part should have the expanded regex embedded
  assert.ok(code.includes('(?<opening>'), 'Expected (?<opening> named group');
});

test('matches PART uses \\k<partname> for backreference not inline expansion', () => {
  const src = `pattern html heading\n  tag is "h" then digit 1 through 6\n  closing is "</" then matches tag then ">"\nend`;
  const code = gen(src);
  // closing should use \k<tag> not expand tag inline
  assert.ok(code.includes('\\k<tag>'), 'Expected \\k<tag> backreference in closing group');
});

test('pattern comment line in generated output', () => {
  const src = `pattern my pattern\n  part is letters\nend`;
  const code = gen(src);
  assert.ok(code.includes('// pattern:'), 'Expected // pattern: comment in output');
});

test('multiple named groups in correct order', () => {
  const src = `pattern email address\n  user is letters and digits and "._%-+" repeated\n  at is "@"\n  domain is letters and digits repeated\n  extension is "." then letters at least 2\nend`;
  const code = gen(src);
  const userIdx = code.indexOf('(?<user>');
  const atIdx   = code.indexOf('(?<at>');
  const domIdx  = code.indexOf('(?<domain>');
  const extIdx  = code.indexOf('(?<extension>');
  assert.ok(userIdx < atIdx, 'user group should come before at group');
  assert.ok(atIdx < domIdx, 'at group should come before domain group');
  assert.ok(domIdx < extIdx, 'domain group should come before extension group');
});

// ── Formatter ────────────────────────────────────────────────────────
console.log('─ Formatter ─');

test('PatternStmt round-trips through formatter', () => {
  const src = `pattern email address
  user is letters repeated
  at is "@"
end`;
  const ast = parse(src);
  const fmt = new EventMathFormatter();
  const out = fmt.format(ast);
  assert.ok(out.includes('pattern email address'), 'Expected pattern header in formatted output');
  assert.ok(out.includes('user is letters repeated'), 'Expected part in formatted output');
  assert.ok(out.includes('at is "@"'), 'Expected part in formatted output');
  assert.ok(out.includes('end'), 'Expected end in formatted output');
});

test('ScanStmt round-trips through formatter', () => {
  const src = 'scan page with email address into found emails';
  const ast = parse(src);
  const fmt = new EventMathFormatter();
  const out = fmt.format(ast);
  assert.ok(out.includes('scan page with email address into found emails'), 'ScanStmt round-trip failed');
});

test('SeekStmt round-trips through formatter', () => {
  const src = 'seek html with heading finder into first heading';
  const ast = parse(src);
  const fmt = new EventMathFormatter();
  const out = fmt.format(ast);
  assert.ok(out.includes('seek html with heading finder into first heading'), 'SeekStmt round-trip failed');
});

test('Formatter indents pattern body parts', () => {
  const src = `pattern email address
  user is letters repeated
  at is "@"
end`;
  const ast = parse(src);
  const fmt = new EventMathFormatter();
  const out = fmt.format(ast);
  const lines = out.split('\n');
  const userLine = lines.find(l => l.includes('user is letters repeated'));
  assert.ok(userLine, 'user line not found');
  // Body line should be indented (have leading spaces)
  assert.ok(userLine.startsWith(' ') || userLine.startsWith('\t'), 'Body line should be indented');
});

// ── End-to-end integration ────────────────────────────────────────────
console.log('─ Integration ─');

test('full email pattern example compiles without error', () => {
  const src = `pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end
mark page as "test@example.com"
scan page with email address into found emails`;
  let code;
  assert.doesNotThrow(() => { code = gen(src); }, 'codegen should not throw');
  assert.ok(code.includes('email_address'), 'Expected email_address variable');
  assert.ok(code.includes('found_emails'), 'Expected found_emails variable');
});

test('full html heading pattern example compiles without error', () => {
  const src = `pattern html heading
  tag     is "h" then digit 1 through 6
  opening is "<" then tag then optional attributes then ">"
  content is any text lazily
  closing is "</" then matches tag then ">"
end
mark source as "<h1>Hello</h1>"
scan source with html heading into all headings`;
  let code;
  assert.doesNotThrow(() => { code = gen(src); }, 'codegen should not throw');
  assert.ok(code.includes('html_heading'), 'Expected html_heading variable');
  assert.ok(code.includes('all_headings'), 'Expected all_headings variable');
});

test('optional attributes → [^>]* in compiled regex', () => {
  const src = `pattern tag\n  open is "<" then optional attributes then ">"\nend`;
  const code = gen(src);
  assert.ok(code.includes('[^>]*'), 'Expected optional attributes [^>]* in output');
});

test('word atom → \\\\w in generated regex', () => {
  const src = `pattern words\n  w is word repeated\nend`;
  const code = gen(src);
  assert.ok(code.includes('\\w'), 'Expected \\w in output');
});

// ── Part name collision checks ─────────────────────────────────────────
console.log('\n─ Part name collision checks ─');

test('"open" is usable as a part name (tokenized as NAME)', () => {
  // 'open' appears in KEYWORDS but the tokenizer emits NAME at line-start — safe.
  const src = `pattern tag\n  open is "<" then letters repeated then ">"\nend`;
  const code = gen(src);
  assert.ok(code.includes('(?<open>'), 'Expected named group open in output: ' + code);
});

test('"not", "to", "from", "by" tokenize as NAME — usable as part names', () => {
  const src = `pattern file path\n  not is "!" then letters repeated\n  to  is "/" then letters repeated\nend`;
  const code = gen(src);
  assert.ok(code.includes('(?<not>'), 'Expected named group not');
  assert.ok(code.includes('(?<to>'), 'Expected named group to');
});

test('non-keyword names are always safe as part names', () => {
  const src = `pattern html heading\n  open tag is "<h" then digit 1 through 6 then ">"\n  content is any text lazily\n  close tag is "</h" then digit 1 through 6 then ">"\nend`;
  const code = gen(src);
  assert.ok(code.includes('(?<open_tag>'), 'Expected open_tag group');
  assert.ok(code.includes('(?<content>'), 'Expected content group');
  assert.ok(code.includes('(?<close_tag>'), 'Expected close_tag group');
});

// ── Regression: runtime correctness ──────────────────────────────────
console.log('\n─ Runtime correctness ─');

// The codegen wraps the regex with JSON.stringify, so the code contains a
// JS string literal.  Extract it and JSON.parse to get the actual regex chars.
function rxFromCode(code, flags) {
  const raw = code.match(/new RegExp\("([^"]+)"/)?.[1] || '';
  const str = JSON.parse('"' + raw + '"');
  return new RegExp(str, flags || 'gm');
}

test('html heading pattern matches h1-h6 at runtime', () => {
  const src = `pattern html heading
  open tag  is "<h" then digit 1 through 6 then optional attributes then ">"
  content   is any text lazily
  close tag is "</h" then digit 1 through 6 then ">"
end`;
  const code = gen(src);
  const rx = rxFromCode(code);
  const page = '<h1>Title</h1><h2>Sub</h2><h7>Invalid</h7>';
  const matches = [...page.matchAll(rx)].map(m => m.groups);
  assert.strictEqual(matches.length, 2, 'Expected 2 headings (h7 excluded), got ' + matches.length);
  assert.strictEqual(matches[0].open_tag, '<h1>', 'Expected open_tag <h1>');
  assert.strictEqual(matches[0].content, 'Title', 'Expected content Title');
  assert.strictEqual(matches[1].open_tag, '<h2>', 'Expected open_tag <h2>');
});

test('email pattern matches correctly at runtime', () => {
  const code = gen(`pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end`);
  const rx = rxFromCode(code);
  const text = 'alice@example.com and bob@test.org';
  const matches = [...text.matchAll(rx)].map(m => m.groups);
  assert.strictEqual(matches.length, 2, 'Expected 2 email matches');
  assert.strictEqual(matches[0].user, 'alice');
  assert.strictEqual(matches[0].domain, 'example');
  assert.strictEqual(matches[0].extension, '.com');
  assert.strictEqual(matches[1].user, 'bob');
});

test('seek returns first match groups or null', () => {
  const code = gen(`pattern word
  w is letters repeated
end
mark text as "hello world"
seek text with word into first`);
  const rx = rxFromCode(code, 'm');
  const r = rx.exec('hello world');
  assert.ok(r !== null, 'Expected a match');
  assert.strictEqual(r.groups.w, 'hello', 'Expected first word "hello"');
});

test('backreference \\\\k<name> resolves at runtime', () => {
  // Use 'dup' as the part name — 'again' is a keyword that consumes its line.
  const code = gen(`pattern repeated word
  word is letters repeated
  gap  is whitespace repeated
  dup  is matches word
end`);
  assert.ok(code.includes('\\k<word>'), 'Expected \\k<word> backreference in output');
  const rx = rxFromCode(code, 'gim');
  const found = [...'foo foo bar baz baz'.matchAll(rx)].map(m => m.groups.word);
  assert.deepStrictEqual(found, ['foo', 'baz'], 'Expected repeated words foo and baz');
});

// ── Summary ──────────────────────────────────────────────────────────
console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
