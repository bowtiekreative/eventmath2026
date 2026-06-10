/**
 * EventMath Formatter Test — formats acceptance tests and verifies roundtrip.
 */

const fs = require('fs');
const path = require('path');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathFormatter } = require('../src/formatter.js');

const TEST_DIR = __dirname;

const tests = [
  { name: 'Requirements Tracker', file: 'requirements-tracker.em' },
  { name: 'Story Timeline',       file: 'story-timeline.em' },
  { name: 'Workflow Automation',  file: 'workflow-automation.em' },
];

let passed = 0;
let failed = 0;

for (const { name, file } of tests) {
  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${name}`);
  console.log(`${'='.repeat(60)}`);

  const source = fs.readFileSync(filePath, 'utf-8');

  // Parse
  const tokens = new EventMathTokenizer().tokenize(source);
  const ast = new EventMathParser(tokens).parse();

  if (ast.errors && ast.errors.length > 0) {
    console.log('❌ Parse errors — cannot format');
    failed++;
    continue;
  }

  // Format
  const formatter = new EventMathFormatter();
  const formatted = formatter.format(ast);

  // Write output
  const outPath = filePath + '.fmt';
  fs.writeFileSync(outPath, formatted, 'utf-8');

  // Verify roundtrip: format → tokenize → parse → format = same
  const tokens2 = new EventMathTokenizer().tokenize(formatted);
  const ast2 = new EventMathParser(tokens2).parse();

  if (ast2.errors && ast2.errors.length > 0) {
    console.log('❌ Formatted output has parse errors');
    for (const e of ast2.errors) {
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
      console.log(`  ${msg}`);
    }
    failed++;
    continue;
  }

  const formatter2 = new EventMathFormatter();
  const formatted2 = formatter2.format(ast2);

  if (formatted === formatted2) {
    console.log('✅ Roundtrip: parse → format → parse → format = identical');
    passed++;
  } else {
    console.log('⚠  Roundtrip mismatch — formatting not idempotent');
    console.log(`  First: ${formatted.length} chars`);
    console.log(`  Second: ${formatted2.length} chars`);
    failed++;
  }

  // Show formatted preview
  const preview = formatted.split('\n').slice(0, 12).join('\n');
  console.log(`\n   Preview:`);
  for (const line of preview.split('\n')) {
    console.log(`   ${line}`);
  }
  if (formatted.split('\n').length > 12) {
    console.log(`   ... (${formatted.split('\n').length - 12} more lines)`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);