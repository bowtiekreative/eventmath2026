/**
 * EventMath Integration Test — runs compiled .em.js with the runtime.
 * Verifies events, layers, timelines, actions, and timeline tracking.
 * Workflow Automation verified statically (contains top-level loop).
 */

const EM = require('../runtime/eventmath-runtime.js');
const path = require('path');
const fs = require('fs');

const TEST_DIR = __dirname;

const safeTests = [
  { name: 'Requirements Tracker', file: 'requirements-tracker.em.js' },
  { name: 'Story Timeline',       file: 'story-timeline.em.js' },
];

const staticTests = [
  { name: 'Workflow Automation',  file: 'workflow-automation.em.js' },
];

let passed = 0;
let failed = 0;

// ── Run safe compiled tests ──────────────────────────────────

for (const { name, file } of safeTests) {
  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 ${name}`);
  console.log(`${'='.repeat(60)}`);

  const timeline = EM.getDefaultTimeline();
  timeline.log = [];
  timeline.pointer = 0;
  timeline.future = [];
  timeline.snapshots = {};
  timeline._state = {};

  try {
    delete require.cache[filePath];
    const mod = require(filePath);

    const events = Object.keys(mod).filter(k => mod[k] instanceof EM.EventMathEvent);
    const layers = Object.keys(mod).filter(k => mod[k] instanceof EM.EventMathLayer);
    const fns = Object.keys(mod).filter(k => typeof mod[k] === 'function');
    const timelines = Object.keys(mod).filter(k => mod[k] instanceof EM.EventMathTimeline);

    console.log(`  ✓ Events: ${events.length}`);
    for (const k of events) {
      const v = mod[k];
      console.log(`    ${v.id} [${v.cat}]`);
      for (const m in v.matter) console.log(`      ${m}: ${v.matter[m]}`);
    }

    for (const k of layers) {
      const v = mod[k];
      console.log(`  ✓ Layer: ${v.name} (${v.events.length} events)`);
      for (const e of v.events) console.log(`    → ${e.id}`);
    }

    for (const k of fns) console.log(`  ✓ Action: ${k}`);

    for (const k of timelines) {
      const v = mod[k];
      console.log(`  ✓ Timeline: ${v.name}`);
      const s = v.state();
      console.log(`    State: ${s.events ? Object.keys(s.events).length : 0} events`);
    }

    const logCount = timeline.log.length;
    if (logCount > 0) {
      console.log(`  ✓ Timeline log: ${logCount} entries`);
      timeline.rewind(1);
      console.log(`  ✓ Rewind → ${timeline.pointer}`);
      timeline.forward(1);
      console.log(`  ✓ Forward → ${timeline.pointer}`);
    }

    passed++;
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
    failed++;
  }
}

// ── Static verification for compiled files with loops ────────

for (const { name, file } of staticTests) {
  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 ${name} (static)`);
  console.log(`${'='.repeat(60)}`);

  try {
    const js = fs.readFileSync(filePath, 'utf-8');

    // Check that it compiles to valid JS syntax
    try {
      new Function(js);
      console.log('  ✓ Valid JS syntax');
    } catch (e) {
      console.log(`  ❌ Syntax error: ${e.message}`);
      failed++;
      continue;
    }

    // Check for expected patterns
    const checks = [
      ['EventMathEvent', 'Uses runtime EventMathEvent'],
      ['EventMathLayer', 'Uses runtime EventMathLayer'],
      ['all_done', 'Mark compiled correctly'],
      ['while', 'again until → while loop'],
      ['for (const current_task', 'walk → for-of loop'],
      ['current_task.status', 'Property access on walk variable'],
      ['all_done === true', 'Condition compiles correctly'],
      ['all_done = true', 'Set inside loop'],
      ['all_done = false', 'Set inside walk'],
      ['console.log(task_', 'Run statements compiled'],
    ];

    let allOk = true;
    for (const [pattern, label] of checks) {
      if (js.includes(pattern)) {
        console.log(`  ✓ ${label}`);
      } else {
        console.log(`  ⚠  Missing: ${label} (${pattern})`);
        allOk = false;
      }
    }

    if (allOk) {
      console.log(`  ✅ All static checks pass`);
      passed++;
    } else {
      console.log(`  ⚠  Some checks incomplete`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${safeTests.length + staticTests.length} tests`);
process.exit(failed > 0 ? 1 : 0);