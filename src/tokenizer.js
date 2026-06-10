/**
 * EventMath Tokenizer v0.2
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
 */

const KEYWORDS = new Set([
  'event', 'matter', 'category', 'cat', 'layer', 'timeline', 'action',
  'door', 'open', 'closed', 'mark', 'set', 'run', 'when', 'otherwise',
  'split', 'path', 'again', 'walk', 'end', 'is', 'from', 'as', 'to',
  'by', 'with', 'into', 'times', 'past', 'present', 'future', 'stop',
  'merge', 'break', 'add', 'remove', 'before', 'after', 'rewind', 'forward',
  'and', 'not', 'until',
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
    if (lead === 'category' || lead === 'cat') {
      return this._keywordName(lead, words.slice(1), lineNum);
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

  _mark(words, lineNum) {
    // mark <name> as <literal>
    const tokens = [new Token('KEYWORD', 'mark', lineNum)];
    const asIdx = this._indexOf(words, 'as');
    if (asIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, asIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'as', lineNum));
      tokens.push(new Token('LITERAL', words.slice(asIdx + 1).join(' '), lineNum));
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
      const val = words.slice(toIdx + 1).join(' ');
      if (/^\d+(\.\d+)?$/.test(val)) {
        tokens.push(new Token('NUMBER', val, lineNum));
      } else if (val === 'true' || val === 'false') {
        tokens.push(new Token('BOOL', val, lineNum));
      } else {
        tokens.push(new Token('LITERAL', val, lineNum));
      }
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
    // when <name> is <value>  or  when <name> is not <value>
    const tokens = [new Token('KEYWORD', 'when', lineNum)];
    const isIdx = this._indexOf(words, 'is');
    if (isIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, isIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'is', lineNum));
      const rest = words.slice(isIdx + 1);
      // Handle "not" in condition
      if (rest[0] === 'not') {
        tokens.push(new Token('KEYWORD', 'not', lineNum));
        tokens.push(new Token('NAME', rest.slice(1).join(' '), lineNum));
      } else {
        tokens.push(new Token('NAME', rest.join(' '), lineNum));
      }
    }
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
    // again until <condition>
    else if (rest[0] === 'until') {
      tokens.push(new Token('KEYWORD', 'until', lineNum));
      const isIdx = this._indexOf(rest, 'is');
      if (isIdx > 0) {
        tokens.push(new Token('NAME', rest.slice(1, isIdx).join(' '), lineNum));
        tokens.push(new Token('KEYWORD', 'is', lineNum));
        tokens.push(new Token('NAME', rest.slice(isIdx + 1).join(' '), lineNum));
      } else {
        tokens.push(new Token('NAME', rest.slice(1).join(' '), lineNum));
      }
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