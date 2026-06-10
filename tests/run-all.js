/**
 * EventMath Test Runner — validates tokenizer + parser against acceptance tests.
 * Loads .em files directly from the tests/ directory.
 */

const fs = require('fs');
const path = require('path');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');

const TEST_DIR = __dirname;

const tests = [
  { name: 'Requirements Tracker', file: 'requirements-tracker.em' },
  { name: 'Story Timeline',       file: 'story-timeline.em' },
  { name: 'Workflow Automation',  file: 'workflow-automation.em' },
];

// Also test inline conditionals
const condTest = {
  name: 'Conditionals (inline)',
  source: `
when user is logged in
  run dashboard
otherwise
  run login screen
end

split status into
path success
  run done
end
path fail
  run error
end
end

again 5 times
  run test
end
`
};

let passed = 0;
let failed = 0;

function runTest(name, source) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${name}`);
  console.log(`${'='.repeat(60)}`);

  const tokenizer = new EventMathTokenizer();
  const tokens = tokenizer.tokenize(source);
  console.log(`Tokens: ${tokens.length}`);

  const parser = new EventMathParser(tokens);
  const ast = parser.parse();

  if (ast.errors && ast.errors.length > 0) {
    console.log(`❌ PARSE ERRORS (${ast.errors.length}):`);
    for (const err of ast.errors) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      console.log(`  ${msg}`);
    }
    failed++;
  } else {
    console.log(`✅ Parsed: ${ast.statements.length} top-level statements`);
    for (const stmt of ast.statements) {
      const label = stmt.name || stmt.target || stmt.variable || '';
      const extra = [];
      if (stmt.doorOpen) extra.push(`door:${stmt.doorOpen.inputs.join(',')}`);
      if (stmt.body) extra.push(`${stmt.body.length} body stmts`);
      if (stmt.category) extra.push(`cat:${stmt.category}`);
      if (stmt.matter) extra.push(`${stmt.matter.fields.length} matter fields`);
      console.log(`  ✅ ${stmt.type}${label ? ': ' + label : ''}${extra.length ? ' [' + extra.join(', ') + ']' : ''}`);
    }
    passed++;
  }
}

// Run file-based tests
for (const { name, file } of tests) {
  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`\n⚠  SKIP: ${file} (not found)`);
    continue;
  }
  runTest(name, fs.readFileSync(filePath, 'utf-8'));
}

// Run inline tests
runTest(condTest.name, condTest.source);

console.log(`\n${'='.repeat(60)}`);
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length + 1} tests`);
process.exit(failed > 0 ? 1 : 0);