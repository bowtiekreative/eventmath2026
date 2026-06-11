/**
 * EventMath Prediction Engine Test Suite (v1.1)
 *
 * Tests all 6 aspects of the prediction engine:
 *  1. predict statement parses to PredictStmt AST node
 *  2. predict compiles to nested forEach loops
 *  3. resolve statement parses to ResolveStmt AST node
 *  4. resolve compiles to .map() with resolved/correct matter
 *  5. accuracy of compiles to _resolved.length check
 *  6. Full pipeline: compile+run, verify event count
 */

'use strict';

const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathCodeGen } = require('../src/codegen.js');
const vm = require('vm');
const path = require('path');
const EM = require('../runtime/eventmath-runtime.js');

console.log('\n' + '='.repeat(60));
console.log('EventMath Prediction Engine Test Suite');
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

function tokenize(source) {
  return new EventMathTokenizer().tokenize(source);
}

function parse(source) {
  const tokens = tokenize(source);
  const parser = new EventMathParser(tokens);
  const ast = parser.parse();
  if (ast.errors && ast.errors.length > 0) {
    throw new Error('Parse errors: ' + ast.errors.join(', '));
  }
  return ast;
}

function compile(source) {
  const ast = parse(source);
  const codegen = new EventMathCodeGen();
  return codegen.generate(ast);
}

// ── Test 1: predict statement parses ────────────────────────────
test('predict statement parses to PredictStmt', () => {
  const src = `
event dir a
category test
matter
  name is direct
end
end

layer test directions
  dir a
end

event lens a
category test
matter
  name is who
end
end

layer test lenses
  lens a
end

event qty a
category test
matter
  name is all
end
end

layer test quantities
  qty a
end

predict price of product
across test directions
and test lenses
and test quantities
into price predictions
`;
  const ast = parse(src);
  const predictNode = ast.statements.find(s => s.type === 'PredictStmt');
  if (!predictNode) throw new Error('No PredictStmt node found in AST');
  if (predictNode.subject !== 'price of product') throw new Error(`Wrong subject: "${predictNode.subject}"`);
  if (predictNode.directionsLayer !== 'test directions') throw new Error(`Wrong directionsLayer: "${predictNode.directionsLayer}"`);
  if (predictNode.lensesLayer !== 'test lenses') throw new Error(`Wrong lensesLayer: "${predictNode.lensesLayer}"`);
  if (predictNode.quantitiesLayer !== 'test quantities') throw new Error(`Wrong quantitiesLayer: "${predictNode.quantitiesLayer}"`);
  if (predictNode.intoLayer !== 'price predictions') throw new Error(`Wrong intoLayer: "${predictNode.intoLayer}"`);
});

// ── Test 2: predict compiles to nested forEach ───────────────────
test('predict compiles to three nested forEach loops', () => {
  const src = `
event dir a
category test
matter
  name is direct
end
end

event dir b
category test
matter
  name is indirect other
end
end

layer test directions
  dir a
  dir b
end

event lens a
category test
matter
  name is who
end
end

layer test lenses
  lens a
end

event qty a
category test
matter
  name is all
end
end

layer test quantities
  qty a
end

predict some subject
across test directions
and test lenses
and test quantities
into test predictions
`;
  const js = compile(src);
  const forEachCount = (js.match(/\.forEach\(/g) || []).length;
  if (forEachCount < 3) throw new Error(`Expected at least 3 .forEach( calls, got ${forEachCount}`);
  if (!js.includes('predicted_state')) throw new Error('Expected predicted_state in output');
  if (!js.includes("confidence: 0.5")) throw new Error('Expected confidence: 0.5 in output');
});

// ── Test 3: resolve statement parses ────────────────────────────
test('resolve statement parses to ResolveStmt', () => {
  const src = `
mark x as 1

resolve some layer where direction is direct and lens is who as correct
`;
  const ast = parse(src);
  const resolveNode = ast.statements.find(s => s.type === 'ResolveStmt');
  if (!resolveNode) throw new Error('No ResolveStmt node found in AST');
  if (resolveNode.layer !== 'some layer') throw new Error(`Wrong layer: "${resolveNode.layer}"`);
  if (resolveNode.outcome !== 'correct') throw new Error(`Wrong outcome: "${resolveNode.outcome}"`);
  if (!resolveNode.condition) throw new Error('Missing condition node');
});

// ── Test 4: resolve compiles to .map() ──────────────────────────
test('resolve compiles to .map() with resolved: true and correct value', () => {
  const src = `
mark x as 1

resolve some layer where direction is direct as incorrect
`;
  const js = compile(src);
  if (!js.includes('.map(')) throw new Error('Expected .map( in compiled output');
  if (!js.includes('resolved: true')) throw new Error('Expected resolved: true in compiled output');
  if (!js.includes('correct: false')) throw new Error('Expected correct: false for "incorrect" outcome');
});

// ── Test 5: accuracy of compiles ────────────────────────────────
test('accuracy of compiles with _resolved.length check', () => {
  const src = `
mark x as 1

mark score as accuracy of some results where lens is who
`;
  const js = compile(src);
  if (!js.includes('_resolved.length')) throw new Error('Expected _resolved.length in compiled output');
  if (!js.includes('_correct.length')) throw new Error('Expected _correct.length in compiled output');
});

// ── Test 6: Full pipeline — compile, run, verify event count ────
test('full pipeline: 2 dirs x 1 lens x 1 qty = 2 prediction events', () => {
  const src = `
event dir a
category test
matter
  name is direct
end
end

event dir b
category test
matter
  name is indirect other
end
end

layer test directions
  dir a
  dir b
end

event lens a
category test
matter
  name is who
end
end

layer test lenses
  lens a
end

event qty a
category test
matter
  name is all
end
end

layer test quantities
  qty a
end

predict some subject
across test directions
and test lenses
and test quantities
into test predictions
`;
  const js = compile(src);

  // Run the compiled JS in a sandbox with the runtime available
  const sandbox = {
    require: (mod) => {
      if (mod === '../runtime/eventmath-runtime.js') return EM;
      return require(mod);
    },
    console: { log: () => {}, error: () => {} },
    module: { exports: {} },
    exports: {},
    Date,
    Math,
  };

  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);

  const predictions = sandbox.module.exports.test_predictions || sandbox.test_predictions;
  if (!predictions) throw new Error('test_predictions layer not found in output');
  if (predictions.events.length !== 2) {
    throw new Error(`Expected 2 prediction events (2 dirs x 1 lens x 1 qty), got ${predictions.events.length}`);
  }
  const first = predictions.events[0];
  if (!first.matter || first.matter.subject !== 'some subject') {
    throw new Error(`Expected subject "some subject", got "${first.matter && first.matter.subject}"`);
  }
  if (first.matter.confidence !== 0.5) {
    throw new Error(`Expected confidence 0.5, got ${first.matter.confidence}`);
  }
  if (first.matter.resolved !== false) {
    throw new Error(`Expected resolved false, got ${first.matter.resolved}`);
  }
  if (first.matter.correct !== null) {
    throw new Error(`Expected correct null, got ${first.matter.correct}`);
  }
});

// ── Summary ──────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
