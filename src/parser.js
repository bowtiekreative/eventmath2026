/**
 * EventMath Parser v0.4
 *
 * Consumes tokens from the EventMathTokenizer and builds an AST.
 * Stack-based block tracking until "end" (Law 4).
 * All while loops have safety limits to prevent hangs.
 *
 * v0.4 additions:
 *  - _parseMark() detects arithmetic expr (NAME|NUMBER op NAME|NUMBER)
 *  - _parseSet() detects arithmetic expr
 *  - _parseBrokenEvent() for broken event statement
 */

const { Token } = require('./tokenizer.js');

const MAX_ITERATIONS = 10000;

function ast(type, props = {}) {
  return { type, ...props };
}

class EventMathParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
    this._iters = 0;
  }

  _checkIter() {
    if (++this._iters > MAX_ITERATIONS) {
      throw new Error(`Parser exceeded ${MAX_ITERATIONS} iterations — possible infinite loop. Last token: ${JSON.stringify(this.peek())}`);
    }
  }

  peek() { return this.tokens[this.pos] || null; }

  advance() {
    this._checkIter();
    const t = this.tokens[this.pos];
    if (t) this.pos++;
    return t;
  }

  expect(type, value) {
    const t = this.peek();
    if (!t) {
      this.errors.push(`I was expecting ${value || type} but the program ended unexpectedly.`);
      return null;
    }
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      this.errors.push(`Line ${t.line}: I was expecting "${value || type}" but found "${t.value}".`);
      return null;
    }
    return this.advance();
  }

  match(type, value) {
    const t = this.peek();
    if (t && t.type === type && (value === undefined || t.value === value)) {
      return this.advance();
    }
    return null;
  }

  isKeyword(kw) {
    const t = this.peek();
    return t && t.type === 'KEYWORD' && t.value === kw;
  }

  parse() {
    this._iters = 0;
    const statements = [];
    while (this.peek()) {
      this._checkIter();
      const stmt = this._parseStatement();
      if (stmt) {
        statements.push(stmt);
      } else {
        // Unknown token — skip and continue rather than infinite loop
        const t = this.advance();
        if (t) {
          this.errors.push(`Line ${t.line}: I don't know what to do with "${t.value}".`);
        }
      }
    }
    return ast('Program', { statements, errors: this.errors.length > 0 ? this.errors : undefined });
  }

  _parseStatement() {
    const t = this.peek();
    if (!t) return null;

    if (t.type === 'KEYWORD' && t.value === 'end') return null;

    // Handle ZOOM_* and torus tokens (non-KEYWORD types)
    if (t.type === 'ZOOM_IN')       return this._parseZoomIn();
    if (t.type === 'ZOOM_OUT')      return this._parseZoomOut();
    if (t.type === 'ZOOM_OPPOSITE') return this._parseZoomOpposite();
    if (t.type === 'ZOOM_META')     return this._parseZoomMeta();
    if (t.type === 'SPIN_STMT')     return this._parseSpinStmt();
    if (t.type === 'VIBRATE_STMT')  return this._parseVibrateStmt();
    if (t.type === 'CYCLE_STMT')    return this._parseCycleStmt();
    if (t.type === 'RESONATE_STMT') return this._parseResonateStmt();
    if (t.type === 'WEIGHT_STMT')   return this._parseWeightStmt();
    if (t.type === 'EXPLAIN_STMT')  return this._parseExplainStmt();
    if (t.type === 'ANALOGY_STMT')   return this._parseAnalogyStmt();
    if (t.type === 'BOUND_STMT')    return this._parseBoundStmt();
    if (t.type === 'LANDSCAPE_STMT')        return this._parseLandscapeStmt();
    if (t.type === 'FORECAST_STMT')         return this._parseForecastStmt();
    if (t.type === 'ASYMMETRY_STMT')        return this._parseAsymmetryStmt();
    if (t.type === 'ROOT_OF_STMT')          return this._parseRootOfStmt();
    if (t.type === 'INVERT_STMT')           return this._parseInvertStmt();
    if (t.type === 'ASSUME_STMT')           return this._parseAssumeStmt();
    if (t.type === 'DETECT_FALLACIES_STMT') return this._parseDetectFallaciesStmt();
    if (t.type === 'FRACTAL_STMT')          return this._parseFractalStmt();
    if (t.type === 'SPINE_STMT')            return this._parseSpineStmt();
    if (t.type === 'ANCHOR_STMT')           return this._parseAnchorStmt();
    if (t.type === 'SATISFY_STMT')          return this._parseSatisfyStmt();
    if (t.type === 'EVALUATE_STMT')         return this._parseEvaluateStmt();
    if (t.type === 'DIMENSIONAL_STMT')      return this._parseDimensionalStmt();
    if (t.type === 'GRADE_STMT')            return this._parseGradeStmt();
    if (t.type === 'WHY_STMT')              return this._parseWhyStmt();
    if (t.type === 'CHALLENGE_STMT')        return this._parseChallengeStmt();
    if (t.type === 'COMPARE_STMT')          return this._parseCompareStmt();
    if (t.type === 'CONFLICT_STMT')         return this._parseConflictStmt();
    if (t.type === 'WEIGH_STMT')            return this._parseWeighStmt();
    if (t.type === 'DEEPEN_STMT')           return this._parseDeepenStmt();
    if (t.type === 'EXTEND_STMT')           return this._parseExtendStmt();
    if (t.type === 'TRACE_STMT')            return this._parseTraceStmt();
    if (t.type === 'SCRUB_STMT')            return this._parseScrubStmt();
    // v2.11
    if (t.type === 'RAIN_STMT')             return this._parseRainStmt();
    if (t.type === 'STAR_STMT')             return this._parseStarStmt();
    if (t.type === 'ZONE_STMT')             return this._parseZoneStmt();
    if (t.type === 'SKY_STMT')              return this._parseSkyStmt();
    if (t.type === 'UNIVERSE_STMT')         return this._parseUniverseStmt();
    if (t.type === 'ORBIT_STMT')            return this._parseOrbitStmt();
    if (t.type === 'LENS_STMT')             return this._parseLensStmt();
    if (t.type === 'CLOUD_STMT')            return this._parseCloudStmt();
    if (t.type === 'REFLECT_STMT')          return this._parseReflectStmt();
    if (t.type === 'NODE_STMT')             return this._parseNodeStmt();
    if (t.type === 'ATMOSPHERE_STMT')       return this._parseAtmosphereStmt();
    if (t.type === 'EARTH_STMT')            return this._parseEarthStmt();
    if (t.type === 'TRAVEL_STMT')           return this._parseTravelStmt();
    if (t.value === 'attempt')              return this._parseAttemptStmt();
    if (t.value === 'map')                  return this._parseMapStmt();
    // v2.12
    if (t.type === 'GUARD_STMT')         return this._parseGuardStmt();
    if (t.type === 'MATCH_STMT')         return this._parseMatchStmt();
    if (t.type === 'OBSERVE_STMT')       return this._parseObserveStmt();
    if (t.type === 'EVERY_STMT')         return this._parseEveryStmt();
    if (t.type === 'CLEAR_STMT')         return this._parseClearStmt();
    if (t.type === 'ON_LIFECYCLE_STMT')  return this._parseOnLifecycleStmt();
    if (t.type === 'ON_EVENT_STMT')      return this._parseOnEventStmt();
    if (t.type === 'OFF_STMT')           return this._parseOffStmt();
    if (t.type === 'TRIGGER_STMT')       return this._parseTriggerStmt();
    if (t.type === 'EMIT_STMT')          return this._parseEmitStmt();
    if (t.type === 'PULL_STMT')          return this._parsePullStmt();
    if (t.type === 'RAINDROP_STMT')      return this._parseRaindropStmt();
    if (t.type === 'GROUND_STMT')        return this._parseGroundStmt();
    if (t.type === 'DRAW_STMT')          return this._parseDrawStmt();
    if (t.type === 'SERVE_STMT')         return this._parseServeStmt();
    if (t.type === 'REPLY_STMT')         return this._parseReplyStmt();
    if (t.type === 'ASK_STMT')           return this._parseAskStmt();
    if (t.type === 'LIVE_DRAW_STMT')     return this._parseLiveDrawStmt();
    if (t.type === 'MANIFEST_STMT')      return this._parseManifestStmt();
    if (t.type === 'PATTERN_STMT')       return this._parsePatternStmt();
    if (t.type === 'SCAN_STMT')          return this._parseScanStmt();
    if (t.type === 'SEEK_STMT')          return this._parseSeekStmt();
    if (t.type === 'REPLACE_STMT')       return this._parseReplaceStmt();
    if (t.type === 'ZOOM_OUT_FROM')      return this._parseZoomOutFrom();
    if (t.type === 'ZOOM_EXPAND')        return this._parseZoomExpand();
    // v2.19 — security layer
    if (t.type === 'KEYWORD' && t.value === 'probe')     return this._parseProbeStmt();
    if (t.type === 'KEYWORD' && t.value === 'authorize') return this._parseAuthorizeStmt();
    if (t.type === 'KEYWORD' && t.value === 'threat')    return this._parseThreatStmt();
    if (t.type === 'KEYWORD' && t.value === 'harden')    return this._parseHardenStmt();
    if (t.type === 'KEYWORD' && t.value === 'discover')  return this._parseDiscoverStmt();
    if (t.type === 'KEYWORD' && t.value === 'intercept') return this._parseInterceptStmt();
    // v2.20 — story layer
    if (t.type === 'STORY_STMT')      return this._parseStoryStmt();
    if (t.type === 'NARRATIVE_STMT')  return this._parseNarrativeStmt();
    if (t.type === 'SCOPE_STMT')      return this._parseScopeStmt();
    if (t.type === 'SCENARIO_STMT')   return this._parseScenarioStmt();
    // v2.21 — intelligence layer
    if (t.type === 'KEYWORD' && t.value === 'emerge')  return this._parseEmergeStmt();
    if (t.type === 'KEYWORD' && t.value === 'wifi')    return this._parseWifiStmt();
    if (t.type === 'KEYWORD' && t.value === 'lookup')  return this._parseLookupStmt();
    if (t.type === 'KEYWORD' && t.value === 'watch')   return this._parseWatchStmt();
    if (t.type === 'NEW_STMT')           return this._parseNewStmt();
    if (t.type === 'AWAIT_STMT')         return this._parseAwaitStmt();
    if (t.type === 'SLOT_STMT')          return this._parseSlotStmt();
    if (t.type === 'BURST_STMT')         return this._parseBurstStmt();
    // v2.14 — collection intelligence
    if (t.type === 'FILTER_STMT')        return this._parseFilterStmt();
    if (t.type === 'FIND_STMT')          return this._parseFindStmt();
    if (t.type === 'SORT_STMT')          return this._parseSortStmt();
    if (t.type === 'COUNT_STMT')         return this._parseCountStmt();
    if (t.type === 'PIPE_STMT')          return this._parsePipeStmt();
    if (t.type === 'CAST_STMT')          return this._parseCastStmt();
    if (t.type === 'LOG_STMT')           return this._parseLogStmt();
    if (t.value === 'escape')            { this.advance(); return ast('EscapeStmt', {}); }
    if (t.value === 'skip')              { this.advance(); return ast('SkipStmt', {}); }
    if (t.value === 'door')              { return this._parseDoorClosed(); }

    switch (t.value) {
      case 'event':    return this._parseEvent();
      case 'layer':    return this._parseLayer();
      case 'timeline': return this._parseTimeline();
      case 'action':   return this._parseAction();
      case 'mark':     return this._parseMark();
      case 'set':      return this._parseSet();
      case 'run':      return this._parseRun();
      case 'show':     return this._parseShow();
      case 'when':     return this._parseWhen();
      case 'split':    return this._parseSplit();
      case 'again':    return this._parseAgain();
      case 'walk':     return this._parseWalk();
      case 'rewind':   return this._parseRewind();
      case 'forward':  return this._parseForward();
      case 'stop':     return this._parseStop();
      case 'add':      return this._parseAdd();
      case 'remove':   return this._parseRemove();
      case 'merge':    return this._parseMerge();
      case 'overlap':  return this._parseOverlap();
      case 'note':     return this._parseNote();
      case 'broken':   return this._parseBrokenEvent();
      case 'check':    return this._parseCheck();
      case 'use':      return this._parseUse();
      case 'sort':     return this._parseSortLayer();
      case 'filter':   return this._parseFilterLayer();
      case 'find':     return this._parseFindInLayer();
      case 'count':    return this._parseCountInLayer();
      case 'predict':  return this._parsePredictStmt();
      case 'resolve':  return this._parseResolveStmt();
      // v2.0
      case 'actor':    return this._parseActorBlock();
      case 'chain':    return this._parseChainBlock();
      case 'desire':   return this._parseEventLike('desire');
      case 'outcome':  return this._parseEventLike('outcome');
      case 'scenario': return this._parseEventLike('scenario');
      case 'fallacy':  return this._parseEventLike('fallacy');
      case 'dilemma':  return this._parseEventLike('dilemma');
      default:         return this._parseBodyName();
    }
  }

  // ── Event ────────────────────────────────────────────────────────

  _parseEvent() {
    this.expect('KEYWORD', 'event');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('event');

    const result = ast('Event', { name: nameToken.value, category: null, matter: null });

    if (this.isKeyword('category') || this.isKeyword('cat')) {
      this.advance();
      const catName = this.expect('NAME');
      if (catName) result.category = catName.value;
    }

    if (this.isKeyword('matter')) {
      this.advance(); // consume 'matter'
      result.matter = this._parseMatterBlock();
    }

    this.expect('KEYWORD', 'end');
    return result;
  }

  _parseMatterBlock() {
    const fields = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const t = this.peek();
      if (t.type === 'NAME') {
        const key = this.advance().value;
        const delim = this.peek();
        if (delim && delim.type === 'KEYWORD' && delim.value === 'is') {
          this.advance();
          const val = this.expect('LITERAL');
          fields.push({ key, kind: 'literal', value: val ? val.value : '' });
        } else if (delim && delim.type === 'KEYWORD' && delim.value === 'from') {
          this.advance();
          const ref = this.expect('NAME');
          fields.push({ key, kind: 'reference', value: ref ? ref.value : '' });
        } else {
          this.errors.push(`Line ${t.line}: After "${key}" I expected "is" (literal) or "from" (reference), not "${delim ? delim.value : 'nothing'}".`);
          this.advance();
        }
      } else if (t.type === 'KEYWORD' && (t.value === 'category' || t.value === 'cat')) {
        // Category inside matter? Skip
        this.advance();
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end'); // consume the end of matter block
    return ast('MatterBlock', { fields });
  }

  // ── Layer ────────────────────────────────────────────────────────

  _parseLayer() {
    this.expect('KEYWORD', 'layer');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('layer');

    const events = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const t = this.peek();
      if (t.type === 'NAME') {
        events.push({ name: this.advance().value });
      } else if (t.type === 'KEYWORD' && t.value === 'event') {
        // Inline event definition inside layer
        const evt = this._parseEvent();
        if (evt) events.push({ name: evt.name, event: evt });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('Layer', { name: nameToken.value, events });
  }

  // ── Timeline ─────────────────────────────────────────────────────

  _parseTimeline() {
    this.expect('KEYWORD', 'timeline');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('timeline');

    const result = ast('Timeline', { name: nameToken.value, past: null, present: null, future: null });

    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const t = this.peek();
      if (t.type === 'KEYWORD' && ['past', 'present', 'future'].includes(t.value)) {
        const section = this.advance().value;
        const layers = [];
        let g2 = 0;
        while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
          if (this.isKeyword('past') || this.isKeyword('present') || this.isKeyword('future')) break;
          const lt = this.peek();
          if (lt && lt.type === 'NAME') {
            layers.push({ name: this.advance().value });
          } else if (lt && lt.type === 'KEYWORD' && lt.value !== 'end') {
            this.advance();
          } else {
            break;
          }
        }
        this.expect('KEYWORD', 'end');
        result[section] = ast('TimelineSection', { name: section, layers });
      } else if (t.type === 'NAME') {
        if (!result.present) result.present = ast('TimelineSection', { name: 'present', layers: [] });
        result.present.layers.push({ name: this.advance().value });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return result;
  }

  // ── Action ───────────────────────────────────────────────────────

  _parseAction() {
    this.expect('KEYWORD', 'action');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('action');

    const result = ast('Action', { name: nameToken.value, doorOpen: null, body: [], doorClosed: null });

    // Door open — parameters
    if (this.isKeyword('door')) {
      this.advance();
      if (this.isKeyword('open')) {
        this.advance();
        const inputs = [];
        // Parameters are lines of "input NAME" — consume INPUT_STMT tokens
        while (this.peek() && this.peek().type === 'INPUT_STMT') {
          const inputStmt = this.advance().value;
          if (inputStmt && inputStmt.name) inputs.push(inputStmt.name);
        }
        // Also support bare NAME tokens for backward compat
        while (this.peek() && this.peek().type === 'NAME') {
          const first = this.advance().value;
          if (first === 'input') {
            const nameTok = this.match('NAME');
            if (nameTok) inputs.push(nameTok.value);
          } else {
            inputs.push(first);
          }
        }
        result.doorOpen = ast('DoorOpen', { inputs });
      }
    }

    // Body: statements until "door closed" or "end"
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (!stmt) break;
      if (stmt.type === 'DoorClosed') {
        result.doorClosed = stmt;
        break;
      }
      result.body.push(stmt);
    }

    this.expect('KEYWORD', 'end');
    return result;
  }

  // ── Door Closed (early return) ───────────────────────────────────

  _parseDoorClosed() {
    this.expect('KEYWORD', 'door');
    if (this.isKeyword('open')) {
      // door open in body context is not allowed
      this.advance();
      const t = this.peek();
      const name = t && t.type === 'NAME' ? this.advance().value : '';
      this.errors.push(`Line ${t ? t.line : '?'}: 'door open' is only allowed as the first statement of an action. Use 'door closed' for return.`);
      return ast('DoorClosed', { returns: name });
    }
    if (this.isKeyword('closed')) {
      this.advance();
      const returnName = this.match('NAME');
      return ast('DoorClosed', { returns: returnName ? returnName.value : null });
    }
    // bare 'door' keyword — skip it
    const t = this.peek();
    return null;
  }

  // ── Mark & Set ───────────────────────────────────────────────────

  /**
   * _parseExprOrValue: After consuming the keyword (as/to), peek at the
   * token stream and detect string ops, arithmetic, including chained operations.
   * Returns { expr: node }, { stringOp, ... }, or { value } object for the AST node.
   */
  _parseExprOrValue() {
    const firstTok = this.peek();
    if (!firstTok) return { value: '' };

    const ARITH_OPS = new Set(['plus', 'minus', 'times', 'divided by', 'take away']);

    // Handle BUILTIN token — emitted by _findBuiltinOp in tokenizer
    if (firstTok.type === 'BUILTIN') {
      this.advance();
      return { builtinExpr: firstTok.value };
    }

    // Handle 'length of' — emitted as KEYWORD before the NAME
    if (firstTok.type === 'KEYWORD' && firstTok.value === 'length of') {
      this.advance(); // consume 'length of'
      const subject = this.peek();
      if (subject) this.advance();
      return { stringOp: 'length of', subject: { kind: 'name', value: subject ? subject.value : '' } };
    }

    // Check if next token (after current) is an arithmetic operator
    const isArith = () => {
      const t = this.peek();
      return t && t.type === 'KEYWORD' && ARITH_OPS.has(t.value);
    };

    // Parse one operand
    const parseOperand = () => {
      const t = this.peek();
      if (!t) return null;
      if (t.type === 'NUMBER') { this.advance(); return { kind: 'number', value: t.value }; }
      if (t.type === 'BOOL')   { this.advance(); return { kind: 'bool',   value: t.value }; }
      if (t.type === 'NAME')   { this.advance(); return { kind: 'name',   value: t.value }; }
      if (t.type === 'LITERAL'){ this.advance(); return { kind: 'literal',value: t.value }; }
      return null;
    };

    const firstOp = parseOperand();
    if (!firstOp) return { value: '' };

    // After parsing the first token, check for string operators
    const t = this.peek();
    if (t && t.type === 'KEYWORD') {
      if (t.value === 'joined with') {
        this.advance();
        const right = this.peek();
        if (right) this.advance();
        return { stringOp: 'joined with', left: firstOp, right: { kind: 'name', value: right ? right.value : '' } };
      }
      if (t.value === 'in uppercase') {
        this.advance();
        return { stringOp: 'in uppercase', subject: firstOp };
      }
      if (t.value === 'in lowercase') {
        this.advance();
        return { stringOp: 'in lowercase', subject: firstOp };
      }
    }

    if (!isArith()) {
      // No arithmetic — return as plain value
      if (firstOp.kind === 'number') return { value: firstOp.value };
      if (firstOp.kind === 'bool')   return { value: firstOp.value };
      return { value: firstOp.value };
    }

    // Build left-associative expression tree
    let node = firstOp;
    while (isArith()) {
      const op = this.advance().value; // consume operator keyword
      const right = parseOperand();
      if (!right) break;
      node = { kind: 'expr', left: node, op, right };
    }
    return { expr: node };
  }

  _parseMark() {
    this.expect('KEYWORD', 'mark');
    const nameToken = this.expect('NAME');
    if (!nameToken) return null;
    this.expect('KEYWORD', 'as');

    const parsed = this._parseExprOrValue();
    if (parsed.builtinExpr !== undefined) {
      return ast('Mark', { name: nameToken.value, value: null, expr: null, builtinExpr: parsed.builtinExpr });
    }
    if (parsed.stringOp !== undefined) {
      return ast('Mark', { name: nameToken.value, value: null, expr: null, stringOp: parsed.stringOp, left: parsed.left, right: parsed.right, subject: parsed.subject });
    }
    if (parsed.expr !== undefined) {
      return ast('Mark', { name: nameToken.value, value: null, expr: parsed.expr });
    }
    // value is a plain scalar string
    const valStr = parsed.value !== undefined ? String(parsed.value) : '';
    return ast('Mark', { name: nameToken.value, value: valStr });
  }

  _parseSet() {
    this.expect('KEYWORD', 'set');
    const nameToken = this.expect('NAME');
    if (!nameToken) return null;
    this.expect('KEYWORD', 'to');

    const parsed = this._parseExprOrValue();
    if (parsed.builtinExpr !== undefined) {
      return ast('Set', { name: nameToken.value, value: null, expr: null, builtinExpr: parsed.builtinExpr });
    }
    if (parsed.stringOp !== undefined) {
      return ast('Set', { name: nameToken.value, value: null, expr: null, stringOp: parsed.stringOp, left: parsed.left, right: parsed.right, subject: parsed.subject });
    }
    if (parsed.expr !== undefined) {
      return ast('Set', { name: nameToken.value, value: null, expr: parsed.expr });
    }
    // Wrap scalar in a value object for _typedValue compatibility
    const raw = parsed.value !== undefined ? String(parsed.value) : '';
    return ast('Set', { name: nameToken.value, value: { kind: 'literal', value: raw } });
  }

  // ── Run ──────────────────────────────────────────────────────────

  _parseRun() {
    this.expect('KEYWORD', 'run');
    const t = this.peek();
    return ast('Run', { target: t && t.type === 'NAME' ? this.advance().value : null });
  }

  _parseShow() {
    this.expect('KEYWORD', 'show');
    const t = this.peek();
    return ast('Show', { target: t && t.type === 'NAME' ? this.advance().value : null });
  }

  // ── Use statement ────────────────────────────────────────────────

  _parseUse() {
    this.expect('KEYWORD', 'use');
    // Consume name tokens until we hit KEYWORD('from')
    const nameWords = [];
    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'from')) {
      nameWords.push(this.advance().value);
    }
    const name = nameWords.join(' ');
    this.expect('KEYWORD', 'from');
    const fileTok = this.expect('LITERAL');
    return ast('Use', { name, from: fileTok ? fileTok.value : '' });
  }

  // ── Body name (action call, bare ref) ────────────────────────────

  _parseBodyName() {
    const t = this.peek();
    if (!t || t.type !== 'NAME') return null;
    const name = this.advance().value;

    if (this.isKeyword('with')) {
      this.advance();
      const args = [];
      let guard = 0;
      while (this.peek() && this.peek().type === 'NAME' && !this.isKeyword('end') && !this.isKeyword('otherwise') && !this.isKeyword('path') && guard++ < 1000) {
        const key = this.expect('NAME');
        if (!key) break;
        this.expect('KEYWORD', 'is');
        const val = this.expect('LITERAL');
        args.push({ key: key.value, value: val ? val.value : '' });
        this.match('KEYWORD', 'and');
      }
      return ast('ActionCall', { name, args });
    }

    return ast('NameRef', { name });
  }

  // ── When / Otherwise ────────────────────────────────────────────

  _parseWhen() {
    this.expect('KEYWORD', 'when');
    const condition = this._parseCondition();
    const body = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('otherwise') && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) body.push(stmt);
    }
    let otherwise = null;
    if (this.isKeyword('otherwise')) {
      this.advance();
      otherwise = [];
      let g2 = 0;
      while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
        const stmt = this._parseStatement();
        if (stmt) otherwise.push(stmt);
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('When', { condition, body, otherwise });
  }

  _parseCondition() {
    const first = this._parseSimpleCondition();
    if (!first) return null;

    // Check for 'and'/'or' connector
    if (this.peek() && this.peek().type === 'KEYWORD' &&
        (this.peek().value === 'and' || this.peek().value === 'or')) {
      const op = this.advance().value;
      const right = this._parseCondition(); // recursive for right-side chains
      return ast('CompoundCondition', { left: first, op, right });
    }

    return first;
  }

  _parseSimpleCondition() {
    const left = this.expect('NAME');
    if (!left) return null;
    this.expect('KEYWORD', 'is');

    // Check for multi-word operators
    const peek = this.peek();
    if (peek && peek.type === 'KEYWORD') {
      const kw = peek.value;
      if (kw === 'not') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is not', right: right ? right.value : '' });
      }
      if (kw === 'greater than') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is greater than', right: right ? right.value : '' });
      }
      if (kw === 'less than') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is less than', right: right ? right.value : '' });
      }
      if (kw === 'at least') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is at least', right: right ? right.value : '' });
      }
      if (kw === 'at most') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is at most', right: right ? right.value : '' });
      }
      if (kw === 'starts with') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is starts with', right: right ? right.value : '' });
      }
      if (kw === 'ends with') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is ends with', right: right ? right.value : '' });
      }
      if (kw === 'contains') {
        this.advance();
        const right = this.expect('NAME');
        return ast('Condition', { left: left.value, op: 'is contains', right: right ? right.value : '' });
      }
    }

    // Default: just NAME
    const right = this.expect('NAME');
    return ast('Condition', {
      left: left.value,
      op: 'is',
      right: right ? right.value : '',
    });
  }

  // ── Split ────────────────────────────────────────────────────────

  _parseSplit() {
    this.expect('KEYWORD', 'split');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('split');
    this.expect('KEYWORD', 'into');
    const paths = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      if (this.isKeyword('path')) {
        this.advance();
        const pathName = this.expect('NAME');
        const body = [];
        let g2 = 0;
        while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
          if (this.isKeyword('path')) break;
          const stmt = this._parseStatement();
          if (stmt) body.push(stmt);
        }
        this.expect('KEYWORD', 'end');
        paths.push(ast('Path', { name: pathName ? pathName.value : '', body }));
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('Split', { target: nameToken.value, paths });
  }

  // ── Again ────────────────────────────────────────────────────────

  _parseAgain() {
    this.expect('KEYWORD', 'again');
    const t = this.peek();
    if (!t) return this._skipBlock('again');

    let loop;
    if (t.type === 'NUMBER') {
      const count = this.advance().value;
      this.expect('KEYWORD', 'times');
      loop = ast('AgainCount', { count: parseInt(count), body: [] });
    } else if (t.type === 'KEYWORD' && t.value === 'until') {
      this.advance();
      const condition = this._parseCondition();
      loop = ast('AgainUntil', { condition, body: [] });
    } else {
      loop = ast('AgainUntil', { body: [] });
    }

    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) loop.body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return loop;
  }

  // ── Walk ─────────────────────────────────────────────────────────

  _parseWalk() {
    this.expect('KEYWORD', 'walk');
    const layerTok = this.expect('NAME');
    if (!layerTok) return this._skipBlock('walk');
    this.expect('KEYWORD', 'as');
    const varTok = this.expect('NAME');

    const result = ast('Walk', { layer: layerTok.value, variable: varTok ? varTok.value : '', body: [] });
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) result.body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return result;
  }

  // ── Time travel ──────────────────────────────────────────────────

  _parseRewind() {
    this.expect('KEYWORD', 'rewind');
    const target = this.expect('NAME');
    if (!target) return null;
    if (this.isKeyword('by')) { this.advance(); const c = this.expect('NUMBER'); return ast('Rewind', { target: target.value, mode: 'by', count: c ? parseInt(c.value) : 0 }); }
    if (this.isKeyword('to')) { this.advance(); const d = this.expect('NAME'); return ast('Rewind', { target: target.value, mode: 'to', destination: d ? d.value : '' }); }
    return ast('Rewind', { target: target.value, mode: 'by', count: 1 });
  }

  _parseForward() {
    this.expect('KEYWORD', 'forward');
    const target = this.expect('NAME');
    if (!target) return null;
    if (this.isKeyword('by')) { this.advance(); const c = this.expect('NUMBER'); return ast('Forward', { target: target.value, mode: 'by', count: c ? parseInt(c.value) : 0 }); }
    if (this.isKeyword('to')) { this.advance(); const d = this.expect('NAME'); return ast('Forward', { target: target.value, mode: 'to', destination: d ? d.value : '' }); }
    return ast('Forward', { target: target.value, mode: 'by', count: 1 });
  }

  _parseStop() { this.expect('KEYWORD', 'stop'); return ast('Stop'); }

  _parseAdd() {
    this.expect('KEYWORD', 'add');
    const kind = this.peek();
    if (!kind) return null;
    if (kind.type === 'KEYWORD' && (kind.value === 'event' || kind.value === 'layer')) {
      this.advance();
      const name = this.expect('NAME');
      const into = this.match('KEYWORD', 'into');
      const target = into ? this.expect('NAME') : null;
      if (kind.value === 'event') return ast('AddEvent', { eventName: name ? name.value : '', layerName: target ? target.value : null });
      return ast('AddLayer', { layerName: name ? name.value : '', toTimeline: target ? target.value : null });
    }
    return null;
  }

  _parseRemove() {
    this.expect('KEYWORD', 'remove');
    const kind = this.peek();
    if (!kind) return null;
    if (kind.type === 'KEYWORD' && (kind.value === 'layer' || kind.value === 'event')) {
      this.advance();
      const name = this.expect('NAME');
      return ast(kind.value === 'layer' ? 'RemoveLayer' : 'RemoveEvent', { name: name ? name.value : '' });
    }
    return null;
  }

  _parseMerge() {
    this.expect('KEYWORD', 'merge');
    const source = this.expect('NAME');
    this.expect('KEYWORD', 'into');
    const target = this.expect('NAME');
    return ast('Merge', { source: source ? source.value : '', target: target ? target.value : '' });
  }

  // ── Overlap ──────────────────────────────────────────────────────

  _parseOverlap() {
    this.expect('KEYWORD', 'overlap');
    const tracks = [];
    let current = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < MAX_ITERATIONS) {
      if (this.isKeyword('and')) {
        this.advance();
        tracks.push(current);
        current = [];
      } else {
        const stmt = this._parseStatement();
        if (stmt) current.push(stmt);
      }
    }
    tracks.push(current);
    this.expect('KEYWORD', 'end');
    return ast('Overlap', { tracks });
  }

  // ── Note ─────────────────────────────────────────────────────────

  _parseNote() {
    this.expect('KEYWORD', 'note');
    const textTok = this.expect('LITERAL');
    return ast('Note', { text: textTok ? textTok.value : '' });
  }

  // ── Broken Event ─────────────────────────────────────────────────

  _parseBrokenEvent() {
    this.expect('KEYWORD', 'broken');
    this.expect('KEYWORD', 'event');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('broken event');
    const result = ast('BrokenEvent', { name: nameToken.value, matter: null });
    if (this.isKeyword('matter')) {
      this.advance();
      result.matter = this._parseMatterBlock();
    }
    this.expect('KEYWORD', 'end');
    return result;
  }

  // ── Check ────────────────────────────────────────────────────────

  _parseCheck() {
    this.expect('KEYWORD', 'check');
    const condition = this._parseCondition();
    return ast('Check', { condition });
  }

  // ── Layer operations ─────────────────────────────────────────────

  _parseSortLayer() {
    this.expect('KEYWORD', 'sort');
    this.expect('KEYWORD', 'layer');
    const nameToken = this.expect('NAME');
    this.expect('KEYWORD', 'by');
    this.expect('KEYWORD', 'matter');
    const fieldToken = this.expect('NAME');
    const direction = this.match('KEYWORD', 'descending') ? 'descending' : 'ascending';
    return ast('SortLayer', {
      name: nameToken ? nameToken.value : '',
      field: fieldToken ? fieldToken.value : '',
      direction,
    });
  }

  _parseFilterLayer() {
    this.expect('KEYWORD', 'filter');
    this.expect('KEYWORD', 'layer');
    const nameToken = this.expect('NAME');
    this.expect('KEYWORD', 'where');
    const condToken = this.expect('NAME'); // raw condition string
    this.expect('KEYWORD', 'into');
    const intoToken = this.expect('NAME');
    return ast('FilterLayer', {
      name: nameToken ? nameToken.value : '',
      condition: condToken ? condToken.value : '',
      into: intoToken ? intoToken.value : '',
    });
  }

  _parseFindInLayer() {
    this.expect('KEYWORD', 'find');
    const nameToken = this.expect('NAME');
    this.expect('KEYWORD', 'where');
    const condToken = this.expect('NAME');
    this.expect('KEYWORD', 'into');
    const intoToken = this.expect('NAME');
    return ast('FindInLayer', {
      name: nameToken ? nameToken.value : '',
      condition: condToken ? condToken.value : '',
      into: intoToken ? intoToken.value : '',
    });
  }

  _parseCountInLayer() {
    this.expect('KEYWORD', 'count');
    const nameToken = this.expect('NAME');
    this.expect('KEYWORD', 'where');
    const condToken = this.expect('NAME');
    this.expect('KEYWORD', 'into');
    const intoToken = this.expect('NAME');
    return ast('CountInLayer', {
      name: nameToken ? nameToken.value : '',
      condition: condToken ? condToken.value : '',
      into: intoToken ? intoToken.value : '',
    });
  }

  // ── Predict / Resolve ────────────────────────────────────────────

  _parsePredictStmt() {
    this.expect('KEYWORD', 'predict');
    const subjectTok = this.expect('NAME');
    const subject = subjectTok ? subjectTok.value : '';

    this.expect('KEYWORD', 'across');

    // Collect N condition dimensions separated by 'and'
    const dimensions = [];
    const firstDim = this.expect('NAME');
    if (firstDim) dimensions.push(firstDim.value);

    while (this.peek() && this.peek().type === 'KEYWORD' && this.peek().value === 'and') {
      this.advance(); // consume 'and'
      const dimTok = this.expect('NAME');
      if (dimTok) dimensions.push(dimTok.value);
    }

    // Optional 'through FRACTAL' — routes all condition dimensions through the
    // fractal's three structural tiers (surface D±13, system D±26, root D±39).
    // Without this, predict produces a flat cartesian product.
    let fractalName = null;
    if (this.peek() && this.peek().type === 'KEYWORD' && this.peek().value === 'through') {
      this.advance(); // consume 'through'
      const fractalTok = this.expect('NAME');
      if (fractalTok) fractalName = fractalTok.value;
    }

    this.expect('KEYWORD', 'into');
    const intoTok = this.expect('NAME');

    return ast('PredictStmt', {
      subject,
      dimensions,
      fractalName,
      intoLayer: intoTok ? intoTok.value : '',
      // backward compat aliases
      directionsLayer: dimensions[0] || '',
      lensesLayer:     dimensions[1] || '',
      quantitiesLayer: dimensions[2] || '',
    });
  }

  _parseResolveStmt() {
    this.expect('KEYWORD', 'resolve');
    const layerTok = this.expect('NAME');
    this.expect('KEYWORD', 'where');
    const condition = this._parseCondition();
    this.expect('KEYWORD', 'as');
    const outcomeTok = this.expect('NAME');
    return ast('ResolveStmt', {
      layer: layerTok ? layerTok.value : '',
      condition,
      outcome: outcomeTok ? outcomeTok.value : 'correct',
    });
  }

  // ── Zoom In / Zoom Out ───────────────────────────────────────────

  _parseZoomIn() {
    const t = this.advance(); // consume ZOOM_IN token
    if (!t || !t.value) return null;
    const { fromType, fromName, toType, toName, intoName } = t.value;
    return ast('ZoomIn', { fromType, fromName, toType, toName, intoName });
  }

  _parseZoomOut() {
    const t = this.advance(); // consume ZOOM_OUT token
    if (!t || !t.value) return null;
    const { sourceType, sourceName, asName } = t.value;
    return ast('ZoomOut', { sourceType, sourceName, asName });
  }

  _parseZoomOpposite() {
    const t = this.advance(); // consume ZOOM_OPPOSITE token
    if (!t || !t.value) return null;
    const { sourceName, intoName } = t.value;
    return ast('ZoomOpposite', { sourceName, intoName });
  }

  _parseZoomMeta() {
    const t = this.advance(); // consume ZOOM_META token
    if (!t || !t.value) return null;
    const { subjects, intoName } = t.value;
    return ast('ZoomMeta', { subjects, intoName });
  }

  // ── Torus statements ─────────────────────────────────────────────

  _parseSpinStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('SpinStmt', {
      sourceName: t.value.sourceName,
      intoName:   t.value.intoName,
      dimension:  t.value.dimension || 2
    });
  }

  _parseVibrateStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('VibrateStmt', { torusName: t.value.torusName, rings: t.value.rings });
  }

  _parseCycleStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('CycleStmt', { torusName: t.value.torusName });
  }

  _parseResonateStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ResonateStmt', { firstName: t.value.firstName, secondName: t.value.secondName });
  }

  _parseWeightStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('WeightStmt', { targetName: t.value.targetName, value: t.value.value });
  }

  _parseExplainStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ExplainStmt', {
      observations: t.value.observations,
      candidates:   t.value.candidates,
      intoName:     t.value.intoName
    });
  }

  _parseAnalogyStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('AnalogyStmt', {
      firstName:  t.value.firstName,
      secondName: t.value.secondName,
      intoName:   t.value.intoName
    });
  }

  _parseBoundStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('BoundStmt', {
      firstName:  t.value.firstName,
      secondName: t.value.secondName,
      intoName:   t.value.intoName
    });
  }

  _parseLandscapeStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('LandscapeStmt', {
      sources:  t.value.sources,
      intoName: t.value.intoName
    });
  }

  _parseForecastStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ForecastStmt', {
      landscapeName: t.value.landscapeName,
      intoName:      t.value.intoName
    });
  }

  // ── v2.0 parse methods ──────────────────────────────────────────

  // actor block — same structure as event
  _parseActorBlock() {
    this.expect('KEYWORD', 'actor');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('actor');
    const result = ast('ActorStmt', { name: nameToken.value, category: null, matter: null });
    if (this.isKeyword('category') || this.isKeyword('cat')) {
      this.advance();
      const catName = this.expect('NAME');
      if (catName) result.category = catName.value;
    }
    if (this.isKeyword('matter')) {
      this.advance();
      result.matter = this._parseMatterBlock();
    }
    this.expect('KEYWORD', 'end');
    return result;
  }

  // chain block — collects leads-to links until 'end'
  _parseChainBlock() {
    this.expect('KEYWORD', 'chain');
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('chain');
    const links = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < MAX_ITERATIONS) {
      const t = this.peek();
      if (t && t.type === 'LEADS_TO_STMT') {
        const lt = this.advance();
        links.push({ from: lt.value.from, to: lt.value.to, value: lt.value.value });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('ChainStmt', { name: nameToken.value, links });
  }

  // generic event-like block for desire/outcome/scenario/fallacy/dilemma
  _parseEventLike(keyword) {
    this.expect('KEYWORD', keyword);
    const nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock(keyword);
    const result = ast('EventLikeStmt', { keyword, name: nameToken.value, category: null, matter: null });
    if (this.isKeyword('category') || this.isKeyword('cat')) {
      this.advance();
      const catName = this.expect('NAME');
      if (catName) result.category = catName.value;
    }
    if (this.isKeyword('matter')) {
      this.advance();
      result.matter = this._parseMatterBlock();
    }
    this.expect('KEYWORD', 'end');
    return result;
  }

  _parseAsymmetryStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('AsymmetryStmt', {
      firstName:  t.value.firstName,
      secondName: t.value.secondName,
      intoName:   t.value.intoName
    });
  }

  _parseRootOfStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('RootOfStmt', {
      stateName: t.value.stateName,
      chainName: t.value.chainName,
      intoName:  t.value.intoName
    });
  }

  _parseInvertStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('InvertStmt', { sourceName: t.value.sourceName, intoName: t.value.intoName });
  }

  _parseAssumeStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('AssumeStmt', { name: t.value.name, value: t.value.value, text: t.value.text });
  }

  _parseDetectFallaciesStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('DetectFallaciesStmt', { chainName: t.value.chainName, intoName: t.value.intoName });
  }

  _parseFractalStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('FractalStmt', {
      firstName:  t.value.firstName,
      secondName: t.value.secondName,
      intoName:   t.value.intoName
    });
  }

  _parseSatisfyStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('SatisfyStmt', {
      desireName: t.value.desireName,
      chainName:  t.value.chainName,
      intoName:   t.value.intoName
    });
  }

  _parseEvaluateStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('EvaluateStmt', {
      desireNames: t.value.desireNames,
      chainName:   t.value.chainName,
      intoName:    t.value.intoName
    });
  }

  _parseDimensionalStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('DimensionalStmt', {
      desireNames: t.value.desireNames,
      chainName:   t.value.chainName,
      fractalName: t.value.fractalName,
      intoName:    t.value.intoName
    });
  }

  _parseWhyStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('DiagnoseStmt', {
      desireName: t.value.desireName,
      chainName:  t.value.chainName,
      intoName:   t.value.intoName,
    });
  }

  _parseChallengeStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ChallengeStmt', {
      assumptionName: t.value.assumptionName,
      reportName:     t.value.reportName,
      intoName:       t.value.intoName,
    });
  }

  _parseCompareStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('CompareStmt', {
      chain1Name:  t.value.chain1,
      chain2Name:  t.value.chain2,
      desireName:  t.value.desireName,
      intoName:    t.value.intoName,
    });
  }

  _parseConflictStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ConflictStmt', {
      desire1Name: t.value.desire1,
      desire2Name: t.value.desire2,
      chainName:   t.value.chainName,
      intoName:    t.value.intoName,
    });
  }

  _parseWeighStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('WeighStmt', {
      conflictName: t.value.conflictName,
      intoName:     t.value.intoName,
    });
  }

  _parseDeepenStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('DeepenStmt', {
      axisName: t.value.axisName,
      negName:  t.value.negName,
      posName:  t.value.posName,
      intoName: t.value.intoName,
    });
  }

  _parseTraceStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('TraceStmt', {
      conflictName: t.value.conflictName,
      intoName:     t.value.intoName,
    });
  }

  // ── v2.10 video-editor vocabulary ────────────────────────────────

  _parseAnchorStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('AnchorStmt', { name: t.value.name, depth: t.value.depth });
  }

  _parseSpineStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('SpineStmt', {
      firstName:  t.value.firstName,
      secondName: t.value.secondName,
      intoName:   t.value.intoName,
    });
  }

  _parseGradeStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('GradeStmt', {
      desireName: t.value.desireName,
      chainName:  t.value.chainName,
      spineName:  t.value.spineName,
      intoName:   t.value.intoName,
    });
  }

  _parseExtendStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ExtendStmt', {
      spineName: t.value.spineName,
      negName:   t.value.negName,
      posName:   t.value.posName,
      intoName:  t.value.intoName,
    });
  }

  _parseScrubStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ScrubStmt', {
      conflictName: t.value.conflictName,
      intoName:     t.value.intoName,
    });
  }

  // ── v2.11 web layer parse methods ────────────────────────────────

  _parseRainStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('RainStmt', { name: t.value.name, value: t.value.value, live: !!t.value.live });
  }

  _parseStarStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('StarStmt', { name: t.value.name, value: t.value.value });
  }

  _parseZoneStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ZoneStmt', { name: t.value.name, expression: t.value.expression });
  }

  _parseSkyStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('SkyStmt', { name: t.value.name, expression: t.value.expression });
  }

  _parseUniverseStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    const name = t.value.name;
    const fields = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const ft = this.peek();
      if (ft.type === 'UNIVERSE_FIELD') {
        this.advance();
        fields.push({ name: ft.value.name, type: ft.value.type });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('UniverseStmt', { name, fields });
  }

  _parseOrbitStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    const { itemName, collectionName } = t.value;
    const body = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return ast('OrbitStmt', { itemName, collectionName, body });
  }

  _parseLensStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('LensStmt', { name: t.value.name, expression: t.value.expression });
  }

  _parseAttemptStmt() {
    this.advance(); // consume 'attempt'
    const _atStop = () => {
      const p = this.peek();
      if (!p) return true;
      if (p.type === 'COLLAPSE_MARKER') return true;
      if (p.type === 'KEYWORD' && (p.value === 'always' || p.value === 'end')) return true;
      return false;
    };
    const tryBody = [];
    let guard = 0;
    while (!_atStop() && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) tryBody.push(stmt);
    }
    let errName = '_err', catchBody = [], alwaysBody = [];
    if (this.peek() && this.peek().type === 'COLLAPSE_MARKER') {
      const ct = this.advance();
      errName = ct.value.errName;
      guard = 0;
      while (this.peek() && !this.isKeyword('end') && !this.isKeyword('always') && guard++ < 1000) {
        const stmt = this._parseStatement();
        if (stmt) catchBody.push(stmt);
      }
    }
    if (this.peek() && this.isKeyword('always')) {
      this.advance();
      guard = 0;
      while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
        const stmt = this._parseStatement();
        if (stmt) alwaysBody.push(stmt);
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('AttemptStmt', { tryBody, errName, catchBody, alwaysBody });
  }

  _parseCloudStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    const { name, isAsync } = t.value;
    const body = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return ast('CloudStmt', { name, isAsync: !!isAsync, body });
  }

  _parseReflectStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('ReflectStmt', { expression: t.value.expression });
  }

  _parseNodeStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('NodeStmt', { nodeType: t.value.type, text: t.value.text });
  }

  _parseAtmosphereStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    const name = t.value.name;
    const props = {};
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const pt = this.peek();
      if (pt.type === 'STYLE_PROP') {
        this.advance();
        props[pt.value.key] = pt.value.value;
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('AtmosphereStmt', { name, props });
  }

  _parseEarthStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('EarthStmt', {
      method:   t.value.method,
      path:     t.value.path,
      bodyName: t.value.bodyName,
      intoName: t.value.intoName,
    });
  }

  _parseTravelStmt() {
    const t = this.advance();
    if (!t || !t.value) return null;
    return ast('TravelStmt', { path: t.value.path });
  }

  _parseMapStmt() {
    this.advance(); // consume 'map'
    const routes = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const rt = this.peek();
      if (rt.type === 'ROUTE_LINE') {
        this.advance();
        routes.push({ name: rt.value.name, path: rt.value.path, cloudName: rt.value.cloudName });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('MapStmt', { routes });
  }

  // ── v2.12 parse methods ──────────────────────────────────────────

  _parseGuardStmt() {
    const t = this.advance();
    return ast('GuardStmt', { condition: t.value.condition, fallback: t.value.fallback });
  }

  _parseMatchStmt() {
    const t = this.advance(); // MATCH_STMT
    const subject = t.value.subject;
    const arms = [];
    let defaultBody = null;

    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'end')) {
      const curr = this.peek();
      if (!curr || curr.type !== 'ARM_STMT') { this.advance(); continue; }
      this.advance(); // consume ARM_STMT
      const pattern = curr.value.pattern;
      const body = [];
      while (this.peek() &&
             !(this.peek().type === 'KEYWORD' && this.peek().value === 'end') &&
             this.peek().type !== 'ARM_STMT') {
        const s = this._parseStatement();
        if (s) body.push(s);
      }
      if (pattern === 'else' || pattern === '_') { defaultBody = body; }
      else { arms.push({ pattern, body }); }
    }
    if (this.peek() && this.peek().type === 'KEYWORD' && this.peek().value === 'end') this.advance();
    return ast('MatchStmt', { subject, arms, defaultBody });
  }

  _parseObserveStmt() {
    const t = this.advance(); // OBSERVE_STMT
    const name = t.value.name;
    const body = [];
    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'end')) {
      const s = this._parseStatement(); if (s) body.push(s);
    }
    if (this.peek()) this.advance(); // end
    return ast('ObserveStmt', { name, body });
  }

  _parseEveryStmt() {
    const t = this.advance();
    return ast('EveryStmt', { interval: t.value.interval, cloudName: t.value.cloudName, intoName: t.value.intoName });
  }

  _parseClearStmt() {
    const t = this.advance();
    return ast('ClearStmt', { name: t.value.name });
  }

  _parseOnLifecycleStmt() {
    const t = this.advance(); // ON_LIFECYCLE_STMT
    const phase = t.value.phase;
    const isAsync = t.value.isAsync;
    const body = [];
    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'end')) {
      const s = this._parseStatement(); if (s) body.push(s);
    }
    if (this.peek()) this.advance(); // end
    return ast('OnLifecycleStmt', { phase, isAsync, body });
  }

  _parseOnEventStmt() {
    const t = this.advance(); // ON_EVENT_STMT
    const event = t.value.event;
    const isAsync = t.value.isAsync;
    const body = [];
    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'end')) {
      const s = this._parseStatement(); if (s) body.push(s);
    }
    if (this.peek()) this.advance(); // end
    return ast('OnEventStmt', { event, isAsync, body });
  }

  _parseOffStmt() {
    const t = this.advance();
    return ast('OffStmt', { event: t.value.event });
  }

  _parseTriggerStmt() {
    const t = this.advance();
    return ast('TriggerStmt', { event: t.value.event, payload: t.value.payload });
  }

  _parseEmitStmt() {
    const t = this.advance();
    return ast('EmitStmt', { kind: t.value.kind, name: t.value.name });
  }

  _parsePullStmt() {
    const t = this.advance();
    return ast('PullStmt', { names: t.value.names, path: t.value.path });
  }

  _parseRaindropStmt() {
    const t = this.advance();
    return ast('RaindropStmt', { rdType: t.value.rdType, name: t.value.name });
  }

  _parseGroundStmt() {
    const t = this.advance();
    return ast('GroundStmt', {
      op: t.value.op, key: t.value.key, value: t.value.value, intoName: t.value.intoName,
      name: t.value.name, path: t.value.path,
    });
  }

  _parseDrawStmt() {
    const t = this.advance();
    return ast('DrawStmt', { sql: t.value.sql, from: t.value.from, into: t.value.into });
  }

  _parseServeStmt() {
    const t = this.advance();
    const port = t.value.port;
    const routes = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const cur = this.peek();
      if (cur && cur.type === 'SERVE_ROUTE_STMT') {
        routes.push(this._parseServeRouteBlock());
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('ServeStmt', { port, routes });
  }

  _parseServeRouteBlock() {
    const t = this.advance();
    const method = t.value.method;
    const path = t.value.path;
    const body = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const stmt = this._parseStatement();
      if (stmt) body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return ast('ServeRouteStmt', { method, path, body });
  }

  _parseReplyStmt() {
    const t = this.advance();
    return ast('ReplyStmt', { name: t.value.name });
  }

  _parseAskStmt() {
    const t = this.advance();
    return ast('AskStmt', { prompt: t.value.prompt, data: t.value.data, into: t.value.into });
  }

  _parseLiveDrawStmt() {
    const t = this.advance();
    return ast('LiveDrawStmt', { sql: t.value.sql, from: t.value.from, into: t.value.into });
  }

  _parseManifestStmt() {
    const t = this.advance(); // MANIFEST_STMT
    const name = t.value.name;
    const stores = [];
    let port = 3000;
    const showAlls = [];
    const summarizes = [];
    const accepts = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const cur = this.peek();
      if (!cur) break;
      if (cur.type === 'MANIFEST_STORE') {
        const s = this.advance();
        stores.push({ table: s.value.table, path: s.value.path, fields: s.value.fields });
      } else if (cur.type === 'SERVE_STMT') {
        const s = this.advance();
        port = s.value.port;
      } else if (cur.type === 'MANIFEST_SHOW_ALL') {
        const s = this.advance();
        showAlls.push({ table: s.value.table, path: s.value.path });
      } else if (cur.type === 'MANIFEST_SUMMARIZE') {
        const s = this.advance();
        summarizes.push({ table: s.value.table, prompt: s.value.prompt || null, path: s.value.path });
      } else if (cur.type === 'MANIFEST_ACCEPT') {
        const s = this.advance();
        accepts.push({ noun: s.value.noun, path: s.value.path });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('ManifestStmt', { name, stores, port, showAlls, summarizes, accepts });
  }

  _parseNewStmt() {
    const t = this.advance();
    return ast('NewStmt', { schema: t.value.schema, intoName: t.value.intoName });
  }

  _parseAwaitStmt() {
    const t = this.advance();
    return ast('AwaitStmt', { expression: t.value.expression, intoName: t.value.intoName });
  }

  _parseSlotStmt() {
    const t = this.advance();
    return ast('SlotStmt', { name: t.value.name });
  }

  _parseBurstStmt() {
    const t = this.advance();
    return ast('BurstStmt', { sources: t.value.sources, intoName: t.value.intoName });
  }

  // ── v2.14 collection intelligence ────────────────────────────────

  _parseFilterStmt() {
    const t = this.advance();
    return ast('FilterStmt', {
      itemName:   t.value.itemName,
      collName:   t.value.collName,
      condition:  t.value.condition,
      resultName: t.value.resultName,
    });
  }

  _parseFindStmt() {
    const t = this.advance();
    return ast('FindStmt', {
      itemName:   t.value.itemName,
      collName:   t.value.collName,
      condition:  t.value.condition,
      resultName: t.value.resultName,
    });
  }

  _parseSortStmt() {
    const t = this.advance();
    return ast('SortStmt', {
      collName:   t.value.collName,
      field:      t.value.field,
      descending: t.value.descending,
      resultName: t.value.resultName,
    });
  }

  _parseCountStmt() {
    const t = this.advance();
    return ast('CountStmt', {
      itemName:   t.value.itemName,
      collName:   t.value.collName,
      condition:  t.value.condition,
      resultName: t.value.resultName,
    });
  }

  _parsePipeStmt() {
    const t = this.advance();
    return ast('PipeStmt', {
      sourceName:  t.value.sourceName,
      transforms:  t.value.transforms,
      resultName:  t.value.resultName,
    });
  }

  _parseCastStmt() {
    const t = this.advance();
    return ast('CastStmt', {
      sourceName:  t.value.sourceName,
      targetType:  t.value.targetType,
      resultName:  t.value.resultName,
    });
  }

  _parseLogStmt() {
    const t = this.advance();
    return ast('LogStmt', {
      message:   t.value.message,
      withValue: t.value.withValue,
      value:     t.value.value,
      line:      t.value.line,
    });
  }

  // ── v2.17 — named patterns ───────────────────────────────────────

  _parsePatternStmt() {
    const t = this.advance(); // PATTERN_STMT
    const name = t.value.name;
    const parts = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const nameTok = this.peek();
      // Accept NAME or any KEYWORD (except 'end'/'is') as a part name — common words
      // like 'open', 'again', 'path' are keywords but valid as named capture groups.
      const isPartName = nameTok && (
        nameTok.type === 'NAME' ||
        (nameTok.type === 'KEYWORD' && nameTok.value !== 'end' && nameTok.value !== 'is')
      );
      if (isPartName) {
        const partName = this.advance().value;
        if (this.peek() && this.peek().type === 'KEYWORD' && this.peek().value === 'is') {
          this.advance(); // consume 'is'
          const exprTok = this.peek();
          if (exprTok && exprTok.type === 'LITERAL') {
            parts.push({ name: partName, expr: this.advance().value });
          } else {
            this.advance();
          }
        }
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('PatternStmt', { name, parts });
  }

  _parseScanStmt() {
    const t = this.advance();
    return ast('ScanStmt', { text: t.value.text, pattern: t.value.pattern, into: t.value.into });
  }

  _parseSeekStmt() {
    const t = this.advance();
    return ast('SeekStmt', { text: t.value.text, pattern: t.value.pattern, into: t.value.into });
  }

  _parseReplaceStmt() {
    const t = this.advance();
    return ast('ReplaceStmt', { text: t.value.text, pattern: t.value.pattern, template: t.value.template, into: t.value.into });
  }

  _parseZoomOutFrom() {
    const t = this.advance();
    return ast('ZoomOutFrom', { sourceName: t.value.sourceName, intoName: t.value.intoName });
  }

  // ── v2.19 security layer ─────────────────────────────────────────

  /**
   * probe dns|mx|whois "HOST" into RESULT
   * probe headers|ssl at "URL" into RESULT
   * probe ports at "HOST" [from N through M] into RESULT
   */
  _parseProbeStmt() {
    this.expect('KEYWORD', 'probe');
    const probeTypeTok = this.expect('NAME');
    const probeType    = probeTypeTok ? probeTypeTok.value : 'dns';

    let target = null, fromPort = 1, toPort = 1024;

    if (['dns', 'mx', 'whois'].includes(probeType)) {
      // Next token is the LITERAL host
      const hostTok = this.match('LITERAL');
      target = hostTok ? hostTok.value : null;
    } else {
      // headers, ssl, ports — expect KEYWORD 'at' then LITERAL
      this.expect('KEYWORD', 'at');
      const hostTok = this.match('LITERAL');
      target = hostTok ? hostTok.value : null;

      if (probeType === 'ports') {
        if (this.isKeyword('from')) {
          this.advance(); // consume 'from'
          const startTok = this.match('NUMBER');
          if (startTok) fromPort = parseInt(startTok.value, 10);
          if (this.isKeyword('through')) {
            this.advance(); // consume 'through'
            const endTok = this.match('NUMBER');
            if (endTok) toPort = parseInt(endTok.value, 10);
          }
        }
      }
    }

    this.expect('KEYWORD', 'into');
    const intoTok = this.expect('NAME');
    const intoName = intoTok ? intoTok.value : 'result';

    return ast('ProbeStmt', { probeType, target, fromPort, toPort, intoName });
  }

  /**
   * authorize audit
   *   scope   is "..."
   *   target  is "..."
   *   allowed by "..."
   *   expires is "..."
   * end
   *
   * The tokenizer collapses body lines that start with unrecognised words
   * (e.g. "allowed by ...") into a single NAME token. We handle both forms:
   *   (a) NAME KEYWORD:is/by LITERAL  — normal key-is-value lines
   *   (b) Single NAME containing the whole "key ... value" phrase
   */
  _parseAuthorizeStmt() {
    this.expect('KEYWORD', 'authorize');
    const nameTok = this.expect('NAME');
    const name    = nameTok ? nameTok.value : 'audit';
    const fields  = new Map();

    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'NAME') {
        const raw = this.advance().value;
        // Check whether the next token is a connective keyword ('is', 'by', 'at')
        const conn = this.peek();
        if (conn && conn.type === 'KEYWORD' && ['is', 'by', 'at'].includes(conn.value)) {
          // Normal form: NAME KEYWORD:is LITERAL
          this.advance(); // consume connective
          const valTok = this.match('LITERAL') || this.match('NAME');
          if (valTok) {
            // Strip surrounding quotes that may appear in the LITERAL value
            const val = valTok.value.replace(/^["']|["']$/g, '');
            fields.set(raw, val);
          }
        } else {
          // Whole-line form: "allowed by \"Security Director\""
          // Split on first occurrence of ' is ', ' by ', or ' at '
          const m = raw.match(/^(.+?)\s+(?:is|by|at)\s+"(.+)"$/)
                 || raw.match(/^(.+?)\s+(?:is|by|at)\s+'(.+)'$/)
                 || raw.match(/^(.+?)\s+(?:is|by|at)\s+(.+)$/);
          if (m) {
            fields.set(m[1].trim(), m[2].trim());
          } else {
            fields.set(raw, '');
          }
        }
      } else if (t.type === 'LITERAL') {
        // Stray literal — skip
        this.advance();
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('AuthorizeStmt', {
      name,
      fields,
      scope:  fields.get('scope')  || null,
      target: fields.get('target') || null,
    });
  }

  /**
   * threat NAME
   *   category CATEGORY
   *   matter
   *     severity is high
   *     vector   is "..."
   *     fix      is "..."
   *   end
   * end
   */
  _parseThreatStmt() {
    this.expect('KEYWORD', 'threat');
    const nameTok  = this.expect('NAME');
    const name     = nameTok ? nameTok.value : 'threat';
    let category   = null;
    let matter     = {};

    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'KEYWORD' && (t.value === 'category' || t.value === 'cat')) {
        this.advance();
        const catTok = this.match('NAME');
        if (catTok) category = catTok.value;
      } else if (t.type === 'KEYWORD' && t.value === 'matter') {
        this.advance(); // consume 'matter'
        const matterBlock = this._parseMatterBlock();
        for (const f of (matterBlock ? matterBlock.fields : [])) {
          matter[f.key] = f.value;
        }
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return ast('ThreatStmt', { name, category, matter });
  }

  /**
   * harden from SOURCE1 and SOURCE2 ... into RESULT
   * Token stream: KEYWORD:harden NAME... KEYWORD:and NAME... KEYWORD:into NAME
   */
  _parseHardenStmt() {
    this.expect('KEYWORD', 'harden');
    if (this.isKeyword('from')) this.advance();
    const sources = [];
    let guard = 0;
    while (this.peek() && !this.isKeyword('into') && guard++ < 100) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'NAME') {
        sources.push(this.advance().value);
      } else if (t.type === 'KEYWORD' && t.value === 'and') {
        this.advance(); // skip 'and'
      } else {
        break;
      }
    }
    this.expect('KEYWORD', 'into');
    const intoTok = this.expect('NAME');
    const intoName = intoTok ? intoTok.value : 'recommendations';
    return ast('HardenStmt', { sources, intoName });
  }

  /**
   * discover hosts on "CIDR" into RESULT
   * Token stream: KEYWORD:discover NAME:hosts KEYWORD:on LITERAL:cidr KEYWORD:into NAME:result
   */
  _parseDiscoverStmt() {
    this.expect('KEYWORD', 'discover');
    this.match('NAME'); // consume 'hosts'
    this.expect('KEYWORD', 'on');
    const cidrTok = this.expect('LITERAL');
    const target  = cidrTok ? cidrTok.value : '192.168.1.0/24';
    this.expect('KEYWORD', 'into');
    const intoTok  = this.expect('NAME');
    const intoName = intoTok ? intoTok.value : 'live hosts';
    return ast('DiscoverStmt', { target, intoName });
  }

  /**
   * intercept traffic on "IFACE" [matching "FILTER"] for N seconds into RESULT
   * Token stream: KEYWORD:intercept KEYWORD:on LITERAL:iface [KEYWORD:matching LITERAL:filter]
   *               KEYWORD:for NUMBER:N KEYWORD:into NAME:result
   */
  _parseInterceptStmt() {
    this.expect('KEYWORD', 'intercept');
    this.expect('KEYWORD', 'on');
    const ifaceTok = this.expect('LITERAL');
    const iface    = ifaceTok ? ifaceTok.value : 'eth0';
    let   filter   = null;

    if (this.isKeyword('matching')) {
      this.advance();
      const filterTok = this.match('LITERAL');
      if (filterTok) filter = filterTok.value;
    }

    this.expect('KEYWORD', 'for');
    const secTok  = this.match('NUMBER');
    const seconds = secTok ? parseInt(secTok.value, 10) : 10;
    // consume optional word 'seconds'
    const nextTok = this.peek();
    if (nextTok && nextTok.type === 'NAME' && nextTok.value === 'seconds') this.advance();

    this.expect('KEYWORD', 'into');
    const intoTok  = this.expect('NAME');
    const intoName = intoTok ? intoTok.value : 'packets';

    return ast('InterceptStmt', { interface: iface, filter, seconds, intoName });
  }

  _parseZoomExpand() {
    const t = this.advance();
    return ast('ZoomExpand', { sourceType: t.value.sourceType, sourceName: t.value.sourceName, intoName: t.value.intoName });
  }

  // ── v2.20 story layer parsers ─────────────────────────────────────────

  _parseStoryStmt() {
    const t = this.advance();
    return ast('StoryStmt', {
      name: t.value.name,
      source: t.value.source,
      query: t.value.query,
      into: t.value.into,
    });
  }

  _parseNarrativeStmt() {
    const t = this.advance();
    const stmt = ast('NarrativeStmt', {
      name: t.value.name,
      storyName: t.value.storyName,
      perspective: t.value.perspective,
      body: [],
    });
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const s = this._parseStatement();
      if (s) stmt.body.push(s);
    }
    this.expect('KEYWORD', 'end');
    return stmt;
  }

  _parseScopeStmt() {
    const t = this.advance();
    return ast('ScopeStmt', {
      subject: t.value.subject,
      dimensions: t.value.dimensions,
      into: t.value.into,
    });
  }

  _parseScenarioStmt() {
    const t = this.advance();
    const stmt = ast('ScenarioStmt', {
      name: t.value.name,
      condition: t.value.condition,
      probability: t.value.probability,
      body: [],
    });
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      const s = this._parseStatement();
      if (s) stmt.body.push(s);
    }
    this.expect('KEYWORD', 'end');
    return stmt;
  }

  // ── v2.21 intelligence layer parsers ─────────────────────────────────────

  /**
   * emerge NAME
   *   from STORY_NAME
   *   subject "SUBJECT LABEL"
   *   preference "ITEM1" and "PREFERENCE2"
   *   trigger "TRIGGER1" and "TRIGGER2"
   *   reaction "REACTION1"
   *   threshold unusual
   *   into RESULT
   * end
   *
   * Body lines are tokenized as bare NAME tokens (multi-word lines).
   * We parse them by examining the raw token value string since the tokenizer
   * collapses each body line into one NAME token or a KEYWORD token.
   */
  _parseEmergeStmt() {
    this.expect('KEYWORD', 'emerge');
    const nameTok = this.match('NAME');
    const name = nameTok ? nameTok.value : 'correlations';
    let story = null, subject = null, preferences = [], triggers = [], reactions = [], threshold = 'unusual', intoName = 'findings';

    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 200) {
      const t = this.peek();
      if (!t) break;

      // Handle 'from STORY_NAME' — emitted as KEYWORD:from NAME
      if (t.type === 'KEYWORD' && t.value === 'from') {
        this.advance();
        const tok = this.match('NAME');
        if (tok) story = tok.value;
        continue;
      }

      // Handle 'into RESULT' — emitted as KEYWORD:into NAME
      if (t.type === 'KEYWORD' && t.value === 'into') {
        this.advance();
        const tok = this.match('NAME');
        if (tok) intoName = tok.value;
        continue;
      }

      // Handle body lines that the tokenizer collapses into NAME tokens.
      // Each body line becomes one NAME token whose value is the full line text
      // (e.g., `subject "Donald Trump"`, `preference "McDonald's" and "golf"`)
      if (t.type === 'NAME') {
        const raw = t.value;
        this.advance();

        // subject "..."
        const mSubject = raw.match(/^subject\s+"([^"]+)"/i);
        if (mSubject) { subject = mSubject[1]; continue; }

        // preference "X" and "Y" and ...
        const mPref = raw.match(/^preference\s+(.+)$/i);
        if (mPref) {
          const items = mPref[1].match(/"([^"]+)"/g) || [];
          for (const it of items) preferences.push(it.replace(/^"|"$/g, ''));
          continue;
        }

        // trigger "X" and "Y" and ...  (note: 'trigger' is a keyword but body
        // lines can also appear as TRIGGER_STMT tokens — handle both here)
        const mTrig = raw.match(/^trigger\s+(.+)$/i);
        if (mTrig) {
          const items = mTrig[1].match(/"([^"]+)"/g) || [];
          for (const it of items) triggers.push(it.replace(/^"|"$/g, ''));
          continue;
        }

        // reaction "X" and "Y" and ...
        const mReact = raw.match(/^reaction\s+(.+)$/i);
        if (mReact) {
          const items = mReact[1].match(/"([^"]+)"/g) || [];
          for (const it of items) reactions.push(it.replace(/^"|"$/g, ''));
          continue;
        }

        // threshold VALUE (e.g., `threshold unusual`)
        const mThresh = raw.match(/^threshold\s+(\w+)$/i);
        if (mThresh) { threshold = mThresh[1].toLowerCase(); continue; }

        // Fallthrough: ignore unknown body line
        continue;
      }

      // Handle TRIGGER_STMT tokens — these happen because 'trigger' is a keyword
      // and the tokenizer dispatches it to _tokenizeTriggerStmt. We extract the
      // quoted literal from the event field.
      if (t.type === 'TRIGGER_STMT') {
        const raw = t.value.event || '';
        const items = raw.match(/"([^"]+)"/g) || [];
        for (const it of items) triggers.push(it.replace(/^"|"$/g, ''));
        this.advance();
        continue;
      }

      // Skip other tokens (keywords we don't recognize in this context)
      this.advance();
    }
    this.expect('KEYWORD', 'end');
    return ast('EmergeStmt', { name, story, subject, preferences, triggers, reactions, threshold, intoName });
  }

  /**
   * wifi map network into devices
   * wifi locate "device name" into position
   */
  _parseWifiStmt() {
    this.expect('KEYWORD', 'wifi');
    const opTok = this.peek();
    if (opTok && opTok.type === 'KEYWORD' && opTok.value === 'map') {
      this.advance(); // consume 'map'
      this.match('KEYWORD', 'network'); // optional 'network'
      this.expect('KEYWORD', 'into');
      const intoTok = this.match('NAME');
      return ast('WifiMapStmt', { op: 'map', target: null, intoName: intoTok ? intoTok.value : 'devices' });
    }
    if (opTok && opTok.type === 'KEYWORD' && opTok.value === 'locate') {
      this.advance(); // consume 'locate'
      const targetTok = this.match('LITERAL');
      this.expect('KEYWORD', 'into');
      const intoTok = this.match('NAME');
      return ast('WifiMapStmt', { op: 'locate', target: targetTok ? targetTok.value : null, intoName: intoTok ? intoTok.value : 'position' });
    }
    this.advance();
    return null;
  }

  /**
   * lookup phone "555-1234" into contact info
   * lookup email "user@example.com" into account info
   */
  _parseLookupStmt() {
    this.expect('KEYWORD', 'lookup');
    const typeTok = this.peek();
    const lookupType = (typeTok && typeTok.type === 'KEYWORD') ? this.advance().value : 'phone';
    const targetTok = this.match('LITERAL');
    this.expect('KEYWORD', 'into');
    const intoTok = this.match('NAME');
    return ast('LookupStmt', {
      lookupType,
      target: targetTok ? targetTok.value : '',
      intoName: intoTok ? intoTok.value : 'result',
    });
  }

  /**
   * watch feed at "URL" for 30 seconds into frames
   * watch cameras near "Washington DC" into live feeds
   */
  _parseWatchStmt() {
    this.expect('KEYWORD', 'watch');
    const subTypeTok = this.peek();
    const watchType = (subTypeTok && subTypeTok.type === 'KEYWORD') ? this.advance().value : 'feed';

    if (watchType === 'feed') {
      this.match('KEYWORD', 'at');
      const urlTok = this.match('LITERAL');
      this.match('KEYWORD', 'for');
      const secTok = this.match('NUMBER');
      const seconds = secTok ? parseInt(secTok.value, 10) : 30;
      const nextTok = this.peek();
      if (nextTok && nextTok.type === 'NAME' && nextTok.value === 'seconds') this.advance();
      this.expect('KEYWORD', 'into');
      const intoTok = this.match('NAME');
      return ast('WatchStmt', { watchType: 'feed', target: urlTok ? urlTok.value : '', seconds, location: null, intoName: intoTok ? intoTok.value : 'frames' });
    }

    if (watchType === 'cameras') {
      this.match('KEYWORD', 'near');
      const locTok = this.match('LITERAL');
      this.expect('KEYWORD', 'into');
      const intoTok = this.match('NAME');
      return ast('WatchStmt', { watchType: 'cameras', target: null, seconds: 0, location: locTok ? locTok.value : '', intoName: intoTok ? intoTok.value : 'live feeds' });
    }

    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _skipBlock(ctx) {
    this.errors.push(`I was looking for the name of a ${ctx} but couldn't find one.`);
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 10000) this.advance();
    if (this.isKeyword('end')) this.advance();
    return null;
  }
}

module.exports = { EventMathParser };
