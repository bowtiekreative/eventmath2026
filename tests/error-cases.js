/**
 * EventMath Error-Path Test Suite
 *
 * Tests all major error classes. Runs each case through the
 * tokenizer + parser + validator and verifies expected errors/warnings
 * appear (or don't appear for valid programs).
 *
 * v0.5 additions:
 *  - expectCompiles / compiledContains: tokenize + parse + codegen check
 */

const fs = require('fs');
const path = require('path');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathValidator } = require('../src/validator.js');
const { EventMathCodeGen } = require('../src/codegen.js');

const TEST_DIR = __dirname;

const cases = [
  {
    name: 'E001 — Missing event name',
    source: 'event\nend',
    expectParseError: true,
    errorContains: 'name',
  },
  {
    name: 'E003 — Missing end',
    source: 'event task 1\ncategory task\nmatter\n  name is test\n',
    expectParseError: true,
  },
  {
    name: 'E005 — Bad matter line',
    source: 'event t1\nmatter\n  title whatever\nend\nend',
    expectParseError: true,
    errorContains: '"is"',
  },
  {
    name: 'E015 — Reserved word in name (validator)',
    source: 'event end the world\ncategory test\nend',
    expectValidatorError: true,
    errorContains: 'reserved',
  },
  {
    name: 'E017 — Undefined event reference in layer',
    source: 'layer my layer\n  ghost event\nend',
    expectValidatorError: true,
    errorContains: 'ghost event',
  },
  {
    name: 'E018 — Duplicate event declaration',
    source: 'event task 1\ncategory task\nend\nevent task 1\ncategory task\nend',
    expectValidatorWarning: true,
    warningContains: 'task 1',
  },
  {
    name: 'E002 — Unknown keyword in context',
    source: 'mark\nset y to 1',
    expectParseError: true,
  },
  {
    name: 'Valid — No errors on requirements tracker',
    sourceFile: 'requirements-tracker.em',
    expectNoErrors: true,
  },
  {
    name: 'Valid — No errors on story timeline',
    sourceFile: 'story-timeline.em',
    expectNoErrors: true,
  },
  {
    name: 'Valid — No errors on workflow automation',
    sourceFile: 'workflow-automation.em',
    expectNoErrors: true,
  },
  {
    name: 'check statement compiles correctly',
    source: 'mark count as 5\ncheck count is greater than 3',
    expectCompiles: true,
    compiledContains: 'if (!(count > 3))',
  },
  {
    name: 'arithmetic chaining compiles correctly',
    source: 'mark a as 2\nmark b as 3\nmark c as 4\nmark total as a plus b plus c',
    expectCompiles: true,
    compiledContains: 'a + b',
  },
  {
    name: 'Compound AND condition compiles correctly',
    source: 'mark a as 1\nmark b as 2\nwhen a is greater than 0 and b is greater than 0\n  run event task 1\nend',
    expectCompiles: true,
    compiledContains: '&&',
  },
  {
    name: 'Compound OR condition compiles correctly',
    source: 'mark status as done\nwhen status is done or status is complete\n  run event task 1\nend',
    expectCompiles: true,
    compiledContains: '||',
  },
  {
    name: 'String joined with compiles correctly',
    source: 'mark first as hello\nmark greeting as first joined with world',
    expectCompiles: true,
    compiledContains: 'String(',
  },
  {
    name: 'Use statement parses correctly',
    source: 'use sprint features from events.em',
    expectNoErrors: true,
  },
  {
    name: 'Use statement compiles to require',
    source: 'use sprint layer from events.em',
    expectCompiles: true,
    compiledContains: "require('./events.em.js')",
  },
];

let passed = 0;
let failed = 0;

function runCase(tc) {
  let source;
  if (tc.sourceFile) {
    const fp = path.join(TEST_DIR, tc.sourceFile);
    if (!fs.existsSync(fp)) {
      console.log(`  SKIP: ${tc.sourceFile} not found`);
      return;
    }
    source = fs.readFileSync(fp, 'utf-8');
  } else {
    source = tc.source;
  }

  const tokenizer = new EventMathTokenizer();
  const tokens = tokenizer.tokenize(source);
  const parser = new EventMathParser(tokens);
  const ast = parser.parse();
  const validator = new EventMathValidator();
  const validation = validator.validate(ast);

  const parseErrors = ast.errors || [];
  const validatorErrors = validation.errors || [];
  const validatorWarnings = validation.warnings || [];

  let ok = true;
  let reason = '';

  if (tc.expectNoErrors) {
    if (parseErrors.length > 0) {
      ok = false;
      reason = `Expected no parse errors, got: ${parseErrors[0]}`;
    } else if (validatorErrors.length > 0) {
      ok = false;
      reason = `Expected no validator errors, got: ${validatorErrors[0]}`;
    }
  }

  if (tc.expectParseError) {
    if (parseErrors.length === 0) {
      ok = false;
      reason = 'Expected parse error, got none';
    } else if (tc.errorContains) {
      const found = parseErrors.some(e => {
        const msg = typeof e === 'string' ? e : (e.message || '');
        return msg.toLowerCase().includes(tc.errorContains.toLowerCase());
      });
      if (!found) {
        ok = false;
        reason = `Expected parse error containing "${tc.errorContains}", got: ${parseErrors.map(e => typeof e === 'string' ? e : e.message).join('; ')}`;
      }
    }
  }

  if (tc.expectValidatorError) {
    if (validatorErrors.length === 0) {
      ok = false;
      reason = 'Expected validator error, got none';
    } else if (tc.errorContains) {
      const found = validatorErrors.some(e => {
        const msg = typeof e === 'string' ? e : (e.message || '');
        return msg.toLowerCase().includes(tc.errorContains.toLowerCase());
      });
      if (!found) {
        ok = false;
        reason = `Expected validator error containing "${tc.errorContains}", got: ${validatorErrors.join('; ')}`;
      }
    }
  }

  if (tc.expectValidatorWarning) {
    if (validatorWarnings.length === 0) {
      ok = false;
      reason = 'Expected validator warning, got none';
    } else if (tc.warningContains) {
      const found = validatorWarnings.some(w => {
        const msg = typeof w === 'string' ? w : (w.message || '');
        return msg.toLowerCase().includes(tc.warningContains.toLowerCase());
      });
      if (!found) {
        ok = false;
        reason = `Expected validator warning containing "${tc.warningContains}", got: ${validatorWarnings.join('; ')}`;
      }
    }
  }

  // ── expectCompiles / compiledContains ───────────────────────
  if (tc.expectCompiles) {
    if (parseErrors.length > 0) {
      ok = false;
      reason = `Expected clean compile, got parse errors: ${parseErrors[0]}`;
    } else {
      let compiled = '';
      try {
        const codegen = new EventMathCodeGen();
        compiled = codegen.generate(ast);
      } catch (err) {
        ok = false;
        reason = `Codegen threw: ${err.message}`;
      }
      if (ok && tc.compiledContains && !compiled.includes(tc.compiledContains)) {
        ok = false;
        reason = `Expected compiled output to contain "${tc.compiledContains}"`;
      }
    }
  }

  if (ok) {
    console.log(`  PASS  ${tc.name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${tc.name}`);
    console.log(`        ${reason}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('EventMath Error-Path Test Suite');
console.log('='.repeat(60) + '\n');

for (const tc of cases) {
  runCase(tc);
}

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${cases.length} cases`);
process.exit(failed > 0 ? 1 : 0);
