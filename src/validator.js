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
    this.foragers = new Map(); // v2.30 — forage block names

    if (!ast || !ast.statements) {
      return { errors: this.errors, warnings: this.warnings };
    }

    // Pass 1: collect all declarations (and check for duplicates + reserved words)
    this._collectDeclarations(ast.statements);

    // Pass 2: validate references
    this._validateReferences(ast.statements);

    // Pass 3: stigmergy rules — statelessness guarantee + world resolution
    this._validateStigmergy(ast.statements, null);

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
        // v2.29 — stigmergy layer
        case 'WorldStmt':
          if (stmt.name) this.marks.set(stmt.name, true);
          break;
        case 'AnimalStmt':
          if (stmt.name) this.marks.set(stmt.name, true);
          break;
        case 'SenseStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'ForageStmt':
          if (stmt.name) { this.marks.set(stmt.name, true); this.foragers.set(stmt.name, true); }
          if (stmt.body) this._collectDeclarations(stmt.body);
          break;
        case 'Mark':
          this._registerSymbol('mark', stmt.name, this.marks);
          break;
        case 'GroundStmt':
          // `ground NAME at "file.db"` declares a queryable ground value.
          if (stmt.op === 'open' && stmt.name) this.marks.set(stmt.name, true);
          break;
        case 'DrawStmt':
          // `draw "..." from g into RESULT` declares RESULT (the rows).
          if (stmt.into) this.marks.set(stmt.into, true);
          break;
        case 'AskStmt':
          if (stmt.into && stmt.into !== '_') this.marks.set(stmt.into, true);
          break;
        case 'LiveDrawStmt':
          if (stmt.into) this.marks.set(stmt.into, true);
          break;
        case 'ServeStmt':
          for (const route of (stmt.routes || [])) {
            if (route.body) this._collectDeclarations(route.body);
          }
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
            this.marks.set(stmt.intoName, true);
          }
          break;
        case 'AnchorStmt':
          if (stmt.name) {
            this.marks.set(stmt.name, true);
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
        case 'SpineStmt':
        case 'SatisfyStmt':
        case 'EvaluateStmt':
        case 'DimensionalStmt':
        case 'GradeStmt':
        case 'DiagnoseStmt':
        case 'ChallengeStmt':
        case 'CompareStmt':
        case 'ConflictStmt':
        case 'WeighStmt':
        case 'DeepenStmt':
        case 'ExtendStmt':
        case 'TraceStmt':
        case 'ScrubStmt':
        case 'ZoneStmt':
        case 'SkyStmt':
        case 'LensStmt':
        case 'AtmosphereStmt':
        case 'EarthStmt':
        case 'MapStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'RainStmt':
        case 'StarStmt':
        case 'UniverseStmt':
        case 'CloudStmt':
          if (stmt.name) this.marks.set(stmt.name, true);
          break;
        case 'OrbitStmt':
          if (stmt.body) this._collectDeclarations(stmt.body);
          break;
        case 'AttemptStmt':
          if (stmt.tryBody)   this._collectDeclarations(stmt.tryBody);
          if (stmt.catchBody) this._collectDeclarations(stmt.catchBody);
          if (stmt.alwaysBody) this._collectDeclarations(stmt.alwaysBody);
          break;
        // v2.12
        case 'PullStmt':
          for (const name of (stmt.names || [])) {
            this.events.set(name, true);
            this.layers.set(name, true);
            this.actions.set(name, true);
            this.marks.set(name, true);
          }
          break;
        case 'EmitStmt':
          break;
        case 'ObserveStmt':
          if (stmt.body) this._collectDeclarations(stmt.body);
          break;
        case 'OnLifecycleStmt':
        case 'OnEventStmt':
          if (stmt.body) this._collectDeclarations(stmt.body);
          break;
        case 'MatchStmt':
          for (const arm of (stmt.arms || [])) {
            if (arm.body) this._collectDeclarations(arm.body);
          }
          if (stmt.defaultBody) this._collectDeclarations(stmt.defaultBody);
          break;
        case 'NewStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'GroundStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'EveryStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'BurstStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'AwaitStmt':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        // v2.14 — collection results
        case 'FilterStmt':
        case 'FindStmt':
        case 'SortStmt':
        case 'CountStmt':
        case 'PipeStmt':
        case 'CastStmt':
          if (stmt.resultName) this.marks.set(stmt.resultName, true);
          break;
        // v2.16 — HTTP server
        case 'ServeStmt':
          for (const route of (stmt.routes || [])) {
            if (route.body) this._collectDeclarations(route.body);
          }
          break;
        // v2.16 — manifest (self-generating app)
        case 'ManifestStmt':
          for (const store of (stmt.stores || [])) {
            if (store.table) this.marks.set(store.table, true);
            if (store.table) this.marks.set('all_' + store.table, true);
          }
          break;
        // v2.17 — named patterns
        case 'PatternStmt':
          if (stmt.name) this.marks.set(stmt.name.replace(/\s+/g, '_'), true);
          break;
        case 'ScanStmt':
          if (stmt.into) this.marks.set(stmt.into, true);
          break;
        case 'SeekStmt':
          if (stmt.into) this.marks.set(stmt.into, true);
          break;
        // v2.18 — replace, zoom out from, zoom expand
        case 'ReplaceStmt':
          if (stmt.into) this.marks.set(stmt.into, true);
          break;
        case 'ZoomOutFrom':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
        case 'ZoomExpand':
          if (stmt.intoName) this.marks.set(stmt.intoName, true);
          break;
      }
    }
  }

  // ── Pass 3: stigmergy rules ────────────────────────────────────
  // Enforce the headline guarantee of the forage block: a forager holds no
  // memory of its own. Durable in-agent state (`live` signals, `remember`
  // store) is forbidden inside a forage body — persistence must go through the
  // world as trails. Also: sense/trail need a world unless inside a forager.
  _validateStigmergy(statements, forageWorld) {
    for (const stmt of statements) {
      if (!stmt) continue;
      const inForage = forageWorld !== null;

      switch (stmt.type) {
        case 'ForageStmt':
          if (!stmt.world) {
            this.errors.push(
              `"forage ${stmt.name}" needs a world to forage on — write "forage ${stmt.name} on WORLD".`
            );
          }
          this._validateStigmergy(stmt.body || [], stmt.world || '');
          continue;

        case 'RainStmt':
          if (inForage && stmt.live) {
            this.errors.push(
              `A forager holds no memory of its own: "live rain ${stmt.name}" is not allowed ` +
              `inside "forage". Persist through the world with "trail ${stmt.name} by ..." instead.`
            );
          }
          break;

        case 'RememberStmt':
          if (inForage) {
            this.errors.push(
              `A forager holds no memory of its own: "remember" is not allowed inside "forage". ` +
              `Lay a trail in the world instead.`
            );
          }
          break;

        case 'SenseStmt':
          if (!inForage && !stmt.world) {
            this.errors.push(
              `"sense ${stmt.name}" needs a world — write "sense ${stmt.name} in WORLD into ..." ` +
              `or place it inside a "forage" block.`
            );
          }
          break;

        case 'TrailStmt':
          if (!inForage && !stmt.world) {
            this.errors.push(
              `"trail ${stmt.name}" needs a world — write "trail ${stmt.name} in WORLD by ..." ` +
              `or place it inside a "forage" block.`
            );
          }
          break;

        case 'StepStmt':
          if (stmt.name && !this.foragers.has(stmt.name)) {
            this.warnings.push(
              `"step ${stmt.name}" refers to a forager that was not declared. ` +
              `Declare it first with "forage ${stmt.name} on WORLD ... end".`
            );
          }
          break;
      }

      // Recurse into nested bodies (when/otherwise, action, etc.), preserving
      // whether we are inside a forage block.
      if (stmt.body && stmt.type !== 'ForageStmt') this._validateStigmergy(stmt.body, forageWorld);
      if (stmt.otherwise) this._validateStigmergy(stmt.otherwise, forageWorld);
    }
  }

  _registerSymbol(kind, name, map) {
    if (!name) return;

    // Check reserved words in name parts.
    // Only flag a word if the entire name is that single keyword,
    // OR if the word is a "structural" keyword that would break parsing
    // (not natural-language prepositions like to, from, as, by, and, not).
    const naturalWords = new Set(['to', 'from', 'as', 'by', 'and', 'not', 'is', 'with', 'into', 'at', 'zoom', 'for', 'through', 'conflict', 'weigh', 'deepen', 'trace', 'anchor', 'spine', 'grade', 'extend', 'scrub', 'rain', 'star', 'zone', 'sky', 'lens', 'orbit', 'cloud', 'node', 'earth', 'travel', 'map', 'attempt', 'collapse', 'always', 'reflect', 'field', 'style', 'route', 'expand', 'atmosphere', 'void', 'guard', 'match', 'arm', 'escape', 'skip', 'observe', 'every', 'clear', 'on', 'off', 'trigger', 'emit', 'pull', 'raindrop', 'ground', 'new', 'await', 'slot', 'burst', 'live',
      'pipe', 'cast', 'log', 'filter', 'find', 'sort', 'count', 'where',
      'story', 'narrative', 'scope', 'scenario',
      'emerge', 'wifi', 'lookup', 'watch',
      'agent', 'remember', 'recall', 'alert', 'control', 'send', 'play', 'pause', 'next', 'previous', 'media', 'via', 'computer', 'mute', 'loop',
      'role', 'hierarchy', 'incentive', 'align', 'credibility',
      'watchdog', 'sweep', 'quarantine', 'inoculate',
      'instruct', 'fundamental', 'buffett', 'graham', 'network', 'connect', 'offline',
      'fetch', 'socket', 'serial', 'spawn', 'bytes', 'port', 'baud', 'udp', 'body', 'get', 'post',
      'world', 'animal', 'trail', 'sense', 'fade', 'forage', 'step']);
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

        case 'PredictStmt': {
          const dims = (stmt.dimensions && stmt.dimensions.length > 0)
            ? stmt.dimensions
            : [stmt.directionsLayer, stmt.lensesLayer, stmt.quantitiesLayer].filter(Boolean);
          if (dims.length > 3 && !stmt.fractalName) {
            this.warnings.push(
              `"predict ${stmt.subject}" crosses ${dims.length} condition dimensions without routing through a fractal axis. ` +
              `All condition dimensions must pass through the three structural tiers (surface D±13, system D±26, root D±39). ` +
              `Add "through FRACTAL" to enforce dimensional routing, ` +
              `e.g.: predict ${stmt.subject} across ${dims.slice(0, 2).join(' and ')} ... through my axis into ${stmt.intoLayer}`
            );
          }
          break;
        }

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
