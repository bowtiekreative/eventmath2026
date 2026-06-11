/**
 * EventMath Tokenizer v0.4
 *
 * Line-oriented tokenizer. One idea per line.
 * The FIRST token on each line determines the statement type.
 * Multi-word names are allowed; keywords are reserved.
 *
 * Law 1 — Bare words are literal. References are marked.
 *   "title is User can log in"  → literal text after "is"
 *   "priority from priority"    → reference after "from"
 *
 * Law 4 — Blocks end with `end`. Indentation is cosmetic.
 * Law 5 — No silent autocorrect. Friendly precision instead.
 *
 * v0.4 additions:
 *  - _tokenizeValue() helper for arithmetic in set/mark
 *  - _brokenEvent() for broken event statement
 *  - 'broken' added to KEYWORDS
 */

const KEYWORDS = new Set([
  'event', 'matter', 'category', 'cat', 'layer', 'timeline', 'action',
  'door', 'open', 'closed', 'mark', 'set', 'run', 'when', 'otherwise',
  'split', 'path', 'again', 'walk', 'end', 'is', 'from', 'as', 'to',
  'by', 'with', 'into', 'times', 'past', 'present', 'future', 'stop',
  'merge', 'break', 'add', 'remove', 'before', 'after', 'rewind', 'forward',
  'and', 'not', 'until', 'overlap', 'note', 'broken', 'check', 'use',
  'sort', 'filter', 'find', 'count', 'where', 'descending',
  'predict', 'across', 'resolve',
  'zoom', 'show', 'pulse', 'tick', 'rate', 'amplitude', 'frequency',
]);

// Reserved words that cannot be used as declaration names (per spec E015)
const RESERVED_WORDS = new Set([
  'event', 'matter', 'category', 'cat', 'layer', 'timeline', 'action',
  'door', 'open', 'closed', 'mark', 'set', 'run', 'when', 'otherwise',
  'split', 'path', 'again', 'walk', 'end', 'is', 'from', 'as', 'to',
  'by', 'with', 'into', 'times', 'past', 'present', 'future', 'stop',
  'merge', 'break', 'add', 'remove', 'before', 'after', 'rewind', 'forward',
  'and', 'not', 'until', 'overlap', 'note', 'broken', 'check', 'use',
  'sort', 'filter', 'find', 'count', 'where', 'descending',
  'predict', 'across', 'resolve',
  'zoom', 'show', 'pulse', 'tick', 'rate', 'amplitude', 'frequency',
]);

class Token {
  constructor(type, value, line) {
    this.type = type;   // KEYWORD, NAME, NUMBER, BOOL, LITERAL
    this.value = value;
    this.line = line;
  }
}

/**
 * Line-oriented EventMath tokenizer.
 *
 * Strategy: For each line, figure out what kind of statement it is from
 * the leading word. Then tokenize the rest of the line appropriately.
 * Multi-word names and literals are handled per-statement-type.
 */
class EventMathTokenizer {
  tokenize(source) {
    const tokens = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = this._stripComment(lines[i]).trim();
      if (!line) continue;

      const lineTokens = this._tokenizeLine(line, i + 1);
      tokens.push(...lineTokens);
    }

    return tokens;
  }

  _stripComment(raw) {
    // Find '# ' that's preceded by space or at start
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '#' && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) {
        return raw.substring(0, i);
      }
    }
    return raw;
  }

  _tokenizeLine(line, lineNum) {
    const parts = line.split(/(\s+)/);
    const words = parts.filter((p, idx) => idx % 2 === 0 && p !== '');

    if (words.length === 0) return [];

    const lead = words[0].toLowerCase();

    // ── Dispatch by leading keyword ──────────────────────────

    // event, action, layer, timeline, path  →  consume NAME after
    if (KEYWORDS.has(lead) && ['event', 'action', 'layer', 'timeline', 'path'].includes(lead)) {
      return this._keywordName(lead, words.slice(1), lineNum);
    }

    // category, cat → consume category name
    // But if the next word is "is" or "from", this is a matter field key, not a declaration
    if (lead === 'category' || lead === 'cat') {
      if (words.length >= 2 && (words[1] === 'is' || words[1] === 'from')) {
        // Fall through to matter line / matter ref line handling below
      } else {
        return this._keywordName(lead, words.slice(1), lineNum);
      }
    }

    // use → use <name> from <file>
    if (lead === 'use') {
      return this._use(words, lineNum);
    }

    // broken event → broken event <name>
    if (lead === 'broken') {
      return this._brokenEvent(words, lineNum);
    }

    // check → check <condition>
    if (lead === 'check') {
      return this._check(words, lineNum);
    }

    // pulse → pulse <name>
    if (lead === 'pulse') {
      return this._pulse(words, lineNum);
    }

    // mark → mark <name> as <literal>
    if (lead === 'mark') {
      return this._mark(words, lineNum);
    }

    // set → set <name> to <value>
    if (lead === 'set') {
      return this._set(words, lineNum);
    }

    // run → run <target>
    if (lead === 'run') {
      return this._run(words, lineNum);
    }

    // show → show <markname>
    if (lead === 'show') {
      return this._show(words, lineNum);
    }

    // when → when <condition>
    if (lead === 'when') {
      return this._when(words, lineNum);
    }

    // again → again N times | again until <condition>
    if (lead === 'again') {
      return this._again(words, lineNum);
    }

    // walk → walk <layer> as <var>
    if (lead === 'walk') {
      return this._walk(words, lineNum);
    }

    // split → split <name> into
    if (lead === 'split') {
      return this._split(words, lineNum);
    }

    // door → door open|closed [name ...]
    if (lead === 'door') {
      return this._door(words, lineNum);
    }

    // rewind, forward
    if (lead === 'rewind' || lead === 'forward') {
      return this._timeTravel(lead, words, lineNum);
    }

    // add, remove, merge
    if (lead === 'add') {
      return this._add(words, lineNum);
    }
    if (lead === 'remove') {
      return this._remove(words, lineNum);
    }
    if (lead === 'merge') {
      return this._merge(words, lineNum);
    }

    // sort → sort layer <name> by matter <field> [descending]
    if (lead === 'sort') {
      return this._sortLayer(words, lineNum);
    }

    // filter → filter layer <name> where <condition> into <newname>
    if (lead === 'filter') {
      return this._filterLayer(words, lineNum);
    }

    // find → find in <name> where <condition> into <markname>
    if (lead === 'find') {
      return this._findInLayer(words, lineNum);
    }

    // count → count in <name> where <condition> into <markname>
    if (lead === 'count') {
      return this._countInLayer(words, lineNum);
    }

    // zoom → zoom in ... | zoom out ... | zoom opposite ... | zoom meta ...
    if (lead === 'zoom') {
      if (words[1] === 'in') return this._tokenizeZoomIn(words, lineNum);
      if (words[1] === 'out') return this._tokenizeZoomOut(words, lineNum);
      if (words[1] === 'opposite') return this._tokenizeZoomOpposite(words, lineNum);
      if (words[1] === 'meta') return this._tokenizeZoomMeta(words, lineNum);
      return [new Token('KEYWORD', 'zoom', lineNum)];
    }

    // predict → predict <subject> across <dir> and <lens> and <qty> into <out>
    if (lead === 'predict') {
      return this._tokenizePredictStmt(words, lineNum);
    }

    // resolve → resolve <layer> where <condition> as correct|incorrect
    if (lead === 'resolve') {
      return this._tokenizeResolveStmt(words, lineNum);
    }

    // across → continuation of predict statement (multi-line syntax)
    if (lead === 'across') {
      const tokens = [new Token('KEYWORD', 'across', lineNum)];
      if (words.length > 1) {
        tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
      }
      return tokens;
    }

    // into → continuation of predict statement (multi-line syntax)
    // Only emit as bare continuation if no other keyword context handles it
    if (lead === 'into') {
      const tokens = [new Token('KEYWORD', 'into', lineNum)];
      if (words.length > 1) {
        tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
      }
      return tokens;
    }

    // stop
    if (lead === 'stop') {
      return [new Token('KEYWORD', 'stop', lineNum)];
    }

    // otherwise, end, matter — bare keywords
    if (lead === 'otherwise') {
      return [new Token('KEYWORD', 'otherwise', lineNum)];
    }
    if (lead === 'matter') {
      return [new Token('KEYWORD', 'matter', lineNum)];
    }
    if (lead === 'past' || lead === 'present' || lead === 'future') {
      return [new Token('KEYWORD', lead, lineNum)];
    }
    if (lead === 'end') {
      return [new Token('KEYWORD', 'end', lineNum)];
    }

    // overlap — parallel track block
    if (lead === 'overlap') {
      return [new Token('KEYWORD', 'overlap', lineNum)];
    }

    // note — annotation
    if (lead === 'note') {
      return this._note(words, lineNum);
    }

    // and — track separator in overlap block, or layer name in predict multi-line
    if (lead === 'and') {
      const tokens = [new Token('KEYWORD', 'and', lineNum)];
      if (words.length > 1) {
        // Multi-line predict continuation: "and <layer name>"
        tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
      }
      return tokens;
    }

    // ── Action call: <name> with <key> is <value> and ... ────
    // Must check BEFORE matter lines since action calls also have "is"
    if (this._hasDelimiter(words, 'with')) {
      const withIdx = this._indexOf(words, 'with');
      const isIdx = this._indexOf(words, 'is');
      // Only treat as action call if "with" comes before "is"
      if (withIdx >= 0 && (isIdx < 0 || withIdx < isIdx)) {
        return this._actionCall(words, lineNum);
      }
    }

    // ── Core: matter lines (title is Some text) ──────────────
    if (this._hasDelimiter(words, 'is')) {
      return this._matterLine(words, lineNum);
    }

    // ── Core: matter reference lines (title from priority) ───
    if (this._hasDelimiter(words, 'from')) {
      return this._matterRefLine(words, lineNum);
    }

    // ── Action call: <name> with <key> is <value> and ... ────
    if (this._hasDelimiter(words, 'with')) {
      return this._actionCall(words, lineNum);
    }

    // ── Event/layer refs in a body: just a bare name ─────────
    // Could be multi-word, join them
    return [new Token('NAME', words.join(' '), lineNum)];
  }

  // ── Helpers ─────────────────────────────────────────────────

  _hasDelimiter(words, delim) {
    return words.includes(delim);
  }

  _indexOf(words, target) {
    for (let i = 0; i < words.length; i++) {
      if (words[i] === target) return i;
    }
    return -1;
  }

  _keywordName(keyword, rest, lineNum) {
    const tokens = [new Token('KEYWORD', keyword, lineNum)];
    if (rest.length > 0) {
      tokens.push(new Token('NAME', rest.join(' '), lineNum));
    }
    return tokens;
  }

  /**
   * Tokenize a value, detecting string operations first, then arithmetic.
   * String ops: 'joined with', 'in uppercase', 'in lowercase', 'length of'
   * Arithmetic: 'divided by' (2 words), 'plus', 'minus', 'times'
   * Supports chains: a plus b minus c → NAME KEYWORD NAME KEYWORD NAME
   * Otherwise: emit LITERAL/NUMBER/BOOL as appropriate.
   *
   * Note: 'plus', 'minus', 'times', 'divided' are NOT added to KEYWORDS —
   * they are only recognized here in value position.
   */
  _tokenizeValue(words, lineNum) {
    if (!words || words.length === 0) return [];

    // Check for string operations first (they don't mix with arithmetic)
    // 'joined with': NAME('left') KEYWORD('joined with') NAME('right')
    const joinedIdx = this._findPhrase(words, ['joined', 'with']);
    if (joinedIdx >= 0) {
      const left  = words.slice(0, joinedIdx).join(' ');
      const right = words.slice(joinedIdx + 2).join(' ');
      return [
        new Token('NAME', left, lineNum),
        new Token('KEYWORD', 'joined with', lineNum),
        new Token('NAME', right, lineNum),
      ];
    }

    // 'in uppercase' / 'in lowercase': NAME('subject') KEYWORD('in uppercase'|'in lowercase')
    const inIdx = this._indexOf(words, 'in');
    if (inIdx > 0 && words[inIdx + 1] === 'uppercase') {
      const subject = words.slice(0, inIdx).join(' ');
      return [new Token('NAME', subject, lineNum), new Token('KEYWORD', 'in uppercase', lineNum)];
    }
    if (inIdx > 0 && words[inIdx + 1] === 'lowercase') {
      const subject = words.slice(0, inIdx).join(' ');
      return [new Token('NAME', subject, lineNum), new Token('KEYWORD', 'in lowercase', lineNum)];
    }

    // 'length of': KEYWORD('length of') NAME('subject')
    if (words[0] === 'length' && words[1] === 'of') {
      const subject = words.slice(2).join(' ');
      return [new Token('KEYWORD', 'length of', lineNum), new Token('NAME', subject, lineNum)];
    }

    // ── Built-in operations (before arithmetic check) ────────────
    const builtinOp = this._findBuiltinOp(words);
    if (builtinOp) {
      return [new Token('BUILTIN', builtinOp, lineNum)];
    }

    const segments = [];
    const operators = [];
    let current = [];

    for (let i = 0; i < words.length; i++) {
      if (words[i] === 'divided' && i + 1 < words.length && words[i + 1] === 'by') {
        segments.push(current); operators.push('divided by'); current = []; i++;
      } else if (['plus', 'minus', 'times'].includes(words[i])) {
        segments.push(current); operators.push(words[i]); current = [];
      } else {
        current.push(words[i]);
      }
    }
    segments.push(current);

    if (operators.length === 0) {
      // single value — existing behavior
      const raw = segments[0].join(' ');
      if (!raw) return [];
      if (/^\d+(\.\d+)?$/.test(raw)) return [new Token('NUMBER', raw, lineNum)];
      if (raw === 'true' || raw === 'false') return [new Token('BOOL', raw, lineNum)];
      // Quoted string literal: "value" → LITERAL token with unquoted content
      if (/^"[^"]*"$/.test(raw)) return [new Token('LITERAL', raw.slice(1, -1), lineNum)];
      return [new Token('NAME', raw, lineNum)];
    }

    // chain: NAME/NUMBER KEYWORD(op) NAME/NUMBER KEYWORD(op) ...
    const tokens = [];
    for (let i = 0; i < segments.length; i++) {
      const raw = segments[i].join(' ');
      if (/^\d+(\.\d+)?$/.test(raw)) tokens.push(new Token('NUMBER', raw, lineNum));
      else tokens.push(new Token('NAME', raw, lineNum));
      if (i < operators.length) tokens.push(new Token('KEYWORD', operators[i], lineNum));
    }
    return tokens;
  }

  /**
   * Emit a single value token (NUMBER, BOOL, NAME, or LITERAL).
   */
  _tokenizeSingleValue(val, lineNum) {
    if (!val) return [];
    if (/^\d+(\.\d+)?$/.test(val)) {
      return [new Token('NUMBER', val, lineNum)];
    }
    if (val === 'true' || val === 'false') {
      return [new Token('BOOL', val, lineNum)];
    }
    // If it looks like a simple name reference (no spaces), use NAME
    // If it has spaces and isn't a number/bool, it's ambiguous — use NAME for references
    // The parser will handle the distinction
    return [new Token('NAME', val, lineNum)];
  }

  _mark(words, lineNum) {
    // mark <name> as <value>
    const tokens = [new Token('KEYWORD', 'mark', lineNum)];
    const asIdx = this._indexOf(words, 'as');
    if (asIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, asIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'as', lineNum));
      tokens.push(...this._tokenizeValue(words.slice(asIdx + 1), lineNum));
    }
    return tokens;
  }

  _set(words, lineNum) {
    // set <name> to <value>
    const tokens = [new Token('KEYWORD', 'set', lineNum)];
    const toIdx = this._indexOf(words, 'to');
    if (toIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, toIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'to', lineNum));
      tokens.push(...this._tokenizeValue(words.slice(toIdx + 1), lineNum));
    }
    return tokens;
  }

  _run(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'run', lineNum)];
    if (words.length > 1) {
      tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
    }
    return tokens;
  }

  _show(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'show', lineNum)];
    if (words.length > 1) {
      tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
    }
    return tokens;
  }

  _when(words, lineNum) {
    // when <condition> [and|or <condition> ...]
    const tokens = [new Token('KEYWORD', 'when', lineNum)];
    tokens.push(...this._tokenizeCondition(words.slice(1), lineNum));
    return tokens;
  }

  _again(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'again', lineNum)];
    const rest = words.slice(1);
    // again N times
    if (rest.length >= 2 && (rest[1] === 'times' || rest[1] === 'time')) {
      tokens.push(new Token('NUMBER', rest[0], lineNum));
      tokens.push(new Token('KEYWORD', 'times', lineNum));
    }
    // again until <condition> [and|or <condition> ...]
    else if (rest[0] === 'until') {
      tokens.push(new Token('KEYWORD', 'until', lineNum));
      tokens.push(...this._tokenizeCondition(rest.slice(1), lineNum));
    }
    return tokens;
  }

  _walk(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'walk', lineNum)];
    const asIdx = this._indexOf(words, 'as');
    if (asIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, asIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'as', lineNum));
      tokens.push(new Token('NAME', words.slice(asIdx + 1).join(' '), lineNum));
    }
    return tokens;
  }

  _split(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'split', lineNum)];
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, intoIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'into', lineNum));
    }
    return tokens;
  }

  _door(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'door', lineNum)];
    // door open|closed [name ...]
    if (words.length >= 2 && (words[1] === 'open' || words[1] === 'closed')) {
      tokens.push(new Token('KEYWORD', words[1], lineNum));
      if (words[1] === 'open') {
        // "door open title priority" — each is a separate input name
        for (let i = 2; i < words.length; i++) {
          tokens.push(new Token('NAME', words[i], lineNum));
        }
      } else {
        // "door closed made requirement" — one multi-word return name
        if (words.length > 2) {
          tokens.push(new Token('NAME', words.slice(2).join(' '), lineNum));
        }
      }
    }
    return tokens;
  }

  _timeTravel(cmd, words, lineNum) {
    const tokens = [new Token('KEYWORD', cmd, lineNum)];
    // rewind/forward <target> by <N>  or  rewind/forward <target> to <event>
    const byIdx = this._indexOf(words, 'by');
    const toIdx = this._indexOf(words, 'to');
    if (byIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, byIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'by', lineNum));
      tokens.push(new Token('NUMBER', words[byIdx + 1], lineNum));
    } else if (toIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, toIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'to', lineNum));
      tokens.push(new Token('NAME', words.slice(toIdx + 1).join(' '), lineNum));
    }
    return tokens;
  }

  _add(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'add', lineNum)];
    // add event <name> into <layer>  or  add layer <name>
    for (let i = 1; i < words.length; i++) {
      const w = words[i].toLowerCase();
      if (KEYWORDS.has(w)) {
        tokens.push(new Token('KEYWORD', w, lineNum));
      } else {
        tokens.push(new Token('NAME', w, lineNum));
      }
    }
    // Re-join multi-word names: collapse consecutive NAME tokens
    return this._collapseNames(tokens);
  }

  _remove(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'remove', lineNum)];
    for (let i = 1; i < words.length; i++) {
      const w = words[i].toLowerCase();
      if (KEYWORDS.has(w)) {
        tokens.push(new Token('KEYWORD', w, lineNum));
      } else {
        tokens.push(new Token('NAME', w, lineNum));
      }
    }
    return this._collapseNames(tokens);
  }

  _merge(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'merge', lineNum)];
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, intoIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'into', lineNum));
      tokens.push(new Token('NAME', words.slice(intoIdx + 1).join(' '), lineNum));
    }
    return tokens;
  }

  /**
   * Use statement: use <name> from <file>
   * words[0] = 'use', then name words, then 'from', then filename
   */
  _use(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'use', lineNum)];
    const fromIdx = this._indexOf(words, 'from');
    if (fromIdx > 1) {
      tokens.push(new Token('NAME', words.slice(1, fromIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'from', lineNum));
      // filename — join remaining words (handles paths with spaces, though not recommended)
      tokens.push(new Token('LITERAL', words.slice(fromIdx + 1).join(' '), lineNum));
    } else if (fromIdx === 1) {
      // "use from <file>" — malformed, but emit partial
      tokens.push(new Token('KEYWORD', 'from', lineNum));
      tokens.push(new Token('LITERAL', words.slice(fromIdx + 1).join(' '), lineNum));
    }
    return tokens;
  }

  /**
   * Broken event: broken event <name>
   */
  _brokenEvent(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'broken', lineNum)];
    if (words[1] === 'event') {
      tokens.push(new Token('KEYWORD', 'event', lineNum));
      if (words.length > 2) {
        tokens.push(new Token('NAME', words.slice(2).join(' '), lineNum));
      }
    }
    return tokens;
  }

  /**
   * Check assertion: check <name> is [op] <value> [and|or ...]
   * Same tokenization as a when condition.
   */
  _check(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'check', lineNum)];
    // words[0] = 'check', rest is the full condition
    tokens.push(...this._tokenizeCondition(words.slice(1), lineNum));
    return tokens;
  }

  /**
   * Pulse declaration: pulse <name> [every N tick]
   * Creates an oscillating control that toggles state each tick.
   * The pulse is a binary switch — nucleus appears, then disappears.
   */
  _pulse(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'pulse', lineNum)];
    // words[0] = 'pulse', rest is name
    const rest = words.slice(1);
    if (rest.length === 0) {
      tokens.push(new Token('NAME', '', lineNum));
      return tokens;
    }
    // pulse <name> [every N tick] — search for 'every' anywhere in rest
    const everyIdx = this._indexOf(rest, 'every');
    if (everyIdx > 0 && rest.length > everyIdx + 1) {
      tokens.push(new Token('NAME', rest.slice(0, everyIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'every', lineNum));
      tokens.push(new Token('NUMBER', rest[everyIdx + 1], lineNum));
      if (rest[everyIdx + 2] === 'tick' || rest[everyIdx + 2] === 'ticks') {
        tokens.push(new Token('KEYWORD', rest[everyIdx + 2], lineNum));
      }
    } else {
      // pulse <name>
      tokens.push(new Token('NAME', rest.join(' '), lineNum));
    }
    return tokens;
  }

  /**
   * Matter lines: <key> is <value>
   * Everything after "is" is a LITERAL (Law 1)
   */
  _matterLine(words, lineNum) {
    const tokens = [];
    const isIdx = this._indexOf(words, 'is');
    tokens.push(new Token('NAME', words.slice(0, isIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'is', lineNum));
    tokens.push(new Token('LITERAL', words.slice(isIdx + 1).join(' '), lineNum));
    return tokens;
  }

  /**
   * Matter reference lines: <key> from <name>
   * Everything after "from" is a NAME reference (Law 1)
   */
  _matterRefLine(words, lineNum) {
    const tokens = [];
    const fromIdx = this._indexOf(words, 'from');
    tokens.push(new Token('NAME', words.slice(0, fromIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'from', lineNum));
    tokens.push(new Token('NAME', words.slice(fromIdx + 1).join(' '), lineNum));
    return tokens;
  }

  /**
   * Action calls: <name> with <key> is <value> and ...
   */
  _actionCall(words, lineNum) {
    const tokens = [];
    const withIdx = this._indexOf(words, 'with');
    tokens.push(new Token('NAME', words.slice(0, withIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'with', lineNum));

    // Rest is key-value pairs
    const rest = words.slice(withIdx + 1);
    let i = 0;
    while (i < rest.length) {
      // Collect key (until "is")
      let keyWords = [];
      while (i < rest.length && rest[i] !== 'is' && rest[i] !== 'and') {
        keyWords.push(rest[i]);
        i++;
      }
      if (keyWords.length > 0) {
        tokens.push(new Token('NAME', keyWords.join(' '), lineNum));
      }
      if (i < rest.length && rest[i] === 'is') {
        tokens.push(new Token('KEYWORD', 'is', lineNum));
        i++;
      }
      // Collect value (until "and")
      let valWords = [];
      while (i < rest.length && rest[i] !== 'and') {
        valWords.push(rest[i]);
        i++;
      }
      if (valWords.length > 0) {
        tokens.push(new Token('LITERAL', valWords.join(' '), lineNum));
      }
      // Skip "and"
      if (i < rest.length && rest[i] === 'and') i++;
    }

    return tokens;
  }

  /**
   * Note annotation: note <text>
   */
  _note(words, lineNum) {
    return [
      new Token('KEYWORD', 'note', lineNum),
      new Token('LITERAL', words.slice(1).join(' '), lineNum),
    ];
  }

  /**
   * Shared condition tokenizer: handles the full condition chain in when/again until.
   * Supports compound conditions with 'and'/'or' connectors.
   * Recognizes: not, greater than, less than, at least, at most, starts with, ends with, contains
   */
  _tokenizeCondition(words, lineNum) {
    const tokens = [];
    let i = 0;

    while (i < words.length) {
      // Skip 'and'/'or' connectors — emit as KEYWORD
      if (words[i] === 'and' || words[i] === 'or') {
        tokens.push(new Token('KEYWORD', words[i], lineNum));
        i++;
        continue;
      }

      // Find the next 'is' keyword
      const isIdx = this._indexOfFrom(words, 'is', i);
      if (isIdx < 0) {
        // No 'is' found — emit remaining words as NAME
        tokens.push(new Token('NAME', words.slice(i).join(' '), lineNum));
        break;
      }

      // Emit left side (NAME)
      const left = words.slice(i, isIdx).join(' ');
      if (left) tokens.push(new Token('NAME', left, lineNum));
      tokens.push(new Token('KEYWORD', 'is', lineNum));

      const rest = words.slice(isIdx + 1);

      // Check for multi-word operators and value, stopping before 'and'/'or'
      const nextConnector = this._findConnector(rest);
      const opWords = nextConnector >= 0 ? rest.slice(0, nextConnector) : rest;

      if (opWords[0] === 'not') {
        tokens.push(new Token('KEYWORD', 'not', lineNum));
        tokens.push(new Token('NAME', opWords.slice(1).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'greater' && opWords[1] === 'than') {
        tokens.push(new Token('KEYWORD', 'greater than', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'less' && opWords[1] === 'than') {
        tokens.push(new Token('KEYWORD', 'less than', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'at' && opWords[1] === 'least') {
        tokens.push(new Token('KEYWORD', 'at least', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'at' && opWords[1] === 'most') {
        tokens.push(new Token('KEYWORD', 'at most', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'starts' && opWords[1] === 'with') {
        tokens.push(new Token('KEYWORD', 'starts with', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'ends' && opWords[1] === 'with') {
        tokens.push(new Token('KEYWORD', 'ends with', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords[0] === 'contains') {
        tokens.push(new Token('KEYWORD', 'contains', lineNum));
        tokens.push(new Token('NAME', opWords.slice(1).join(' '), lineNum));
      } else {
        tokens.push(new Token('NAME', opWords.join(' '), lineNum));
      }

      i = isIdx + 1 + (nextConnector >= 0 ? nextConnector : opWords.length);
    }

    return tokens;
  }

  // Find index of next 'and'/'or' in words array starting at 0
  _findConnector(words) {
    for (let i = 0; i < words.length; i++) {
      if (words[i] === 'and' || words[i] === 'or') return i;
    }
    return -1;
  }

  // indexOf starting from a given index
  _indexOfFrom(words, target, from) {
    for (let i = from; i < words.length; i++) {
      if (words[i] === target) return i;
    }
    return -1;
  }

  // Find index of first word of a phrase within words, or -1
  _findPhrase(words, phrase) {
    for (let i = 0; i <= words.length - phrase.length; i++) {
      if (phrase.every((w, j) => words[i + j] === w)) return i;
    }
    return -1;
  }

  /**
   * Detect built-in operations in a word array.
   * Returns { kind, ... } or null.
   */
  _findBuiltinOp(words) {
    if (!words || words.length === 0) return null;

    const w0 = words[0];
    const w1 = words[1];

    // today (single word)
    if (w0 === 'today' && words.length === 1) {
      return { kind: 'today' };
    }

    // now (single word)
    if (w0 === 'now' && words.length === 1) {
      return { kind: 'now' };
    }

    // round of X
    if (w0 === 'round' && w1 === 'of') {
      return { kind: 'round', a: words.slice(2) };
    }

    // floor of X
    if (w0 === 'floor' && w1 === 'of') {
      return { kind: 'floor', a: words.slice(2) };
    }

    // ceiling of X
    if (w0 === 'ceiling' && w1 === 'of') {
      return { kind: 'ceiling', a: words.slice(2) };
    }

    // absolute of X
    if (w0 === 'absolute' && w1 === 'of') {
      return { kind: 'absolute', a: words.slice(2) };
    }

    // minimum of X and Y
    if (w0 === 'minimum' && w1 === 'of') {
      const rest = words.slice(2);
      const andIdx = this._indexOf(rest, 'and');
      if (andIdx >= 0) {
        return { kind: 'min', a: rest.slice(0, andIdx), b: rest.slice(andIdx + 1) };
      }
    }

    // maximum of X and Y
    if (w0 === 'maximum' && w1 === 'of') {
      const rest = words.slice(2);
      const andIdx = this._indexOf(rest, 'and');
      if (andIdx >= 0) {
        return { kind: 'max', a: rest.slice(0, andIdx), b: rest.slice(andIdx + 1) };
      }
    }

    // random between X and Y
    if (w0 === 'random' && w1 === 'between') {
      const rest = words.slice(2);
      const andIdx = this._indexOf(rest, 'and');
      if (andIdx >= 0) {
        return { kind: 'random', a: rest.slice(0, andIdx), b: rest.slice(andIdx + 1) };
      }
    }

    // days between X and Y
    if (w0 === 'days' && w1 === 'between') {
      const rest = words.slice(2);
      const andIdx = this._indexOf(rest, 'and');
      if (andIdx >= 0) {
        return { kind: 'days_between', a: rest.slice(0, andIdx), b: rest.slice(andIdx + 1) };
      }
    }

    // X trimmed (last word is 'trimmed')
    if (words.length >= 2 && words[words.length - 1] === 'trimmed') {
      return { kind: 'trimmed', a: words.slice(0, -1) };
    }

    // X repeated N times
    // Pattern: <subject words> repeated <N> times
    if (words.length >= 4 && words[words.length - 1] === 'times') {
      const repeatedIdx = this._indexOfFrom(words, 'repeated', 0);
      if (repeatedIdx > 0) {
        // subject is before 'repeated', N is between 'repeated' and 'times'
        const subject = words.slice(0, repeatedIdx);
        const nWords = words.slice(repeatedIdx + 1, -1); // strip 'times' at end
        return { kind: 'repeated', a: subject, n: nWords };
      }
    }

    // accuracy of <layer> where <condition>
    if (w0 === 'accuracy' && w1 === 'of') {
      const rest = words.slice(2);
      const whereIdx = this._indexOf(rest, 'where');
      if (whereIdx >= 0) {
        const layer = rest.slice(0, whereIdx);
        const condition = rest.slice(whereIdx + 1);
        return { kind: 'accuracy_of', layer, condition };
      }
    }

    // zoom level of <target>
    if (w0 === 'zoom' && w1 === 'level' && words[2] === 'of') {
      return { kind: 'zoom_level_of', target: words.slice(3).join(' ') };
    }

    return null;
  }

  /**
   * Sort layer statement: sort layer <name> by matter <field> [descending]
   */
  _sortLayer(words, lineNum) {
    // words[0] = 'sort', words[1] should be 'layer'
    const tokens = [new Token('KEYWORD', 'sort', lineNum)];
    if (words.length < 2 || words[1] !== 'layer') return tokens;
    tokens.push(new Token('KEYWORD', 'layer', lineNum));

    // Find 'by' keyword
    const byIdx = this._indexOf(words, 'by');
    if (byIdx < 0) return tokens;

    const name = words.slice(2, byIdx).join(' ');
    tokens.push(new Token('NAME', name, lineNum));
    tokens.push(new Token('KEYWORD', 'by', lineNum));

    // After 'by': 'matter' <field> [descending]
    const afterBy = words.slice(byIdx + 1);
    if (afterBy[0] === 'matter') {
      tokens.push(new Token('KEYWORD', 'matter', lineNum));
      const remaining = afterBy.slice(1);
      // Check for 'descending' at the end
      if (remaining.length > 0 && remaining[remaining.length - 1] === 'descending') {
        tokens.push(new Token('NAME', remaining.slice(0, -1).join(' '), lineNum));
        tokens.push(new Token('KEYWORD', 'descending', lineNum));
      } else {
        tokens.push(new Token('NAME', remaining.join(' '), lineNum));
      }
    }

    return tokens;
  }

  /**
   * Filter layer statement: filter layer <name> where <condition> into <newname>
   */
  _filterLayer(words, lineNum) {
    // words[0] = 'filter', words[1] = 'layer'
    const tokens = [new Token('KEYWORD', 'filter', lineNum)];
    if (words.length < 2 || words[1] !== 'layer') return tokens;
    tokens.push(new Token('KEYWORD', 'layer', lineNum));

    // Find 'where' and 'into'
    const whereIdx = this._indexOf(words, 'where');
    const intoIdx = this._indexOf(words, 'into');
    if (whereIdx < 0 || intoIdx < 0 || intoIdx <= whereIdx) return tokens;

    const name = words.slice(2, whereIdx).join(' ');
    tokens.push(new Token('NAME', name, lineNum));
    tokens.push(new Token('KEYWORD', 'where', lineNum));

    // Condition: words between 'where' and 'into'
    const condWords = words.slice(whereIdx + 1, intoIdx);
    tokens.push(new Token('NAME', condWords.join(' '), lineNum));

    tokens.push(new Token('KEYWORD', 'into', lineNum));
    const newName = words.slice(intoIdx + 1).join(' ');
    tokens.push(new Token('NAME', newName, lineNum));

    return tokens;
  }

  /**
   * Find in layer statement: find in <name> where <condition> into <markname>
   */
  _findInLayer(words, lineNum) {
    // words[0] = 'find', words[1] = 'in'
    const tokens = [new Token('KEYWORD', 'find', lineNum)];
    if (words.length < 2 || words[1] !== 'in') return tokens;
    // 'in' is consumed structurally; not emitted as a token

    // Find 'where' and 'into'
    const whereIdx = this._indexOf(words, 'where');
    const intoIdx = this._indexOf(words, 'into');
    if (whereIdx < 0 || intoIdx < 0 || intoIdx <= whereIdx) return tokens;

    const name = words.slice(2, whereIdx).join(' ');
    tokens.push(new Token('NAME', name, lineNum));
    tokens.push(new Token('KEYWORD', 'where', lineNum));

    const condWords = words.slice(whereIdx + 1, intoIdx);
    tokens.push(new Token('NAME', condWords.join(' '), lineNum));

    tokens.push(new Token('KEYWORD', 'into', lineNum));
    const markName = words.slice(intoIdx + 1).join(' ');
    tokens.push(new Token('NAME', markName, lineNum));

    return tokens;
  }

  /**
   * Count in layer statement: count in <name> where <condition> into <markname>
   */
  _countInLayer(words, lineNum) {
    // words[0] = 'count', words[1] = 'in'
    const tokens = [new Token('KEYWORD', 'count', lineNum)];
    if (words.length < 2 || words[1] !== 'in') return tokens;

    // Find 'where' and 'into'
    const whereIdx = this._indexOf(words, 'where');
    const intoIdx = this._indexOf(words, 'into');
    if (whereIdx < 0 || intoIdx < 0 || intoIdx <= whereIdx) return tokens;

    const name = words.slice(2, whereIdx).join(' ');
    tokens.push(new Token('NAME', name, lineNum));
    tokens.push(new Token('KEYWORD', 'where', lineNum));

    const condWords = words.slice(whereIdx + 1, intoIdx);
    tokens.push(new Token('NAME', condWords.join(' '), lineNum));

    tokens.push(new Token('KEYWORD', 'into', lineNum));
    const markName = words.slice(intoIdx + 1).join(' ');
    tokens.push(new Token('NAME', markName, lineNum));

    return tokens;
  }

  /**
   * Zoom in statement: zoom in on <A ref> and <B ref> into <name>
   * words[0] = 'zoom', words[1] = 'in', words[2] = 'on'
   *
   * A ref and B ref may start with 'layer' or 'timeline' as type hints.
   * Produces token: { type: 'ZOOM_IN', fromType, fromName, toType, toName, intoName, line }
   */
  _tokenizeZoomIn(words, lineNum) {
    // words: zoom in on [layer|timeline] <name> and [layer|timeline] <name> into <name>
    // words[0]=zoom, words[1]=in, words[2]=on
    const onIdx = this._indexOf(words, 'on');
    const andIdx = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');

    if (onIdx < 0 || andIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'zoom', lineNum)];
    }

    // Parse A ref: words from onIdx+1 to andIdx-1
    const aWords = words.slice(onIdx + 1, andIdx);
    let fromType = 'event', fromName;
    if (aWords[0] === 'layer') {
      fromType = 'layer';
      fromName = aWords.slice(1).join(' ');
    } else if (aWords[0] === 'timeline') {
      fromType = 'timeline';
      fromName = aWords.slice(1).join(' ');
    } else {
      fromName = aWords.join(' ');
    }

    // Parse B ref: words from andIdx+1 to intoIdx-1
    const bWords = words.slice(andIdx + 1, intoIdx);
    let toType = 'event', toName;
    if (bWords[0] === 'layer') {
      toType = 'layer';
      toName = bWords.slice(1).join(' ');
    } else if (bWords[0] === 'timeline') {
      toType = 'timeline';
      toName = bWords.slice(1).join(' ');
    } else {
      toName = bWords.join(' ');
    }

    const intoName = words.slice(intoIdx + 1).join(' ');

    return [new Token('ZOOM_IN', {
      fromType, fromName, toType, toName, intoName
    }, lineNum)];
  }

  /**
   * Zoom out statement: zoom out on [timeline|layer] <name> as event <name>
   * words[0] = 'zoom', words[1] = 'out', words[2] = 'on'
   *
   * Produces token: { type: 'ZOOM_OUT', sourceType, sourceName, asName, line }
   */
  _tokenizeZoomOut(words, lineNum) {
    // words: zoom out on [timeline|layer] <name> as event <name>
    // words[0]=zoom, words[1]=out, words[2]=on
    const onIdx = this._indexOf(words, 'on');
    const asIdx = this._indexOf(words, 'as');

    if (onIdx < 0 || asIdx < 0) {
      return [new Token('KEYWORD', 'zoom', lineNum)];
    }

    // Parse source ref: words from onIdx+1 to asIdx-1
    const srcWords = words.slice(onIdx + 1, asIdx);
    let sourceType = 'event', sourceName;
    if (srcWords[0] === 'timeline') {
      sourceType = 'timeline';
      sourceName = srcWords.slice(1).join(' ');
    } else if (srcWords[0] === 'layer') {
      sourceType = 'layer';
      sourceName = srcWords.slice(1).join(' ');
    } else {
      sourceName = srcWords.join(' ');
    }

    // Parse as name: words after 'as', skip optional 'event' keyword
    const asWords = words.slice(asIdx + 1);
    let asName;
    if (asWords[0] === 'event') {
      asName = asWords.slice(1).join(' ');
    } else {
      asName = asWords.join(' ');
    }

    return [new Token('ZOOM_OUT', {
      sourceType, sourceName, asName
    }, lineNum)];
  }

  /**
   * Zoom opposite: zoom opposite on <source> into <result>
   * Creates the equal and opposite control of an existing control.
   *
   * Produces token: { type: 'ZOOM_OPPOSITE', sourceName, intoName }
   */
  _tokenizeZoomOpposite(words, lineNum) {
    // words: zoom opposite on <source> into <result>
    const onIdx = this._indexOf(words, 'on');
    const intoIdx = this._indexOf(words, 'into');

    if (onIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'zoom', lineNum)];
    }

    const sourceName = words.slice(onIdx + 1, intoIdx).join(' ');
    const intoName = words.slice(intoIdx + 1).join(' ');

    return [new Token('ZOOM_OPPOSITE', { sourceName, intoName }, lineNum)];
  }

  /**
   * Zoom meta: zoom meta on <n1> and <n2> and <n3> and <n4> into <result>
   * Creates the meta-control governing four subjects (two events + two controls).
   * Names can be multi-word; `and` is the separator; `into` terminates subject list.
   *
   * Produces token: { type: 'ZOOM_META', subjects: string[], intoName }
   */
  _tokenizeZoomMeta(words, lineNum) {
    // words: zoom meta on <n1> and <n2> ... into <result>
    const onIdx = this._indexOf(words, 'on');
    const intoIdx = this._indexOf(words, 'into');

    if (onIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'zoom', lineNum)];
    }

    const intoName = words.slice(intoIdx + 1).join(' ');

    // Collect subject names separated by standalone 'and' between onIdx+1 and intoIdx
    const subjectWords = words.slice(onIdx + 1, intoIdx);
    const subjects = [];
    let current = [];
    for (const w of subjectWords) {
      if (w === 'and') {
        if (current.length > 0) { subjects.push(current.join(' ')); current = []; }
      } else {
        current.push(w);
      }
    }
    if (current.length > 0) subjects.push(current.join(' '));

    return [new Token('ZOOM_META', { subjects, intoName }, lineNum)];
  }

  /**
   * Predict statement: predict <subject> [across <dir> and <lens> and <qty> into <out>]
   * words[0] = 'predict'
   *
   * Supports both single-line and multi-line forms:
   *   Single: predict price across directions and lenses and quantities into results
   *   Multi:  predict price          (just emits KEYWORD + NAME for subject)
   *           across directions      (handled by 'across' branch in _tokenizeLine)
   *           and lenses             (handled by bare 'and' branch)
   *           and quantities
   *           into results           (handled by 'into' branch)
   */
  _tokenizePredictStmt(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'predict', lineNum)];
    const acrossIdx = this._indexOf(words, 'across');

    if (acrossIdx > 0) {
      // Single-line form: everything on one line
      const subject = words.slice(1, acrossIdx).join(' ');
      tokens.push(new Token('NAME', subject, lineNum));
      tokens.push(new Token('KEYWORD', 'across', lineNum));

      const afterAcross = words.slice(acrossIdx + 1);
      const firstAndIdx = this._indexOf(afterAcross, 'and');
      if (firstAndIdx < 0) return tokens;

      const directionsLayer = afterAcross.slice(0, firstAndIdx).join(' ');
      tokens.push(new Token('NAME', directionsLayer, lineNum));
      tokens.push(new Token('KEYWORD', 'and', lineNum));

      const afterFirstAnd = afterAcross.slice(firstAndIdx + 1);
      const secondAndIdx = this._indexOf(afterFirstAnd, 'and');
      const intoInAfter = this._indexOf(afterFirstAnd, 'into');
      if (secondAndIdx < 0 || intoInAfter < 0) return tokens;

      const lensesLayer = afterFirstAnd.slice(0, secondAndIdx).join(' ');
      tokens.push(new Token('NAME', lensesLayer, lineNum));
      tokens.push(new Token('KEYWORD', 'and', lineNum));

      const afterSecondAnd = afterFirstAnd.slice(secondAndIdx + 1);
      const intoInAfterSecond = this._indexOf(afterSecondAnd, 'into');
      if (intoInAfterSecond < 0) return tokens;

      const quantitiesLayer = afterSecondAnd.slice(0, intoInAfterSecond).join(' ');
      tokens.push(new Token('NAME', quantitiesLayer, lineNum));
      tokens.push(new Token('KEYWORD', 'into', lineNum));

      const intoLayer = afterSecondAnd.slice(intoInAfterSecond + 1).join(' ');
      tokens.push(new Token('NAME', intoLayer, lineNum));
    } else {
      // Multi-line form: just emit subject on this line; rest follows on subsequent lines
      const subject = words.slice(1).join(' ');
      if (subject) tokens.push(new Token('NAME', subject, lineNum));
    }

    return tokens;
  }

  /**
   * Resolve statement: resolve <layer> where <condition> as correct|incorrect
   * words[0] = 'resolve'
   */
  _tokenizeResolveStmt(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'resolve', lineNum)];
    const whereIdx = this._indexOf(words, 'where');
    const asIdx = this._indexOf(words, 'as');
    if (whereIdx < 0 || asIdx < 0 || asIdx <= whereIdx) return tokens;

    const layerName = words.slice(1, whereIdx).join(' ');
    tokens.push(new Token('NAME', layerName, lineNum));
    tokens.push(new Token('KEYWORD', 'where', lineNum));

    // Condition tokens between 'where' and 'as'
    const condWords = words.slice(whereIdx + 1, asIdx);
    tokens.push(...this._tokenizeCondition(condWords, lineNum));

    tokens.push(new Token('KEYWORD', 'as', lineNum));

    // outcome: last word(s) after 'as'
    const outcome = words.slice(asIdx + 1).join(' ');
    tokens.push(new Token('NAME', outcome, lineNum));

    return tokens;
  }

  /**
   * Collapse consecutive NAME tokens into one (for multi-word names).
   */
  _collapseNames(tokens) {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'NAME' && result.length > 0 && result[result.length - 1].type === 'NAME') {
        result[result.length - 1].value += ' ' + tokens[i].value;
      } else {
        result.push(tokens[i]);
      }
    }
    return result;
  }
}

module.exports = { EventMathTokenizer, Token, KEYWORDS, RESERVED_WORDS };
