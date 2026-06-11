/**
 * EventMath Runtime v0.2
 *
 * Event / Layer / Timeline with structural sharing and timeline log.
 * Target: < 10 KB minified.
 *
 * USAGE:
 *   <script src="eventmath-runtime.js"></script>
 *   const EM = require('./eventmath-runtime.js');
 *
 * v0.2 changes:
 *  - Added forwardTo method (was missing, causing TypeError)
 *  - Separated rewindTo event/match key lookup to avoid conflation
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EventMathRuntime = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // ── Event ────────────────────────────────────────────────

  /**
   * A named thing that happened or exists, carrying matter.
   * Events are immutable — once created they never change.
   */
  function EventMathEvent(id, category, matter) {
    if (!(this instanceof EventMathEvent)) {
      return new EventMathEvent(id, category, matter);
    }
    this.id = id || '';
    this.cat = category || 'event';
    this.matter = matter || {};
    // Freeze for structural sharing safety
    Object.freeze(this.matter);
    Object.freeze(this);
  }

  EventMathEvent.prototype.render = function () {
    var lines = ['── Event: ' + this.id + ' ──'];
    lines.push('  Category: ' + this.cat);
    for (var key in this.matter) {
      if (this.matter.hasOwnProperty(key)) {
        lines.push('  ' + key + ': ' + this.matter[key]);
      }
    }
    return lines.join('\n');
  };

  // ── Layer ────────────────────────────────────────────────

  /**
   * An ordered container of event references.
   * Events are stored by reference (structural sharing).
   */
  function EventMathLayer(name, events) {
    if (!(this instanceof EventMathLayer)) {
      return new EventMathLayer(name, events);
    }
    this.name = name || '';
    this.events = events || [];
    this.zoomLevel = 1;
  }

  EventMathLayer.prototype.render = function () {
    var lines = ['── Layer: ' + this.name + ' ──'];
    for (var i = 0; i < this.events.length; i++) {
      var evt = this.events[i];
      lines.push('  [' + (i + 1) + '] ' + (evt.id || evt));
    }
    return lines.join('\n');
  };

  // ── Timeline Entry ───────────────────────────────────────

  function TimelineEntry(type, data) {
    this.type = type;       // 'event', 'set', 'action', 'add', 'remove', 'merge'
    this.data = data;
    this.timestamp = Date.now();
  }

  // ── Timeline ─────────────────────────────────────────────

  /**
   * Append-only timeline with pointer and periodic snapshots.
   *
   * State is derived by folding over the log from 0..pointer.
   * Snapshots store a structural-sharing copy of state at
   * intervals so rewind costs O(distance to nearest snapshot),
   * not O(history length).
   *
   * SNAPSHOT_INTERVAL: take a snapshot every N entries.
   */
  var SNAPSHOT_INTERVAL = 50;

  function EventMathTimeline(name) {
    if (!(this instanceof EventMathTimeline)) {
      return new EventMathTimeline(name);
    }
    this.name = name || '';
    this.log = [];              // Append-only event log (TimelineEntry[])
    this.pointer = 0;           // Current position in the log
    this.future = [];           // Planned events
    this.snapshots = {};        // { index: state }
    this._state = {};           // Current derived state (marks, events, etc.)
    this.zoomLevel = 1;
    // v1.4 — opposite / meta governance fields
    this.opposite = false;      // true if this is an equal-and-opposite control
    this.oppositeOf = null;     // name of the source control this opposes
    this.polarity = 1;          // 1 = positive direction, -1 = opposite direction
    this.meta = false;          // true if this is a meta-control
    this.governs = null;        // array of governed objects
    this.governsNames = null;   // array of governed names
  }

  /**
   * Append an entry to the timeline log.
   * Updates pointer and periodic snapshot.
   */
  EventMathTimeline.prototype.append = function (entry) {
    this.log.push(entry);
    this.pointer = this.log.length;
    this._applyEntry(entry, this._state);

    // Periodic snapshot (structural sharing via JSON round-trip)
    if (this.log.length % SNAPSHOT_INTERVAL === 0) {
      this.snapshots[this.log.length] = JSON.parse(JSON.stringify(this._state));
    }

    return this;
  };

  /**
   * Apply a single entry to the state (fold step).
   */
  EventMathTimeline.prototype._applyEntry = function (entry, state) {
    switch (entry.type) {
      case 'event':
        if (!state.events) state.events = {};
        state.events[entry.data.id] = entry.data;
        break;
      case 'set':
        if (!state.marks) state.marks = {};
        state.marks[entry.data.key] = entry.data.value;
        break;
      case 'add':
        if (!state.layers) state.layers = {};
        var layer = state.layers[entry.data.layer];
        if (layer) {
          layer.push(entry.data.event);
        }
        break;
      case 'remove':
        if (state.layers && entry.data.layer) {
          state.layers[entry.data.layer] = (state.layers[entry.data.layer] || []).filter(
            function (e) { return e.id !== entry.data.eventId; }
          );
        }
        break;
      case 'merge':
        // Merge entries are informational — no state mutation
        break;
      case 'action':
        // Action entries are informational — no state mutation
        break;
    }
  };

  /**
   * Rebuild state from scratch up to the current pointer.
   * Returns the derived state.
   */
  EventMathTimeline.prototype._rebuild = function () {
    var state = {};

    // Find nearest snapshot before pointer
    var nearest = 0;
    for (var snap in this.snapshots) {
      if (this.snapshots.hasOwnProperty(snap)) {
        var idx = parseInt(snap, 10);
        if (idx <= this.pointer && idx > nearest) {
          nearest = idx;
        }
      }
    }

    // Start from snapshot if found
    if (nearest > 0) {
      state = JSON.parse(JSON.stringify(this.snapshots[nearest]));
    }

    // Apply remaining entries from nearest to pointer
    for (var i = nearest; i < this.pointer; i++) {
      if (this.log[i]) {
        this._applyEntry(this.log[i], state);
      }
    }

    this._state = state;
    return state;
  };

  /**
   * Get the current derived state.
   */
  EventMathTimeline.prototype.state = function () {
    return this._rebuild();
  };

  /**
   * Rewind the pointer by N entries.
   */
  EventMathTimeline.prototype.rewind = function (n) {
    n = n || 1;
    this.pointer = Math.max(0, this.pointer - n);
    return this;
  };

  /**
   * Rewind to a specific event by name (searches the log for events only).
   */
  EventMathTimeline.prototype.rewindTo = function (eventId) {
    for (var i = this.log.length - 1; i >= 0; i--) {
      var entry = this.log[i];
      if (entry.type === 'event' && entry.data && entry.data.id === eventId) {
        this.pointer = i + 1;
        return this;
      }
    }
    // Event not found — rewind to start
    this.pointer = 0;
    return this;
  };

  /**
   * Forward the pointer by N entries.
   */
  EventMathTimeline.prototype.forward = function (n) {
    n = n || 1;
    this.pointer = Math.min(this.log.length, this.pointer + n);
    return this;
  };

  /**
   * Forward to a specific event by name (searches the log for events only).
   * Mirrors rewindTo but moves pointer forward.
   */
  EventMathTimeline.prototype.forwardTo = function (eventId) {
    for (var i = 0; i < this.log.length; i++) {
      var entry = this.log[i];
      if (entry.type === 'event' && entry.data && entry.data.id === eventId) {
        this.pointer = i + 1;
        return this;
      }
    }
    // Event not found — forward to end
    this.pointer = this.log.length;
    return this;
  };

  /**
   * Render the timeline's current state for "run".
   */
  EventMathTimeline.prototype.render = function () {
    var st = this._rebuild();
    var role = this.meta ? 'Meta-Control' : (this.opposite ? 'Opposite Control' : 'Timeline');
    var lines = ['── ' + role + ': ' + this.name + ' ──'];
    lines.push('  Zoom Level: ' + this.zoomLevel);

    if (this.opposite && this.oppositeOf) {
      lines.push('  Opposes: ' + this.oppositeOf);
      lines.push('  Polarity: -1 (equal and opposite)');
    }
    if (this.meta && this.governsNames) {
      lines.push('  Governs: ' + this.governsNames.join(', '));
      lines.push('  Governed count: ' + this.governsNames.length);
    }

    lines.push('  Log entries: ' + this.log.length);
    lines.push('  Events: ' + (st.events ? Object.keys(st.events).length : 0));
    lines.push('  Marks: ' + (st.marks ? Object.keys(st.marks).length : 0));

    if (this.log.length > 0) {
      for (var i = 0; i < this.log.length; i++) {
        var entry = this.log[i];
        if (entry.type === 'control' && entry.data) {
          var m = entry.data.matter || {};
          for (var k in m) {
            if (m.hasOwnProperty(k)) {
              lines.push('  ' + k + ': ' + m[k]);
            }
          }
        }
      }
    }

    if (st.marks) {
      for (var key in st.marks) {
        if (st.marks.hasOwnProperty(key)) {
          lines.push('  ' + key + ' = ' + st.marks[key]);
        }
      }
    }

    return lines.join('\n');
  };

  /**
   * Zoom in between two events in this timeline — returns a new timeline
   * representing the gap between them.
   */
  EventMathTimeline.prototype.zoomIn = function (fromEventId, toEventId) {
    var fromEvt = null, toEvt = null;
    for (var i = 0; i < this.log.length; i++) {
      var entry = this.log[i];
      if (entry.data && entry.data.id === fromEventId) fromEvt = entry.data;
      if (entry.data && entry.data.id === toEventId) toEvt = entry.data;
    }
    var ctrl = new EventMathTimeline('control_' + fromEventId + '_' + toEventId);
    ctrl.zoomLevel = this.zoomLevel + 1;
    if (fromEvt && toEvt) {
      ctrl.append(new TimelineEntry('control', new EventMathEvent(
        'ctrl_' + Date.now(), 'control',
        { from: fromEventId, to: toEventId, zoom_level: ctrl.zoomLevel, control: true }
      )));
    }
    return ctrl;
  };

  /**
   * Zoom out — collapse this timeline to a single summary event.
   */
  EventMathTimeline.prototype.zoomOut = function () {
    return new EventMathEvent(
      'summary_' + this.name.replace(/\s+/g, '_'),
      'summary',
      { source: this.name, zoom_level: Math.max(1, this.zoomLevel - 1), entry_count: this.log.length, summary: this.render() }
    );
  };

  /**
   * Render past/present/future sections.
   */
  EventMathTimeline.prototype.renderSection = function (section) {
    var self = this;
    if (section === 'past') {
      return this.renderRange(0, this.pointer);
    } else if (section === 'present') {
      var st = this._rebuild();
      return this.render() + '\n\n  (present state)';
    } else if (section === 'future') {
      if (this.future.length === 0) return '  (no planned events)';
      return '── Future ──\n' + this.future.map(function (e) {
        return '  [planned] ' + (e.id || JSON.stringify(e));
      }).join('\n');
    }
    return this.render();
  };

  /**
   * Render a range of the log.
   */
  EventMathTimeline.prototype.renderRange = function (start, end) {
    var lines = [];
    for (var i = start; i < end && i < this.log.length; i++) {
      var entry = this.log[i];
      switch (entry.type) {
        case 'event':
          lines.push('  [' + i + '] event: ' + (entry.data.id || ''));
          break;
        case 'set':
          lines.push('  [' + i + '] set: ' + (entry.data.key || '') + ' = ' + entry.data.value);
          break;
        case 'add':
          lines.push('  [' + i + '] add: ' + (entry.data.event || '') + ' to ' + (entry.data.layer || ''));
          break;
        default:
          lines.push('  [' + i + '] ' + entry.type);
      }
    }
    return lines.join('\n');
  };

  /**
   * Zoom in between two events in this layer — returns a new layer.
   */
  EventMathLayer.prototype.zoomIn = function (fromIdx, toIdx) {
    var ctrl = new EventMathLayer('control_' + this.name, []);
    ctrl.zoomLevel = this.zoomLevel + 1;
    var fromEvt = this.events[fromIdx];
    var toEvt = this.events[toIdx];
    if (fromEvt && toEvt) {
      ctrl.events.push(new EventMathEvent('ctrl_' + Date.now(), 'control', { from: fromEvt.id, to: toEvt.id, zoom_level: ctrl.zoomLevel, control: true }));
    }
    return ctrl;
  };

  /**
   * Zoom out — collapse this layer to a single summary event.
   */
  EventMathLayer.prototype.zoomOut = function () {
    return new EventMathEvent(
      'summary_' + this.name.replace(/\s+/g, '_'),
      'summary',
      { source: this.name, zoom_level: Math.max(1, this.zoomLevel - 1), event_count: this.events.length, summary: this.render() }
    );
  };

  // ── Auto-tracking ───────────────────────────────────────

  /**
   * Global default timeline for auto-tracked events.
   */
  // ── Torus ────────────────────────────────────────────────
  //
  // The shape that emerges when you map all controls.
  // Not a sphere — a torus. The nucleus switches (present/absent)
  // because it is the hole the torus passes through.
  //
  // Ring structure: each ring adds 4 points (square → diamond →
  // square → diamond ...). At every completion point the total
  // including the nucleus hits a Fibonacci number.
  //
  //   Ring 1:  4 outer  → +nucleus = 5  ← Fibonacci ✓
  //   Ring 2:  8 outer  → +nucleus = 9
  //   Ring 3: 12 outer  → +nucleus = 13 ← Fibonacci ✓
  //   Ring 4: 16 outer  → +nucleus = 17
  //   Ring 5: 20 outer  → +nucleus = 21 ← Fibonacci ✓
  //   Ring 6: 24 outer  → +nucleus = 25
  //   Ring 7: 28 outer  → +nucleus = 29
  //   Ring 8: 32 outer  → +nucleus = 33
  //   Ring 9: 36 outer  → +nucleus = 37
  //  Ring 12: 48 outer  → +nucleus = 49
  //  Ring 12: 52 outer  → +nucleus = 53
  //  Ring 13: 56 outer  → +nucleus = 57 (not Fib)
  //   ...
  //  total=34: Fibonacci ✓  (outer=33, +nucleus=34)
  //
  // The switch: the nucleus is always structurally present but
  // COUNTS as a point only when total+1 lands on a Fibonacci number.
  // This is Ryan's insight — the nucleus is what makes the count Fibonacci.

  var FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

  function isFibonacci(n) {
    return FIB.indexOf(n) !== -1;
  }

  function EventMathTorus(name) {
    if (!(this instanceof EventMathTorus)) {
      return new EventMathTorus(name);
    }
    this.name        = name || '';
    this.sourceName  = '';          // name of the seed object
    this.zoomLevel   = 1;           // one above source zoom level
    this.rings       = [];          // array of ring descriptors
    this.totalOuter  = 0;           // running outer point count
    this.resonances  = [];          // cross-level connections
    this.cycleComplete = false;
    this.completionEvent = null;
  }

  EventMathTorus.prototype.spinFrom = function (source) {
    this.sourceName = source
      ? (source.name || source.id || String(source))
      : '';
    this.zoomLevel = ((source && source.zoomLevel) || 1) + 1;
    return this;
  };

  // Add N rings (4 outer points each, alternating square/diamond).
  EventMathTorus.prototype.expand = function (n) {
    for (var i = 0; i < n; i++) {
      var ringNum   = this.rings.length + 1;
      var shape     = ringNum % 2 === 1 ? 'square' : 'diamond';
      // Rotation angle for this ring in the stacking-squares model
      var rotation  = ((ringNum - 1) * 45 / 2) % 360;
      this.totalOuter += 4;
      var withNucleus = this.totalOuter + 1;
      this.rings.push({
        ring:        ringNum,
        shape:       shape,
        rotation:    rotation,
        count:       4,
        total_outer: this.totalOuter,
        with_nucleus: withNucleus,
        fibonacci:   isFibonacci(withNucleus)
      });
    }
    return this;
  };

  // Nucleus state: present (COUNTED) when total+1 is Fibonacci.
  EventMathTorus.prototype.nucleusPresent = function () {
    return isFibonacci(this.totalOuter + 1);
  };

  // Mark cycle completion — the return to 1, one level up.
  // The completion event itself is the point that makes the total Fibonacci.
  // After N rings: outer + nucleus = total. The cycle adds +1 (the return point)
  // bringing the count to the next Fibonacci number.
  EventMathTorus.prototype.complete = function () {
    var beforeCycle = this.totalOuter + 1; // outer + nucleus
    var withCycle   = beforeCycle + 1;     // + the return-to-1 point
    this.cycleComplete = true;
    this.completionEvent = new EventMathEvent(
      'cycle_complete_' + Date.now(),
      'completion',
      {
        outer_points:    this.totalOuter,
        nucleus:         1,
        cycle_point:     1,
        total:           withCycle,
        fibonacci_hit:   isFibonacci(withCycle),
        rings:           this.rings.length,
        description:     'cycle complete — outer ' + this.totalOuter +
                         ' + nucleus 1 + return 1 = ' + withCycle +
                         (isFibonacci(withCycle) ? '  ← Fibonacci ✓' : '')
      }
    );
    return this.completionEvent;
  };

  EventMathTorus.prototype.addResonance = function (otherName, label) {
    this.resonances.push({ name: otherName, label: label || 'resonance' });
    return this;
  };

  EventMathTorus.prototype.render = function () {
    var lines = ['── Torus: ' + this.name + ' ──'];
    lines.push('  Source: ' + (this.sourceName || 'unknown') +
               '  (zoom level ' + (this.zoomLevel - 1) + ' → torus level ' + this.zoomLevel + ')');

    var nucleusState = this.nucleusPresent() ? '● PRESENT' : '○ ABSENT';
    lines.push('  Nucleus: ' + nucleusState +
               (this.nucleusPresent() ? '  (switch ON — total is Fibonacci)' : '  (switch OFF)'));
    lines.push('');

    for (var i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      var fib = r.fibonacci ? '  ← Fibonacci: ' + r.with_nucleus + ' ✓' : '';
      lines.push('  Ring ' + r.ring + '  [' + r.shape + ', ' + r.rotation + '°]' +
                 '  4 pts  →  outer: ' + r.total_outer + '  +nucleus = ' + r.with_nucleus + fib);
    }

    if (this.rings.length > 0) {
      lines.push('');
      lines.push('  Total outer: ' + this.totalOuter + '  +nucleus: 1  =  ' +
                 (this.totalOuter + 1) +
                 (isFibonacci(this.totalOuter + 1) ? '  ← Fibonacci ✓' : ''));
    }

    if (this.resonances.length > 0) {
      lines.push('');
      lines.push('  Resonances:');
      for (var j = 0; j < this.resonances.length; j++) {
        lines.push('    ↔ ' + this.resonances[j].name);
      }
    }

    if (this.cycleComplete && this.completionEvent) {
      var m = this.completionEvent.matter;
      lines.push('');
      lines.push('  Cycle: COMPLETE');
      lines.push('    outer ' + m.outer_points + '  +nucleus 1  +return 1  =  ' +
                 m.total + (m.fibonacci_hit ? '  ← Fibonacci ✓  (the ' + m.total + 'th point IS the return to 1)' : ''));
    }

    return lines.join('\n');
  };

  // ── Default Timeline ─────────────────────────────────────

  var defaultTimeline = new EventMathTimeline('default');

  function getDefaultTimeline() {
    return defaultTimeline;
  }

  // ── Exports ──────────────────────────────────────────────

  return {
    EventMathEvent: EventMathEvent,
    EventMathLayer: EventMathLayer,
    EventMathTimeline: EventMathTimeline,
    EventMathTorus: EventMathTorus,
    TimelineEntry: TimelineEntry,
    getDefaultTimeline: getDefaultTimeline,
    SNAPSHOT_INTERVAL: SNAPSHOT_INTERVAL,
    isFibonacci: isFibonacci,
  };

});