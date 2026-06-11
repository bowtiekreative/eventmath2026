/**
 * EventMath Formatter v0.4
 *
 * Rewrites EventMath source into canonical form:
 *  - cat → category
 *  - Consistent 2-space indentation
 *  - Block-end alignment
 *  - Proper spacing around keywords
 *  - Canonical ordering
 *
 * Uses the parser to build an AST, then walks the AST
 * to emit well-formatted EventMath source code.
 *
 * v0.4 additions:
 *  - Mark/Set with expr format arithmetic expressions
 *  - BrokenEvent formatting
 */

class EventMathFormatter {
  constructor() {
    this.output = [];
    this.indent = 0;
  }

  _line(code) {
    this.output.push('  '.repeat(this.indent) + code);
  }

  /**
   * Format an EventMath AST into canonical-form source code.
   * @param {object} ast - Program AST from the parser
   * @returns {string} Formatted EventMath source
   */
  format(ast) {
    this.output = [];
    this.indent = 0;

    for (const stmt of (ast.statements || [])) {
      this._formatStatement(stmt);
    }

    return this.output.join('\n') + '\n';
  }

  _formatStatement(stmt) {
    if (!stmt) return;

    switch (stmt.type) {
      case 'Event':        return this._formatEvent(stmt);
      case 'Layer':        return this._formatLayer(stmt);
      case 'Timeline':     return this._formatTimeline(stmt);
      case 'Action':       return this._formatAction(stmt);
      case 'Mark':         return this._formatMark(stmt);
      case 'Set':          return this._formatSet(stmt);
      case 'Run':          return this._formatRun(stmt);
      case 'When':         return this._formatWhen(stmt);
      case 'Split':        return this._formatSplit(stmt);
      case 'AgainCount':   return this._formatAgainCount(stmt);
      case 'AgainUntil':   return this._formatAgainUntil(stmt);
      case 'Walk':         return this._formatWalk(stmt);
      case 'ActionCall':   return this._formatActionCall(stmt);
      case 'Rewind':       return this._formatRewind(stmt);
      case 'Forward':      return this._formatForward(stmt);
      case 'Stop':         return this._formatStop(stmt);
      case 'AddEvent':     return this._formatAddEvent(stmt);
      case 'AddLayer':     return this._formatAddLayer(stmt);
      case 'RemoveLayer':  return this._formatRemoveLayer(stmt);
      case 'RemoveEvent':  return this._formatRemoveEvent(stmt);
      case 'Merge':        return this._formatMerge(stmt);
      case 'NameRef':      return this._formatNameRef(stmt);
      case 'Overlap':      return this._formatOverlap(stmt);
      case 'Note':         return this._formatNote(stmt);
      case 'BrokenEvent':  return this._formatBrokenEvent(stmt);
      case 'Check':        return this._formatCheck(stmt);
      case 'Use':          return this._formatUse(stmt);
    }
  }

  // ── Events ────────────────────────────────────────────────

  _formatEvent(stmt) {
    this._line(`event ${stmt.name}`);
    this.indent++;

    if (stmt.category) {
      this._line(`category ${stmt.category}`);
    }

    if (stmt.matter && stmt.matter.fields && stmt.matter.fields.length > 0) {
      this._line('matter');
      this.indent++;
      for (const field of stmt.matter.fields) {
        if (field.kind === 'literal') {
          this._line(`${field.key} is ${field.value}`);
        } else {
          this._line(`${field.key} from ${field.value}`);
        }
      }
      this.indent--;
      this._line('end');
    }

    this.indent--;
    this._line('end');
  }

  // ── Layers ────────────────────────────────────────────────

  _formatLayer(stmt) {
    this._line(`layer ${stmt.name}`);
    this.indent++;
    for (const evt of (stmt.events || [])) {
      this._line(evt.name);
    }
    this.indent--;
    this._line('end');
  }

  // ── Timelines ─────────────────────────────────────────────

  _formatTimeline(stmt) {
    this._line(`timeline ${stmt.name}`);
    this.indent++;

    for (const section of ['past', 'present', 'future']) {
      const sec = stmt[section];
      if (sec && sec.layers && sec.layers.length > 0) {
        this._line(sec.name);
        this.indent++;
        for (const layer of sec.layers) {
          this._line(layer.name);
        }
        this.indent--;
        this._line('end');
      } else if (sec) {
        // Empty section
        this._line(sec.name);
        this.indent++;
        this.indent--;
        this._line('end');
      }
    }

    this.indent--;
    this._line('end');
  }

  // ── Actions ───────────────────────────────────────────────

  _formatAction(stmt) {
    this._line(`action ${stmt.name}`);
    this.indent++;

    if (stmt.doorOpen && stmt.doorOpen.inputs && stmt.doorOpen.inputs.length > 0) {
      this._line(`door open ${stmt.doorOpen.inputs.join(' ')}`);
    }

    for (const bodyStmt of (stmt.body || [])) {
      this._formatStatement(bodyStmt);
    }

    if (stmt.doorClosed) {
      if (stmt.doorClosed.returns) {
        this._line(`door closed ${stmt.doorClosed.returns}`);
      } else {
        this._line('door closed');
      }
    }

    this.indent--;
    this._line('end');
  }

  // ── Mark & Set ────────────────────────────────────────────

  _formatExpr(node) {
    if (!node) return '';
    if (node.kind === 'expr') {
      const l = node.left.kind  === 'expr' ? `(${this._formatExpr(node.left)})`  : node.left.value;
      const r = node.right.kind === 'expr' ? `(${this._formatExpr(node.right)})` : node.right.value;
      return `${l} ${node.op} ${r}`;
    }
    return node.value || '';
  }

  _formatStringOp(stmt) {
    if (stmt.stringOp === 'joined with') {
      return `${stmt.left ? stmt.left.value : ''} joined with ${stmt.right ? stmt.right.value : ''}`;
    }
    if (stmt.stringOp === 'in uppercase') return `${stmt.subject ? stmt.subject.value : ''} in uppercase`;
    if (stmt.stringOp === 'in lowercase') return `${stmt.subject ? stmt.subject.value : ''} in lowercase`;
    if (stmt.stringOp === 'length of')    return `length of ${stmt.subject ? stmt.subject.value : ''}`;
    return '';
  }

  _formatMark(stmt) {
    if (stmt.stringOp) {
      this._line(`mark ${stmt.name} as ${this._formatStringOp(stmt)}`);
    } else if (stmt.expr !== undefined && stmt.expr !== null) {
      this._line(`mark ${stmt.name} as ${this._formatExpr(stmt.expr)}`);
    } else {
      this._line(`mark ${stmt.name} as ${stmt.value}`);
    }
  }

  _formatSet(stmt) {
    if (stmt.stringOp) {
      this._line(`set ${stmt.name} to ${this._formatStringOp(stmt)}`);
    } else if (stmt.expr !== undefined && stmt.expr !== null) {
      this._line(`set ${stmt.name} to ${this._formatExpr(stmt.expr)}`);
    } else if (stmt.value) {
      this._line(`set ${stmt.name} to ${stmt.value.value !== undefined ? stmt.value.value : stmt.value}`);
    } else {
      this._line(`set ${stmt.name} to`);
    }
  }

  // ── Run ───────────────────────────────────────────────────

  _formatRun(stmt) {
    if (stmt.target) {
      this._line(`run ${stmt.target}`);
    } else {
      this._line('run');
    }
  }

  _formatCondition(cond) {
    if (!cond) return '';
    if (cond.type === 'CompoundCondition') {
      return `${this._formatCondition(cond.left)} ${cond.op} ${this._formatCondition(cond.right)}`;
    }
    const opMap = {
      'is': 'is',
      'is not': 'is not',
      'is greater than': 'is greater than',
      'is less than': 'is less than',
      'is at least': 'is at least',
      'is at most': 'is at most',
      'is starts with': 'is starts with',
      'is ends with': 'is ends with',
      'is contains': 'is contains',
      // Legacy (without 'is' prefix)
      'greater than': 'is greater than',
      'less than': 'is less than',
      'at least': 'is at least',
      'at most': 'is at most',
    };
    const op = opMap[cond.op] || cond.op;
    return `${cond.left} ${op} ${cond.right}`;
  }

  // ── When / Otherwise ──────────────────────────────────────

  _formatWhen(stmt) {
    if (stmt.condition) {
      this._line(`when ${this._formatCondition(stmt.condition)}`);
    } else {
      this._line('when');
    }
    this.indent++;

    for (const bodyStmt of (stmt.body || [])) {
      this._formatStatement(bodyStmt);
    }

    this.indent--;

    if (stmt.otherwise && stmt.otherwise.length > 0) {
      this._line('otherwise');
      this.indent++;
      for (const bodyStmt of stmt.otherwise) {
        this._formatStatement(bodyStmt);
      }
      this.indent--;
    }

    this._line('end');
  }

  // ── Split / Path ──────────────────────────────────────────

  _formatSplit(stmt) {
    this._line(`split ${stmt.target} into`);
    this.indent++;

    for (const path of (stmt.paths || [])) {
      this._line(`path ${path.name}`);
      this.indent++;
      for (const bodyStmt of (path.body || [])) {
        this._formatStatement(bodyStmt);
      }
      this.indent--;
      this._line('end');
    }

    this.indent--;
    this._line('end');
  }

  // ── Again ─────────────────────────────────────────────────

  _formatAgainCount(stmt) {
    this._line(`again ${stmt.count} times`);
    this.indent++;
    for (const bodyStmt of (stmt.body || [])) {
      this._formatStatement(bodyStmt);
    }
    this.indent--;
    this._line('end');
  }

  _formatAgainUntil(stmt) {
    if (stmt.condition) {
      this._line(`again until ${this._formatCondition(stmt.condition)}`);
    } else {
      this._line('again until');
    }
    this.indent++;
    for (const bodyStmt of (stmt.body || [])) {
      this._formatStatement(bodyStmt);
    }
    this.indent--;
    this._line('end');
  }

  // ── Walk ──────────────────────────────────────────────────

  _formatWalk(stmt) {
    this._line(`walk ${stmt.layer} as ${stmt.variable}`);
    this.indent++;
    for (const bodyStmt of (stmt.body || [])) {
      this._formatStatement(bodyStmt);
    }
    this.indent--;
    this._line('end');
  }

  // ── Action calls ──────────────────────────────────────────

  _formatActionCall(stmt) {
    const args = (stmt.args || []).map(a => `${a.key} is ${a.value}`).join(' and ');
    this._line(`${stmt.name} with ${args}`);
  }

  // ── Time travel ───────────────────────────────────────────

  _formatRewind(stmt) {
    if (stmt.mode === 'by') {
      this._line(`rewind ${stmt.target} by ${stmt.count}`);
    } else {
      this._line(`rewind ${stmt.target} to ${stmt.destination}`);
    }
  }

  _formatForward(stmt) {
    if (stmt.mode === 'by') {
      this._line(`forward ${stmt.target} by ${stmt.count}`);
    } else {
      this._line(`forward ${stmt.target} to ${stmt.destination}`);
    }
  }

  _formatStop() {
    this._line('stop');
  }

  // ── Layer operations ──────────────────────────────────────

  _formatAddEvent(stmt) {
    if (stmt.layerName) {
      this._line(`add event ${stmt.eventName} into ${stmt.layerName}`);
    } else {
      this._line(`add event ${stmt.eventName}`);
    }
  }

  _formatAddLayer(stmt) {
    this._line(`add layer ${stmt.layerName}`);
  }

  _formatRemoveLayer(stmt) {
    this._line(`remove layer ${stmt.name}`);
  }

  _formatRemoveEvent(stmt) {
    this._line(`remove event ${stmt.name}`);
  }

  _formatMerge(stmt) {
    this._line(`merge ${stmt.source} into ${stmt.target}`);
  }

  _formatNameRef(stmt) {
    this._line(stmt.name);
  }

  // ── Overlap ───────────────────────────────────────────────

  _formatOverlap(stmt) {
    this._line('overlap');
    const tracks = stmt.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      if (i > 0) {
        this._line('and');
      }
      this.indent++;
      for (const s of tracks[i]) {
        this._formatStatement(s);
      }
      this.indent--;
    }
    this._line('end');
  }

  // ── Note ──────────────────────────────────────────────────

  _formatNote(stmt) {
    this._line(`note ${stmt.text}`);
  }

  // ── Check ─────────────────────────────────────────────────

  _formatCheck(stmt) {
    if (!stmt.condition) return;
    const cond = this._formatCondition(stmt.condition);
    this._line(`check ${cond}`);
  }

  // ── Use ───────────────────────────────────────────────────

  _formatUse(stmt) {
    this._line(`use ${stmt.name} from ${stmt.from}`);
  }

  // ── Broken Event ──────────────────────────────────────────

  _formatBrokenEvent(stmt) {
    this._line(`broken event ${stmt.name}`);
    if (stmt.matter && stmt.matter.fields && stmt.matter.fields.length > 0) {
      this.indent++;
      this._line('matter');
      this.indent++;
      for (const field of stmt.matter.fields) {
        if (field.kind === 'literal') {
          this._line(`${field.key} is ${field.value}`);
        } else {
          this._line(`${field.key} from ${field.value}`);
        }
      }
      this.indent--;
      this._line('end');
      this.indent--;
    }
    this._line('end');
  }
}

module.exports = { EventMathFormatter };
