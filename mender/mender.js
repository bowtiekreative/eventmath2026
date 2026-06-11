/**
 * The Mender — EventMath debugging engine (v0.8)
 *
 * Built-in conversational debugger. Finds and fixes broken events
 * using plain, friendly language, one step at a time.
 *
 * v0.8 adds:
 *  - All phases as class methods (Phase 1–5 + feedback gate)
 *  - Validator error integration (SEEN evidence)
 *  - Source context display (±2 lines)
 *  - Phase 3: structured evidence gathering (SEEN / TOLD / GUESSED)
 *  - Phase 4: hypothesis ranking by confidence
 *  - Phase 5: ranked fix presentation using evidence labels
 *  - .mender-memory.json persistence for learned fix patterns
 *  - Full phase loop with feedback gate
 *
 * Standing rules (per spec):
 * 1. Walk phases in order. Never skip (except via Fast Path).
 * 2. Give the user ONE action at a time.
 * 3. Never reveal internal mechanics (phases, hypotheses, scoring).
 * 4. Label evidence: SEEN (timeline), TOLD (user), GUESSED (inferred).
 * 5. When in doubt, ask.
 * 6. Use EventMath vocabulary only (doors, matter, events).
 */

'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser } = require('../src/parser.js');
const { EventMathFormatter } = require('../src/formatter.js');
const { EventMathValidator } = require('../src/validator.js');
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
    matcher: /After "(\w+)" I expected "is" \(literal\) or "from"/,
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
  {
    matcher: /I don't know the word "(\w+)"/,
    classify: 'E002',
    template: 'Unknown word "{word}".',
    fix: function(matches) {
      return `"${matches[1]}" is not part of EventMath's vocabulary. Did you mean to use a different keyword? Check the spelling.`;
    },
  },
  {
    matcher: /I was expecting the beginning of a matter block/,
    classify: 'E007',
    template: 'Missing "matter" keyword.',
    fix: 'Add "matter" before the field lines, then "end" after them:\n  matter\n    title is Some value\n  end',
  },
  {
    matcher: /I found "(\w+)" after "again"/,
    classify: 'E009',
    template: 'Loop problem after "again".',
    fix: 'Use "again N times" for a fixed count, or "again until condition" for a conditional loop.\n  again 5 times\n  again until all done is true',
  },
  {
    matcher: /I found "(\w+)" after "walk"/,
    classify: 'E010',
    template: 'Walk problem after "walk".',
    fix: 'Write "walk layer_name as variable_name".\n  walk myLayer as item',
  },
  {
    matcher: /I found "(\w+)" after "split"/,
    classify: 'E011',
    template: 'Split problem.',
    fix: 'Use "split value into path name ... end path name ... end end". Each path is a block closed with "end".',
  },
  {
    matcher: /closed its door but never opened it/,
    classify: 'E012',
    template: 'Door closed without being opened.',
    fix: 'A door can only close if it was opened first. Either add "door open" with the inputs, or remove "door closed".',
  },
  {
    matcher: /opened its door but never closed it/,
    classify: 'E013',
    template: 'Action never closes its door.',
    fix: 'A warning — the action might still do useful work, but nothing returns. Add "door closed event_name" to return matter through the door.',
  },
  {
    matcher: /Blocked door in (\w+)/,
    classify: 'E014',
    template: 'Blocked door — missing input.',
    fix: function(matches) {
      return `The door in "${matches[1]}" asked for inputs but nothing entered. Check the "door open" line and provide every input when calling the action.`;
    },
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
      evidence: [],      // { text, class: 'SEEN'|'TOLD'|'GUESSED', confidence: number }
      candidateFixes: [],
      lastRootCause: null,
      userId: null,
      program: null,
      errors: [],
    };
    this._memory = null;       // loaded from .mender-memory.json
    this._memoryPath = null;   // path to .mender-memory.json for the current file
  }

  /**
   * Start a Mender session for an EventMath program.
   * @param {string} filePath - Path to .em file
   */
  async diagnose(filePath) {
    console.log('\nThe Mender — EventMath Debugger');
    console.log('━'.repeat(50));

    // Load memory from project directory
    this._memoryPath = path.join(path.dirname(filePath), '.mender-memory.json');
    this._memory = this._loadMemory();

    // Read and parse the program
    const source = fs.readFileSync(filePath, 'utf-8');
    this.session.program = path.basename(filePath);

    const tokenizer = new EventMathTokenizer();
    const tokens = tokenizer.tokenize(source);
    const parser = new EventMathParser(tokens);
    const ast = parser.parse();

    // Collect parse errors
    const parseErrors = (ast.errors || []).map(e => {
      const msg = typeof e === 'string' ? e : (e.message || String(e));
      return { message: msg, source: 'parse' };
    });

    // Run validator and collect semantic errors (classified as SEEN)
    const validator = new EventMathValidator();
    const validation = validator.validate(ast);
    const validatorErrors = (validation.errors || []).map(e => {
      const msg = typeof e === 'string' ? e : (e.message || String(e));
      return { message: msg, source: 'validator' };
    });

    // Combine all errors
    this.session.errors = [...parseErrors, ...validatorErrors];

    if (this.session.errors.length === 0) {
      // No errors found — start runtime behavior debugging
      console.log(`\n"${this.session.program}" compiles cleanly — no broken events found.`);
      console.log('Tell me what you expected to happen and what you see instead, and I\'ll help you trace it.');
      await this._phase3([], source);
      this._getRL().close();
      return;
    }

    // Try fast path first
    const errorMessages = this.session.errors.map(e => e.message);
    const fastPathHandled = await this._fastPath(errorMessages, source);

    if (!fastPathHandled) {
      // Full diagnostic loop
      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 3;

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        if (loopCount > 1) {
          console.log('\nLet me look at this differently.');
        }

        // Phase 1: context gathering
        const context = await this._phase1();

        // Phase 3: structured evidence gathering
        await this._phase3(this.session.errors, source);

        // Phase 4: hypothesis ranking
        await this._phase4(context);

        // Phase 5: ranked fix presentation
        const feedback = await this._phase5();

        if (feedback === 'yes') {
          continueLoop = false;
          // Save successful pattern to memory
          const firstError = this.session.errors[0];
          if (firstError && this.session.candidateFixes.length > 0) {
            const topFix = this.session.candidateFixes[0];
            this._saveToMemory(firstError.message, topFix.action);
          }
        } else if (feedback === 'partially') {
          console.log('\nThat\'s progress. Let me look at what\'s still not working.');
          // Clear old evidence, keep going
          this.session.evidence = [];
          this.session.candidateFixes = [];
        } else {
          // 'no' — loop back
          this.session.evidence = [];
          this.session.candidateFixes = [];
        }
      }
    }

    this._getRL().close();
  }

  // ── Phase 1: Context gathering ──────────────────────────────────

  async _phase1() {
    console.log('\n── Understanding your program ──\n');
    console.log('Let me ask you a couple of questions to understand what\'s happening.\n');

    const purpose = await this._ask('What should this part of your program do when it works?');
    const recent = await this._ask('Did you change anything recently? (or type "no" if not)');

    return { purpose, recent };
  }

  // ── Phase 3: Structured evidence gathering ──────────────────────

  /**
   * Walk through each error and collect SEEN / TOLD / GUESSED evidence.
   * @param {Array} errors - array of { message, source } objects (may be empty for runtime debugging)
   * @param {string} source - raw source text
   */
  async _phase3(errors, source) {
    console.log('\n── Looking at what we know ──\n');

    if (errors.length === 0) {
      // Runtime behavior debugging — no compiler errors
      const seen = await this._ask('What do you see happening when you run this?');
      this.session.evidence.push({ text: seen, class: 'SEEN', confidence: 0.9 });

      const guessed = await this._ask('What do you think might have caused this?');
      this.session.evidence.push({ text: guessed, class: 'GUESSED', confidence: 0.5 });
      return;
    }

    for (const err of errors) {
      const msg = err.message;
      console.log(`\nI can see this: ${msg}`);

      // Extract and show source context if a line number is in the message
      const lineNum = this._extractLineNumber(msg);
      if (lineNum && source) {
        this._showSourceContext(source, lineNum);
      }

      // TOLD: auto-add compiler error as TOLD evidence
      this.session.evidence.push({
        text: msg,
        class: 'TOLD',
        confidence: 0.8,
      });

      // SEEN: what the user observes when running
      const seen = await this._ask('What do you see happening when you run this?');
      this.session.evidence.push({ text: seen, class: 'SEEN', confidence: 0.9 });

      // GUESSED: user's theory about the cause
      const guessed = await this._ask('What do you think might have caused this?');
      this.session.evidence.push({ text: guessed, class: 'GUESSED', confidence: 0.5 });
    }
  }

  // ── Phase 4: Hypothesis ranking ─────────────────────────────────

  /**
   * Build and rank candidateFixes from evidence sources.
   * @param {Object} context - { purpose, recent } from Phase 1
   */
  async _phase4(context) {
    const candidates = [];
    const firstError = this.session.errors[0];
    const errorMsg = firstError ? firstError.message : '';

    // 1. Check memory patterns (confidence 1.0)
    if (this._memory && this._memory.patterns) {
      for (const pattern of this._memory.patterns) {
        if (errorMsg.includes(pattern.errorPattern) || pattern.errorPattern.includes(errorMsg.slice(0, 20))) {
          candidates.push({
            action: pattern.fix,
            confidence: 1.0,
            evidenceClass: 'SEEN',
            source: 'memory',
          });
        }
      }
    }

    // 2. Check fast-path table (confidence 0.95 if matched)
    for (const entry of FAST_PATH_TABLE) {
      const m = errorMsg.match(entry.matcher);
      if (m) {
        const fix = typeof entry.fix === 'function' ? entry.fix.call(entry, m) : entry.fix;
        candidates.push({
          action: fix,
          confidence: 0.95,
          evidenceClass: 'TOLD',
          source: 'catalog',
        });
      }
    }

    // 3. Use GUESSED evidence from user
    const guessedEvidence = this.session.evidence.filter(e => e.class === 'GUESSED');
    for (const g of guessedEvidence) {
      if (g.text && g.text.toLowerCase() !== 'skip' && g.text.length > 2) {
        candidates.push({
          action: `Based on what you described — "${g.text}" — check that part of your program carefully.`,
          confidence: 0.5,
          evidenceClass: 'GUESSED',
          source: 'user',
        });
      }
    }

    // 4. Generic fallback
    if (candidates.length === 0 || candidates.every(c => c.confidence < 0.5)) {
      candidates.push({
        action: 'Check the surrounding lines carefully. Sometimes the real problem is one line above or below where the message points.',
        confidence: 0.3,
        evidenceClass: 'SEEN',
        source: 'fallback',
      });
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);
    this.session.candidateFixes = candidates;
  }

  // ── Phase 5: Ranked fix presentation ────────────────────────────

  /**
   * Present the top candidate fix and collect feedback.
   * @returns {string} 'yes' | 'no' | 'partially'
   */
  async _phase5() {
    console.log('\n── Here is what to try ──\n');

    const top = this.session.candidateFixes[0];

    if (top) {
      console.log(`Try this: ${top.action}`);
      console.log('');
      console.log(`I can ${top.evidenceClass === 'SEEN' ? 'SEE' : top.evidenceClass === 'TOLD' ? 'see this was TOLD to me by the compiler' : 'GUESS'} this from the evidence.`);
    } else {
      const firstError = this.session.errors[0];
      if (firstError) {
        console.log(`Try this: Read the message carefully — "${firstError.message}"`);
        console.log('\nIt describes exactly what EventMath expected to find.');
      }
    }

    console.log('\nWhen you have tried this, tell me what happened and I will help you from there.');

    return await this._feedbackGate();
  }

  // ── Feedback gate ───────────────────────────────────────────────

  async _feedbackGate() {
    const answer = await this._ask('Did that fix it? (yes / no / partially)');

    if (answer === 'yes') {
      console.log('\nGreat, glad that worked! Is there anything else that looks off?');
    } else if (answer === 'partially') {
      console.log('\nThat\'s progress. A partial fix often means there are two issues. Let me look at this differently.');
    } else {
      console.log('\nThat didn\'t work, which actually tells us something useful. Let me look at this differently.');
    }

    return answer;
  }

  // ── Source context display ──────────────────────────────────────

  /**
   * Show ±2 lines of source around a given line number.
   * @param {string} source - full source text
   * @param {number} lineNum - 1-based line number
   */
  _showSourceContext(source, lineNum) {
    const lines = source.split('\n');
    const start = Math.max(0, lineNum - 3);  // lineNum is 1-based, array is 0-based, ±2 means start at lineNum-3
    const end = Math.min(lines.length - 1, lineNum + 1);  // lineNum-1+2 = lineNum+1

    console.log('');
    for (let i = start; i <= end; i++) {
      const displayLineNum = i + 1;  // back to 1-based for display
      const marker = displayLineNum === lineNum ? '>>>' : '   ';
      console.log(`  ${marker} Line ${String(displayLineNum).padStart(3)}: ${lines[i]}`);
    }

    // Show caret under the error line
    const errorLine = lines[lineNum - 1] || '';
    const caretPad = '             ';  // align under the content
    console.log(`  ${caretPad}${'^^^'.padStart(Math.min(errorLine.length + 1, 10))}`);
    console.log('');
  }

  /**
   * Extract a line number from an error message.
   * Looks for patterns like "line 3", "Line 3", "[line 3]".
   * @param {string} msg
   * @returns {number|null}
   */
  _extractLineNumber(msg) {
    const m = msg.match(/\[?[Ll]ine\s+(\d+)\]?/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  // ── Memory: .mender-memory.json ─────────────────────────────────

  /**
   * Load .mender-memory.json from the project directory.
   * @returns {Object} memory object { patterns: [] }
   */
  _loadMemory() {
    if (!this._memoryPath) return { patterns: [] };
    try {
      if (fs.existsSync(this._memoryPath)) {
        const raw = fs.readFileSync(this._memoryPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      // Silently ignore corrupt memory files
    }
    return { patterns: [] };
  }

  /**
   * Save a successful error pattern + fix to .mender-memory.json.
   * Increments seenCount if the pattern already exists.
   * @param {string} errorMessage
   * @param {string} fix
   */
  _saveToMemory(errorMessage, fix) {
    if (!this._memoryPath) return;
    if (!this._memory) this._memory = { patterns: [] };
    if (!this._memory.patterns) this._memory.patterns = [];

    // Use first 40 chars as the error pattern key
    const errorPattern = errorMessage.slice(0, 40).trim();

    const existing = this._memory.patterns.find(p => p.errorPattern === errorPattern);
    if (existing) {
      existing.seenCount = (existing.seenCount || 1) + 1;
      existing.fix = fix;
    } else {
      this._memory.patterns.push({ errorPattern, fix, seenCount: 1 });
    }

    try {
      fs.writeFileSync(this._memoryPath, JSON.stringify(this._memory, null, 2), 'utf-8');
    } catch (e) {
      // Silently ignore write errors
    }
  }

  // ── Phase 0: Fast Path ──────────────────────────────────────────

  /**
   * Phase 0 — Fast Path.
   * Matches errors against the catalog; if match found,
   * skip directly to recommending the fix.
   * Returns true if fast path handled at least one error.
   * @param {string[]} errors - array of error message strings
   * @param {string} source - raw source text
   */
  async _fastPath(errors, source) {
    console.log(`\nFound ${errors.length} issue${errors.length > 1 ? 's' : ''}:`);

    let anyMatched = false;
    for (const msg of errors) {
      console.log(`\n  ${msg}`);

      // Show source context if line number present
      const lineNum = this._extractLineNumber(msg);
      if (lineNum && source) {
        this._showSourceContext(source, lineNum);
      }

      // Try to match against fast-path table
      let matched = false;
      for (const entry of FAST_PATH_TABLE) {
        const m = msg.match(entry.matcher);
        if (m) {
          matched = true;
          anyMatched = true;
          console.log('\nI think I know this one.');

          const fix = typeof entry.fix === 'function' ? entry.fix.call(entry, m) : entry.fix;
          console.log(`\n  Try this: ${fix}`);
          console.log('\n  When you have tried this, tell me what happened and I will help you from there.');

          const feedback = await this._feedbackGate();

          if (feedback === 'yes') {
            // Save to memory
            this._saveToMemory(msg, fix);
          }
          break;
        }
      }

      if (!matched) {
        console.log('\n  I don\'t have a quick fix for this one yet.');
        console.log('  Can you tell me more about what you were trying to do?');
      }
    }

    return anyMatched;
  }

  // ── Utilities ───────────────────────────────────────────────────

  _getRL() {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }

  /**
   * Ask the user a question (CLI prompt).
   */
  _ask(question) {
    const rl = this._getRL();
    return new Promise((resolve) => {
      rl.question(`\n  ${question}\n  > `, (answer) => {
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
