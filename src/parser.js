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

    // Handle ZOOM_IN / ZOOM_OUT tokens (non-KEYWORD type)
    if (t.type === 'ZOOM_IN') return this._parseZoomIn();
    if (t.type === 'ZOOM_OUT') return this._parseZoomOut();

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

    // Door open
    if (this.isKeyword('door')) {
      this.advance();
      if (this.isKeyword('open')) {
        this.advance();
        const inputs = [];
        while (this.peek() && this.peek().type === 'NAME') {
          inputs.push(this.advance().value);
        }
        result.doorOpen = ast('DoorOpen', { inputs });
      }
    }

    // Body: statements until "door closed" or "end"
    let guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      if (this.isKeyword('door')) {
        this.advance();
        if (this.isKeyword('closed')) {
          this.advance();
          const returnName = this.match('NAME');
          result.doorClosed = ast('DoorClosed', { returns: returnName ? returnName.value : null });
          break;
        }
      }
      const stmt = this._parseStatement();
      if (stmt) result.body.push(stmt);
    }

    this.expect('KEYWORD', 'end');
    return result;
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

    const ARITH_OPS = new Set(['plus', 'minus', 'times', 'divided by']);

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
    this.expect('KEYWORD', 'across');
    const dirTok = this.expect('NAME');
    this.expect('KEYWORD', 'and');
    const lensTok = this.expect('NAME');
    this.expect('KEYWORD', 'and');
    const qtyTok = this.expect('NAME');
    this.expect('KEYWORD', 'into');
    const intoTok = this.expect('NAME');
    return ast('PredictStmt', {
      subject: subjectTok ? subjectTok.value : '',
      directionsLayer: dirTok ? dirTok.value : '',
      lensesLayer: lensTok ? lensTok.value : '',
      quantitiesLayer: qtyTok ? qtyTok.value : '',
      intoLayer: intoTok ? intoTok.value : '',
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
