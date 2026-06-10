/**
 * EventMath Compilation Test — compiles acceptance tests to JS.
 * Output is written alongside the .em files as .em.js for inspection.
 */

const fs = require('fs');
const path = require('path');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');

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
  if (!fs.existsSync(filePath)) {
    console.log(`⚠  SKIP: ${file} (not found)`);
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${name}`);
  console.log(`${'='.repeat(60)}`);

  // Tokenize
  const tokenizer = new EventMathTokenizer();
  const tokens = tokenizer.tokenize(source);

  // Parse
  const parser = new EventMathParser(tokens);
  const ast = parser.parse();

  if (ast.errors && ast.errors.length > 0) {
    console.log(`❌ Parse errors — cannot compile`);
    for (const err of ast.errors) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      console.log(`  ${msg}`);
    }
    failed++;
    continue;
  }

  // Generate
  const codegen = new EventMathCodeGen();
  let js;
  try {
    js = codegen.generate(ast);
  } catch (err) {
    console.log(`❌ Code generation error: ${err.message}`);
    failed++;
    continue;
  }

  // Write output
  const outPath = filePath + '.js';
  fs.writeFileSync(outPath, js, 'utf-8');
  console.log(`✅ Compiled: ${tokens.length} tokens → ${js.split('\n').length} JS lines`);
  console.log(`   Output: ${path.basename(outPath)}`);

  // Show generated code preview
  const preview = js.split('\n').slice(0, Math.min(15, js.split('\n').length)).join('\n');
  console.log(`\n   Preview:`);
  for (const line of preview.split('\n')) {
    console.log(`   ${line}`);
  }
  if (js.split('\n').length > 15) {
    console.log(`   ... (${js.split('\n').length - 15} more lines)`);
  }

  passed++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`\nResults: ${passed} compiled, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);