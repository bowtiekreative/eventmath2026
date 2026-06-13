'use strict';
/**
 * EventMath natural-language expression compiler
 *
 * Converts arrays of EventMath words to JavaScript expression strings.
 * Preserves the Five Laws: operators are reserved words that split expressions;
 * everything else is either a name reference or a literal.
 *
 * Operator precedence (lowest first — lowest splits first):
 *   or  →  ||
 *   and →  &&
 *   is not / is not void → !==
 *   is / is void → ===
 *   more than, less than, at least, at most → >, <, >=, <=
 *   plus, minus → +, -
 *   times, divided by → *, /
 *   not (prefix) → !
 */

const OPS = [
  { words: ['or'],           js: '||',  prec: 1 },
  { words: ['and'],          js: '&&',  prec: 2 },
  { words: ['is', 'not'],    js: '!==', prec: 3 },
  { words: ['is'],           js: '===', prec: 3 },
  { words: ['more', 'than'], js: '>',   prec: 4 },
  { words: ['less', 'than'], js: '<',   prec: 4 },
  { words: ['at', 'least'],  js: '>=',  prec: 4 },
  { words: ['at', 'most'],   js: '<=',  prec: 4 },
  { words: ['plus'],         js: '+',   prec: 5 },
  { words: ['minus'],        js: '-',   prec: 5 },
  { words: ['times'],        js: '*',   prec: 6 },
  { words: ['divided', 'by'],js: '/',   prec: 6 },
];

function safeName(str) {
  if (!str) return 'null';
  return str.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_$]/g, '_');
}

function isNumber(s) { return /^-?\d+(\.\d+)?$/.test(s); }
function isQuoted(s) { return (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")); }

function toAtom(str, signals) {
  if (!str) return 'null';
  const s = str.trim();
  if (s === 'void')  return 'null';
  if (s === 'true')  return 'true';
  if (s === 'false') return 'false';
  if (isNumber(s))   return s;
  if (isQuoted(s))   return s;
  const name = safeName(s);
  if (signals && signals.has(name)) return `${name}.get()`;
  return name;
}

// Return the index of the lowest-precedence operator found in words.
// Searches right-to-left within each precedence level to produce
// left-to-right evaluation (left-associativity).
function findSplit(words) {
  let best = null;
  for (let i = 0; i < words.length; i++) {
    for (const op of OPS) {
      const len = op.words.length;
      if (i + len > words.length) continue;
      let match = true;
      for (let j = 0; j < len; j++) {
        if (words[i + j].toLowerCase() !== op.words[j]) { match = false; break; }
      }
      if (!match) continue;
      // Keep the lowest-precedence (outermost) operator.
      // Among same-precedence operators at different positions, keep the
      // rightmost (left-associativity). At the same position, prefer the
      // longer (more specific) match — "is not" beats "is".
      const beats = !best
        || op.prec < best.op.prec
        || (op.prec === best.op.prec && i > best.pos)
        || (op.prec === best.op.prec && i === best.pos && len > best.len);
      if (beats) {
        best = { op, pos: i, len };
      }
    }
  }
  return best;
}

// Check whether a word array contains any known operator.
function hasOperator(words) {
  for (let i = 0; i < words.length; i++) {
    for (const op of OPS) {
      if (i + op.words.length > words.length) continue;
      let match = true;
      for (let j = 0; j < op.words.length; j++) {
        if (words[i + j].toLowerCase() !== op.words[j]) { match = false; break; }
      }
      if (match) return true;
    }
  }
  return false;
}

/**
 * Compile a word array as an expression.
 * Always interprets names as variable references.
 */
function compileExpr(words, signals) {
  if (!words || !words.length) return 'null';

  // Leading 'not' → prefix negation
  if (words[0].toLowerCase() === 'not') {
    return `!(${compileExpr(words.slice(1), signals)})`;
  }

  const split = findSplit(words);
  if (!split) {
    // Leaf — convert to atom
    return toAtom(words.join(' '), signals);
  }

  const leftWords  = words.slice(0, split.pos);
  const rightWords = words.slice(split.pos + split.len);
  const jsOp       = split.op.js;

  // Special-case: `is void` and `is not void` → null checks
  if (jsOp === '===' && rightWords.join(' ').toLowerCase() === 'void') {
    const l = leftWords.length ? compileExpr(leftWords, signals) : 'null';
    return `(${l} === null || ${l} === undefined)`;
  }
  if (jsOp === '!==' && rightWords.join(' ').toLowerCase() === 'void') {
    const l = leftWords.length ? compileExpr(leftWords, signals) : 'null';
    return `(${l} !== null && ${l} !== undefined)`;
  }

  const left  = leftWords.length  ? compileExpr(leftWords, signals)  : 'null';
  const right = rightWords.length ? compileExpr(rightWords, signals) : 'null';

  return `(${left} ${jsOp} ${right})`;
}

/**
 * Smart value: for use in rain/star assignments.
 * - void            → null
 * - true/false      → boolean
 * - number          → number
 * - quoted string   → as-is
 * - words with ops  → compile as expression
 * - bare words      → string literal (Five Laws: bare words are literal)
 */
function smartValue(words) {
  if (!words || !words.length) return 'null';
  const s = words.join(' ').trim();
  if (s === 'void')   return 'null';
  if (s === 'true')   return 'true';
  if (s === 'false')  return 'false';
  if (isNumber(s))    return s;
  if (isQuoted(s))    return s;
  if (hasOperator(words)) return compileExpr(words);
  // Bare words → string literal
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

module.exports = { compileExpr, smartValue, hasOperator, safeName };
