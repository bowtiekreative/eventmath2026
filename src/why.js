'use strict';
/**
 * EventMath Self-Explaining System — "Why" Query
 *
 * Given a signal name or cloud name, the system traces and narrates
 * what that thing depends on, what it affects, and what conditions gate it.
 *
 * Speaks in EventMath's own vocabulary — "flows into", "gated by", "feeds",
 * "watches", "blocks execution unless".
 *
 * Both the system map (dependency graph) and the AST are used to provide
 * a complete picture.
 */

const { EventMathSystemMap } = require('./system-map.js');
const { safeName } = require('./expression.js');

class EventMathWhy {
  /**
   * @param {object} ast - Parsed Program AST
   */
  constructor(ast) {
    this.ast = ast;
    const mapper = new EventMathSystemMap();
    this.map = mapper.build(ast);
    this._buildLookup();
  }

  _buildLookup() {
    // Build lookup maps
    this._byName = {};   // lowercase name → node(s)
    this._byId = {};
    this._edgesById = { from: {}, to: {} };
    this._kindById = {};
    this._typeById = {};

    for (const node of this.map.nodes) {
      this._byId[node.id] = node;
      if (node.name) {
        const key = node.name.toLowerCase();
        if (!this._byName[key]) this._byName[key] = [];
        this._byName[key].push(node);
      }
    }

    // Index outgoing edges (from → [to]) and incoming (to → [from])
    for (const edge of this.map.edges) {
      if (!this._edgesById.from[edge.from]) this._edgesById.from[edge.from] = [];
      this._edgesById.from[edge.from].push(edge);
      if (!this._edgesById.to[edge.to]) this._edgesById.to[edge.to] = [];
      this._edgesById.to[edge.to].push(edge);
    }
  }

  /**
   * Explain why a named thing exists — what flows into it,
   * what it affects, what gates it.
   *
   * @param {string} name - Signal/lens/cloud/action/event name
   * @returns {string} Human-readable explanation in EventMath vocabulary
   */
  explain(name) {
    if (!name || !name.trim()) {
      return 'I need a name to trace. Try "price", "total", or "my plants".';
    }

    const key = name.trim().toLowerCase();
    const nodes = this._byName[key] || [];

    if (nodes.length === 0) {
      // Try matching a safeName version
      const sn = safeName(name);
      const idMatch = Object.keys(this._byId).filter(id =>
        id.toLowerCase().includes(sn.toLowerCase())
      );
      if (idMatch.length > 0) {
        const matched = idMatch.map(id => this._byId[id]).filter(Boolean);
        for (const n of matched) {
          nodes.push(n);
        }
      }
    }

    if (nodes.length === 0) {
      return `I couldn't find "${name}" in the system map. Check the spelling — names are case-sensitive in EventMath.`;
    }

    const lines = [];
    for (const node of nodes) {
      lines.push('');
      lines.push(this._describeNode(node));
      lines.push('');

      // ── What feeds into this node? ──
      // Edges where OTHER nodes point TO this node
      const incomingEdges = this._edgesById.to[node.id] || [];
      // Edges where THIS node points TO other nodes
      const outgoingEdges = this._edgesById.from[node.id] || [];

      if (incomingEdges.length > 0) {
        lines.push(`  ⬅  What feeds into it:`);
        for (const edge of incomingEdges) {
          const fromNode = this._byId[edge.from];
          if (fromNode) {
            lines.push(`       ${this._formatNodeName(fromNode)} ${edge.via} ${this._formatNodeName(node)}`);
          }
        }
      }

      if (outgoingEdges.length > 0) {
        lines.push(`  ➡  What it affects:`);
        for (const edge of outgoingEdges) {
          const toNode = this._byId[edge.to];
          if (toNode) {
            lines.push(`       ${this._formatNodeName(node)} ${edge.via} ${this._formatNodeName(toNode)}`);
          }
        }
      }

      // ── Dependencies ──
      if (node.dependencies && node.dependencies.length > 0) {
        lines.push(`  🔗  Depends on:`);
        for (const depId of node.dependencies) {
          const depNode = this._byId[depId];
          if (depNode) {
            lines.push(`       ${this._formatNodeName(depNode)}`);
          }
        }
      }

      // ── Body references ──
      if (node.bodyReferences && node.bodyReferences.length > 0) {
        lines.push(`  📦  Uses in its body:`);
        for (const refId of node.bodyReferences) {
          const refNode = this._byId[refId];
          if (refNode) {
            lines.push(`       ${this._formatNodeName(refNode)}`);
          }
        }
      }

      // ── Condition details ──
      if (node.condition) {
        lines.push(`  🚧  Condition: "${node.condition}"`);
        if (node.fallback && node.fallback !== 'void') {
          lines.push(`       Falls back to: ${node.fallback}`);
        }
      }

      // ── Expression details ──
      if (node.expression && node.expression !== 'null') {
        lines.push(`  🧮  Expression: ${node.expression}`);
      }

      // ── Inputs ──
      if (node.inputs && node.inputs.length > 0) {
        lines.push(`  📥  Inputs: ${node.inputs.map(i => `"${i}"`).join(', ')}`);
      }

      // ── Matters (event fields) ──
      if (node.matters && node.matters.length > 0) {
        lines.push(`  📋  Matters:`);
        for (const m of node.matters) {
          lines.push(`       ${m.name}: ${m.value}`);
        }
      }

      // ── Summary sentence ──
      const summary = this._summarySentence(node);
      if (summary) {
        lines.push('');
        lines.push(`  📝  ${summary}`);
      }
    }

    return lines.join('\n');
  }

  _describeNode(node) {
    const kind = node.kind || node.type;
    const name = node.name || '(unnamed)';
    return `══ ${kind}: ${name} ══`;
  }

  _formatNodeName(node) {
    const kind = node.kind || node.type;
    return `"${node.name}" (${kind})`;
  }

  _summarySentence(node) {
    switch (node.kind) {
      case 'live rain':
        return `"${node.name}" is a reactive signal. When its value changes, every lens watching it recomputes. Nothing feeds into it — it's a source. Set it directly.`;
      case 'lens':
        if (node.dependencies && node.dependencies.length > 0) {
          const depNames = node.dependencies.map(d => {
            const n = this._byId[d];
            return n ? `"${n.name}"` : d;
          }).join(', ');
          return `"${node.name}" is a reactive lens. When ${depNames} changes, "${node.name}" recomputes automatically through "${node.expression}".`;
        }
        return `"${node.name}" is a static lens. It computes "${node.expression}" once at startup.`;
      case 'guard':
        return `"${node.name}" is a gate. It blocks execution unless "${node.condition}" is true. If the condition fails, it returns ${node.fallback || 'void'}.`;
      case 'cloud':
        return `"${node.name}" is a component scope — a ${node.isAsync ? 'async ' : ''}function that groups related logic together. It contains ${node.bodyStatementCount || 0} statement${(node.bodyStatementCount || 0) !== 1 ? 's' : ''}.`;
      case 'action':
        return `"${node.name}" is a callable action${node.inputCount > 0 ? ` that takes ${node.inputCount} input${node.inputCount > 1 ? 's' : ''}` : ''}. Call it with "run ${node.name}".`;
      case 'event':
        return `"${node.name}" is an event schema${node.matterCount > 0 ? ` with ${node.matterCount} matter field${node.matterCount > 1 ? 's' : ''}` : ''}. Events are immutable — once created they never change.`;
      case 'layer':
        return `"${node.name}" is an event layer — an ordered container that holds events like a shelf holds books.`;
      case 'timeline':
        return `"${node.name}" is a timeline — an append-only sequence that remembers everything and can rewind or fast-forward.`;
      case 'mark':
        return `"${node.name}" is a named value that stores ${node.value ? `"${node.value}"` : 'a computed result'}.`;
      case 'star':
        return `"${node.name}" is a constant — ${node.value === 'void' ? 'empty' : `set to "${node.value}"`}. It never changes.`;
      case 'every':
        return `"${node.name}" is a timer that fires every ${node.interval}ms.`;
      case 'on lifecycle':
        return `"${node.name}" is a lifecycle hook that runs at the "${node.name}" phase, ${node.isAsync ? 'asynchronously' : 'synchronously'}.`;
      case 'on event':
        return `"${node.name}" is an event handler that triggers when the "${node.name}" event is fired.`;
      case 'earth':
        return `"${node.name}" is an HTTP ${node.method} request to "${node.path}". It speaks to the outside world.`;
      case 'emit':
        return `"${node.name}" sends a "${node.kindOfEmit || 'view'}" signal. The UI reacts when this fires.`;
      case 'trigger':
        return `"${node.name}" fires an event that handlers are listening for.`;
      case 'use':
        return `"${node.name}" imports from "${node.source}". It brings code from another file into this program.`;
      // v2.20 — story layer
      case 'story':
        return `"${node.name}" is a story that scans "${node.source}" for "${node.query}". Its events flow into "${node.intoLayer || 'a layer'}".`;
      case 'narrative':
        return `"${node.name}" is a "${node.perspective}" narrative of "${node.storyName}". It sees events through a specific lens.`;
      case 'scope':
        return `"${node.name}" is a multi-dimensional analysis of "${node.subject}"${node.dimensions ? ' across [' + node.dimensions.join(', ') + ']' : ''}. It maps alternative scenarios.`;
      case 'scenario':
        return `"${node.name}" is a future scenario. When ${node.condition}, it is ${node.probability} likely. It describes a possible state of the system.`;
      default:
        return null;
    }
  }

  /**
   * Generate a full annotated report of every node and its relationships.
   */
  fullReport() {
    const lines = [];
    lines.push('═══════════════════════════════════════════════');
    lines.push('  EventMath — Full System Map Report');
    lines.push('═══════════════════════════════════════════════');
    lines.push('');
    lines.push(`  Total nodes: ${this.map.totalNodes}`);
    lines.push(`  Total edges: ${this.map.totalEdges}`);
    lines.push('');

    // Group by type
    const byType = {};
    for (const node of this.map.nodes) {
      const type = node.type || 'other';
      if (!byType[type]) byType[type] = [];
      byType[type].push(node);
    }

    for (const [type, nodes] of Object.entries(byType)) {
      lines.push(`  ── ${type} (${nodes.length}) ──`);
      for (const node of nodes) {
        lines.push(`    ${this._describeNode(node)}`);
        // Show deps inline
        if (node.dependencies && node.dependencies.length > 0) {
          const depNames = node.dependencies
            .map(d => { const n = this._byId[d]; return n ? `"${n.name}"` : d; })
            .join(', ');
          lines.push(`      depends on: ${depNames}`);
        }
        if (node.expression) {
          lines.push(`      expression: ${node.expression}`);
        }
        if (node.condition) {
          lines.push(`      condition: ${node.condition}`);
        }
        if (node.bodyReferences && node.bodyReferences.length > 0) {
          const refNames = node.bodyReferences
            .map(d => { const n = this._byId[d]; return n ? `"${n.name}"` : d; })
            .join(', ');
          lines.push(`      uses: ${refNames}`);
        }
      }
      lines.push('');
    }

    // Edge summary
    if (this.map.edges.length > 0) {
      lines.push(`  ── Data Flow ──`);
      for (const edge of this.map.edges) {
        const from = this._byId[edge.from];
        const to = this._byId[edge.to];
        const fromName = from ? `"${from.name}"` : edge.from;
        const toName = to ? `"${to.name}"` : edge.to;
        lines.push(`    ${fromName} ${edge.via} ${toName}`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = { EventMathWhy };
