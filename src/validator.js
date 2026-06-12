/**
 * EventMath Semantic Validator v0.1
 *
 * A post-parse semantic validation pass over the AST.
 * Catches problems the parser cannot — things that are syntactically fine
 * but semantically broken (referencing things that don't exist, reserved
 * words in names, duplicates, etc.)
 *
 * Returns { errors: string[], warnings: string[] }.
 * All messages use EventMath vocabulary only — no JS jargon.
 */

const { KEYWORDS } = require('./tokenizer.js');

class EventMathValidator {
  validate(ast) {
    this.errors = [];
    this.warnings = [];

    // Declared symbol tables
    this.events = new Map();     // name → true
    this.layers = new Map();
    this.timelines = new Map();
    this.actions = new Map();
    this.marks = new Map();

    if (!ast || !ast.statements) {
      return { errors: this.errors, warnings: this.warnings };
    }

    // Pass 1: collect all declarations (and check for duplicates + reserved words)
    this._collectDeclarations(ast.statements);

    // Pass 2: validate references
    this._validateReferences(ast.statements);

    return { errors: this.errors, warnings: this.warnings };
  }

  // ── Pass 1: collect declarations ───────────────────────────────

  _collectDeclarations(statements) {
    for (const stmt of statements) {
      if (!stmt) continue;
      switch (stmt.type) {
        case 'Event':
          this._registerSymbol('event', stmt.name, this.events);
          break;
        case 'Layer':
          this._registerSymbol('layer', stmt.name, this.layers);
          break;
        case 'Timeline':
          this._registerSymbol('timeline', stmt.name, this.timelines);
          break;
        case 'Action':
          this._registerSymbol('action', stmt.name, this.actions);
          // Recurse into action body
          if (stmt.body) this._collectDeclarations(stmt.body);
          break;
        case 'Mark':
          this._registerSymbol('mark', stmt.name, this.marks);
          break;
        case 'Use':
          // Imported names are external — treat as valid symbols to avoid false E017 errors
          // Add to all symbol sets since we don't know the type at validate time
          this.events.set(stmt.name, true);
          this.layers.set(stmt.name, true);
          this.actions.set(stmt.name, true);
          this.marks.set(stmt.name, true);
          break;
        case 'ZoomIn':
          // Register the zoom-in result as a known layer or timeline
          if (stmt.intoName) {
            if (stmt.fromType === 'layer') {
              this.layers.set(stmt.intoName, true);
            } else {
              this.timelines.set(stmt.intoName, true);
            }
          }
          break;
        case 'ZoomOut':
          if (stmt.asName) {
            this.events.set(stmt.asName, true);
          }
          break;
        case 'ZoomOpposite':
          if (stmt.intoName) {
            this.timelines.set(stmt.intoName, true);
          }
          break;
        case 'ZoomMeta':
          if (stmt.intoName) {
            this.timelines.set(stmt.intoName, true);
          }
          break;
        case 'SpinStmt':
          if (stmt.intoName) {
            // torus is a new kind — register as a known symbol
            this.marks.set(stmt.intoName, true);
          }
          break;
        case 'ExplainStmt':
          if (stmt.intoName) {
            this.events.set(stmt.intoName, true);
          }
          break;
        case 'AnalogyStmt':
          if (stmt.intoName) {
            this.marks.set(stmt.intoName, true);
          }
          break;
        case 'LandscapeStmt':
          if (stmt.intoName) {
            this.marks.set(stmt.intoName, true);
          }
          break;
        case 'ForecastStmt':
          if (stmt.intoName) {
            this.events.set(stmt.intoName, true);
          }
          break;
        case 'BoundStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'ActorStmt':
          this._registerSymbol('actor', stmt.name, this.events);
          break;
        case 'ChainStmt':
          this.marks.set(stmt.name, true);
          break;
        case 'EventLikeStmt':
          this._registerSymbol(stmt.keyword, stmt.name, this.events);
          break;
        case 'AsymmetryStmt':
        case 'RootOfStmt':
        case 'InvertStmt':
        case 'DetectFallaciesStmt':
        case 'FractalStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
      }
    }
  }

  _registerSymbol(kind, name, map) {
    if (!name) return;

    // Check reserved words in name parts.
    // Only flag a word if the entire name is that single keyword,
    // OR if the word is a "structural" keyword that would break parsing
    // (not natural-language prepositions like to, from, as, by, and, not).
    const naturalWords = new Set(['to', 'from', 'as', 'by', 'and', 'not', 'is', 'with', 'into', 'at', 'zoom']);
    const words = name.split(/\s+/);
    for (const word of words) {
      const lw = word.toLowerCase();
      if (KEYWORDS.has(lw) && !naturalWords.has(lw)) {
        this.errors.push(
          `The word "${word}" is reserved and cannot be part of a ${kind} name. ` +
          `Reserved words have one meaning in EventMath.`
        );
      }
    }

    // Check duplicate
    if (map.has(name)) {
      this.warnings.push(
        `A ${kind} named "${name}" was already declared. Each ${kind} needs a unique name.`
      );
    } else {
      map.set(name, true);
    }
  }

  // ── Pass 2: validate references ────────────────────────────────

  _validateReferences(statements) {
    for (const stmt of statements) {
      if (!stmt) continue;
      switch (stmt.type) {
        case 'Layer':
          // Each event name in a layer must be a declared event
          for (const ref of (stmt.events || [])) {
            if (!this.events.has(ref.name)) {
              this.errors.push(
                `Layer "${stmt.name}" contains "${ref.name}", but no event named "${ref.name}" was declared. ` +
                `Did you mean to write "event ${ref.name}" first?`
              );
            }
          }
          break;

        case 'Timeline':
          // Each layer name in past/present/future must be a declared layer
          for (const section of ['past', 'present', 'future']) {
            const sec = stmt[section];
            if (!sec) continue;
            for (const ref of (sec.layers || [])) {
              if (!this.layers.has(ref.name)) {
                this.errors.push(
                  `Timeline "${stmt.name}" (${section}) contains "${ref.name}", but no layer named "${ref.name}" was declared. ` +
                  `Did you mean to write "layer ${ref.name}" first?`
                );
              }
            }
          }
          break;

        case 'Walk':
          // Walk target must be a declared layer
          if (stmt.layer && !this.layers.has(stmt.layer)) {
            this.errors.push(
              `"walk ${stmt.layer}" refers to a layer that has not been declared. ` +
              `Did you mean to write "layer ${stmt.layer}" first?`
            );
          }
          // Recurse into walk body
          if (stmt.body) this._validateReferences(stmt.body);
          break;

        case 'ActionCall':
          // Action must exist
          if (stmt.name && !this.actions.has(stmt.name)) {
            this.errors.push(
              `"${stmt.name} with ..." calls an action named "${stmt.name}", but no action with that name was declared. ` +
              `Did you mean to write "action ${stmt.name}" first?`
            );
          }
          break;

        case 'Action':
          if (stmt.body) this._validateReferences(stmt.body);
          break;

        case 'When':
          if (stmt.body) this._validateReferences(stmt.body);
          if (stmt.otherwise) this._validateReferences(stmt.otherwise);
          break;

        case 'Split':
          for (const path of (stmt.paths || [])) {
            if (path.body) this._validateReferences(path.body);
          }
          break;

        case 'AgainCount':
        case 'AgainUntil':
          if (stmt.body) this._validateReferences(stmt.body);
          break;

        case 'Overlap':
          for (const track of (stmt.tracks || [])) {
            this._validateReferences(track);
          }
          break;
      }
    }
  }
}

module.exports = { EventMathValidator };
