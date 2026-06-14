'use strict';
/**
 * EventMath System Map Generator
 *
 * Walks the AST and emits a dependency graph of the program.
 * Makes the moving system visible without running it.
 *
 * live rain nodes → sources
 * lens nodes → derived values (with signal dependencies traced)
 * guard nodes → gates
 * cloud blocks → components
 * all other declarations → nodes with their relationships
 *
 * Output is a JSON graph with nodes and edges.
 * Both human-readable and machine-readable.
 */

const { safeName } = require('./expression.js');

function nodeId(kind, name) {
  if (!name) return `${kind}:__unnamed__`;
  return `${kind}:${safeName(name)}`;
}

class EventMathSystemMap {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this._signalNames = new Set();   // names of reactive signals (live rain)
    this._lensNames   = new Set();   // names of lenses (derived)
    this._allNames    = new Set();   // all declared names
    this._nameToNodeId = {};        // name → node id
    this._nodeById     = {};        // id → node object
    this._guardNodes   = [];        // guard nodes (added after building)
    this._guardCounter = 0;         // unique counter for guard IDs
  }

  /**
   * Build a system map from an EventMath Program AST.
   * @param {object} ast
   * @returns {object} { nodes, edges, summary }
   */
  build(ast) {
    this.nodes = [];
    this.edges = [];
    this._signalNames = new Set();
    this._lensNames = new Set();
    this._allNames = new Set();
    this._nameToNodeId = {};
    this._nodeById = {};
    this._guardNodes = [];

    // ── Pass 1: collect names ──
    this._firstPass(ast.statements);

    // ── Pass 2: build nodes + detect dependencies ──
    for (const stmt of ast.statements) {
      this._buildNode(stmt, {});
    }

    // ── Build edges from guard contexts ──
    // Guards themselves don't have names, but we connect them
    // to the tokens they guard by position.
    for (const guard of this._guardNodes) {
      this._addEdge(guard.id, guard.nextNodeId, 'guards');
    }

    return this._result();
  }

  // ── Pass 1: register all declaration names ──
  _firstPass(statements) {
    for (const stmt of statements) {
      if (!stmt) continue;
      switch (stmt.type) {
        case 'RainStmt':
          if (stmt.name) {
            this._allNames.add(stmt.name);
            if (stmt.live) this._signalNames.add(stmt.name);
          }
          break;
        case 'LensStmt':
          if (stmt.name) {
            this._allNames.add(stmt.name);
            this._lensNames.add(stmt.name);
          }
          break;
        case 'StarStmt':
        case 'CloudStmt':
        case 'ZoneStmt':
        case 'SkyStmt':
        case 'Mark':
        case 'Set':
        case 'Event':
        case 'Layer':
        case 'Timeline':
        case 'Action':
        case 'UniverseStmt':
        case 'AtmosphereStmt':
        case 'GuardStmt':
          if (stmt.name) this._allNames.add(stmt.name);
          break;
        // Recurse into blocks
        case 'When':
          this._firstPass(stmt.body || []);
          this._firstPass(stmt.otherwise || []);
          break;
        case 'AgainCount':
        case 'AgainUntil':
        case 'Walk':
          this._firstPass(stmt.body || []);
          break;
        case 'OrbitStmt':
          this._firstPass(stmt.body || []);
          break;
        case 'CloudStmt':
          this._firstPass(stmt.body || []);
          break;
        case 'ObserveStmt':
          this._firstPass(stmt.body || []);
          break;
        case 'AttemptStmt':
          this._firstPass(stmt.tryBody || []);
          this._firstPass(stmt.catchBody || []);
          this._firstPass(stmt.alwaysBody || []);
          break;
        case 'Overlap':
          for (const track of (stmt.tracks || [])) this._firstPass(track);
          break;
        case 'OnLifecycleStmt':
          this._firstPass(stmt.body || []);
          break;
        case 'OnEventStmt':
          this._firstPass(stmt.body || []);
          break;
        // v2.20 — story layer
        case 'NarrativeStmt':
        case 'ScenarioStmt':
          this._firstPass(stmt.body || []);
          break;
        case 'StoryStmt':
        case 'ScopeStmt':
          // No body recursion needed for these
          break;
      }
    }
  }

  _addNode(node) {
    this.nodes.push(node);
    if (node.name) {
      this._nameToNodeId[node.name] = node.id;
    }
    this._nodeById[node.id] = node;
  }

  _addEdge(from, to, via) {
    // Deduplicate edges
    const key = `${from}→${to}:${via}`;
    if (!this._edgeSet) this._edgeSet = new Set();
    if (this._edgeSet.has(key)) return;
    this._edgeSet.add(key);
    this.edges.push({ from, to, via });
  }

  // ── Find signal/lens names referenced in an expression string ──
  _findSignalDeps(expression) {
    if (!expression || !expression.trim()) return [];
    const words = expression.trim().split(/\s+/);
    const deps = [];
    for (const word of words) {
      const cleaned = safeName(word);
      if (this._signalNames.has(cleaned)) {
        deps.push(nodeId('live rain', cleaned));
      }
      if (this._lensNames.has(cleaned)) {
        deps.push(nodeId('lens', cleaned));
      }
    }
    return [...new Set(deps)];
  }

  // ── Find ALL known name references in an expression ──
  _findNameDeps(expression) {
    if (!expression || !expression.trim()) return [];
    const words = expression.trim().split(/\s+/);
    const deps = [];
    for (const word of words) {
      const cleaned = safeName(word);
      if (this._nameToNodeId[cleaned]) {
        deps.push(this._nameToNodeId[cleaned]);
      }
    }
    return [...new Set(deps)];
  }

  // ── Pass 2: build node for one statement ──
  _buildNode(stmt, ctx) {
    if (!stmt) return;

    switch (stmt.type) {
      // ═══════════════════════════════════════
      // SOURCES — live signals
      // ═══════════════════════════════════════
      case 'RainStmt': {
        const id = nodeId('live rain', stmt.name);
        const pfx = stmt.live ? 'live rain' : 'rain';
        this._addNode({
          id,
          type: stmt.live ? 'source' : 'variable',
          kind: pfx,
          name: stmt.name,
          initialValue: (stmt.value || '').trim() || 'void',
          description: stmt.live
            ? 'Reactive signal — when this value changes, all lenses watching it recompute'
            : 'Plain variable — stores a value, doesn\'t trigger reactivity',
        });
        break;
      }

      // ═══════════════════════════════════════
      // DERIVED — lenses (reactive computations)
      // ═══════════════════════════════════════
      case 'LensStmt': {
        const id = nodeId('lens', stmt.name);
        const raw = (stmt.expression || '').trim();
        const signalDeps = this._findSignalDeps(raw);
        const nameDeps = this._findNameDeps(raw);
        const allDeps = [...new Set([...signalDeps, ...nameDeps])];

        this._addNode({
          id,
          type: 'derived',
          kind: 'lens',
          name: stmt.name,
          expression: raw || 'null',
          dependencies: allDeps,
          description: allDeps.length > 0
            ? `Reactive lens — recomputes when ${allDeps.map(d => d.replace(/^(live rain|lens|variable):/, '')).join(' or ')} changes`
            : 'Static lens — computed once at module load',
        });

        for (const depId of allDeps) {
          this._addEdge(depId, id, 'feeds into');
        }
        break;
      }

      // ═══════════════════════════════════════
      // GATES — guards (conditions that block)
      // ═══════════════════════════════════════
      case 'GuardStmt': {
        const raw = (stmt.condition || '').trim();
        const idx = this._guardCounter++;
        const guardId = nodeId('guard', `__guard_${idx}`);
        this._addNode({
          id: guardId,
          type: 'gate',
          kind: 'guard',
          name: raw ? `guard: ${raw}` : 'unnamed guard',
          condition: raw,
          fallback: stmt.fallback || 'void',
          dependencies: this._findNameDeps(raw),
          description: raw
            ? `Guard gate — blocks execution unless "${raw}" is true`
            : 'Guard gate — blocks execution',
        });
        // Link guard condition deps
        for (const depId of this._findNameDeps(raw)) {
          this._addEdge(depId, guardId, 'conditions');
        }
        // Store for post-pass edge linking if we know the next node
        stmt._guardId = guardId;
        break;
      }

      // ═══════════════════════════════════════
      // COMPONENTS — clouds (function scopes)
      // ═══════════════════════════════════════
      case 'CloudStmt': {
        const id = nodeId('cloud', stmt.name);
        const bodyRefs = this._collectBodyRefs(stmt.body || []);
        this._addNode({
          id,
          type: 'component',
          kind: 'cloud',
          name: stmt.name,
          isAsync: !!stmt.isAsync,
          bodyStatementCount: (stmt.body || []).length,
          bodyReferences: [...bodyRefs],
          description: `Component scope — ${stmt.isAsync ? 'async ' : ''}function that groups logic`,
        });
        // Link body references
        for (const refId of bodyRefs) {
          this._addEdge(refId, id, 'used in');
        }
        break;
      }

      // ═══════════════════════════════════════
      // FUNCTIONS — actions
      // ═══════════════════════════════════════
      case 'Action': {
        const id = nodeId('action', stmt.name);
        const inputs = (stmt.doorOpen && stmt.doorOpen.inputs) || [];
        const bodyRefs = this._collectBodyRefs(stmt.body || []);
        this._addNode({
          id,
          type: 'function',
          kind: 'action',
          name: stmt.name,
          inputs,
          inputCount: inputs.length,
          bodyReferences: [...bodyRefs],
          description: `Action — callable function${inputs.length > 0 ? ` that takes ${inputs.length} input${inputs.length > 1 ? 's' : ''}` : ''}`,
        });
        for (const refId of bodyRefs) {
          this._addEdge(refId, id, 'used in');
        }
        break;
      }

      // ═══════════════════════════════════════
      // SCHEMAS — events
      // ═══════════════════════════════════════
      case 'Event': {
        const id = nodeId('event', stmt.name);
        const matters = (stmt.matters || []).map(m => ({
          name: m.name,
          value: m.value || 'void',
        }));
        this._addNode({
          id,
          type: 'schema',
          kind: 'event',
          name: stmt.name,
          matters,
          matterCount: matters.length,
          description: `Event schema — "${stmt.name}" things that happen or exist`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // COLLECTIONS — layers
      // ═══════════════════════════════════════
      case 'Layer': {
        const id = nodeId('layer', stmt.name);
        this._addNode({
          id,
          type: 'collection',
          kind: 'layer',
          name: stmt.name,
          description: 'Layer — ordered container of events',
        });
        break;
      }

      // ═══════════════════════════════════════
      // SEQUENCES — timelines
      // ═══════════════════════════════════════
      case 'Timeline': {
        const id = nodeId('timeline', stmt.name);
        this._addNode({
          id,
          type: 'sequence',
          kind: 'timeline',
          name: stmt.name,
          description: 'Timeline — append-only sequence with snapshots',
        });
        break;
      }

      // ═══════════════════════════════════════
      // VARIABLES — marks
      // ═══════════════════════════════════════
      case 'Mark': {
        const id = nodeId('mark', stmt.name);
        const node = {
          id,
          type: 'variable',
          kind: 'mark',
          name: stmt.name,
        };
        if (stmt.expr) {
          node.expression = stmt.expr;
          node.dependencies = this._findNameDeps(stmt.expr);
          node.description = `Mark — computed value: ${stmt.expr}`;
          for (const depId of node.dependencies) {
            this._addEdge(depId, id, 'feeds into');
          }
        } else if (stmt.builtinExpr) {
          node.expression = stmt.builtinExpr;
          node.description = `Mark — computed value: ${stmt.builtinExpr}`;
        } else if (stmt.stringOp) {
          node.operation = stmt.stringOp.op || 'join';
          node.description = `Mark — string ${node.operation}`;
        } else {
          node.value = stmt.value;
          node.description = `Mark — stores "${stmt.value}"`;
        }
        this._addNode(node);
        break;
      }

      // ═══════════════════════════════════════
      // ASSIGNMENTS — set
      // ═══════════════════════════════════════
      case 'Set': {
        const id = nodeId('set', stmt.name);
        this._addNode({
          id,
          type: 'assignment',
          kind: 'set',
          name: stmt.name,
          description: `Set — assigns a new value to "${stmt.name}"`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // CONSTANTS — stars
      // ═══════════════════════════════════════
      case 'StarStmt': {
        const id = nodeId('star', stmt.name);
        this._addNode({
          id,
          type: 'constant',
          kind: 'star',
          name: stmt.name,
          value: (stmt.value || '').trim() || 'void',
          description: `Star — constant value "${stmt.name}"`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // CONTAINERS — zones (object literals)
      // ═══════════════════════════════════════
      case 'ZoneStmt': {
        const id = nodeId('zone', stmt.name);
        this._addNode({
          id,
          type: 'container',
          kind: 'zone',
          name: stmt.name,
          expression: (stmt.expression || '').trim(),
          description: `Zone — object literal "${stmt.name}"`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // ARRAYS — skies
      // ═══════════════════════════════════════
      case 'SkyStmt': {
        const id = nodeId('sky', stmt.name);
        this._addNode({
          id,
          type: 'array',
          kind: 'sky',
          name: stmt.name,
          expression: (stmt.expression || '').trim(),
          description: `Sky — array literal "${stmt.name}"`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // CONSTRUCTORS — universes
      // ═══════════════════════════════════════
      case 'UniverseStmt': {
        const id = nodeId('universe', stmt.name);
        const fields = (stmt.fields || []).map(f => f.name);
        this._addNode({
          id,
          type: 'constructor',
          kind: 'universe',
          name: stmt.name,
          fields,
          fieldCount: fields.length,
          description: `Universe — data constructor with ${fields.length} field${fields.length !== 1 ? 's' : ''}`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // USE — imports
      // ═══════════════════════════════════════
      case 'Use': {
        const id = nodeId('use', stmt.from || stmt.name || 'unknown');
        this._addNode({
          id,
          type: 'import',
          kind: 'use',
          name: stmt.name || stmt.from,
          source: stmt.from,
          description: `Import from "${stmt.from}"`,
        });
        break;
      }

      // ═══════════════════════════════════════
      // EARTH — HTTP calls
      // ═══════════════════════════════════════
      case 'EarthStmt': {
        const id = nodeId('earth', stmt.path || 'request');
        this._addNode({
          id,
          type: 'external',
          kind: 'earth',
          method: (stmt.method || 'get').toUpperCase(),
          path: stmt.path,
          intoName: stmt.intoName,
          description: `HTTP ${(stmt.method || 'get').toUpperCase()} — "${stmt.path}"`,
        });
        break;
      }

      // ── LIFECYCLE HOOKS ──
      case 'OnLifecycleStmt': {
        const id = nodeId('lifecycle', stmt.phase || 'unknown');
        const bodyRefs = this._collectBodyRefs(stmt.body || []);
        this._addNode({
          id,
          type: 'lifecycle',
          kind: 'on lifecycle',
          name: stmt.phase || 'unknown',
          isAsync: !!stmt.isAsync,
          bodyReferences: [...bodyRefs],
          description: `Lifecycle hook — runs at "${stmt.phase}" phase`,
        });
        for (const refId of bodyRefs) {
          this._addEdge(refId, id, 'used in');
        }
        break;
      }

      // ── EVENT HANDLERS ──
      case 'OnEventStmt': {
        const id = nodeId('on_event', stmt.event || 'unknown');
        const bodyRefs = this._collectBodyRefs(stmt.body || []);
        this._addNode({
          id,
          type: 'handler',
          kind: 'on event',
          name: stmt.event || 'unknown',
          isAsync: !!stmt.isAsync,
          bodyReferences: [...bodyRefs],
          description: `Event handler — triggers on "${stmt.event}" event`,
        });
        for (const refId of bodyRefs) {
          this._addEdge(refId, id, 'used in');
        }
        break;
      }

      // ── OBSERVE BLOCKS ──
      case 'ObserveStmt': {
        const id = nodeId('observe', stmt.name || 'anonymous');
        const bodyRefs = this._collectBodyRefs(stmt.body || []);
        this._addNode({
          id,
          type: 'observer',
          kind: 'observe',
          name: stmt.name,
          bodyReferences: [...bodyRefs],
          description: `Observer — immediately-invoked block`,
        });
        for (const refId of bodyRefs) {
          this._addEdge(refId, id, 'used in');
        }
        break;
      }

      // ── TIMERS ──
      case 'EveryStmt': {
        const id = nodeId('every', stmt.cloudName || stmt.intoName || 'timer');
        this._addNode({
          id,
          type: 'timer',
          kind: 'every',
          name: stmt.cloudName || stmt.intoName || 'timer',
          interval: stmt.interval || '1000',
          description: `Timer — calls every ${stmt.interval || '1000'}ms`,
        });
        break;
      }

      // ── EMIT / TRIGGER ──
      case 'EmitStmt': {
        const id = nodeId('emit', stmt.name || 'event');
        this._addNode({
          id,
          type: 'signal_out',
          kind: 'emit',
          name: stmt.name || 'event',
          kindOfEmit: stmt.kind || 'view',
          description: `Emit — sends "${stmt.kind || 'view'}" signal "${stmt.name || 'event'}"`,
        });
        break;
      }

      case 'TriggerStmt': {
        const id = nodeId('trigger', stmt.event || 'event');
        this._addNode({
          id,
          type: 'signal_out',
          kind: 'trigger',
          name: stmt.event || 'event',
          description: `Trigger — fires "${stmt.event}" event${stmt.payload ? ' with payload' : ''}`,
        });
        break;
      }

      // ── ATMOSPHERE (style/theme) ──
      case 'AtmosphereStmt': {
        const id = nodeId('atmosphere', stmt.name);
        this._addNode({
          id,
          type: 'theme',
          kind: 'atmosphere',
          name: stmt.name,
          props: stmt.props || {},
          description: `Theme — sets "${stmt.name}" atmosphere`,
        });
        break;
      }

      // ── MAP (router) ──
      case 'MapStmt': {
        const routes = (stmt.routes || []).map(r => ({
          name: r.name,
          path: r.path,
          cloud: r.cloudName,
        }));
        routes.forEach(r => {
          const routeId = nodeId('route', r.name);
          this._addNode({
            id: routeId,
            type: 'route',
            kind: 'route',
            name: r.name,
            path: r.path,
            targetCloud: r.cloud,
            description: `Route — "${r.path}" → cloud "${r.cloud}"`,
          });
          const targetId = nodeId('cloud', r.cloud);
          if (this._nodeById[targetId]) {
            this._addEdge(routeId, targetId, 'routes to');
          }
        });
        break;
      }

      // ── STREAM (raindrop) ──
      case 'RaindropStmt': {
        const id = nodeId('raindrop', stmt.name || 'stream');
        this._addNode({
          id,
          type: 'stream',
          kind: 'raindrop',
          name: stmt.name,
          rdType: stmt.rdType || 'text',
          description: `Raindrop —${stmt.rdType ? ` ${stmt.rdType}` : ''} stream element`,
        });
        break;
      }

      // ── NOTHING — no node ──
      case 'Note':
      case 'EscapeStmt':
      case 'SkipStmt':
        // These don't create nodes
        break;

      // ── DOOR CLOSED — inline return ──
      case 'DoorClosed': {
        // No separate node — it's a return from an action
        break;
      }

      // ── v2.20 story layer ──────────────────────────────────────────────

      case 'StoryStmt': {
        const id = nodeId('story', stmt.name);
        this._addNode({
          id,
          type: 'story_source',
          kind: 'story',
          name: stmt.name,
          source: stmt.source,
          query: stmt.query,
          intoLayer: stmt.into,
          description: `Story — scans "${stmt.source}" for "${stmt.query}"`,
        });
        break;
      }

      case 'NarrativeStmt': {
        const id = nodeId('narrative', stmt.name);
        this._addNode({
          id,
          type: 'perspective',
          kind: 'narrative',
          name: stmt.name,
          storyName: stmt.storyName,
          perspective: stmt.perspective,
          bodyStatementCount: (stmt.body || []).length,
          description: `Narrative — "${stmt.perspective}" view of "${stmt.storyName}"`,
        });
        break;
      }

      case 'ScopeStmt': {
        const id = nodeId('scope', stmt.into || stmt.subject);
        this._addNode({
          id,
          type: 'analysis',
          kind: 'scope',
          name: stmt.into || stmt.subject,
          subject: stmt.subject,
          dimensions: stmt.dimensions,
          description: `Scope — multi-dimensional analysis of "${stmt.subject}"`,
        });
        break;
      }

      case 'ScenarioStmt': {
        const id = nodeId('scenario', stmt.name);
        this._addNode({
          id,
          type: 'prediction',
          kind: 'scenario',
          name: stmt.name,
          condition: stmt.condition,
          probability: stmt.probability,
          bodyStatementCount: (stmt.body || []).length,
          description: `Scenario — "${stmt.name}" when ${stmt.condition}, likely ${stmt.probability}`,
        });
        break;
      }

      default:
        // Some statement types don't produce named nodes but
        // we may still want to track them if they have a name
        if (stmt.name) {
          this._addNode({
            id: nodeId(stmt.type, stmt.name),
            type: 'statement',
            kind: stmt.type,
            name: stmt.name,
            description: `${stmt.type} statement`,
          });
        }
        break;
    }
  }

  /**
   * Walk a body of statements and find references to known names.
   * Returns an array of node IDs.
   */
  _collectBodyRefs(body) {
    const refs = new Set();
    for (const stmt of (body || [])) {
      if (!stmt) continue;
      // Check if any property value in the statement refers to a known name
      for (const key of Object.keys(stmt)) {
        const val = stmt[key];
        if (typeof val === 'string' && this._nameToNodeId[safeName(val)]) {
          refs.add(this._nameToNodeId[safeName(val)]);
        }
        if (key === 'condition' && typeof val === 'string') {
          for (const dep of this._findSignalDeps(val)) refs.add(dep);
        }
        if (key === 'expression' && typeof val === 'string') {
          for (const dep of this._findSignalDeps(val)) refs.add(dep);
        }
      }
      // Check guard statements inside the body
      if (stmt._guardId) {
        // The guard is followed by whatever statement is next in this body
        refs.add(stmt._guardId);
      }
      // Recurse into substatements
      ['body', 'otherwise', 'tryBody', 'catchBody', 'alwaysBody'].forEach(k => {
        if (stmt[k]) {
          for (const r of this._collectBodyRefs(
            Array.isArray(stmt[k]) ? stmt[k] : [stmt[k]]
          )) refs.add(r);
        }
      });
      if (stmt.tracks) {
        for (const track of (stmt.tracks || [])) {
          for (const r of this._collectBodyRefs(track)) refs.add(r);
        }
      }
    }
    return refs;
  }

  _result() {
    const byType = {};
    for (const n of this.nodes) {
      byType[n.type] = (byType[n.type] || 0) + 1;
    }

    return {
      program: 'EventMath System Map',
      version: '0.1',
      generatedAt: new Date().toISOString(),
      totalNodes: this.nodes.length,
      totalEdges: this.edges.length,
      nodes: this.nodes,
      edges: this.edges,
      summary: {
        sources: this.nodes.filter(n => n.type === 'source').length,
        derivedValues: this.nodes.filter(n => n.type === 'derived').length,
        gates: this.nodes.filter(n => n.type === 'gate').length,
        components: this.nodes.filter(n => n.type === 'component').length,
        functions: this.nodes.filter(n => n.type === 'function').length,
        schemas: this.nodes.filter(n => n.type === 'schema').length,
        collections: this.nodes.filter(n => n.type === 'collection').length,
        sequences: this.nodes.filter(n => n.type === 'sequence').length,
        variables: this.nodes.filter(n => n.type === 'variable' || n.type === 'assignment').length,
        constants: this.nodes.filter(n => n.type === 'constant').length,
        byType,
      },
    };
  }
}

module.exports = { EventMathSystemMap };
