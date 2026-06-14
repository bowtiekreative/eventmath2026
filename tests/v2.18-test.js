'use strict';

/**
 * EventMath v2.18 Test Suite
 *
 * Tests:
 * 1. Pattern atom expansion (uppercase, lowercase, hex digit, tab, newline, start/end of line)
 * 2. Char class with new atoms
 * 3. replace in TEXT with PATTERN using "TEMPLATE" into RESULT
 * 4. zoom out from SOURCE into CONTEXT
 * 5. zoom expand on SOURCE into NETWORK
 */

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');
const { EventMathFormatter } = require('../src/formatter.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
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

// ─────────────────────────────────────────────────────────────────────
// Section 1: Pattern atom expansion
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Pattern atom expansion ─');

test('uppercase atom → [A-Z]', () => {
  const src = `
pattern upper test
  letter is uppercase
end
`;
  const out = compile(src);
  assert(out.includes('[A-Z]'), `Expected [A-Z] in: ${out}`);
});

test('uppercase letters atom → [A-Z]', () => {
  const src = `
pattern upper test
  letter is uppercase letters
end
`;
  const out = compile(src);
  assert(out.includes('[A-Z]'), `Expected [A-Z] in: ${out}`);
});

test('lowercase atom → [a-z]', () => {
  const src = `
pattern lower test
  letter is lowercase
end
`;
  const out = compile(src);
  assert(out.includes('[a-z]'), `Expected [a-z] in: ${out}`);
});

test('lowercase letters atom → [a-z]', () => {
  const src = `
pattern lower test
  letter is lowercase letters
end
`;
  const out = compile(src);
  assert(out.includes('[a-z]'), `Expected [a-z] in: ${out}`);
});

test('hex digit atom → [0-9a-fA-F]', () => {
  const src = `
pattern hex test
  nibble is hex digit
end
`;
  const out = compile(src);
  assert(out.includes('[0-9a-fA-F]'), `Expected [0-9a-fA-F] in: ${out}`);
});

test('hex digits atom → [0-9a-fA-F]', () => {
  const src = `
pattern hex test
  nibble is hex digits
end
`;
  const out = compile(src);
  assert(out.includes('[0-9a-fA-F]'), `Expected [0-9a-fA-F] in: ${out}`);
});

test('tab atom → \\t', () => {
  const src = `
pattern tab test
  separator is tab
end
`;
  const out = compile(src);
  assert(out.includes('\\t'), `Expected \\t in: ${out}`);
});

test('newline atom → \\n', () => {
  const src = `
pattern nl test
  separator is newline
end
`;
  const out = compile(src);
  assert(out.includes('\\n'), `Expected \\n in: ${out}`);
});

test('start of line atom → ^', () => {
  const src = `
pattern sol test
  prefix is start of line
end
`;
  const out = compile(src);
  assert(out.includes('^'), `Expected ^ in: ${out}`);
});

test('end of line atom → $', () => {
  const src = `
pattern eol test
  suffix is end of line
end
`;
  const out = compile(src);
  assert(out.includes('$'), `Expected $ in: ${out}`);
});

test('start of text atom → ^', () => {
  const src = `
pattern sot test
  prefix is start of text
end
`;
  const out = compile(src);
  assert(out.includes('^'), `Expected ^ in: ${out}`);
});

test('end of text atom → $', () => {
  const src = `
pattern eot test
  suffix is end of text
end
`;
  const out = compile(src);
  assert(out.includes('$'), `Expected $ in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 2: Char class with new atoms
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ Char class with new atoms ─');

test('uppercase and lowercase → [A-Za-z]', () => {
  const src = `
pattern alpha
  letter is uppercase and lowercase
end
`;
  const out = compile(src);
  assert(out.includes('[A-Za-z]'), `Expected [A-Za-z] in: ${out}`);
});

test('uppercase letters and lowercase letters → [A-Za-z]', () => {
  const src = `
pattern alpha
  letter is uppercase letters and lowercase letters
end
`;
  const out = compile(src);
  assert(out.includes('[A-Za-z]'), `Expected [A-Za-z] in: ${out}`);
});

test('hex digit and "_" char class', () => {
  const src = `
pattern hexish
  nibble is hex digit and "_"
end
`;
  const out = compile(src);
  assert(out.includes('[0-9a-fA-F_]'), `Expected [0-9a-fA-F_] in: ${out}`);
});

test('uppercase and lowercase and digits char class', () => {
  const src = `
pattern alnum
  ch is uppercase and lowercase and digits
end
`;
  const out = compile(src);
  assert(out.includes('[A-Za-z0-9]'), `Expected [A-Za-z0-9] in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 3: replace in TEXT with PATTERN using "TEMPLATE" into RESULT
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ replace statement ─');

test('tokenizer: replace in ... with ... using ... into ... → REPLACE_STMT', () => {
  const tokens = tokenize('replace in body with email address using "$<user> at $<domain>" into cleaned');
  const t = tokens.find(t => t.type === 'REPLACE_STMT');
  assert(t, 'Expected REPLACE_STMT token');
  assert(t.value.text === 'body', `Expected text=body, got ${t.value.text}`);
  assert(t.value.pattern === 'email address', `Expected pattern=email address, got ${t.value.pattern}`);
  assert(t.value.template === '$<user> at $<domain>', `Expected template, got: ${t.value.template}`);
  assert(t.value.into === 'cleaned', `Expected into=cleaned, got ${t.value.into}`);
});

test('parser: ReplaceStmt AST node', () => {
  const ast = parse('replace in body with email address using "$<user> at $<domain>" into cleaned');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ReplaceStmt', `Expected ReplaceStmt, got ${stmt.type}`);
  assert(stmt.text === 'body', `text: ${stmt.text}`);
  assert(stmt.pattern === 'email address', `pattern: ${stmt.pattern}`);
  assert(stmt.template === '$<user> at $<domain>', `template: ${stmt.template}`);
  assert(stmt.into === 'cleaned', `into: ${stmt.into}`);
});

test('codegen: ReplaceStmt emits .replace() call', () => {
  const src = `
pattern email address
  user is letters and digits and "._%-+" repeated
  at is "@"
  domain is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

mark text as "contact alice@example.com for info"
replace in text with email address using "$<user> at $<domain>" into cleaned
`;
  const out = compile(src);
  assert(out.includes('.replace(email_address,'), `Expected .replace(email_address,...) in: ${out}`);
  assert(out.includes('"$<user> at $<domain>"'), `Expected template in: ${out}`);
  assert(out.includes('const cleaned'), `Expected const cleaned in: ${out}`);
});

test('formatter: ReplaceStmt round-trips', () => {
  const src = 'replace in text with email address using "$<user> at $<domain>" into cleaned';
  const out = format(src);
  assert(out.includes('replace in text with email address'), `Round-trip failed: ${out}`);
  assert(out.includes('using "$<user> at $<domain>"'), `Template missing in: ${out}`);
  assert(out.includes('into cleaned'), `into missing in: ${out}`);
});

test('runtime: replace produces correct substitution', () => {
  // Build the pattern manually as codegen would, matching the pattern compiler output
  // user: letters and digits and "._%-+" repeated → [a-zA-Z0-9._%-+]+
  // domain: letters and digits and "." and "-" repeated → [a-zA-Z0-9.-]+
  const email_address = new RegExp(
    '(?<user>[a-zA-Z0-9._%-+]+)(?<at>@)(?<domain>[a-zA-Z0-9.-]+)(?<extension>\\.[a-zA-Z]{2,})',
    'gm'
  );
  const text = 'contact alice@example.com for info';
  const cleaned = text.replace(email_address, '$<user> at $<domain>');
  // Note: domain group captures 'example' (letters/digits/dots/dashes), then extension is '.com'
  assert(cleaned.includes('alice'), `Expected alice in result: ${cleaned}`);
  assert(cleaned.includes('example'), `Expected example in result: ${cleaned}`);
  assert(!cleaned.includes('@'), `Expected no @ in result: ${cleaned}`);
});

test('runtime: replace with multiple matches works', () => {
  const email_address = new RegExp('(?<user>[a-zA-Z0-9._%-+]+)(?<at>@)(?<domain>[a-zA-Z0-9.-]+)(?<extension>\\.[a-zA-Z]{2,})', 'gm');
  const text = 'alice@example.com and bob@corp.org';
  const cleaned = text.replace(email_address, '$<user>');
  assert(cleaned.includes('alice') && cleaned.includes('bob'), `Expected both names: ${cleaned}`);
  assert(!cleaned.includes('@'), `Expected @ removed: ${cleaned}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 4: zoom out from SOURCE into CONTEXT
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ zoom out from ─');

test('tokenizer: zoom out from ... into ... → ZOOM_OUT_FROM', () => {
  const tokens = tokenize('zoom out from revenue bridge into bridge context');
  const t = tokens.find(t => t.type === 'ZOOM_OUT_FROM');
  assert(t, 'Expected ZOOM_OUT_FROM token');
  assert(t.value.sourceName === 'revenue bridge', `sourceName: ${t.value.sourceName}`);
  assert(t.value.intoName === 'bridge context', `intoName: ${t.value.intoName}`);
});

test('tokenizer: zoom out on ... (old form) still → ZOOM_OUT', () => {
  const tokens = tokenize('zoom out on timeline my timeline as event summary');
  const t = tokens.find(t => t.type === 'ZOOM_OUT');
  assert(t, 'Expected ZOOM_OUT token (old form unchanged)');
});

test('parser: ZoomOutFrom AST node', () => {
  const ast = parse('zoom out from revenue bridge into bridge context');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ZoomOutFrom', `Expected ZoomOutFrom, got ${stmt.type}`);
  assert(stmt.sourceName === 'revenue bridge', `sourceName: ${stmt.sourceName}`);
  assert(stmt.intoName === 'bridge context', `intoName: ${stmt.intoName}`);
});

test('codegen: ZoomOutFrom emits IIFE with context object', () => {
  const src = `
event no income
category state
matter
  energy is low
end
end

event consistent income
category state
matter
  energy is high
end
end

zoom in on no income and consistent income into revenue bridge
zoom out from revenue bridge into bridge context
show bridge context
`;
  const out = compile(src);
  assert(out.includes('zoom out from'), `Expected zoom comment in: ${out}`);
  assert(out.includes('bridge_context'), `Expected bridge_context in: ${out}`);
  assert(out.includes('zoom_level'), `Expected zoom_level in: ${out}`);
  assert(out.includes('source:'), `Expected source: in: ${out}`);
  assert(out.includes('render:'), `Expected render: function in: ${out}`);
});

test('formatter: ZoomOutFrom round-trips', () => {
  const src = 'zoom out from revenue bridge into bridge context';
  const out = format(src);
  assert(out.includes('zoom out from revenue bridge into bridge context'), `Round-trip failed: ${out}`);
});

test('codegen: ZoomOutFrom output has correct fields', () => {
  const src = `
event no income
category state
matter
  energy is low
end
end

event consistent income
category state
matter
  energy is high
end
end

zoom in on no income and consistent income into revenue bridge
zoom out from revenue bridge into bridge context
`;
  const out = compile(src);
  assert(out.includes('from:'), `Expected from: field in: ${out}`);
  assert(out.includes('to:'), `Expected to: field in: ${out}`);
  assert(out.includes('parent_level:'), `Expected parent_level: in: ${out}`);
  assert(out.includes('constituents:'), `Expected constituents: in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Section 5: zoom expand on SOURCE into NETWORK
// ─────────────────────────────────────────────────────────────────────
console.log('\n─ zoom expand ─');

test('tokenizer: zoom expand on ... into ... → ZOOM_EXPAND', () => {
  const tokens = tokenize('zoom expand on market suppression into suppression field');
  const t = tokens.find(t => t.type === 'ZOOM_EXPAND');
  assert(t, 'Expected ZOOM_EXPAND token');
  assert(t.value.sourceName === 'market suppression', `sourceName: ${t.value.sourceName}`);
  assert(t.value.intoName === 'suppression field', `intoName: ${t.value.intoName}`);
  assert(t.value.sourceType === 'event', `sourceType: ${t.value.sourceType}`);
});

test('tokenizer: zoom expand on layer ... → sourceType=layer', () => {
  const tokens = tokenize('zoom expand on layer my events into event field');
  const t = tokens.find(t => t.type === 'ZOOM_EXPAND');
  assert(t, 'Expected ZOOM_EXPAND token');
  assert(t.value.sourceType === 'layer', `sourceType: ${t.value.sourceType}`);
  assert(t.value.sourceName === 'my events', `sourceName: ${t.value.sourceName}`);
});

test('parser: ZoomExpand AST node', () => {
  const ast = parse('zoom expand on market suppression into suppression field');
  const stmt = ast.statements[0];
  assert(stmt.type === 'ZoomExpand', `Expected ZoomExpand, got ${stmt.type}`);
  assert(stmt.sourceName === 'market suppression', `sourceName: ${stmt.sourceName}`);
  assert(stmt.intoName === 'suppression field', `intoName: ${stmt.intoName}`);
  assert(stmt.sourceType === 'event', `sourceType: ${stmt.sourceType}`);
});

test('codegen: ZoomExpand emits IIFE with field object', () => {
  const src = `
event market suppression
category state
matter
  energy is against
  signal is suppressed
end
end

zoom expand on market suppression into suppression field
show suppression field
`;
  const out = compile(src);
  assert(out.includes('zoom expand on'), `Expected zoom expand comment in: ${out}`);
  assert(out.includes('suppression_field'), `Expected suppression_field in: ${out}`);
  assert(out.includes('surface_area:'), `Expected surface_area: in: ${out}`);
  assert(out.includes('connections:'), `Expected connections: in: ${out}`);
  assert(out.includes('polarity:'), `Expected polarity: in: ${out}`);
  assert(out.includes('expansion_axis:'), `Expected expansion_axis: in: ${out}`);
  assert(out.includes('render:'), `Expected render: function in: ${out}`);
});

test('codegen: ZoomExpand polarity is negative for suppressed events', () => {
  const src = `
event market suppression
category state
matter
  energy is against
  signal is suppressed
end
end

zoom expand on market suppression into suppression field
`;
  const out = compile(src);
  assert(out.includes("'negative'"), `Expected negative polarity in: ${out}`);
});

test('codegen: ZoomExpand polarity is positive for neutral events', () => {
  const src = `
event good growth
category state
matter
  energy is high
  signal is strong
end
end

zoom expand on good growth into growth field
`;
  const out = compile(src);
  assert(out.includes("'positive'"), `Expected positive polarity in: ${out}`);
});

test('formatter: ZoomExpand round-trips for event source', () => {
  const src = 'zoom expand on market suppression into suppression field';
  const out = format(src);
  assert(out.includes('zoom expand on market suppression into suppression field'), `Round-trip failed: ${out}`);
});

test('formatter: ZoomExpand round-trips for layer source', () => {
  const src = 'zoom expand on layer my events into event field';
  const out = format(src);
  assert(out.includes('zoom expand on layer my events into event field'), `Round-trip failed: ${out}`);
});

test('codegen: ZoomExpand zoom_level is source level + 1', () => {
  const src = `
event base state
category state
matter
  energy is high
end
end

zoom expand on base state into expanded
`;
  const out = compile(src);
  assert(out.includes('__srcLevel + 1'), `Expected __srcLevel + 1 in: ${out}`);
});

// ─────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────
console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
