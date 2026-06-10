/**
 * The Mender — EventMath debugging engine (v0.1 Fast Path)
 *
 * Built-in conversational debugger. Finds and fixes broken events
 * using plain, friendly language, one step at a time.
 *
 * v0.1 ships the Fast Path (Phase 0): when an error matches a known
 * pattern in the friendly-error catalog, recommend the fix directly.
 *
 * Standing rules (per spec):
 * 1. Walk phases in order. Never skip (except via Fast Path).
 * 2. Give the user ONE action at a time.
 * 3. Never reveal internal mechanics (phases, hypotheses, scoring).
 * 4. Label evidence: SEEN (timeline), TOLD (user), GUESSED (inferred).
 * 5. When in doubt, ask.
 * 6. Use EventMath vocabulary only (doors, matter, events).
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathFormatter } = require('../src/formatter.js');
const EM = require('../runtime/eventmath-runtime.js');

// ── Error catalog (embedded fast-path table) ──────────────────────

const FAST_PATH_TABLE = [
  {
    matcher: /I was looking for the name of a (\w+)/,
    classify: 'E001',
    template: 'Missing name for {block}.',
    fix: function(matches) {
      const block = matches[1];
      return `Add a name right after "${block}". Every ${block} needs a name. For example:\n  ${block} my ${block} name`;
    },
  },
  {
    matcher: /I don't know the word "(\w+)"/,
    classify: 'E002',
    template: 'Unknown word "{word}".',
    suggestions: {
      'variable': 'mark — marks are how EventMath remembers matter',
      'var': 'mark — marks are how EventMath remembers matter',
      'let': 'mark — marks are how EventMath remembers matter',
      'const': 'mark — marks are how EventMath remembers matter',
      'function': 'action — actions are reusable processes with a door',
      'fun': 'action — actions are reusable processes with a door',
      'method': 'action — actions are reusable processes with a door',
      'if': 'when — EventMath conditionals read as English',
      'else if': 'otherwise',
      'for': 'walk — walk a layer, one event at a time',
      'foreach': 'walk — walk a layer, one event at a time',
      'each': 'walk — walk a layer, one event at a time',
      'while': 'again until — repeat until a condition is met',
      'return': 'door closed — matter leaves when the door closes',
      'class': 'event — a named thing that happened, carrying matter',
      'object': 'event — a named thing that happened, carrying matter',
      'array': 'layer — an ordered container of events',
      'list': 'layer — an ordered container of events',
      'null': 'EventMath does not use null. If matter is missing, the door was blocked.',
      'undefined': 'EventMath does not use undefined.',
    },
    fix: function(matches) {
      const word = matches[1];
      const sug = this.suggestions[word.toLowerCase()];
      if (sug) return `Did you mean ${sug}?`;
      return `"${word}" is not part of EventMath. Check the spelling.`;
    },
  },
  {
    matcher: /I was expecting "end" but found "(\w+)"/,
    classify: 'E003',
    template: 'Missing "end" — found "{found}".',
    fix: function(matches) {
      return `Every block in EventMath must close with "end". Add one before "${matches[1]}". Count your open blocks and make sure each has a matching close.`;
    },
  },
  {
    matcher: /Door problem in (\w+)/,
    classify: 'E004',
    template: 'Door problem in action.',
    fix: function(matches) {
      return `The action "${matches[1]}" has a door that expects certain inputs. Check the "door open" line in the action definition and provide all inputs when calling it.`;
    },
  },
  {
    matcher: /After "(\w+)" I was expecting "is" or "from"/,
    classify: 'E005',
    template: 'Matter line problem: "{key}" needs "is" or "from".',
    fix: function(matches) {
      const key = matches[1];
      return `After "${key}" add "is" followed by its value (literal), or "from" followed by a reference.\n  ${key} is Your value here\n  ${key} from some_mark`;
    },
  },
  {
    matcher: /I was expecting (end) but the program ended/,
    classify: 'E006',
    template: 'Unclosed block at end of program.',
    fix: 'Add the missing "end" keyword. Count how many blocks you opened (events, layers, actions, etc.) and make sure each has a closing "end".',
  },
  {
    matcher: /I was trying to read a condition/,
    classify: 'E008',
    template: 'Condition problem — needs "is" between name and value.',
    fix: 'Conditions need "is" between the name and its value. Write:\n  when name is value\nFor negation:\n  when name is not value',
  },
  {
    matcher: /"(\w+)" is reserved/,
    classify: 'E015',
    template: 'Reserved word "{word}" used as a name.',
    fix: function(matches) {
      return `"${matches[1]}" is reserved and cannot be used as a name. Choose a different name. Reserved words include: event, matter, category, layer, timeline, action, door, mark, set, run, when, split, again, walk, end, is, from.`;
    },
  },
  {
    matcher: /Timeline sections use "past", "present", and "future"/,
    classify: 'E016',
    template: 'Unknown timeline section.',
    fix: 'Timeline sections must be named "past", "present", or "future". Each section is closed with "end".',
  },
];

// ── Mender ────────────────────────────────────────────────────────

class Mender {
  constructor() {
    this.rl = null;
    this.session = {
      phase: 0,
      passCount: 0,
      triedFixes: [],
      evidence: [],      // { text, class: 'SEEN'|'TOLD'|'GUESSED' }
      candidateFixes: [],
      lastRootCause: null,
      userId: null,
      program: null,
      errors: [],
    };
  }

  /**
   * Start a Mender session for an EventMath program.
   * @param {string} filePath - Path to .em file
   */
  async diagnose(filePath) {
    console.log('\n🔧  The Mender — EventMath Debugger');
    console.log('━'.repeat(50));

    // Read and parse the program
    const source = fs.readFileSync(filePath, 'utf-8');
    this.session.program = path.basename(filePath);

    const tokenizer = new EventMathTokenizer();
    const tokens = tokenizer.tokenize(source);
    const parser = new EventMathParser(tokens);
    const ast = parser.parse();

    if (ast.errors && ast.errors.length > 0) {
      this.session.errors = ast.errors;
      await this._fastPath(ast.errors);
    } else {
      console.log(`\n✅ "${this.session.program}" compiles without errors.`);
      console.log(`Tell me what's not working and I'll help you find it.`);
      // TODO: Phase 1+ in v0.2
      console.log('\n(Full conversational debugging coming in v0.2)');
    }
  }

  /**
   * Phase 0 — Fast Path.
   * Matches errors against the catalog; if match is > 85% confident,
   * skip directly to recommending the fix.
   */
  async _fastPath(errors) {
    console.log(`\nFound ${errors.length} issue${errors.length > 1 ? 's' : ''}:`);

    for (const err of errors) {
      const msg = typeof err === 'string' ? err : (err.message || '');
      console.log(`\n  ${msg}`);

      // Try to match against fast-path table
      let matched = false;
      for (const entry of FAST_PATH_TABLE) {
        const m = msg.match(entry.matcher);
        if (m) {
          matched = true;
          console.log('\n🔧  I think I know this one.');

          // Phase 5: Recommend exactly one fix
          const fix = typeof entry.fix === 'function' ? entry.fix.call(entry, m) : entry.fix;
          console.log(`\n  Try this: ${fix}`);
          console.log('\n  When you have tried this, tell me what happened and I will help you from there.');

          // Phase 6 — Feedback gate
          await this._feedbackGate();
          break;
        }
      }

      if (!matched) {
        console.log('\n  I don\'t have a quick fix for this one yet.');
        console.log('  Can you tell me more about what you were trying to do?');
        // TODO: Fall through to Phase 1+ in v0.2
      }
    }
  }

  /**
   * Phase 6 — Feedback gate.
   */
  async _feedbackGate() {
    const answer = await this._ask('Did that fix it? (yes / no / partially)');

    if (answer === 'yes') {
      console.log('\n✅ Great, glad that worked! Is there anything else that looks off?');
    } else if (answer === 'partially') {
      console.log('\nThat\'s progress. A partial fix often means there are two issues. Let me look at this differently.');
    } else {
      console.log('\nThat didn\'t work, which actually tells us something useful. Let me look at this differently.');
    }
  }

  /**
   * Ask the user a question (CLI prompt).
   */
  _ask(question) {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return new Promise((resolve) => {
      this.rl.question(`\n❓ ${question}\n> `, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  }

  close() {
    if (this.rl) this.rl.close();
  }
}

// ── CLI ───────────────────────────────────────────────────────────

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node mender.js <path/to/file.em>');
    console.log('\nThe Mender helps you find and fix issues in EventMath programs.\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    process.exit(1);
  }

  const mender = new Mender();
  mender.diagnose(filePath).then(() => {
    mender.close();
  }).catch((err) => {
    console.error('Mender error:', err.message);
    mender.close();
  });
}

module.exports = { Mender, FAST_PATH_TABLE };