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
  'predict', 'across', 'through', 'resolve',
  'zoom', 'show',
  'spin', 'vibrate', 'cycle', 'resonate',
  'weight', 'explain', 'analogy', 'bound',
  'landscape', 'forecast', 'dimension',
  // v2.0 — innovation framework
  'actor', 'asymmetry', 'chain', 'leads', 'root',
  'invert', 'desire', 'outcome', 'scenario',
  'fallacy', 'detect', 'dilemma', 'assume', 'fractal',
  // v2.2 — satisfaction engine
  'satisfy', 'evaluate', 'against',
  // v2.6 — backward satisfaction diagnosis
  'why', 'satisfied',
  // v2.7 — sensitivity analysis + chain comparison
  'challenge', 'compare', 'for',
  // v2.8 — conflict detection + weighted trade-offs
  'conflict', 'weigh',
  // v2.9 — emergence tier + trace
  'deepen', 'trace',
  // v2.10 — video editor vocabulary rename
  'anchor', 'spine', 'grade', 'extend', 'scrub',
  // v2.11 — web layer (TheBigBang integration)
  'rain', 'star', 'zone', 'sky', 'universe', 'orbit', 'lens',
  'attempt', 'collapse', 'always',
  'cloud', 'reflect', 'node', 'atmosphere', 'field', 'style', 'route',
  'earth', 'travel', 'map', 'expand',
  // v2.12 — core language completion
  'void', 'guard', 'match', 'arm', 'escape', 'skip', 'observe',
  'every', 'clear', 'on', 'off', 'trigger', 'emit', 'pull',
  'raindrop', 'ground', 'new', 'await', 'slot', 'burst',
  // v2.13 — expression engine + reactive signals
  'live',
  // v2.14 — collection intelligence + pipeline
  'pipe', 'cast', 'log',
  // v2.16 — Bun target: SQLite-backed ground + query verb
  'draw',
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

    // ── 'leads to' detection (chain body) — must precede all other dispatch ──
    const leadsIdx = this._findPhrase(words, ['leads', 'to']);
    if (leadsIdx >= 0) {
      return this._leadsToStmt(words, leadsIdx, lineNum);
    }

    const lead = words[0].toLowerCase();

    // ── Dispatch by leading keyword ──────────────────────────

    // event, action, layer, timeline, path  →  consume NAME after
    if (KEYWORDS.has(lead) && ['event', 'action', 'layer', 'timeline', 'path'].includes(lead)) {
      return this._keywordName(lead, words.slice(1), lineNum);
    }

    // v2.0 block-opener keywords that work exactly like 'event'
    if (['actor', 'desire', 'outcome', 'scenario', 'fallacy', 'dilemma'].includes(lead)) {
      return this._keywordName(lead, words.slice(1), lineNum);
    }

    // chain <name>  — opens a chain block
    if (lead === 'chain') {
      return this._keywordName('chain', words.slice(1), lineNum);
    }

    // asymmetry from <X> and <Y> into <Z>
    if (lead === 'asymmetry') {
      return this._asymmetryStmt(words, lineNum);
    }

    // root of <state> in <chain> into <result>
    if (lead === 'root') {
      return this._rootOfStmt(words, lineNum);
    }

    // invert <source> into <result>
    if (lead === 'invert') {
      return this._invertStmt(words, lineNum);
    }

    // assume <text>
    if (lead === 'assume') {
      return this._assumeStmt(words, lineNum);
    }

    // detect fallacies in <chain> into <result>
    if (lead === 'detect') {
      return this._detectFallaciesStmt(words, lineNum);
    }

    // fractal <X> and <Y> into <Z>  — two-tier fractal axis (legacy; 'spine' preferred)
    if (lead === 'fractal') {
      return this._fractalStmt(words, lineNum);
    }

    // spine NEG and POS into NAME  — fractal spine (renamed from 'fractal')
    if (lead === 'spine') {
      return this._spineStmt(words, lineNum);
    }

    // anchor NAME at depth N  — dimensional anchor (renamed from 'spin into')
    if (lead === 'anchor') {
      return this._anchorStmt(words, lineNum);
    }

    // grade DESIRE against CHAIN through SPINE into RESULT  — dimensional grade
    if (lead === 'grade') {
      return this._gradeStmt(words, lineNum);
    }

    // satisfy <desire> against <chain> into <result>
    if (lead === 'satisfy') {
      return this._satisfyStmt(words, lineNum);
    }

    // evaluate <desire> [and <desire>...] against <chain> into <result>
    if (lead === 'evaluate') {
      return this._evaluateStmt(words, lineNum);
    }

    // why <desire> is not satisfied in <chain> into <result>
    if (lead === 'why') {
      return this._tokenizeWhyStmt(words, lineNum);
    }

    // challenge ASSUMPTION in REPORT into RESULT
    if (lead === 'challenge') {
      return this._tokenizeChallengeStmt(words, lineNum);
    }

    // compare CHAIN and CHAIN for DESIRE into RESULT
    if (lead === 'compare') {
      return this._tokenizeCompareStmt(words, lineNum);
    }

    // conflict DESIRE and DESIRE for CHAIN into RESULT
    if (lead === 'conflict') {
      return this._tokenizeConflictStmt(words, lineNum);
    }

    // weigh CONFLICT into RESULT
    if (lead === 'weigh') {
      return this._tokenizeWeighStmt(words, lineNum);
    }

    // deepen AXIS with NEG and POS into RESULT — attach D±52 tori to fractal axis (legacy; 'extend' preferred)
    if (lead === 'deepen') {
      return this._tokenizeDeepenStmt(words, lineNum);
    }

    // extend SPINE with NEG and POS into RESULT — deepen a spine to D±52
    if (lead === 'extend') {
      return this._tokenizeExtendStmt(words, lineNum);
    }

    // trace CONFLICT into RESULT — priority sensitivity curve (legacy; 'scrub' preferred)
    if (lead === 'trace') {
      return this._tokenizeTraceStmt(words, lineNum);
    }

    // scrub CONFLICT into RESULT — priority sensitivity curve
    if (lead === 'scrub') {
      return this._tokenizeScrubStmt(words, lineNum);
    }

    // ── v2.11 web layer ────────────────────────────────────────────

    if (lead === 'rain')       return this._tokenizeRainStmt(words, lineNum);
    if (lead === 'star')       return this._tokenizeStarStmt(words, lineNum);
    if (lead === 'zone')       return this._tokenizeZoneStmt(words, lineNum);
    if (lead === 'sky')        return this._tokenizeSkyStmt(words, lineNum);
    if (lead === 'universe')   return this._tokenizeUniverseStmt(words, lineNum);
    if (lead === 'field')      return this._tokenizeUniverseField(words, lineNum);
    if (lead === 'orbit')      return this._tokenizeOrbitStmt(words, lineNum);
    if (lead === 'lens')       return this._tokenizeLensStmt(words, lineNum);
    if (lead === 'attempt')    return [new Token('KEYWORD', 'attempt', lineNum)];
    if (lead === 'collapse')   return [new Token('COLLAPSE_MARKER', { errName: words.slice(1).join(' ') || '_err' }, lineNum)];
    if (lead === 'always')     return [new Token('KEYWORD', 'always', lineNum)];
    if (lead === 'expand')     return this._tokenizeExpandStmt(words, lineNum);
    if (lead === 'cloud')      return this._tokenizeCloudStmt(words, lineNum);
    if (lead === 'reflect')    return this._tokenizeReflectStmt(words, lineNum);
    if (lead === 'node')       return this._tokenizeNodeStmt(words, lineNum);
    if (lead === 'atmosphere') return this._tokenizeAtmosphereStmt(words, lineNum);
    if (lead === 'style')      return this._tokenizeStyleProp(words, lineNum);
    if (lead === 'earth')      return this._tokenizeEarthStmt(words, lineNum);
    if (lead === 'travel')     return this._tokenizeTravelStmt(words, lineNum);
    if (lead === 'map')        return [new Token('KEYWORD', 'map', lineNum)];
    if (lead === 'route')      return this._tokenizeRouteLine(words, lineNum);
    if (lead === 'void')      return [new Token('KEYWORD', 'void', lineNum)];
    if (lead === 'escape')    return [new Token('KEYWORD', 'escape', lineNum)];
    if (lead === 'skip')      return [new Token('KEYWORD', 'skip', lineNum)];
    if (lead === 'guard')     return this._tokenizeGuardStmt(words, lineNum);
    if (lead === 'match')     return this._tokenizeMatchStmt(words, lineNum);
    if (lead === 'arm')       return this._tokenizeArmStmt(words, lineNum);
    if (lead === 'observe')   return this._tokenizeObserveStmt(words, lineNum);
    if (lead === 'every')     return this._tokenizeEveryStmt(words, lineNum);
    if (lead === 'clear')     return this._tokenizeClearStmt(words, lineNum);
    if (lead === 'on')        return this._tokenizeOnStmt(words, lineNum, false);
    if (lead === 'off')       return this._tokenizeOffStmt(words, lineNum);
    if (lead === 'trigger')   return this._tokenizeTriggerStmt(words, lineNum);
    if (lead === 'emit')      return this._tokenizeEmitStmt(words, lineNum);
    if (lead === 'pull')      return this._tokenizePullStmt(words, lineNum);
    if (lead === 'raindrop')  return this._tokenizeRaindropStmt(words, lineNum);
    if (lead === 'ground')    return this._tokenizeGroundStmt(words, lineNum);
    if (lead === 'draw')      return this._tokenizeDrawStmt(words, lineNum);
    if (lead === 'input')     return this._tokenizeInputStmt(words, lineNum);
    if (lead === 'new')       return this._tokenizeNewStmt(words, lineNum);
    if (lead === 'await')     return this._tokenizeAwaitStmt(words, lineNum);
    if (lead === 'slot')      return this._tokenizeSlotStmt(words, lineNum);
    if (lead === 'burst')     return this._tokenizeBurstStmt(words, lineNum);
    if (lead === 'live')      return this._tokenizeLiveStmt(words, lineNum);
    if (lead === 'pipe')      return this._tokenizePipeStmt(words, lineNum);
    if (lead === 'cast')      return this._tokenizeCastStmt(words, lineNum);
    if (lead === 'log')       return this._tokenizeLogStmt(words, lineNum);

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

    // spin → spin <source> into <name>
    if (lead === 'spin') {
      return this._spinStmt(words, lineNum);
    }

    // vibrate → vibrate <torus> across <N>
    if (lead === 'vibrate') {
      return this._vibrateStmt(words, lineNum);
    }

    // cycle → cycle <torus>
    if (lead === 'cycle') {
      return this._cycleStmt(words, lineNum);
    }

    // resonate → resonate <X> and <Y>
    if (lead === 'resonate') {
      return this._resonateStmt(words, lineNum);
    }

    // weight → weight <X> at <N>   (probabilistic)
    if (lead === 'weight') {
      return this._weightStmt(words, lineNum);
    }

    // explain → explain <X> from <Y> into <Z>   (abductive)
    if (lead === 'explain') {
      return this._explainStmt(words, lineNum);
    }

    // analogy → analogy <X> and <Y> into <Z>   (analogical)
    if (lead === 'analogy') {
      return this._analogyStmt(words, lineNum);
    }

    // bound → bound <X> and <Y> into <Z>  (complex axis structure)
    if (lead === 'bound') {
      return this._boundStmt(words, lineNum);
    }

    // landscape → landscape from <T1> and <T2> ... into <name>
    if (lead === 'landscape') {
      return this._landscapeStmt(words, lineNum);
    }

    // forecast → forecast from <landscape> into <result>
    if (lead === 'forecast') {
      return this._forecastStmt(words, lineNum);
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

    // sort: v2.14 if no 'layer' at words[1]; else old layer sort
    if (lead === 'sort') {
      if (words[1] !== 'layer') return this._tokenizeSortStmt(words, lineNum);
      return this._sortLayer(words, lineNum);
    }

    // filter: v2.14 if no 'layer' at words[1]; else old layer filter
    if (lead === 'filter') {
      if (words[1] !== 'layer') return this._tokenizeFilterStmt(words, lineNum);
      return this._filterLayer(words, lineNum);
    }

    // find: v2.14 if words[1] !== 'in'; else old layer find
    if (lead === 'find') {
      if (words[1] !== 'in') return this._tokenizeFindStmt(words, lineNum);
      return this._findInLayer(words, lineNum);
    }

    // count: v2.14 if words[1] !== 'in'; else old layer count
    if (lead === 'count') {
      if (words[1] !== 'in') return this._tokenizeCountStmt(words, lineNum);
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

    // through → continuation of predict statement (multi-line syntax)
    // Routes condition dimensions through the fractal's three structural tiers
    if (lead === 'through') {
      const tokens = [new Token('KEYWORD', 'through', lineNum)];
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
      const rightRaw = words.slice(joinedIdx + 2).join(' ');
      let rightToken;
      if (/^"[^"]*"$/.test(rightRaw)) {
        rightToken = new Token('LITERAL', rightRaw.slice(1, -1), lineNum);
      } else if (/^'-?[^']*'$/.test(rightRaw)) {
        rightToken = new Token('LITERAL', rightRaw.slice(1, -1), lineNum);
      } else {
        rightToken = new Token('NAME', rightRaw, lineNum);
      }
      return [
        new Token('NAME', left, lineNum),
        new Token('KEYWORD', 'joined with', lineNum),
        rightToken,
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
      } else if (words[i] === 'take' && i + 1 < words.length && words[i + 1] === 'away') {
        segments.push(current); operators.push('take away'); current = []; i++;
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

  // spin <source> into <name> [at dimension N]
  _spinStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) return [new Token('KEYWORD', 'spin', lineNum)];
    const sourceName = words.slice(1, intoIdx).join(' ');
    // Check for 'at dimension N' after the into-name
    const atIdx  = this._indexOfFrom(words, 'at', intoIdx + 1);
    const dimIdx = atIdx >= 0 ? this._indexOfFrom(words, 'dimension', atIdx) : -1;
    let intoName, dimension;
    if (atIdx >= 0 && dimIdx === atIdx + 1) {
      intoName  = words.slice(intoIdx + 1, atIdx).join(' ');
      dimension = parseInt(words[dimIdx + 1], 10) || 2;
    } else {
      intoName  = words.slice(intoIdx + 1).join(' ');
      dimension = 2;
    }
    return [new Token('SPIN_STMT', { sourceName, intoName, dimension }, lineNum)];
  }

  // bound <firstName> and <secondName> into <intoName>
  // Creates the full dimensional axis: bridge (i), anti-bridge (-i), meta (ℝ), anti-meta (-ℝ), grand (ℂ)
  _boundStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'bound', lineNum)];
    const firstName  = words.slice(1, andIdx).join(' ');
    const secondName = words.slice(andIdx + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('BOUND_STMT', { firstName, secondName, intoName }, lineNum)];
  }

  // landscape from <T1> and <T2> [and <TN>] into <name>
  _landscapeStmt(words, lineNum) {
    const fromIdx = this._indexOf(words, 'from');
    const intoIdx = this._lastIndexOf(words, 'into');
    if (fromIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'landscape', lineNum)];
    const middle  = words.slice(fromIdx + 1, intoIdx).join(' ');
    const sources = middle.split(' and ').map(s => s.trim()).filter(Boolean);
    const intoName = words.slice(intoIdx + 1).join(' ');
    return [new Token('LANDSCAPE_STMT', { sources, intoName }, lineNum)];
  }

  // forecast from <landscape> into <result>
  _forecastStmt(words, lineNum) {
    const fromIdx = this._indexOf(words, 'from');
    const intoIdx = this._indexOf(words, 'into');
    if (fromIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'forecast', lineNum)];
    const landscapeName = words.slice(fromIdx + 1, intoIdx).join(' ');
    const intoName      = words.slice(intoIdx + 1).join(' ');
    return [new Token('FORECAST_STMT', { landscapeName, intoName }, lineNum)];
  }

  // vibrate <torus> across <N>
  _vibrateStmt(words, lineNum) {
    const acrossIdx = this._indexOf(words, 'across');
    if (acrossIdx < 0) return [new Token('KEYWORD', 'vibrate', lineNum)];
    const torusName = words.slice(1, acrossIdx).join(' ');
    const rings     = parseInt(words[acrossIdx + 1], 10) || 1;
    return [new Token('VIBRATE_STMT', { torusName, rings }, lineNum)];
  }

  // cycle <torus>
  _cycleStmt(words, lineNum) {
    const torusName = words.slice(1).join(' ');
    return [new Token('CYCLE_STMT', { torusName }, lineNum)];
  }

  // resonate <X> and <Y>
  _resonateStmt(words, lineNum) {
    const andIdx = this._indexOf(words, 'and');
    if (andIdx < 0) return [new Token('KEYWORD', 'resonate', lineNum)];
    const firstName  = words.slice(1, andIdx).join(' ');
    const secondName = words.slice(andIdx + 1).join(' ');
    return [new Token('RESONATE_STMT', { firstName, secondName }, lineNum)];
  }

  // weight <name> at <N>   — probabilistic weight assignment
  _weightStmt(words, lineNum) {
    const atIdx = this._indexOfFrom(words, 'at', 1);
    if (atIdx < 0) return [new Token('KEYWORD', 'weight', lineNum)];
    const targetName = words.slice(1, atIdx).join(' ');
    const value      = parseFloat(words[atIdx + 1]) || 1;
    return [new Token('WEIGHT_STMT', { targetName, value }, lineNum)];
  }

  // explain <observations> from <candidates> into <result>
  _explainStmt(words, lineNum) {
    const fromIdx = this._indexOf(words, 'from');
    const intoIdx = this._indexOf(words, 'into');
    if (fromIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'explain', lineNum)];
    const observations = words.slice(1, fromIdx).join(' ');
    const candidates   = words.slice(fromIdx + 1, intoIdx).join(' ');
    const intoName     = words.slice(intoIdx + 1).join(' ');
    return [new Token('EXPLAIN_STMT', { observations, candidates, intoName }, lineNum)];
  }

  // analogy <X> and <Y> into <Z>   — structural similarity
  _analogyStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'analogy', lineNum)];
    const firstName  = words.slice(1, andIdx).join(' ');
    const secondName = words.slice(andIdx + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('ANALOGY_STMT', { firstName, secondName, intoName }, lineNum)];
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
      } else if (opWords.length >= 2 && (opWords[0] === 'greater' || opWords[0] === 'more') && opWords[1] === 'than') {
        tokens.push(new Token('KEYWORD', 'greater than', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && (opWords[0] === 'less' || opWords[0] === 'fewer') && opWords[1] === 'than') {
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

  _lastIndexOf(words, target) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i] === target) return i;
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

    // weighted accuracy of <layer> where <condition>
    if (w0 === 'weighted' && w1 === 'accuracy' && words[2] === 'of') {
      const rest = words.slice(3);
      const whereIdx = this._indexOf(rest, 'where');
      if (whereIdx >= 0) {
        const layer     = rest.slice(0, whereIdx);
        const condition = rest.slice(whereIdx + 1);
        return { kind: 'weighted_accuracy_of', layer, condition };
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

    // dimension of <target>
    if (w0 === 'dimension' && w1 === 'of') {
      return { kind: 'dimension_of', target: words.slice(2).join(' ') };
    }

    // rewind of <X> → square root (√X)  — math identity: rewind = inverse square
    if (words[0] === 'rewind' && words[1] === 'of') {
      const a = words.slice(2);
      if (a.length > 0) return { kind: 'sqrt', a };
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
   * Predict statement: predict <subject> across <d1> and <d2> ... [through <fractal>] into <out>
   * words[0] = 'predict'
   *
   * Supports both single-line and multi-line forms:
   *   Single: predict price across directions and lenses and quantities into results
   *           predict blueprint across industry and price and awareness through leverage axis into predictions
   *   Multi:  predict price          (just emits KEYWORD + NAME for subject)
   *           across directions      (handled by 'across' branch in _tokenizeLine)
   *           and lenses             (handled by bare 'and' branch)
   *           and awareness
   *           through leverage axis  (handled by 'through' branch in _tokenizeLine)
   *           into results           (handled by 'into' branch)
   *
   * All condition dimensions pass through the fractal's three structural tiers
   * (surface D±13, system D±26, root D±39). Add 'through FRACTAL' to enforce
   * dimensional routing. Without it, dimensions are a flat cartesian product.
   */
  _tokenizePredictStmt(words, lineNum) {
    const tokens = [new Token('KEYWORD', 'predict', lineNum)];
    const acrossIdx = this._indexOf(words, 'across');

    if (acrossIdx > 0) {
      // Single-line form: parse subject, then collect N dimensions, optional through, then into
      const subject = words.slice(1, acrossIdx).join(' ');
      tokens.push(new Token('NAME', subject, lineNum));
      tokens.push(new Token('KEYWORD', 'across', lineNum));

      const afterAcross = words.slice(acrossIdx + 1);
      const intoIdx    = this._indexOf(afterAcross, 'into');
      if (intoIdx < 0) return tokens;

      const throughIdx = this._indexOf(afterAcross, 'through');
      const dimEnd     = throughIdx >= 0 && throughIdx < intoIdx ? throughIdx : intoIdx;

      // Split dimension words by 'and' — supports multi-word names like "industry type"
      const dimWords = afterAcross.slice(0, dimEnd);
      let current = [];
      for (const w of dimWords) {
        if (w === 'and') {
          if (current.length > 0) {
            tokens.push(new Token('NAME', current.join(' '), lineNum));
            tokens.push(new Token('KEYWORD', 'and', lineNum));
            current = [];
          }
        } else {
          current.push(w);
        }
      }
      if (current.length > 0) tokens.push(new Token('NAME', current.join(' '), lineNum));

      // Optional fractal routing
      if (throughIdx >= 0 && throughIdx < intoIdx) {
        tokens.push(new Token('KEYWORD', 'through', lineNum));
        const fractalWords = afterAcross.slice(throughIdx + 1, intoIdx);
        tokens.push(new Token('NAME', fractalWords.join(' '), lineNum));
      }

      tokens.push(new Token('KEYWORD', 'into', lineNum));
      tokens.push(new Token('NAME', afterAcross.slice(intoIdx + 1).join(' '), lineNum));
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

  // ── v2.0 statement handlers ──────────────────────────────

  // <A> leads to <B>  (inside a chain block)
  _leadsToStmt(words, leadsIdx, lineNum) {
    const from     = words.slice(0, leadsIdx).join(' ');
    const afterTo  = words.slice(leadsIdx + 2);

    // Parse optional "at value N" suffix
    const atIdx = this._findPhrase(afterTo, ['at', 'value']);
    let to, value;
    if (atIdx >= 0) {
      to = afterTo.slice(0, atIdx).join(' ');
      const rawVal = afterTo[atIdx + 2];
      const parsed = rawVal !== undefined ? parseFloat(rawVal) : NaN;
      value = isNaN(parsed) ? null : parsed;
    } else {
      to    = afterTo.join(' ');
      value = null;
    }
    return [new Token('LEADS_TO_STMT', { from, to, value }, lineNum)];
  }

  // asymmetry from <X> and <Y> into <Z>
  _asymmetryStmt(words, lineNum) {
    const fromIdx = this._indexOf(words, 'from');
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (fromIdx < 0 || andIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'asymmetry', lineNum)];
    const firstName  = words.slice(fromIdx + 1, andIdx).join(' ');
    const secondName = words.slice(andIdx  + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('ASYMMETRY_STMT', { firstName, secondName, intoName }, lineNum)];
  }

  // root of <state> [in <chain>] into <result>
  _rootOfStmt(words, lineNum) {
    const ofIdx   = this._indexOf(words, 'of');
    const inIdx   = this._indexOf(words, 'in');
    const intoIdx = this._indexOf(words, 'into');
    if (ofIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'root', lineNum)];
    let stateName, chainName;
    if (inIdx > ofIdx && inIdx < intoIdx) {
      stateName = words.slice(ofIdx + 1, inIdx).join(' ');
      chainName = words.slice(inIdx + 1, intoIdx).join(' ');
    } else {
      stateName = words.slice(ofIdx + 1, intoIdx).join(' ');
      chainName = '';
    }
    const intoName = words.slice(intoIdx + 1).join(' ');
    return [new Token('ROOT_OF_STMT', { stateName, chainName, intoName }, lineNum)];
  }

  // invert <source> into <result>
  _invertStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) return [new Token('KEYWORD', 'invert', lineNum)];
    const sourceName = words.slice(1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('INVERT_STMT', { sourceName, intoName }, lineNum)];
  }

  // assume <name> is <value>  — or  assume <text>
  _assumeStmt(words, lineNum) {
    const text  = words.slice(1).join(' ');
    const isIdx = this._indexOf(words, 'is');
    if (isIdx > 1) {
      const name  = words.slice(1, isIdx).join(' ');
      const value = words.slice(isIdx + 1).join(' ');
      return [new Token('ASSUME_STMT', { name, value, text }, lineNum)];
    }
    return [new Token('ASSUME_STMT', { name: text, value: '', text }, lineNum)];
  }

  // detect fallacies in <chain> into <result>
  _detectFallaciesStmt(words, lineNum) {
    const inIdx   = this._indexOf(words, 'in');
    const intoIdx = this._indexOf(words, 'into');
    if (inIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'detect', lineNum)];
    const chainName = words.slice(inIdx + 1, intoIdx).join(' ');
    const intoName  = words.slice(intoIdx + 1).join(' ');
    return [new Token('DETECT_FALLACIES_STMT', { chainName, intoName }, lineNum)];
  }

  // fractal <X> and <Y> into <Z>  (two-tier fractal axis)
  _fractalStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'fractal', lineNum)];
    const firstName  = words.slice(1, andIdx).join(' ');
    const secondName = words.slice(andIdx  + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('FRACTAL_STMT', { firstName, secondName, intoName }, lineNum)];
  }

  // satisfy <desire> against <chain> [across fractal <fractal>] into <result>
  _satisfyStmt(words, lineNum) {
    const againstIdx = this._indexOf(words, 'against');
    const intoIdx    = this._indexOf(words, 'into');
    if (againstIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'satisfy', lineNum)];
    const desireName  = words.slice(1, againstIdx).join(' ');
    const middleWords = words.slice(againstIdx + 1, intoIdx);
    const acrossIdx   = this._indexOf(middleWords, 'across');

    // Detect dimensional form: "against CHAIN across fractal FRACTAL into RESULT"
    if (acrossIdx >= 0 && middleWords[acrossIdx + 1] === 'fractal') {
      const chainName   = middleWords.slice(0, acrossIdx).join(' ');
      const fractalName = middleWords.slice(acrossIdx + 2).join(' ');
      const intoName    = words.slice(intoIdx + 1).join(' ');
      return [new Token('DIMENSIONAL_STMT', {
        desireNames: [desireName], chainName, fractalName, intoName
      }, lineNum)];
    }

    const chainName = middleWords.join(' ');
    const intoName  = words.slice(intoIdx + 1).join(' ');
    return [new Token('SATISFY_STMT', { desireName, chainName, intoName }, lineNum)];
  }

  // evaluate <desire> [and <desire>...] against <chain> [across fractal <fractal>] into <result>
  _evaluateStmt(words, lineNum) {
    const againstIdx = this._indexOf(words, 'against');
    const intoIdx    = this._indexOf(words, 'into');
    if (againstIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'evaluate', lineNum)];
    // Split desire names by 'and'
    const desiresPart = words.slice(1, againstIdx);
    const desireNames = [];
    let   current     = [];
    for (const w of desiresPart) {
      if (w === 'and') {
        if (current.length) desireNames.push(current.join(' '));
        current = [];
      } else {
        current.push(w);
      }
    }
    if (current.length) desireNames.push(current.join(' '));
    const middleWords = words.slice(againstIdx + 1, intoIdx);
    const acrossIdx   = this._indexOf(middleWords, 'across');

    // Detect dimensional form: "against CHAIN across fractal FRACTAL into RESULT"
    if (acrossIdx >= 0 && middleWords[acrossIdx + 1] === 'fractal') {
      const chainName   = middleWords.slice(0, acrossIdx).join(' ');
      const fractalName = middleWords.slice(acrossIdx + 2).join(' ');
      const intoName    = words.slice(intoIdx + 1).join(' ');
      return [new Token('DIMENSIONAL_STMT', {
        desireNames, chainName, fractalName, intoName
      }, lineNum)];
    }

    const chainName = middleWords.join(' ');
    const intoName  = words.slice(intoIdx + 1).join(' ');
    return [new Token('EVALUATE_STMT', { desireNames, chainName, intoName }, lineNum)];
  }

  /**
   * Challenge statement: challenge ASSUMPTION in REPORT into RESULT
   * Deactivates one assumption, re-runs the referenced report, shows the delta.
   * Example: challenge market rate in leverage report into market sensitivity
   */
  _tokenizeChallengeStmt(words, lineNum) {
    const inIdx   = this._indexOf(words, 'in');
    const intoIdx = this._indexOf(words, 'into');
    if (inIdx < 0 || intoIdx < 0 || intoIdx <= inIdx) {
      return [new Token('KEYWORD', 'challenge', lineNum)];
    }
    const assumptionName = words.slice(1, inIdx).join(' ');
    const reportName     = words.slice(inIdx + 1, intoIdx).join(' ');
    const intoName       = words.slice(intoIdx + 1).join(' ');
    return [new Token('CHALLENGE_STMT', { assumptionName, reportName, intoName }, lineNum)];
  }

  /**
   * Compare statement: compare CHAIN and CHAIN for DESIRE into RESULT
   * Side-by-side chain comparison: tier scores, fallacy penalties, winner per tier.
   * Example: compare waiting chain and leverage chain for fair payment into path comparison
   */
  _tokenizeCompareStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const forIdx  = this._indexOf(words, 'for');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || forIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'compare', lineNum)];
    }
    const chain1     = words.slice(1, andIdx).join(' ');
    const chain2     = words.slice(andIdx + 1, forIdx).join(' ');
    const desireName = words.slice(forIdx + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('COMPARE_STMT', { chain1, chain2, desireName, intoName }, lineNum)];
  }

  /**
   * Conflict statement: conflict DESIRE and DESIRE for CHAIN into RESULT
   * Detects ALIGNED / COMPETITIVE / OPPOSED tension between two desires in a chain.
   * Example: conflict fair payment and creative freedom for leverage chain into tension report
   */
  _tokenizeConflictStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const forIdx  = this._indexOf(words, 'for');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || forIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'conflict', lineNum)];
    }
    const desire1   = words.slice(1, andIdx).join(' ');
    const desire2   = words.slice(andIdx + 1, forIdx).join(' ');
    const chainName = words.slice(forIdx + 1, intoIdx).join(' ');
    const intoName  = words.slice(intoIdx + 1).join(' ');
    return [new Token('CONFLICT_STMT', { desire1, desire2, chainName, intoName }, lineNum)];
  }

  /**
   * Weigh statement: weigh CONFLICT into RESULT
   * Produces an optimal trade-off recommendation using desire weights.
   * Example: weigh tension report into resolution
   */
  _tokenizeWeighStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) {
      return [new Token('KEYWORD', 'weigh', lineNum)];
    }
    const conflictName = words.slice(1, intoIdx).join(' ');
    const intoName     = words.slice(intoIdx + 1).join(' ');
    return [new Token('WEIGH_STMT', { conflictName, intoName }, lineNum)];
  }

  /**
   * Deepen statement: deepen AXIS with NEG and POS into RESULT
   * Attaches explicit D±52 tori to an existing fractal axis for emergence scoring.
   * Example: deepen market axis with emergence neg and emergence pos into deep axis
   */
  _tokenizeDeepenStmt(words, lineNum) {
    const withIdx = this._indexOf(words, 'with');
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (withIdx < 0 || andIdx < 0 || intoIdx < 0 || andIdx <= withIdx || intoIdx <= andIdx) {
      return [new Token('KEYWORD', 'deepen', lineNum)];
    }
    const axisName = words.slice(1, withIdx).join(' ');
    const negName  = words.slice(withIdx + 1, andIdx).join(' ');
    const posName  = words.slice(andIdx + 1, intoIdx).join(' ');
    const intoName = words.slice(intoIdx + 1).join(' ');
    return [new Token('DEEPEN_STMT', { axisName, negName, posName, intoName }, lineNum)];
  }

  /**
   * Trace statement: trace CONFLICT into RESULT
   * Priority sensitivity curve — computes the breakeven ratio where the winner switches.
   * Example: trace tension report into priority curve
   */
  _tokenizeTraceStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) {
      return [new Token('KEYWORD', 'trace', lineNum)];
    }
    const conflictName = words.slice(1, intoIdx).join(' ');
    const intoName     = words.slice(intoIdx + 1).join(' ');
    return [new Token('TRACE_STMT', { conflictName, intoName }, lineNum)];
  }

  // ── v2.10 video-editor vocabulary ─────────────────────────────────────────

  // anchor NAME at depth N  — creates a dimensional anchor
  _anchorStmt(words, lineNum) {
    const atIdx    = this._indexOf(words, 'at');
    const depthIdx = atIdx >= 0 ? this._indexOfFrom(words, 'depth', atIdx) : -1;
    let name, depth;
    if (atIdx >= 0 && depthIdx === atIdx + 1 && words.length > depthIdx + 1) {
      name  = words.slice(1, atIdx).join(' ');
      depth = parseInt(words[depthIdx + 1], 10) || 2;
    } else {
      name  = words.slice(1).join(' ');
      depth = 2;
    }
    if (!name) return [new Token('KEYWORD', 'anchor', lineNum)];
    return [new Token('ANCHOR_STMT', { name, depth }, lineNum)];
  }

  // spine NEG and POS into NAME  — fractal spine (video editor name for fractal axis)
  _spineStmt(words, lineNum) {
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (andIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'spine', lineNum)];
    const firstName  = words.slice(1, andIdx).join(' ');
    const secondName = words.slice(andIdx + 1, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');
    return [new Token('SPINE_STMT', { firstName, secondName, intoName }, lineNum)];
  }

  // grade DESIRE against CHAIN through SPINE into RESULT  — dimensional grade
  _gradeStmt(words, lineNum) {
    const againstIdx = this._indexOf(words, 'against');
    const intoIdx    = this._indexOf(words, 'into');
    if (againstIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'grade', lineNum)];
    const desireName  = words.slice(1, againstIdx).join(' ');
    const middleWords = words.slice(againstIdx + 1, intoIdx);
    const throughIdx  = this._indexOf(middleWords, 'through');
    let chainName, spineName;
    if (throughIdx >= 0) {
      chainName = middleWords.slice(0, throughIdx).join(' ');
      spineName = middleWords.slice(throughIdx + 1).join(' ');
    } else {
      chainName = middleWords.join(' ');
      spineName = '';
    }
    const intoName = words.slice(intoIdx + 1).join(' ');
    return [new Token('GRADE_STMT', { desireName, chainName, spineName, intoName }, lineNum)];
  }

  // extend SPINE with NEG and POS into RESULT  — deepen a spine to D±52
  _tokenizeExtendStmt(words, lineNum) {
    const withIdx = this._indexOf(words, 'with');
    const andIdx  = this._indexOf(words, 'and');
    const intoIdx = this._indexOf(words, 'into');
    if (withIdx < 0 || andIdx < 0 || intoIdx < 0 || andIdx <= withIdx || intoIdx <= andIdx) {
      return [new Token('KEYWORD', 'extend', lineNum)];
    }
    const spineName = words.slice(1, withIdx).join(' ');
    const negName   = words.slice(withIdx + 1, andIdx).join(' ');
    const posName   = words.slice(andIdx + 1, intoIdx).join(' ');
    const intoName  = words.slice(intoIdx + 1).join(' ');
    return [new Token('EXTEND_STMT', { spineName, negName, posName, intoName }, lineNum)];
  }

  // scrub CONFLICT into RESULT  — priority sensitivity curve
  _tokenizeScrubStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) return [new Token('KEYWORD', 'scrub', lineNum)];
    const conflictName = words.slice(1, intoIdx).join(' ');
    const intoName     = words.slice(intoIdx + 1).join(' ');
    return [new Token('SCRUB_STMT', { conflictName, intoName }, lineNum)];
  }

  /**
   * Why statement: why DESIRE is not satisfied in CHAIN into RESULT
   * Emits a WHY_STMT compound token for the parser.
   *
   * Example: why fair payment is not satisfied in leverage chain into diagnosis
   *
   * The sequence "is not satisfied in" is fixed. 'is', 'not', 'into' are keywords;
   * 'satisfied' and 'in' are matched as plain words.
   */
  _tokenizeWhyStmt(words, lineNum) {
    const isIdx   = this._indexOf(words, 'is');
    const intoIdx = this._indexOf(words, 'into');

    if (isIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'why', lineNum)];
    }

    // Verify the fixed sequence: is not satisfied in
    if (words[isIdx + 1] !== 'not' ||
        words[isIdx + 2] !== 'satisfied' ||
        words[isIdx + 3] !== 'in') {
      return [new Token('KEYWORD', 'why', lineNum)];
    }

    const desireName = words.slice(1, isIdx).join(' ');
    const chainName  = words.slice(isIdx + 4, intoIdx).join(' ');
    const intoName   = words.slice(intoIdx + 1).join(' ');

    return [new Token('WHY_STMT', { desireName, chainName, intoName }, lineNum)];
  }

  // ── v2.11 web layer tokenizer methods ─────────────────────────────

  // rain NAME is VALUE — mutable variable
  _tokenizeRainStmt(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    if (isIdx < 0) return [new Token('KEYWORD', 'rain', lineNum)];
    const name  = words.slice(1, isIdx).join(' ');
    const value = words.slice(isIdx + 1).join(' ') || 'void';
    return [new Token('RAIN_STMT', { name, value }, lineNum)];
  }

  // star NAME is VALUE — constant
  _tokenizeStarStmt(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    if (isIdx < 0) return [new Token('KEYWORD', 'star', lineNum)];
    const name  = words.slice(1, isIdx).join(' ');
    const value = words.slice(isIdx + 1).join(' ') || 'void';
    return [new Token('STAR_STMT', { name, value }, lineNum)];
  }

  // zone NAME is { ... } — object literal
  _tokenizeZoneStmt(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    if (isIdx < 0) return [new Token('UNIVERSE_BLOCK', { name: words.slice(1).join(' ') }, lineNum)];
    const name       = words.slice(1, isIdx).join(' ');
    const expression = words.slice(isIdx + 1).join(' ');
    return [new Token('ZONE_STMT', { name, expression }, lineNum)];
  }

  // sky NAME is [ ... ] — array literal
  _tokenizeSkyStmt(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    if (isIdx < 0) return [new Token('SKY_BLOCK', { name: words.slice(1).join(' ') }, lineNum)];
    const name       = words.slice(1, isIdx).join(' ');
    const expression = words.slice(isIdx + 1).join(' ');
    return [new Token('SKY_STMT', { name, expression }, lineNum)];
  }

  // universe NAME — schema block header
  _tokenizeUniverseStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('UNIVERSE_STMT', { name }, lineNum)];
  }

  // field NAME is TYPE — inside universe block
  _tokenizeUniverseField(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    const name  = isIdx > 0 ? words.slice(1, isIdx).join(' ') : words.slice(1).join(' ');
    const type  = isIdx > 0 ? words.slice(isIdx + 1).join(' ') : 'One';
    return [new Token('UNIVERSE_FIELD', { name, type }, lineNum)];
  }

  // orbit ITEM in COLLECTION — for-of loop block header
  _tokenizeOrbitStmt(words, lineNum) {
    const inIdx = this._indexOf(words, 'in');
    if (inIdx < 0) return [new Token('KEYWORD', 'orbit', lineNum)];
    const itemName       = words.slice(1, inIdx).join(' ');
    const collectionName = words.slice(inIdx + 1).join(' ');
    return [new Token('ORBIT_STMT', { itemName, collectionName }, lineNum)];
  }

  // lens NAME is EXPRESSION — derived computed value
  _tokenizeLensStmt(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    if (isIdx < 0) return [new Token('KEYWORD', 'lens', lineNum)];
    const name       = words.slice(1, isIdx).join(' ');
    const expression = words.slice(isIdx + 1).join(' ');
    return [new Token('LENS_STMT', { name, expression }, lineNum)];
  }

  // expand cloud NAME / expand on birth/death/shift/EVENT — async modifier
  _tokenizeExpandStmt(words, lineNum) {
    const target = words[1];
    if (target === 'cloud') {
      const name = words.slice(2).join(' ');
      return [new Token('CLOUD_STMT', { name, isAsync: true }, lineNum)];
    }
    if (target === 'on') {
      return this._tokenizeOnStmt(words.slice(1), lineNum, true);
    }
    return [new Token('KEYWORD', 'expand', lineNum)];
  }

  // cloud NAME — UI component block header
  _tokenizeCloudStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('CLOUD_STMT', { name, isAsync: false }, lineNum)];
  }

  // reflect EXPRESSION — render output of a cloud
  _tokenizeReflectStmt(words, lineNum) {
    const expression = words.slice(1).join(' ');
    return [new Token('REFLECT_STMT', { expression }, lineNum)];
  }

  // node TYPE [TEXT] — HTML element
  _tokenizeNodeStmt(words, lineNum) {
    const type = words[1] || 'div';
    const text = words.slice(2).join(' ');
    return [new Token('NODE_STMT', { type, text }, lineNum)];
  }

  // atmosphere NAME — style block header
  _tokenizeAtmosphereStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('ATMOSPHERE_STMT', { name }, lineNum)];
  }

  // style KEY is VALUE — inside atmosphere block
  _tokenizeStyleProp(words, lineNum) {
    const isIdx = this._indexOf(words, 'is');
    const key   = isIdx > 0 ? words.slice(1, isIdx).join('') : words[1] || '';
    const value = isIdx > 0 ? words.slice(isIdx + 1).join(' ') : words.slice(2).join(' ');
    return [new Token('STYLE_PROP', { key, value }, lineNum)];
  }

  // earth METHOD PATH [with BODY] into NAME — HTTP request
  _tokenizeEarthStmt(words, lineNum) {
    const method  = words[1] || 'get';
    const withIdx = this._indexOf(words, 'with');
    const intoIdx = this._indexOf(words, 'into');
    if (intoIdx < 0) return [new Token('KEYWORD', 'earth', lineNum)];
    const pathEnd  = withIdx > 0 && withIdx < intoIdx ? withIdx : intoIdx;
    const path     = words.slice(2, pathEnd).join(' ');
    const bodyName = withIdx > 0 && withIdx < intoIdx ? words.slice(withIdx + 1, intoIdx).join(' ') : '';
    const intoName = words.slice(intoIdx + 1).join(' ');
    return [new Token('EARTH_STMT', { method, path, bodyName, intoName }, lineNum)];
  }

  // travel PATH — navigate to route
  _tokenizeTravelStmt(words, lineNum) {
    const path = words.slice(1).join(' ');
    return [new Token('TRAVEL_STMT', { path }, lineNum)];
  }

  // route NAME PATH as CLOUD — inside map block
  _tokenizeRouteLine(words, lineNum) {
    const asIdx = this._indexOf(words, 'as');
    if (asIdx < 0) return [new Token('KEYWORD', 'route', lineNum)];
    const name      = words[1];
    const cloudName = words.slice(asIdx + 1).join(' ');
    const path      = words.slice(2, asIdx).join(' ');
    return [new Token('ROUTE_LINE', { name, path, cloudName }, lineNum)];
  }

  // v2.12 tokenizer methods

  _tokenizeGuardStmt(words, lineNum) {
    const elseIdx = this._indexOf(words, 'else');
    const condition = words.slice(1, elseIdx >= 0 ? elseIdx : words.length).join(' ');
    let fallback = null;
    if (elseIdx >= 0) {
      const rest = words.slice(elseIdx + 1);
      fallback = rest[0] === 'reflect' ? rest.slice(1).join(' ') : rest.join(' ');
    }
    return [new Token('GUARD_STMT', { condition, fallback }, lineNum)];
  }

  _tokenizeMatchStmt(words, lineNum) {
    const subject = words.slice(1).join(' ');
    return [new Token('MATCH_STMT', { subject }, lineNum)];
  }

  _tokenizeArmStmt(words, lineNum) {
    const pattern = words.slice(1).join(' ') || 'else';
    return [new Token('ARM_STMT', { pattern }, lineNum)];
  }

  _tokenizeObserveStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('OBSERVE_STMT', { name }, lineNum)];
  }

  _tokenizeEveryStmt(words, lineNum) {
    const interval = words[1] || '1000';
    const intoIdx  = this._indexOf(words, 'into');
    const cloudName = words.slice(2, intoIdx >= 0 ? intoIdx : words.length).join(' ');
    const intoName  = intoIdx >= 0 ? words.slice(intoIdx + 1).join(' ') : null;
    return [new Token('EVERY_STMT', { interval, cloudName, intoName }, lineNum)];
  }

  _tokenizeClearStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('CLEAR_STMT', { name }, lineNum)];
  }

  _tokenizeOnStmt(words, lineNum, isAsync) {
    const phase = words[1];
    if (phase === 'birth' || phase === 'death' || phase === 'shift') {
      return [new Token('ON_LIFECYCLE_STMT', { phase, isAsync: !!isAsync }, lineNum)];
    }
    const event = words.slice(1).join(' ');
    return [new Token('ON_EVENT_STMT', { event, isAsync: !!isAsync }, lineNum)];
  }

  _tokenizeOffStmt(words, lineNum) {
    const event = words.slice(1).join(' ');
    return [new Token('OFF_STMT', { event }, lineNum)];
  }

  _tokenizeTriggerStmt(words, lineNum) {
    const withIdx = this._indexOf(words, 'with');
    const event   = words.slice(1, withIdx >= 0 ? withIdx : words.length).join(' ');
    const payload  = withIdx >= 0 ? words.slice(withIdx + 1).join(' ') : null;
    return [new Token('TRIGGER_STMT', { event, payload }, lineNum)];
  }

  _tokenizeEmitStmt(words, lineNum) {
    const second = words[1];
    if (second === 'default') return [new Token('EMIT_STMT', { kind: 'default', name: words.slice(2).join(' ') }, lineNum)];
    if (second === 'cloud')   return [new Token('EMIT_STMT', { kind: 'cloud',   name: words.slice(2).join(' ') }, lineNum)];
    if (second === 'star')    return [new Token('EMIT_STMT', { kind: 'star',    name: words.slice(2).join(' ') }, lineNum)];
    return [new Token('EMIT_STMT', { kind: 'value', name: words.slice(1).join(' ') }, lineNum)];
  }

  _tokenizePullStmt(words, lineNum) {
    const fromIdx = this._indexOf(words, 'from');
    const path    = fromIdx >= 0 ? words.slice(fromIdx + 1).join(' ') : null;
    const namesPart = words.slice(1, fromIdx >= 0 ? fromIdx : words.length);
    const names   = namesPart.join(' ').split(/\s+and\s+/).map(s => s.trim()).filter(Boolean);
    return [new Token('PULL_STMT', { names, path }, lineNum)];
  }

  _tokenizeRaindropStmt(words, lineNum) {
    const rdType = words[1] || 'text';
    const name   = words.slice(2).join(' ');
    return [new Token('RAINDROP_STMT', { rdType, name }, lineNum)];
  }

  _tokenizeGroundStmt(words, lineNum) {
    const op = words[1] || 'get';
    // `ground NAME at "file.db"` — open a SQLite-backed ground. Distinguished
    // from set/get/remove by the second word not being one of those ops.
    if (op !== 'set' && op !== 'get' && op !== 'remove') {
      const m = words.join(' ').match(/^ground\s+(.+?)\s+at\s+"([^"]*)"\s*$/);
      if (m) {
        return [new Token('GROUND_STMT',
          { op: 'open', name: m[1].trim(), path: m[2], key: null, value: null, intoName: null },
          lineNum)];
      }
    }
    if (op === 'set') {
      const isIdx = this._indexOf(words, 'is');
      const key   = words.slice(2, isIdx >= 0 ? isIdx : words.length).join(' ');
      const value = isIdx >= 0 ? words.slice(isIdx + 1).join(' ') : null;
      return [new Token('GROUND_STMT', { op, key, value, intoName: null }, lineNum)];
    }
    if (op === 'get') {
      const intoIdx = this._indexOf(words, 'into');
      const key     = words.slice(2, intoIdx >= 0 ? intoIdx : words.length).join(' ');
      const intoName = intoIdx >= 0 ? words.slice(intoIdx + 1).join(' ') : null;
      return [new Token('GROUND_STMT', { op, key, value: null, intoName }, lineNum)];
    }
    // remove
    const key = words.slice(2).join(' ');
    return [new Token('GROUND_STMT', { op, key, value: null, intoName: null }, lineNum)];
  }

  // `draw "<sql>" from <ground> into <result>` — query a SQLite-backed ground.
  // The SQL is double-quoted EventMath data (its own commas/`from` live inside
  // the quotes); SQL string literals use single quotes, so a quote-aware match
  // on the rejoined line finds the real `from`/`into` keywords.
  _tokenizeDrawStmt(words, lineNum) {
    const line = words.join(' ');
    const m = line.match(/^draw\s+"([^"]*)"\s+from\s+(.+?)\s+into\s+(.+?)\s*$/);
    if (!m) {
      return [new Token('ERROR',
        { message: 'draw needs: draw "<sql>" from <ground> into <result>' }, lineNum)];
    }
    return [new Token('DRAW_STMT',
      { sql: m[1], from: m[2].trim(), into: m[3].trim() }, lineNum)];
  }

  _tokenizeNewStmt(words, lineNum) {
    const schema  = words[1] || 'Object';
    const intoIdx = this._indexOf(words, 'into');
    const intoName = intoIdx >= 0 ? words.slice(intoIdx + 1).join(' ') : null;
    return [new Token('NEW_STMT', { schema, intoName }, lineNum)];
  }

  // input NAME — parameter declaration (used in door open blocks)
  _tokenizeInputStmt(words, lineNum) {
    const name = words.slice(1).join(' ');
    return [new Token('INPUT_STMT', { name }, lineNum)];
  }

  _tokenizeAwaitStmt(words, lineNum) {
    const intoIdx   = this._indexOf(words, 'into');
    const expression = words.slice(1, intoIdx >= 0 ? intoIdx : words.length).join(' ');
    const intoName  = intoIdx >= 0 ? words.slice(intoIdx + 1).join(' ') : null;
    return [new Token('AWAIT_STMT', { expression, intoName }, lineNum)];
  }

  _tokenizeSlotStmt(words, lineNum) {
    const name = words.slice(1).join(' ') || 'children';
    return [new Token('SLOT_STMT', { name }, lineNum)];
  }

  _tokenizeBurstStmt(words, lineNum) {
    const intoIdx = this._indexOf(words, 'into');
    const intoName = intoIdx >= 0 ? words.slice(intoIdx + 1).join(' ') : null;
    const sourcesPart = words.slice(1, intoIdx >= 0 ? intoIdx : words.length);
    const sources = sourcesPart.join(' ').split(/\s+and\s+/).map(s => s.trim()).filter(Boolean);
    return [new Token('BURST_STMT', { sources, intoName }, lineNum)];
  }

  // ── v2.14 collection intelligence ────────────────────────────────────

  // filter <itemName> from <collName> where <condition> into <resultName>
  _tokenizeFilterStmt(words, lineNum) {
    const fromIdx  = this._indexOf(words, 'from');
    const whereIdx = this._indexOf(words, 'where');
    const intoIdx  = this._indexOf(words, 'into');
    if (fromIdx < 0 || whereIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'filter', lineNum)];
    }
    const itemName   = words.slice(1, fromIdx).join(' ');
    const collName   = words.slice(fromIdx + 1, whereIdx).join(' ');
    const condition  = words.slice(whereIdx + 1, intoIdx).join(' ');
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('FILTER_STMT', { itemName, collName, condition, resultName }, lineNum)];
  }

  // find <itemName> in <collName> where <condition> into <resultName>
  _tokenizeFindStmt(words, lineNum) {
    const inIdx    = this._indexOf(words, 'in');
    const whereIdx = this._indexOf(words, 'where');
    const intoIdx  = this._indexOf(words, 'into');
    if (inIdx < 0 || whereIdx < 0 || intoIdx < 0) {
      return [new Token('KEYWORD', 'find', lineNum)];
    }
    const itemName   = words.slice(1, inIdx).join(' ');
    const collName   = words.slice(inIdx + 1, whereIdx).join(' ');
    const condition  = words.slice(whereIdx + 1, intoIdx).join(' ');
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('FIND_STMT', { itemName, collName, condition, resultName }, lineNum)];
  }

  // sort <collName> by <field> [descending] into <resultName>
  _tokenizeSortStmt(words, lineNum) {
    const byIdx   = this._indexOf(words, 'by');
    const intoIdx = this._indexOf(words, 'into');
    if (byIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'sort', lineNum)];
    const collName   = words.slice(1, byIdx).join(' ');
    const midWords   = words.slice(byIdx + 1, intoIdx);
    const descIdx    = midWords.map(w => w.toLowerCase()).indexOf('descending');
    const descending = descIdx >= 0;
    const fieldWords = descending ? midWords.slice(0, descIdx) : midWords;
    const field      = fieldWords.join(' ');
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('SORT_STMT', { collName, field, descending, resultName }, lineNum)];
  }

  // count <collName> into <resultName>
  // count <itemName> in <collName> where <condition> into <resultName>
  _tokenizeCountStmt(words, lineNum) {
    const intoIdx  = this._indexOf(words, 'into');
    if (intoIdx < 0) return [new Token('KEYWORD', 'count', lineNum)];
    const inIdx    = this._indexOf(words, 'in');
    const whereIdx = this._indexOf(words, 'where');
    if (inIdx >= 0 && whereIdx >= 0 && inIdx < whereIdx) {
      const itemName   = words.slice(1, inIdx).join(' ');
      const collName   = words.slice(inIdx + 1, whereIdx).join(' ');
      const condition  = words.slice(whereIdx + 1, intoIdx).join(' ');
      const resultName = words.slice(intoIdx + 1).join(' ');
      return [new Token('COUNT_STMT', { itemName, collName, condition, resultName }, lineNum)];
    }
    const collName   = words.slice(1, intoIdx).join(' ');
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('COUNT_STMT', { collName, resultName }, lineNum)];
  }

  // pipe <sourceName> through <fn1> and <fn2> ... into <resultName>
  _tokenizePipeStmt(words, lineNum) {
    const throughIdx = this._indexOf(words, 'through');
    const intoIdx    = this._indexOf(words, 'into');
    if (throughIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'pipe', lineNum)];
    const sourceName = words.slice(1, throughIdx).join(' ');
    const midPart    = words.slice(throughIdx + 1, intoIdx).join(' ');
    const transforms = midPart.split(/\s+and\s+/).map(s => s.trim()).filter(Boolean);
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('PIPE_STMT', { sourceName, transforms, resultName }, lineNum)];
  }

  // cast <sourceName> as <type> into <resultName>
  _tokenizeCastStmt(words, lineNum) {
    const asIdx   = this._indexOf(words, 'as');
    const intoIdx = this._indexOf(words, 'into');
    if (asIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'cast', lineNum)];
    const sourceName = words.slice(1, asIdx).join(' ');
    const targetType = words.slice(asIdx + 1, intoIdx).join(' ');
    const resultName = words.slice(intoIdx + 1).join(' ');
    return [new Token('CAST_STMT', { sourceName, targetType, resultName }, lineNum)];
  }

  // log <value>
  // log "message" with <value>
  _tokenizeLogStmt(words, lineNum) {
    const withIdx = this._indexOf(words, 'with');
    if (withIdx >= 0) {
      const message   = words.slice(1, withIdx).join(' ');
      const withValue = words.slice(withIdx + 1).join(' ');
      return [new Token('LOG_STMT', { message, withValue, line: lineNum }, lineNum)];
    }
    const value = words.slice(1).join(' ');
    return [new Token('LOG_STMT', { value, line: lineNum }, lineNum)];
  }

  // v2.13: live rain <name> is <expr>  →  reactive signal
  _tokenizeLiveStmt(words, lineNum) {
    const inner = words[1] ? words[1].toLowerCase() : null;
    if (inner === 'rain') {
      const rest = words.slice(2); // <name> is <value>
      const isIdx = this._indexOf(rest, 'is');
      const name  = isIdx > 0 ? rest.slice(0, isIdx).join(' ') : rest.join(' ');
      const value = isIdx >= 0 ? rest.slice(isIdx + 1).join(' ') : '';
      return [new Token('RAIN_STMT', { name, value, live: true }, lineNum)];
    }
    // Unsupported live sub-statement — treat as no-op comment token
    return [new Token('KEYWORD', 'live', lineNum)];
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
