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
  'and', 'not', 'until', 'overlap', 'note', 'broken', 'check',
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

    // broken event → broken event <name>
    if (lead === 'broken') {
      return this._brokenEvent(words, lineNum);
    }

    // check → check <condition>
    if (lead === 'check') {
      return this._check(words, lineNum);
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

    // and — bare track separator in overlap block
    if (lead === 'and') {
      return [new Token('KEYWORD', 'and', lineNum)];
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

module.exports = { EventMathTokenizer, Token, KEYWORDS };
