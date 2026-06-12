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
      case 'Show':         return this._formatShow(stmt);
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
      case 'SortLayer':    return this._formatSortLayer(stmt);
      case 'FilterLayer':  return this._formatFilterLayer(stmt);
      case 'FindInLayer':  return this._formatFindInLayer(stmt);
      case 'CountInLayer': return this._formatCountInLayer(stmt);
      case 'PredictStmt':  return this._formatPredictStmt(stmt);
      case 'ResolveStmt':  return this._formatResolveStmt(stmt);
      case 'ZoomIn':       return this._formatZoomIn(stmt);
      case 'ZoomOut':      return this._formatZoomOut(stmt);
      case 'ZoomOpposite': return this._formatZoomOpposite(stmt);
      case 'ZoomMeta':     return this._formatZoomMeta(stmt);
      case 'SpinStmt':     return this._formatSpinStmt(stmt);
      case 'VibrateStmt':  return this._formatVibrateStmt(stmt);
      case 'CycleStmt':    return this._formatCycleStmt(stmt);
      case 'ResonateStmt': return this._formatResonateStmt(stmt);
      case 'WeightStmt':   return this._formatWeightStmt(stmt);
      case 'ExplainStmt':  return this._formatExplainStmt(stmt);
      case 'AnalogyStmt':   return this._formatAnalogyStmt(stmt);
      case 'LandscapeStmt': return this._formatLandscapeStmt(stmt);
      case 'ForecastStmt':  return this._formatForecastStmt(stmt);
      case 'BoundStmt':          return this._formatBoundStmt(stmt);
      case 'ActorStmt':          return this._formatActorStmt(stmt);
      case 'ChainStmt':          return this._formatChainStmt(stmt);
      case 'EventLikeStmt':      return this._formatEventLikeStmt(stmt);
      case 'AsymmetryStmt':      return this._formatAsymmetryStmt(stmt);
      case 'RootOfStmt':         return this._formatRootOfStmt(stmt);
      case 'InvertStmt':         return this._formatInvertStmt(stmt);
      case 'AssumeStmt':         return this._formatAssumeStmt(stmt);
      case 'DetectFallaciesStmt':return this._formatDetectFallaciesStmt(stmt);
      case 'FractalStmt':        return this._formatFractalStmt(stmt);
      case 'SatisfyStmt':        return this._formatSatisfyStmt(stmt);
      case 'EvaluateStmt':       return this._formatEvaluateStmt(stmt);
      case 'DimensionalStmt':    return this._formatDimensionalStmt(stmt);
      case 'DiagnoseStmt':       return this._formatDiagnoseStmt(stmt);
      case 'ChallengeStmt':      return this._formatChallengeStmt(stmt);
      case 'CompareStmt':        return this._formatCompareStmt(stmt);
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

  _formatBuiltinExpr(op) {
    if (!op || !op.kind) return '';
    const { kind } = op;
    if (kind === 'today') return 'today';
    if (kind === 'now') return 'now';
    if (kind === 'round') return `round of ${op.a ? op.a.join(' ') : ''}`;
    if (kind === 'floor') return `floor of ${op.a ? op.a.join(' ') : ''}`;
    if (kind === 'ceiling') return `ceiling of ${op.a ? op.a.join(' ') : ''}`;
    if (kind === 'absolute') return `absolute of ${op.a ? op.a.join(' ') : ''}`;
    if (kind === 'min') return `minimum of ${op.a ? op.a.join(' ') : ''} and ${op.b ? op.b.join(' ') : ''}`;
    if (kind === 'max') return `maximum of ${op.a ? op.a.join(' ') : ''} and ${op.b ? op.b.join(' ') : ''}`;
    if (kind === 'random') return `random between ${op.a ? op.a.join(' ') : ''} and ${op.b ? op.b.join(' ') : ''}`;
    if (kind === 'days_between') return `days between ${op.a ? op.a.join(' ') : ''} and ${op.b ? op.b.join(' ') : ''}`;
    if (kind === 'trimmed') return `${op.a ? op.a.join(' ') : ''} trimmed`;
    if (kind === 'repeated') return `${op.a ? op.a.join(' ') : ''} repeated ${op.n ? op.n.join(' ') : ''} times`;
    return '';
  }

  _formatMark(stmt) {
    if (stmt.builtinExpr) {
      this._line(`mark ${stmt.name} as ${this._formatBuiltinExpr(stmt.builtinExpr)}`);
    } else if (stmt.stringOp) {
      this._line(`mark ${stmt.name} as ${this._formatStringOp(stmt)}`);
    } else if (stmt.expr !== undefined && stmt.expr !== null) {
      this._line(`mark ${stmt.name} as ${this._formatExpr(stmt.expr)}`);
    } else {
      this._line(`mark ${stmt.name} as ${stmt.value}`);
    }
  }

  _formatSet(stmt) {
    if (stmt.builtinExpr) {
      this._line(`set ${stmt.name} to ${this._formatBuiltinExpr(stmt.builtinExpr)}`);
    } else if (stmt.stringOp) {
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

  _formatShow(stmt) {
    if (stmt.target) {
      this._line(`show ${stmt.target}`);
    } else {
      this._line('show');
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

  // ── Layer operations ──────────────────────────────────────

  _formatSortLayer(stmt) {
    if (stmt.direction === 'descending') {
      this._line(`sort layer ${stmt.name} by matter ${stmt.field} descending`);
    } else {
      this._line(`sort layer ${stmt.name} by matter ${stmt.field}`);
    }
  }

  _formatFilterLayer(stmt) {
    this._line(`filter layer ${stmt.name} where ${stmt.condition} into ${stmt.into}`);
  }

  _formatFindInLayer(stmt) {
    this._line(`find in ${stmt.name} where ${stmt.condition} into ${stmt.into}`);
  }

  _formatCountInLayer(stmt) {
    this._line(`count in ${stmt.name} where ${stmt.condition} into ${stmt.into}`);
  }

  // ── Prediction statements ─────────────────────────────────

  _formatPredictStmt(stmt) {
    const dims = (stmt.dimensions && stmt.dimensions.length > 0)
      ? stmt.dimensions
      : [stmt.directionsLayer, stmt.lensesLayer, stmt.quantitiesLayer].filter(Boolean);
    this._line(`predict ${stmt.subject}`);
    if (dims.length > 0) {
      this._line(`across ${dims[0]}`);
      for (let i = 1; i < dims.length; i++) this._line(`and ${dims[i]}`);
    }
    if (stmt.fractalName) this._line(`through ${stmt.fractalName}`);
    this._line(`into ${stmt.intoLayer}`);
  }

  _formatResolveStmt(stmt) {
    const cond = this._formatCondition(stmt.condition);
    this._line(`resolve ${stmt.layer} where ${cond} as ${stmt.outcome}`);
  }

  // ── Zoom In / Zoom Out ────────────────────────────────────

  _formatZoomIn(stmt) {
    const fromRef = stmt.fromType !== 'event' ? `${stmt.fromType} ${stmt.fromName}` : stmt.fromName;
    const toRef = stmt.toType !== 'event' ? `${stmt.toType} ${stmt.toName}` : stmt.toName;
    this._line(`zoom in on ${fromRef} and ${toRef} into ${stmt.intoName}`);
  }

  _formatZoomOut(stmt) {
    const srcRef = stmt.sourceType !== 'event' ? `${stmt.sourceType} ${stmt.sourceName}` : stmt.sourceName;
    this._line(`zoom out on ${srcRef} as event ${stmt.asName}`);
  }

  _formatZoomOpposite(stmt) {
    this._line(`zoom opposite on ${stmt.sourceName} into ${stmt.intoName}`);
  }

  _formatZoomMeta(stmt) {
    const subjects = stmt.subjects.join(' and ');
    this._line(`zoom meta on ${subjects} into ${stmt.intoName}`);
  }

  _formatSpinStmt(stmt) {
    const dim = stmt.dimension && stmt.dimension > 2 ? ` at dimension ${stmt.dimension}` : '';
    this._line(`spin ${stmt.sourceName} into ${stmt.intoName}${dim}`);
  }

  _formatVibrateStmt(stmt) {
    this._line(`vibrate ${stmt.torusName} across ${stmt.rings}`);
  }

  _formatCycleStmt(stmt) {
    this._line(`cycle ${stmt.torusName}`);
  }

  _formatResonateStmt(stmt) {
    this._line(`resonate ${stmt.firstName} and ${stmt.secondName}`);
  }

  _formatWeightStmt(stmt) {
    this._line(`weight ${stmt.targetName} at ${stmt.value}`);
  }

  _formatExplainStmt(stmt) {
    this._line(`explain ${stmt.observations} from ${stmt.candidates} into ${stmt.intoName}`);
  }

  _formatAnalogyStmt(stmt) {
    this._line(`analogy ${stmt.firstName} and ${stmt.secondName} into ${stmt.intoName}`);
  }

  _formatLandscapeStmt(stmt) {
    const sources = (stmt.sources || []).join(' and ');
    this._line(`landscape from ${sources} into ${stmt.intoName}`);
  }

  _formatForecastStmt(stmt) {
    this._line(`forecast from ${stmt.landscapeName} into ${stmt.intoName}`);
  }

  _formatBoundStmt(stmt) {
    this._line(`bound ${stmt.firstName} and ${stmt.secondName} into ${stmt.intoName}`);
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

  // ── v2.0 format methods ───────────────────────────────────

  _formatActorStmt(stmt) {
    this._line(`actor ${stmt.name}`);
    this.indent++;
    if (stmt.category) this._line(`category ${stmt.category}`);
    if (stmt.matter && stmt.matter.fields && stmt.matter.fields.length > 0) {
      this._line('matter');
      this.indent++;
      for (const f of stmt.matter.fields) {
        this._line(f.kind === 'literal' ? `${f.key} is ${f.value}` : `${f.key} from ${f.value}`);
      }
      this.indent--;
      this._line('end');
    }
    this.indent--;
    this._line('end');
  }

  _formatChainStmt(stmt) {
    this._line(`chain ${stmt.name}`);
    this.indent++;
    for (const link of (stmt.links || [])) {
      this._line(`${link.from} leads to ${link.to}`);
    }
    this.indent--;
    this._line('end');
  }

  _formatEventLikeStmt(stmt) {
    this._line(`${stmt.keyword} ${stmt.name}`);
    this.indent++;
    if (stmt.category) this._line(`category ${stmt.category}`);
    if (stmt.matter && stmt.matter.fields && stmt.matter.fields.length > 0) {
      this._line('matter');
      this.indent++;
      for (const f of stmt.matter.fields) {
        this._line(f.kind === 'literal' ? `${f.key} is ${f.value}` : `${f.key} from ${f.value}`);
      }
      this.indent--;
      this._line('end');
    }
    this.indent--;
    this._line('end');
  }

  _formatAsymmetryStmt(stmt) {
    this._line(`asymmetry from ${stmt.firstName} and ${stmt.secondName} into ${stmt.intoName}`);
  }

  _formatRootOfStmt(stmt) {
    const chain = stmt.chainName ? ` in ${stmt.chainName}` : '';
    this._line(`root of ${stmt.stateName}${chain} into ${stmt.intoName}`);
  }

  _formatInvertStmt(stmt) {
    this._line(`invert ${stmt.sourceName} into ${stmt.intoName}`);
  }

  _formatAssumeStmt(stmt) {
    this._line(`assume ${stmt.text}`);
  }

  _formatDetectFallaciesStmt(stmt) {
    this._line(`detect fallacies in ${stmt.chainName} into ${stmt.intoName}`);
  }

  _formatFractalStmt(stmt) {
    this._line(`fractal ${stmt.firstName} and ${stmt.secondName} into ${stmt.intoName}`);
  }

  _formatSatisfyStmt(stmt) {
    this._line(`satisfy ${stmt.desireName} against ${stmt.chainName} into ${stmt.intoName}`);
  }

  _formatEvaluateStmt(stmt) {
    const names = (stmt.desireNames || []).join(' and ');
    this._line(`evaluate ${names} against ${stmt.chainName} into ${stmt.intoName}`);
  }

  _formatDimensionalStmt(stmt) {
    const names = (stmt.desireNames || []).join(' and ');
    this._line(`evaluate ${names} against ${stmt.chainName} across fractal ${stmt.fractalName} into ${stmt.intoName}`);
  }

  _formatDiagnoseStmt(stmt) {
    this._line(`why ${stmt.desireName} is not satisfied in ${stmt.chainName} into ${stmt.intoName}`);
  }

  _formatChallengeStmt(stmt) {
    this._line(`challenge ${stmt.assumptionName} in ${stmt.reportName} into ${stmt.intoName}`);
  }

  _formatCompareStmt(stmt) {
    this._line(`compare ${stmt.chain1Name} and ${stmt.chain2Name} for ${stmt.desireName} into ${stmt.intoName}`);
  }
}

module.exports = { EventMathFormatter };
