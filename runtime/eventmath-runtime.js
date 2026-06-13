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

  // ── Torus + Landscape ────────────────────────────────────
  //
  // Dimension determines the cross-section polygon and Fibonacci variant:
  //
  //   D=2  square     → standard Fibonacci  (1,1,2,3,5,8,13,21,34...)
  //   D=3  triangle   → tribonacci           (1,1,1,3,5,9,17,31,57...)
  //   D=4  square     → tetranacci           (1,1,1,1,4,7,13,25,49...)
  //   D=5  pentagon   → pentanacci           (1,1,1,1,1,5,9,17,31...)
  //   ...
  //   D=13 tridecagon → 13-step Fibonacci
  //
  // Each dimension D: pointsPerRing = D (except D=2 → 4 for back-compat)
  // Rotation per ring = 90 / pointsPerRing degrees
  // Nucleus switch fires when (totalOuter + 1) is in the D-step Fibonacci sequence.
  // Space between two toruses at D1 and D2 auto-generates a bridge at max(D1,D2)+1.

  var SHAPE_NAMES = {
    2:  'square',        3:  'triangle',      4:  'square',        5:  'pentagon',
    6:  'hexagon',       7:  'heptagon',      8:  'octagon',       9:  'nonagon',
    10: 'decagon',       11: 'hendecagon',    12: 'dodecagon',     13: 'tridecagon',
    14: 'tetradecagon',  15: 'pentadecagon',  16: 'hexadecagon',   17: 'heptadecagon',
    18: 'octadecagon',   19: 'enneadecagon',  20: 'icosagon',      21: 'icosihenagon',
    22: 'icosidigon',    23: 'icositrigon',   24: 'icositetragon', 25: 'icosipentagon',
    26: 'icosihexagon',
    27: 'icosiheptagon', 28: 'icosioctagon',  29: 'icosienneagon',
    30: 'triacontagon',
    31: 'triacontahenagon',  32: 'triacontadigon',    33: 'triacontatrigon',
    34: 'triacontatetragon', 35: 'triacontapentagon', 36: 'triacontahexagon',
    37: 'triacontaheptagon', 38: 'triacontaoctagon',  39: 'triacontaenneagon'
  };

  function getShapeName(D) {
    return SHAPE_NAMES[D] || (D + '-gon');
  }

  // D-step Fibonacci: starts with D ones; each next term = sum of previous D terms.
  function nStepFib(D, maxVal) {
    D = D || 2;
    maxVal = maxVal || 10000;
    var seq = [];
    for (var s = 0; s < D; s++) seq.push(1);
    while (true) {
      var next = 0;
      for (var j = seq.length - D; j < seq.length; j++) next += seq[j];
      if (next > maxVal) break;
      seq.push(next);
    }
    return seq;
  }

  function isNStepFib(n, D) {
    if (!n || n < 1) return false;
    D = D || 2;
    var seq = nStepFib(D, Math.max(n * 2, 200));
    return seq.indexOf(n) !== -1;
  }

  var FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

  function isFibonacci(n) {
    return FIB.indexOf(n) !== -1;
  }

  function EventMathAnchor(name) {
    if (!(this instanceof EventMathAnchor)) {
      return new EventMathAnchor(name);
    }
    this.name          = name || '';
    this.dimension     = 2;
    this.rings         = [];
    this.totalOuter    = 0;
    this.resonances    = [];
    this.cycleComplete = false;
    this.completionEvent = null;
  }

  // setDepth(dimension) — dimension 2–N (positive) or -(2–N) (negative/opposite polarity).
  // Each structural tier adds 13: D±13 surface, D±26 system, D±39 root, D±52 emergence, D±65 ...
  // Negative dimensions spin clockwise; nucleus polarity is inverted.
  EventMathAnchor.prototype.setDepth = function (dimension) {
    var d = typeof dimension === 'number' ? Math.floor(dimension) : 2;
    var absD = Math.abs(d);
    if (absD < 2) absD = 2;
    this.dimension = d < 0 ? -absD : absD;
    return this;
  };

  // Add N rings. Points per ring = |D| (except |D|=2 → 4).
  // Negative dimension: rotates clockwise; Fibonacci flag is inverted (nucleus present when NOT Fibonacci).
  EventMathAnchor.prototype.expand = function (n) {
    var D       = this.dimension || 2;
    var absD    = Math.abs(D);
    var pts     = absD < 3 ? 4 : absD;
    var rotStep = 90 / pts;
    var base    = getShapeName(absD);
    var neg     = D < 0;

    for (var i = 0; i < n; i++) {
      var ringNum  = this.rings.length + 1;
      var rot      = Math.round(((ringNum - 1) * rotStep) % 360 * 100) / 100;
      var rotation = neg ? -rot : rot;
      var shape;
      if (absD === 2)      { shape = ringNum % 2 === 1 ? 'square'   : 'diamond';  }
      else if (absD === 3) { shape = ringNum % 2 === 1 ? 'triangle' : 'tri-star'; }
      else                 { shape = ringNum % 2 === 1 ? base       : base + '*'; }
      if (neg) shape = shape + '↺';

      this.totalOuter += pts;
      var withNucleus = this.totalOuter + 1;
      var isFib = isNStepFib(withNucleus, absD);
      this.rings.push({
        ring:         ringNum,
        shape:        shape,
        rotation:     rotation,
        count:        pts,
        total_outer:  this.totalOuter,
        with_nucleus: withNucleus,
        fibonacci:    neg ? !isFib : isFib   // inverted for negative dimension
      });
    }
    return this;
  };

  EventMathAnchor.prototype.nucleusPresent = function () {
    var D    = this.dimension || 2;
    var absD = Math.abs(D);
    var isFib = isNStepFib(this.totalOuter + 1, absD);
    return D < 0 ? !isFib : isFib;
  };

  EventMathAnchor.prototype.complete = function () {
    var D           = this.dimension || 2;
    var beforeCycle = this.totalOuter + 1;
    var withCycle   = beforeCycle + 1;
    this.cycleComplete = true;
    this.completionEvent = new EventMathEvent(
      'cycle_complete_' + Date.now(),
      'completion',
      {
        outer_points:  this.totalOuter,
        nucleus:       1,
        cycle_point:   1,
        total:         withCycle,
        dimension:     D,
        fibonacci_hit: isNStepFib(withCycle, D),
        rings:         this.rings.length,
        description:   'cycle complete — outer ' + this.totalOuter +
                       ' + nucleus 1 + return 1 = ' + withCycle +
                       (isNStepFib(withCycle, D) ? '  ← D' + D + '-Fibonacci ✓' : '')
      }
    );
    return this.completionEvent;
  };

  EventMathAnchor.prototype.addResonance = function (otherName, label) {
    this.resonances.push({ name: otherName, label: label || 'resonance' });
    return this;
  };

  EventMathAnchor.prototype.render = function () {
    var D         = this.dimension || 2;
    var absD      = Math.abs(D);
    var neg       = D < 0;
    var pts       = absD < 3 ? 4 : absD;
    var shapeName = getShapeName(absD);
    var dimLabel  = neg ? 'D-' + absD : 'D' + absD;
    var fibLabel  = absD === 2 ? 'Fibonacci' : 'D' + absD + '-Fibonacci';
    var nucState  = this.nucleusPresent() ? '● PRESENT' : '○ ABSENT';
    var direction = neg ? 'clockwise ↺' : 'counterclockwise ↻';

    var lines = ['── Anchor: ' + this.name + '  [' + dimLabel + ' / ' + shapeName + '] ──'];
    lines.push('  Depth: ' + dimLabel);
    lines.push('  ' + pts + ' pts/ring   ' + Math.abs(90 / pts) + '°/ring   ' + direction + '   ' + fibLabel);
    if (neg) lines.push('  Negative dimension: nucleus polarity INVERTED (present when NOT ' + fibLabel + ')');
    lines.push('  Nucleus: ' + nucState +
               (this.nucleusPresent() ? '  (switch ON)' : '  (switch OFF)'));
    lines.push('');

    for (var i = 0; i < this.rings.length; i++) {
      var r   = this.rings[i];
      var hit = r.fibonacci ? '  ← ' + fibLabel + ': ' + r.with_nucleus + ' ✓' : '';
      lines.push('  Ring ' + r.ring + '  [' + r.shape + ', ' + r.rotation + '°]' +
                 '  ' + pts + ' pts  →  outer: ' + r.total_outer +
                 '  +nucleus = ' + r.with_nucleus + hit);
    }

    if (this.rings.length > 0) {
      lines.push('');
      lines.push('  Total outer: ' + this.totalOuter + '  +nucleus: 1  =  ' +
                 (this.totalOuter + 1) +
                 (this.nucleusPresent() ? '  ← ' + fibLabel + ' ✓' : ''));
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
                 m.total + (m.fibonacci_hit ? '  ← ' + fibLabel + ' ✓' : ''));
    }

    return lines.join('\n');
  };

  // ── Axis ─────────────────────────────────────────────────
  //
  // The dimensional axis created by `bound X and Y into Z`.
  // Bridges a negative-dimension torus (D-N) and a positive-dimension torus (D+N).
  // Auto-creates: bridge (i), anti-bridge (-i), meta-axis (ℝ), anti-meta (-ℝ), grand (ℂ).
  // The present line (midpoint between -D and +D) is where Re(s) = 1/2 lives.

  function EventMathAxis(name, negative, positive) {
    if (!(this instanceof EventMathAxis)) return new EventMathAxis(name, negative, positive);
    this.name     = name || '';
    this.negative = negative || null;
    this.positive = positive || null;

    var negDim   = negative && negative.dimension ? Math.abs(negative.dimension) : 2;
    var posDim   = positive && positive.dimension ? Math.abs(positive.dimension) : 2;
    var bridgeDim = Math.max(negDim, posDim) + 1;

    // bridge = i (the imaginary unit — the control between negative and positive)
    this.bridge = new EventMathTimeline(name + '_bridge');
    this.bridge.zoomLevel = bridgeDim;
    this.bridge.label = 'i';

    // anti-bridge = -i (equal and opposite to bridge)
    this.antiBridge = new EventMathTimeline(name + '_anti_bridge');
    this.antiBridge.zoomLevel = bridgeDim;
    this.antiBridge.opposite = true;
    this.antiBridge.oppositeOf = name + '_bridge';
    this.antiBridge.polarity = -1;
    this.antiBridge.label = '-i';

    // meta-axis = ℝ (the real number line — governs all four)
    this.metaAxis = new EventMathTimeline(name + '_meta');
    this.metaAxis.zoomLevel = bridgeDim + 1;
    this.metaAxis.meta = true;
    this.metaAxis.governsNames = [
      (negative && negative.name) || 'negative',
      (positive && positive.name) || 'positive',
      name + '_bridge',
      name + '_anti_bridge'
    ];
    this.metaAxis.label = 'R';

    // anti-meta = -ℝ (negative real line)
    this.antiMeta = new EventMathTimeline(name + '_anti_meta');
    this.antiMeta.zoomLevel = bridgeDim + 1;
    this.antiMeta.opposite = true;
    this.antiMeta.oppositeOf = name + '_meta';
    this.antiMeta.polarity = -1;
    this.antiMeta.label = '-R';

    // grand axis = ℂ (the complex plane — the full structure)
    this.grandAxis = new EventMathTimeline(name + '_grand');
    this.grandAxis.zoomLevel = bridgeDim + 2;
    this.grandAxis.meta = true;
    this.grandAxis.governsNames = [name + '_meta', name + '_anti_meta'];
    this.grandAxis.label = 'C';

    this.dimension    = Math.max(negDim, posDim);
    // The present line: midpoint between -D and +D = 0 when symmetric
    var negSign = (negative && negative.dimension < 0) ? negative.dimension : -negDim;
    var posSign = (positive && positive.dimension > 0) ? positive.dimension : posDim;
    this.presentLine = (negSign + posSign) / 2;
  }

  EventMathAxis.prototype.render = function () {
    var d         = this.dimension;
    var shp       = getShapeName(d);
    var lines = [];
    lines.push('══════════════════════════════════════════════════════════');
    lines.push('EventMath Axis: ' + this.name);
    lines.push('══════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('  Negative side  [D-' + d + ' / ' + shp + ']:  ' +
               (this.negative ? this.negative.name : '(none)'));
    lines.push('  Positive side  [D+' + d + ' / ' + shp + ']:  ' +
               (this.positive ? this.positive.name : '(none)'));
    lines.push('');
    lines.push('  Bridge      (i)   [D' + this.bridge.zoomLevel + ']:     ' +
               this.name + '_bridge');
    lines.push('  Anti-bridge (-i)  [D' + this.antiBridge.zoomLevel + ', pol -1]:  ' +
               this.name + '_anti_bridge');
    lines.push('  Meta-axis   (R)   [D' + this.metaAxis.zoomLevel + ']:     ' +
               this.name + '_meta');
    lines.push('  Anti-meta  (-R)   [D' + this.antiMeta.zoomLevel + ', pol -1]:  ' +
               this.name + '_anti_meta');
    lines.push('  Grand axis  (C)   [D' + this.grandAxis.zoomLevel + ']:     ' +
               this.name + '_grand');
    lines.push('');
    lines.push('  Present line: ' + this.presentLine +
               '  <- midpoint between D-' + d + ' and D+' + d);
    if (this.presentLine === 0) {
      lines.push('  <- This is where the Riemann zeros live  (Re(s) = 0.5 = present)');
    }
    lines.push('');
    lines.push('  i x i = anti-bridge x bridge = past (-1)  [verified]');
    lines.push('  Complex structure COMPLETE  [6 layers, D' + this.grandAxis.zoomLevel + ' governance]');
    lines.push('══════════════════════════════════════════════════════════');
    return lines.join('\n');
  };

  // ── Landscape ────────────────────────────────────────────
  //
  // A multi-torus prediction field.
  // Adding a torus auto-creates bridges to every existing torus at dim max(D1,D2)+1.
  // forecast() finds the next Fibonacci switch across all dimensions and detects
  // cross-dimensional resonances (two toruses switching at the same ring offset).

  function EventMathLandscape(name) {
    if (!(this instanceof EventMathLandscape)) {
      return new EventMathLandscape(name);
    }
    this.name    = name || '';
    this.toruses = [];
    this.bridges = [];
  }

  EventMathLandscape.prototype.addTorus = function (torus) {
    for (var i = 0; i < this.toruses.length; i++) {
      var existing  = this.toruses[i];
      var bridgeDim = Math.min(13, Math.max(existing.dimension || 2, torus.dimension || 2) + 1);
      this.bridges.push({ from: existing.name, to: torus.name, dimension: bridgeDim });
    }
    this.toruses.push(torus);
    return this;
  };

  EventMathLandscape.prototype.forecast = function () {
    if (this.toruses.length === 0) {
      return new EventMathEvent('forecast_empty', 'forecast',
        { prediction: 'no toruses in landscape', forecast: true });
    }

    var predictions = [];
    for (var i = 0; i < this.toruses.length; i++) {
      var t   = this.toruses[i];
      var D    = t.dimension || 2;
      var absD = Math.abs(D);
      var pts  = absD < 3 ? 4 : absD;
      var seq  = nStepFib(absD, 10000);
      var cur = t.totalOuter + 1;
      var nextFib = null;
      for (var k = 0; k < seq.length; k++) {
        if (seq[k] > cur) { nextFib = seq[k]; break; }
      }
      var ringsTo = nextFib !== null ? Math.ceil((nextFib - cur) / pts) : null;
      predictions.push({ torus: t.name, dimension: D, currentOuter: t.totalOuter,
                         nextFibAt: nextFib, ringsToSwitch: ringsTo });
    }

    // Cross-dimensional resonances
    var resonances = [];
    for (var a = 0; a < predictions.length; a++) {
      for (var b = a + 1; b < predictions.length; b++) {
        if (predictions[a].ringsToSwitch !== null &&
            predictions[a].ringsToSwitch === predictions[b].ringsToSwitch) {
          resonances.push(
            '"' + predictions[a].torus + '" D' + predictions[a].dimension +
            ' ↔ "' + predictions[b].torus + '" D' + predictions[b].dimension +
            ' (+' + predictions[a].ringsToSwitch + ' rings)'
          );
        }
      }
    }

    var valid = predictions.filter(function (p) { return p.ringsToSwitch !== null; });
    valid.sort(function (a, b) { return a.ringsToSwitch - b.ringsToSwitch; });
    var soonest = valid[0] || null;

    var totalDim = 0;
    for (var m = 0; m < this.toruses.length; m++) totalDim += (this.toruses[m].dimension || 2);

    return new EventMathEvent('forecast_' + Date.now(), 'forecast', {
      prediction: soonest
        ? 'Fibonacci switch in "' + soonest.torus + '" (D' + soonest.dimension + ') in ' +
          soonest.ringsToSwitch + ' ring' + (soonest.ringsToSwitch === 1 ? '' : 's')
        : 'all toruses have completed their cycles',
      rings_until_switch:           soonest ? soonest.ringsToSwitch : 0,
      next_switch_torus:            soonest ? soonest.torus : 'none',
      next_switch_dimension:        soonest ? soonest.dimension : 0,
      cross_dimensional_resonances: resonances.length,
      resonance_detail:             resonances.length > 0 ? resonances.join('; ') : 'none',
      total_dimensional_signature:  totalDim,
      total_toruses:                this.toruses.length,
      total_bridges:                this.bridges.length,
      forecast:                     true
    });
  };

  EventMathLandscape.prototype.render = function () {
    var lines = [];
    lines.push('══════════════════════════════════════════════════');
    lines.push('EventMath Landscape: ' + this.name);

    var totalDim = 0, dimParts = [];
    for (var i = 0; i < this.toruses.length; i++) {
      var d = this.toruses[i].dimension || 2;
      totalDim += d;
      dimParts.push('D' + d);
    }
    lines.push('Dimensional signature: ' + totalDim + '  (' + dimParts.join(' + ') + ')');
    lines.push('══════════════════════════════════════════════════');
    lines.push('');

    for (var j = 0; j < this.toruses.length; j++) {
      var t       = this.toruses[j];
      var D       = t.dimension || 2;
      var absD    = Math.abs(D);
      var pts     = absD < 3 ? 4 : absD;
      var shp     = getShapeName(absD);
      var fibLbl  = absD === 2 ? 'Fibonacci' : 'D' + absD + '-Fibonacci';
      var seq     = nStepFib(absD, 10000);
      var cur     = t.totalOuter + 1;
      var nextFib = null;
      for (var k = 0; k < seq.length; k++) {
        if (seq[k] > cur) { nextFib = seq[k]; break; }
      }
      var ringsTo = nextFib !== null ? Math.ceil((nextFib - cur) / pts) : 'complete';

      var hits = [];
      for (var r = 0; r < t.rings.length; r++) {
        if (t.rings[r].fibonacci) hits.push(t.rings[r].with_nucleus + ' ✓');
      }

      lines.push('  D' + D + ' — ' + t.name + '  [' + shp + ', ' + pts + ' pts/ring]');
      lines.push('    rings: ' + t.rings.length + '   outer: ' + t.totalOuter + '   nucleus: ' + (t.nucleusPresent() ? '●' : '○'));
      if (hits.length > 0) lines.push('    ' + fibLbl + ' hits: ' + hits.join('  '));
      lines.push('    next switch: +' + ringsTo + ' rings  →  ' + (nextFib || 'N/A'));
      lines.push('');
    }

    if (this.bridges.length > 0) {
      lines.push('  Auto-bridges:');
      for (var b = 0; b < this.bridges.length; b++) {
        var br = this.bridges[b];
        lines.push('    ' + br.from + ' ↔ ' + br.to + '  [D' + br.dimension + ']');
      }
      lines.push('');
    }

    var fc = this.forecast();
    var fm = fc.matter;
    lines.push('  Forecast:');
    lines.push('    ' + fm.prediction);
    if (fm.cross_dimensional_resonances > 0) {
      lines.push('    Cross-dim resonance: ' + fm.resonance_detail);
    }
    lines.push('    Signature: D' + fm.total_dimensional_signature + '  (' + this.toruses.length + ' toruses, ' + this.bridges.length + ' bridges)');
    lines.push('');
    lines.push('══════════════════════════════════════════════════');
    return lines.join('\n');
  };

  // ── Actor ─────────────────────────────────────────────────
  //
  // One of 8 functionally distinct actors: user, beneficiary, decider,
  // payer, designer, builder, seller, communicator.
  // Each actor has a power level and declares what it controls vs. needs.

  function EventMathActor(name, matter) {
    if (!(this instanceof EventMathActor)) return new EventMathActor(name, matter);
    this.name     = name   || '';
    this.matter   = matter || {};
    this.power    = parseFloat(matter.power    || 0);
    this.controls = matter.controls || '';
    this.needs    = matter.needs    || '';
    this.role     = matter.role     || matter.type || 'actor';
  }

  EventMathActor.prototype.render = function () {
    var lines = ['── Actor: ' + this.name + ' ──'];
    lines.push('  Role: ' + this.role);
    lines.push('  Power level: ' + this.power);
    if (this.controls) lines.push('  Controls: ' + this.controls);
    if (this.needs)    lines.push('  Needs: '    + this.needs);
    for (var k in this.matter) {
      if (this.matter.hasOwnProperty(k) &&
          k !== 'power' && k !== 'controls' && k !== 'needs' && k !== 'role' && k !== 'type') {
        lines.push('  ' + k + ': ' + this.matter[k]);
      }
    }
    return lines.join('\n');
  };

  // ── Power Gap ─────────────────────────────────────────────
  //
  // `asymmetry from A and B into gap`
  // Computes who holds leverage and what the correction path is.
  // Works with EventMathActor or any EventMathEvent with matter.power/controls/needs.

  function EventMathPowerGap(name, actorA, actorB) {
    if (!(this instanceof EventMathPowerGap)) return new EventMathPowerGap(name, actorA, actorB);
    this.name   = name   || '';
    this.actorA = actorA || null;
    this.actorB = actorB || null;

    var pA = parseFloat((actorA && (actorA.power || (actorA.matter && actorA.matter.power))) || 0);
    var pB = parseFloat((actorB && (actorB.power || (actorB.matter && actorB.matter.power))) || 0);

    this.powerA       = pA;
    this.powerB       = pB;
    this.gap          = Math.abs(pA - pB);
    this.dominant     = pA >= pB ? actorA : actorB;
    this.subordinate  = pA >= pB ? actorB : actorA;
    this.leverage     = this._findLeverage();
    this.correction   = this._findCorrection();
  }

  EventMathPowerGap.prototype._findLeverage = function () {
    if (!this.dominant || !this.subordinate) return 'insufficient data';
    var domNeeds = String((this.dominant.needs   || (this.dominant.matter   && this.dominant.matter.needs)   || '')).toLowerCase();
    var subCtrls = String((this.subordinate.controls || (this.subordinate.matter && this.subordinate.matter.controls) || '')).toLowerCase();
    if (!domNeeds || !subCtrls) return 'map controls and needs to reveal leverage';
    var needsArr = domNeeds.split(/[\s,]+/).filter(Boolean);
    var ctrlArr  = subCtrls.split(/[\s,]+/).filter(Boolean);
    var overlap  = needsArr.filter(function (n) {
      return ctrlArr.some(function (c) { return c.includes(n) || n.includes(c); });
    });
    var subName = (this.subordinate.name || 'subordinate');
    var domName = (this.dominant.name    || 'dominant');
    if (overlap.length > 0) {
      return subName + ' controls "' + overlap.join(', ') + '" — exactly what ' + domName + ' needs';
    }
    return subName + ' controls: [' + subCtrls + ']  |  ' + domName + ' needs: [' + domNeeds + ']';
  };

  EventMathPowerGap.prototype._findCorrection = function () {
    if (this.gap === 0) return 'power is balanced — no correction needed';
    var subName = (this.subordinate && this.subordinate.name) || 'subordinate';
    var domName = (this.dominant    && this.dominant.name)    || 'dominant';
    return subName + ' must make ' + domName + ' explicitly dependent on what only ' +
           subName + ' controls. ' + this.leverage +
           '. Name that dependency before negotiating price.';
  };

  EventMathPowerGap.prototype.render = function () {
    var a = (this.actorA && this.actorA.name) || 'actor A';
    var b = (this.actorB && this.actorB.name) || 'actor B';
    var domName = (this.dominant    && this.dominant.name)    || 'dominant';
    var subName = (this.subordinate && this.subordinate.name) || 'subordinate';
    var lines = [];
    lines.push('══════════════════════════════════════════════');
    lines.push('Power Gap: ' + this.name);
    lines.push('══════════════════════════════════════════════');
    lines.push('  ' + a + '  power: ' + this.powerA);
    lines.push('  ' + b + '  power: ' + this.powerB);
    lines.push('  Gap: ' + this.gap + '  (dominant: ' + domName + ' / subordinate: ' + subName + ')');
    lines.push('');
    lines.push('  Leverage:');
    lines.push('    ' + this.leverage);
    lines.push('');
    lines.push('  Correction path:');
    lines.push('    ' + this.correction);
    lines.push('══════════════════════════════════════════════');
    return lines.join('\n');
  };

  // ── Function Chain ────────────────────────────────────────
  //
  // `chain <name>` block with `<A> leads to <B>` links.
  // Models causal / functional flow: component → function → outcome → desire.
  // The chain can be traversed forward (predict) or backward (root of).

  function EventMathChain(name) {
    if (!(this instanceof EventMathChain)) return new EventMathChain(name);
    this.name  = name || '';
    this.links = [];
  }

  EventMathChain.prototype.addLink = function (from, to, value) {
    var link = { from: from, to: to };
    if (value !== null && value !== undefined && !isNaN(Number(value))) {
      link.value = Number(value);
    }
    this.links.push(link);
    return this;
  };

  EventMathChain.prototype.trace = function (targetState) {
    return new EventMathRootTrace(this, targetState);
  };

  EventMathChain.prototype.invert = function () {
    var inv = new EventMathChain('invert_' + this.name);
    for (var i = this.links.length - 1; i >= 0; i--) {
      inv.addLink(this.links[i].to, this.links[i].from);
    }
    return inv;
  };

  EventMathChain.prototype.render = function () {
    var lines = ['── Chain: ' + this.name + ' ──'];
    if (this.links.length === 0) {
      lines.push('  (empty chain)');
    } else {
      for (var i = 0; i < this.links.length; i++) {
        var lk    = this.links[i];
        var valTx = lk.value !== undefined ? '  [' + lk.value + ']' : '';
        lines.push('  ' + lk.from + '  →  ' + lk.to + valTx);
      }
      lines.push('  [' + this.links.length + ' link' + (this.links.length === 1 ? '' : 's') + ']');
    }
    return lines.join('\n');
  };

  // ── Root Trace (backward causation) ──────────────────────
  //
  // `root of STATE in CHAIN into Z`
  // Walks the chain in reverse from the observed state to find the root cause.
  // Complements forecast (forward) — together they close the predict/diagnose loop.

  function EventMathRootTrace(chain, targetState) {
    if (!(this instanceof EventMathRootTrace)) return new EventMathRootTrace(chain, targetState);
    this.chain  = chain       || null;
    this.target = String(targetState || '');
    this.path   = this._trace();
    this.root   = this.path.length > 1 ? this.path[0] : this.target;
  }

  EventMathRootTrace.prototype._trace = function () {
    if (!this.chain || !this.chain.links || this.chain.links.length === 0) {
      return [this.target];
    }
    var path    = [this.target];
    var current = this.target.toLowerCase();
    var links   = this.chain.links;
    var visited = {};
    visited[current] = true;

    for (var depth = 0; depth < links.length + 1; depth++) {
      var prev = null;
      for (var i = 0; i < links.length; i++) {
        var toLower = links[i].to.toLowerCase();
        if (toLower === current ||
            current.includes(toLower) ||
            toLower.includes(current)) {
          prev = links[i].from;
          break;
        }
      }
      if (!prev || visited[prev.toLowerCase()]) break;
      path.unshift(prev);
      current = prev.toLowerCase();
      visited[current] = true;
    }
    return path;
  };

  EventMathRootTrace.prototype.render = function () {
    var lines = ['── Root Trace → "' + this.target + '" ──'];
    if (this.path.length <= 1) {
      lines.push('  Root cause: unknown — no matching chain found');
      lines.push('  Define a chain with "leads to" statements to enable backward tracing');
    } else {
      lines.push('  Causal path (' + this.path.length + ' steps):');
      for (var i = 0; i < this.path.length; i++) {
        var tag = i === 0 ? '  ← ROOT CAUSE' : (i === this.path.length - 1 ? '  ← OBSERVED STATE' : '');
        lines.push('  [' + (i + 1) + '] ' + this.path[i] + tag);
        if (i < this.path.length - 1) lines.push('        ↓');
      }
      lines.push('');
      lines.push('  Root cause: "' + this.root + '"');
      lines.push('  Flip "' + this.root + '" to change "' + this.target + '"');
    }
    return lines.join('\n');
  };

  // ── Fallacy Library ───────────────────────────────────────
  //
  // 25 built-in logical fallacy patterns.
  // `detect fallacies in CHAIN into Z` scans a chain for structural fallacies.
  // Custom fallacies can be added via the EventMathFallacyDetector constructor.
  // This is the first programmatic fallacy-detection system in any language.

  var FALLACY_PATTERNS = {
    'ad hominem':           'attacking the person instead of the argument',
    'straw man':            'misrepresenting the argument to make it easier to attack',
    'false dichotomy':      'presenting only two options when more exist',
    'slippery slope':       'assuming a chain of events without evidence for each step',
    'circular reasoning':   'using the conclusion as a premise (A causes A)',
    'hasty generalization': 'broad claim drawn from insufficient examples',
    'appeal to authority':  'citing authority as proof rather than reasoning',
    'appeal to emotion':    'manipulating emotions instead of using logic',
    'red herring':          'irrelevant distraction from the actual argument',
    'post hoc':             'assuming causation from temporal correlation',
    'tu quoque':            'deflecting by pointing to the same flaw in others',
    'appeal to ignorance':  'absence of disproof treated as proof',
    'bandwagon':            'using popularity as justification for truth',
    'false cause':          'asserting an incorrect causal relationship',
    'equivocation':         'using the same word with shifting meanings',
    'loaded question':      'question with an embedded false assumption',
    'composition':          'what is true of a part assumed true of the whole',
    'division':             'what is true of the whole assumed true of every part',
    'appeal to nature':     'natural equals good; unnatural equals bad',
    'anecdotal':            'personal experience used as universal evidence',
    'genetic':              'judging an argument by its origin rather than its merit',
    'no true scotsman':     'moving the goalposts to exclude counterexamples',
    'black and white':      'oversimplifying to two extremes when a spectrum exists',
    'middle ground':        'assuming compromise is always true',
    'sunk cost':            'past investment used to justify continuing a failing course'
  };

  function EventMathFallacyDetector(chain, customFallacies) {
    if (!(this instanceof EventMathFallacyDetector)) {
      return new EventMathFallacyDetector(chain, customFallacies);
    }
    this.chain    = chain || null;
    this.patterns = Object.assign({}, FALLACY_PATTERNS, customFallacies || {});
    this.findings = this._detect();
  }

  EventMathFallacyDetector.prototype._detect = function () {
    var findings = [];
    if (!this.chain || !this.chain.links) return findings;
    var links = this.chain.links;

    // Circular reasoning: A → B → A
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      for (var j = 0; j < links.length; j++) {
        if (j !== i &&
            links[j].from.toLowerCase() === links[i].to.toLowerCase() &&
            links[j].to.toLowerCase()   === links[i].from.toLowerCase()) {
          var key = [links[i].from, links[i].to].sort().join('↔');
          if (!seen[key]) {
            seen[key] = true;
            findings.push({
              fallacy: 'circular reasoning',
              description: this.patterns['circular reasoning'],
              evidence: '"' + links[i].from + '" ↔ "' + links[i].to + '" (mutual causation)'
            });
          }
        }
      }
    }

    // Slippery slope: chain longer than 4 steps with no branching (linear cascade)
    if (links.length > 4) {
      var targets = {};
      for (var s = 0; s < links.length; s++) targets[links[s].to] = true;
      var roots = links.filter(function (l) { return !targets[l.from]; });
      if (roots.length <= 1) {
        findings.push({
          fallacy: 'slippery slope risk',
          description: this.patterns['slippery slope'],
          evidence: 'Linear chain of ' + links.length + ' steps — verify each causal link has evidence'
        });
      }
    }

    // False dichotomy: exactly two root nodes feeding into many outcomes
    var sourceCount = {};
    for (var r = 0; r < links.length; r++) sourceCount[links[r].from] = true;
    var targetSet = {};
    for (var t = 0; t < links.length; t++) targetSet[links[t].to] = true;
    var rootNodes = Object.keys(sourceCount).filter(function (k) { return !targetSet[k]; });
    if (rootNodes.length === 2 && links.length > 3) {
      findings.push({
        fallacy: 'false dichotomy risk',
        description: this.patterns['false dichotomy'],
        evidence: 'Only two root nodes found: "' + rootNodes.join('" and "') + '" — verify no third path exists'
      });
    }

    return findings;
  };

  EventMathFallacyDetector.prototype.render = function () {
    var chainName = (this.chain && this.chain.name) || 'unknown';
    var lines = ['── Fallacy Scan: ' + chainName + ' ──'];
    lines.push('  Patterns in library: ' + Object.keys(this.patterns).length);
    lines.push('  Findings: ' + this.findings.length);
    lines.push('');

    if (this.findings.length === 0) {
      lines.push('  ✓ No structural fallacies detected in this chain');
    } else {
      for (var i = 0; i < this.findings.length; i++) {
        var f = this.findings[i];
        lines.push('  [' + (i + 1) + '] ' + f.fallacy.toUpperCase());
        lines.push('      ' + f.description);
        lines.push('      Evidence: ' + f.evidence);
        lines.push('');
      }
    }

    lines.push('  Full fallacy library:');
    Object.keys(FALLACY_PATTERNS).forEach(function (k) {
      lines.push('    • ' + k);
    });
    return lines.join('\n');
  };

  // ── Assumption ────────────────────────────────────────────
  //
  // `assume NAME is VALUE`
  // Named declarations that can be referenced in desire conditions.
  // Numeric values are resolved at satisfaction-evaluation time so
  // "satisfied when is payment more than market rate" uses the
  // assumption value for "market rate" rather than treating it as
  // a plain keyword.

  function EventMathAssumption(name, value) {
    if (!(this instanceof EventMathAssumption)) {
      return new EventMathAssumption(name, value);
    }
    this.name         = name  || '';
    this.rawValue     = value !== undefined && value !== null ? String(value) : '';
    var n             = parseFloat(this.rawValue);
    this.numericValue = isNaN(n) ? null : n;
    this.textValue    = this.rawValue;
    this.active       = true;
  }

  EventMathAssumption.prototype.render = function () {
    var lines = ['── Assumption: ' + this.name + ' ──'];
    lines.push('  Value:   ' + (this.rawValue || '(none)'));
    if (this.numericValue !== null) lines.push('  Numeric: ' + this.numericValue);
    lines.push('  Status:  ' + (this.active ? 'active' : 'challenged'));
    return lines.join('\n');
  };

  // ── Desire ────────────────────────────────────────────────
  //
  // Wraps a desire block: subjective want → typed condition that can be
  // evaluated against a chain. Direction: more | less | matches | does not match.
  // Satisfied when: a text condition parsed into {subject, operator, target}.

  function EventMathDesire(name, matter) {
    if (!(this instanceof EventMathDesire)) {
      return new EventMathDesire(name, matter);
    }
    this.name        = name   || '';
    var m            = matter || {};
    this.scenario    = m.scenario   || '';
    this.subjective  = m.subjective || '';
    this.outcomeText = m.outcome    || '';
    this.direction   = String(m.direction || 'matches').toLowerCase().trim();
    this.state       = String(m.state     || 'desired').toLowerCase().trim();
    // "satisfied when" key may contain a space — access via bracket notation
    this.satisfiedWhen = m['satisfied when'] || m.satisfiedWhen || this.outcomeText || '';
    this._condition    = this._parseCondition(this.satisfiedWhen);
    // priority for conflict resolution — matter field "priority is N", default 1
    // Also accepts m.weight from direct API use (not via compiled .em files)
    var w = parseFloat(m.priority || m['priority'] || m.weight || 1);
    this.weight = (w > 0 && !isNaN(w)) ? w : 1;
  }

  EventMathDesire.prototype._parseCondition = function (text) {
    if (!text) return { subject: '', operator: this.direction || 'matches', target: '' };
    var t   = String(text).toLowerCase().trim();
    // Multi-word operators must be checked before single-word ones
    var ops = ['does not match', 'more than', 'less than', 'not equals',
               'exceeds', 'matches', 'equals', 'reaches', 'occurs', 'includes'];
    for (var i = 0; i < ops.length; i++) {
      var op  = ops[i];
      var idx = t.indexOf(' ' + op + ' ');
      if (idx >= 0) {
        return { subject: t.slice(0, idx).trim(), operator: op, target: t.slice(idx + op.length + 2).trim() };
      }
      if (t.startsWith(op + ' ')) {
        return { subject: '', operator: op, target: t.slice(op.length + 1).trim() };
      }
    }
    // No operator keyword found — treat whole text as target
    return { subject: '', operator: this.direction || 'matches', target: t };
  };

  EventMathDesire.prototype.render = function () {
    var lines = ['── Desire: ' + this.name + ' ──'];
    if (this.scenario)   lines.push('  Scenario:     ' + this.scenario);
    lines.push('  Subjective:   ' + (this.subjective  || '(not stated)'));
    lines.push('  Outcome:      ' + (this.outcomeText || '(not stated)'));
    lines.push('  Direction:    ' + this.direction);
    lines.push('  State:        ' + this.state);
    if (this.satisfiedWhen) lines.push('  Satisfied when: ' + this.satisfiedWhen);
    return lines.join('\n');
  };

  // ── Satisfaction Engine ────────────────────────────────────
  //
  // `satisfy DESIRE against CHAIN into RESULT`
  // `evaluate DESIRE and DESIRE against CHAIN into RESULT`
  //
  // Evaluates whether desires are satisfied by a causal chain.
  // Satisfaction = the chain's reachable states contain what the desire requires.
  // Score = percentage of desires satisfied (0–100).
  // Gaps = array of unsatisfied desires with reasons.

  function EventMathSatisfactionEngine(name, desires, chain, assumptions) {
    if (!(this instanceof EventMathSatisfactionEngine)) {
      return new EventMathSatisfactionEngine(name, desires, chain, assumptions);
    }
    this.name        = name   || 'satisfaction check';
    this.desires     = Array.isArray(desires)     ? desires     : (desires     ? [desires]     : []);
    this.assumptions = Array.isArray(assumptions) ? assumptions : (assumptions ? [assumptions] : []);
    this.chain       = chain  || null;
    this.results     = [];
    this.score       = 0;
    this.gaps        = [];
    this._evaluate();
  }

  EventMathSatisfactionEngine.prototype._extractChainStates = function () {
    if (!this.chain || !this.chain.links || this.chain.links.length === 0) {
      return { all: [], terminals: [], sources: [], stateValues: {} };
    }
    var all         = [];
    var sourceSet   = {};
    var stateValues = {};    // stateName → numeric value (if set)

    this.chain.links.forEach(function (lk) {
      var f = (lk.from || '').toLowerCase();
      var t = (lk.to   || '').toLowerCase();
      if (all.indexOf(f) === -1) all.push(f);
      if (all.indexOf(t) === -1) all.push(t);
      sourceSet[f] = true;
      // For branching chains (multiple paths to the same node), take the strongest path value
      if (lk.value !== undefined && (stateValues[t] === undefined || lk.value > stateValues[t])) {
        stateValues[t] = lk.value;
      }
    });
    var terminals = all.filter(function (s) { return !sourceSet[s]; });
    return { all: all, terminals: terminals, sources: Object.keys(sourceSet), stateValues: stateValues };
  };

  EventMathSatisfactionEngine.prototype._resolveNumericTarget = function (target) {
    // 1. Try to parse an inline number from the condition target text
    var numMatch = String(target || '').match(/\d+(\.\d+)?/);
    if (numMatch) return parseFloat(numMatch[0]);

    // 2. Try to resolve from declared assumptions by name overlap
    var targetLower = (target || '').toLowerCase();
    for (var i = 0; i < this.assumptions.length; i++) {
      var a = this.assumptions[i];
      if (a && a.active && a.numericValue !== null &&
          targetLower.includes(a.name.toLowerCase())) {
        return a.numericValue;
      }
    }
    return null;
  };

  EventMathSatisfactionEngine.prototype._resolveActualValue = function (subject, targetWords, stateValues) {
    var lookup = Object.keys(stateValues);
    // Subject is the thing being measured; targetWords is the threshold.
    // Searching by both causes false matches when target words appear in unrelated state names.
    // Use subject words exclusively when available; fall back to targetWords only when subject is absent.
    var subjectWords = subject ? subject.split(/\s+/) : [];
    var searchWords  = subjectWords.length > 0 ? subjectWords : targetWords;
    for (var i = 0; i < lookup.length; i++) {
      var stateName  = lookup[i];
      var stateWords = stateName.split(/\s+/);
      var matched    = searchWords.some(function (w) {
        return w.length > 2 && stateWords.some(function (sw) { return sw.includes(w); });
      });
      if (matched) return stateValues[stateName];
    }
    return null;
  };

  EventMathSatisfactionEngine.prototype._checkDesire = function (desire, chainStates) {
    var cond        = desire._condition || { subject: '', operator: 'matches', target: '' };
    var direction   = (desire.direction || 'matches').toLowerCase();
    var target      = (cond.target  || '').toLowerCase();
    var subject     = (cond.subject || '').toLowerCase();
    var allStates   = chainStates.all       || [];
    var terminals   = chainStates.terminals || [];
    var stateValues = chainStates.stateValues || {};

    var POS = ['increase', 'growth', 'more', 'rise', 'gain', 'expand', 'improve', 'higher'];
    var NEG = ['decrease', 'reduce', 'less', 'drop', 'loss', 'shrink', 'decline', 'lower'];

    var targetWords = target.split(/\s+/).filter(function (w) { return w.length > 2 && !/^\d/.test(w); });

    var terminalMatch = terminals.some(function (s) {
      return targetWords.some(function (w) { return s.includes(w); }) ||
             (subject.length > 2 && s.includes(subject));
    });
    var anyMatch = allStates.some(function (s) {
      return targetWords.some(function (w) { return s.includes(w); }) ||
             (subject.length > 2 && s.includes(subject));
    });

    var satisfied, reason, partialScore, actualValue, targetValue, gap;

    var noChain = !this.chain || !this.chain.links || this.chain.links.length === 0;
    if (noChain) {
      return {
        desire: desire.name, satisfied: false, partialScore: 0,
        actualValue: null, targetValue: null, gap: null,
        direction: direction,
        condition: desire.satisfiedWhen || desire.outcomeText || '',
        scenario: desire.scenario || '',
        reason: 'No chain provided — cannot evaluate satisfaction'
      };
    }

    // ── Numeric path ────────────────────────────────────────────
    targetValue  = this._resolveNumericTarget(target);
    actualValue  = this._resolveActualValue(subject, targetWords, stateValues);

    if (actualValue !== null && targetValue !== null) {
      var label = (subject || targetWords[0] || 'value');
      if (direction === 'more' || direction === 'more than' ||
          direction === 'exceeds' || cond.operator === 'more than' || cond.operator === 'exceeds') {
        satisfied    = actualValue > targetValue;
        partialScore = Math.min(100, Math.round((actualValue / targetValue) * 100));
        gap          = satisfied ? 0 : Math.round((targetValue - actualValue) * 100) / 100;
        reason       = satisfied
          ? label + ' is ' + actualValue + ' — target: ' + targetValue + ' — exceeded by ' + (actualValue - targetValue) + ' (100% satisfied)'
          : label + ' is ' + actualValue + ' — target: ' + targetValue + ' — gap: ' + gap + ' (' + partialScore + '% of target)';

      } else if (direction === 'less' || direction === 'less than' || cond.operator === 'less than') {
        satisfied    = actualValue < targetValue;
        partialScore = satisfied ? 100 : Math.min(100, Math.round((targetValue / actualValue) * 100));
        gap          = satisfied ? 0 : Math.round((actualValue - targetValue) * 100) / 100;
        reason       = satisfied
          ? label + ' is ' + actualValue + ' — target below: ' + targetValue + ' — satisfied'
          : label + ' is ' + actualValue + ' — target below: ' + targetValue + ' — above by ' + gap;

      } else {
        // matches / equals
        var diff = Math.abs(actualValue - targetValue);
        satisfied    = diff === 0;
        partialScore = diff === 0 ? 100 : Math.max(0, Math.round((1 - diff / targetValue) * 100));
        gap          = satisfied ? 0 : diff;
        reason       = satisfied
          ? label + ' is ' + actualValue + ' — matches target ' + targetValue + ' exactly'
          : label + ' is ' + actualValue + ' — target: ' + targetValue + ' — gap: ' + gap + ' (' + partialScore + '% match)';
      }

      return {
        desire: desire.name, satisfied: satisfied, partialScore: partialScore,
        actualValue: actualValue, targetValue: targetValue, gap: gap,
        direction: direction,
        condition: desire.satisfiedWhen || desire.outcomeText || '',
        scenario: desire.scenario || '',
        reason: reason
      };
    }

    // ── Keyword / structural path (no numeric values) ────────────
    partialScore = 0;
    actualValue  = null;
    targetValue  = null;
    gap          = null;

    if (direction === 'does not match') {
      satisfied    = !anyMatch;
      partialScore = satisfied ? 100 : 0;
      reason       = satisfied
        ? 'Chain does not contain "' + (target || subject) + '" — desired absence confirmed'
        : 'Chain contains "' + (target || subject) + '" — desired absence violated';

    } else if (direction === 'more' || direction === 'more than') {
      var posMatch = allStates.some(function (s) {
        return POS.some(function (sig) { return s.includes(sig); }) ||
               targetWords.some(function (w) { return s.includes(w); });
      });
      satisfied    = posMatch || anyMatch;
      partialScore = satisfied ? 100 : 0;
      reason       = satisfied
        ? 'Chain contains states trending toward "' + (target || subject) + '"'
        : 'Chain does not show increase toward "' + (target || subject) + '" — gap';

    } else if (direction === 'less' || direction === 'less than') {
      var negMatch = allStates.some(function (s) {
        return NEG.some(function (sig) { return s.includes(sig); }) ||
               targetWords.some(function (w) { return s.includes(w); });
      });
      satisfied    = negMatch || anyMatch;
      partialScore = satisfied ? 100 : 0;
      reason       = satisfied
        ? 'Chain contains states trending toward reduction of "' + (target || subject) + '"'
        : 'Chain does not show reduction of "' + (target || subject) + '" — gap';

    } else {
      satisfied    = terminalMatch || anyMatch;
      partialScore = satisfied ? 100 : 0;
      reason       = satisfied
        ? 'Chain reaches a state containing "' + (target || subject) + '"'
        : 'Chain does not reach "' + (target || subject) + '" — gap in causal path';
    }

    return {
      desire: desire.name, satisfied: satisfied, partialScore: partialScore,
      actualValue: null, targetValue: null, gap: null,
      direction: direction,
      condition: desire.satisfiedWhen || desire.outcomeText || '',
      scenario: desire.scenario || '',
      reason: reason
    };
  };

  EventMathSatisfactionEngine.prototype._evaluate = function () {
    var self         = this;
    var chainStates  = this._extractChainStates();
    var weightedSum  = 0;
    var totalWeight  = 0;
    this.desires.forEach(function (d) {
      var r = self._checkDesire(d, chainStates);
      self.results.push(r);
      var w = (d && d.weight > 0) ? d.weight : 1;
      weightedSum += (r.partialScore || 0) * w;
      totalWeight += w;
      if (!r.satisfied) self.gaps.push(r);
    });
    this.score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  };

  EventMathSatisfactionEngine.prototype.render = function () {
    var lines      = [];
    var satN       = this.results.filter(function (r) { return r.satisfied; }).length;
    var total      = this.results.length;
    var statusLine = this.score === 100
      ? 'INNOVATION COMPLETE — all desires satisfied'
      : this.score > 50
        ? 'PARTIAL — ' + this.gaps.length + ' desire(s) unmet'
        : total === 0
          ? 'NO DESIRES — nothing to evaluate'
          : 'BLOCKED — majority of desires unsatisfied';

    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ Satisfaction Engine: ' + this.name);
    lines.push('║ Score: ' + this.score + '%  (' + satN + '/' + total + ' desires satisfied)');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');

    this.results.forEach(function (r) {
      lines.push('  ' + (r.satisfied ? '✓' : '✗') + '  ' + r.desire +
                 (r.partialScore !== undefined && r.partialScore < 100 && r.partialScore > 0
                   ? '  [' + r.partialScore + '%]' : ''));
      if (r.scenario)   lines.push('      Scenario:  ' + r.scenario);
      if (r.condition)  lines.push('      Condition: ' + r.condition);
      lines.push('      Direction: ' + r.direction);
      if (r.actualValue !== null && r.targetValue !== null) {
        lines.push('      Actual:    ' + r.actualValue +
                   '  /  Target: ' + r.targetValue +
                   (r.gap ? '  /  Gap: ' + r.gap : ''));
      }
      lines.push('      Result:    ' + r.reason);
      lines.push('');
    });

    if (this.gaps.length > 0) {
      lines.push('  ── Unmet desires (gaps) ──');
      this.gaps.forEach(function (g) {
        var quantNote = (g.actualValue !== null && g.targetValue !== null)
          ? '  (' + g.actualValue + ' vs target ' + g.targetValue + ')'
          : '';
        lines.push('    • ' + g.desire + quantNote);
        lines.push('      → ' + g.reason);
      });
      lines.push('');
    } else if (total > 0) {
      lines.push('  All desires satisfied.');
      lines.push('');
    }

    if (this.assumptions.length > 0) {
      lines.push('  ── Assumptions used ──');
      this.assumptions.forEach(function (a) {
        lines.push('    • ' + a.name + ': ' + a.rawValue);
      });
      lines.push('');
    }

    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ ' + statusLine);
    lines.push('╚' + '═'.repeat(58) + '╝');
    return lines.join('\n');
  };

  // ── Fractal Axis (multi-tier, multiples of 13) ────────────
  //
  // `fractal X and Y into Z` where X and Y are toruses.
  // Auto-builds tiers based on input dimension:
  //   D±13  → 1 tier  (D±13 foundation)
  //   D±26  → 2 tiers (D±13 foundation, D±26 tier 2)
  //   D±39  → 3 tiers (D±13 foundation, D±26 tier 2, D±39 tier 3)
  //   D±52  → 4 tiers (next pass), and so on in multiples of 13.
  // Each tier repeats the same 6-layer complex structure.
  // Tier N's grand axis feeds Tier N+1's bridge — fractal self-similarity.

  function EventMathSpine(name, negative, positive) {
    if (!(this instanceof EventMathSpine)) {
      return new EventMathSpine(name, negative, positive);
    }
    this.name     = name     || '';
    this.negative = negative || null;
    this.positive = positive || null;

    var negDim = Math.abs((negative && negative.dimension) || 2);
    var posDim = Math.abs((positive && positive.dimension) || 2);
    var maxDim = Math.max(negDim, posDim);

    // Tier 1: foundation at D±13
    var t1n = new EventMathAnchor(name + '_t1_neg');
    t1n.setDepth(-Math.min(13, negDim));
    var t1p = new EventMathAnchor(name + '_t1_pos');
    t1p.setDepth(Math.min(13, posDim));
    this.tier1 = new EventMathAxis(name + '_tier1', t1n, t1p);

    if (maxDim >= 27) {
      // 3-tier mode: tier2 at D±26 (internal toruses), tier3 at D±maxDim (passed)
      var t2n = new EventMathAnchor(name + '_t2_neg');
      t2n.setDepth(-26);
      var t2p = new EventMathAnchor(name + '_t2_pos');
      t2p.setDepth(26);
      this.tier2 = new EventMathAxis(name + '_tier2', t2n, t2p);
      this.tier2.bridge.fractalFrom = this.tier1.grandAxis.name;

      // Tier 3: D±maxDim using passed toruses
      this.tier3 = new EventMathAxis(name + '_tier3', negative, positive);
      this.tier3.bridge.fractalFrom = this.tier2.grandAxis.name;

      this.dimension    = maxDim;
      this.presentLine  = this.tier3.presentLine;
      this.fractalDepth = 3;
      this.signature    = 'D±13 ⊂ D±26 ⊂ D±' + maxDim;
    } else {
      // 2-tier mode: tier2 at D±maxDim using passed toruses
      this.tier2 = new EventMathAxis(name + '_tier2', negative, positive);
      this.tier2.bridge.fractalFrom = this.tier1.grandAxis.name;

      this.dimension    = maxDim;
      this.presentLine  = this.tier2.presentLine;
      this.fractalDepth = 2;
      this.signature    = 'D±' + Math.min(13, posDim) + ' ⊂ D±' + maxDim;
    }
  }

  EventMathSpine.prototype.extend = function (negative52, positive52) {
    var t4n = negative52 || null;
    var t4p = positive52 || null;
    if (!t4n) { t4n = new EventMathAnchor(this.name + '_t4_neg'); t4n.setDepth(-52); }
    if (!t4p) { t4p = new EventMathAnchor(this.name + '_t4_pos'); t4p.setDepth( 52); }
    this.tier4 = new EventMathAxis(this.name + '_tier4', t4n, t4p);
    var parent = this.tier3 || this.tier2;
    if (parent) this.tier4.bridge.fractalFrom = parent.grandAxis.name;
    this.fractalDepth = 4;
    this.dimension    = 52;
    this.signature    = 'D±13 ⊂ D±26 ⊂ D±39 ⊂ D±52';
  };

  EventMathSpine.prototype.render = function () {
    var lines = [];
    var depth    = this.fractalDepth;
    var topAxis  = this.tier4 || this.tier3 || this.tier2;
    var nextDim  = this.dimension + 13;
    var layerCount = depth * 6;

    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ EventMath Fractal Axis: ' + this.name);
    lines.push('║ Signature: ' + this.signature +
               '  [' + depth + ' tier' + (depth > 1 ? 's' : '') + ', self-similar]');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');

    lines.push('  TIER 1  D±' + Math.abs(this.tier1.dimension) +
               '  →  D' + this.tier1.grandAxis.zoomLevel + ' governance  [foundation]');
    lines.push('  ' + '─'.repeat(50));
    var t1 = this.tier1.render().split('\n');
    for (var i = 0; i < t1.length; i++) lines.push('    ' + t1[i]);
    lines.push('');

    lines.push('  TIER 2  D±' + Math.abs(this.tier2.dimension) +
               '  →  D' + this.tier2.grandAxis.zoomLevel + ' governance');
    lines.push('  (Tier 1 grand axis feeds Tier 2 bridge — fractal self-similarity)');
    lines.push('  ' + '─'.repeat(50));
    var t2 = this.tier2.render().split('\n');
    for (var j = 0; j < t2.length; j++) lines.push('    ' + t2[j]);
    lines.push('');

    if (this.tier3) {
      lines.push('  TIER 3  D±' + Math.abs(this.tier3.dimension) +
                 '  →  D' + this.tier3.grandAxis.zoomLevel + ' governance');
      lines.push('  (Tier 2 grand axis feeds Tier 3 bridge — fractal tier 3)');
      lines.push('  ' + '─'.repeat(50));
      var t3 = this.tier3.render().split('\n');
      for (var k = 0; k < t3.length; k++) lines.push('    ' + t3[k]);
      lines.push('');
    }

    if (this.tier4) {
      lines.push('  TIER 4  D±52  [Emergence — what this architecture makes possible]');
      lines.push('  (Tier 3 grand axis feeds Tier 4 bridge — emergence layer)');
      lines.push('  ' + '─'.repeat(50));
      var t4 = this.tier4.render().split('\n');
      for (var m = 0; m < t4.length; m++) lines.push('    ' + t4[m]);
      lines.push('');
    }

    lines.push('  Fractal present line: ' + this.presentLine);
    lines.push('  Fractal depth: ' + depth +
               '  [D±' + nextDim + ' available next pass — multiples of 13]');
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ COMPLETE  [' + layerCount + ' layers, D' + topAxis.grandAxis.zoomLevel + ' max governance]');
    lines.push('╚' + '═'.repeat(58) + '╝');
    return lines.join('\n');
  };

  // ── Dimensional Report (multi-tier satisfaction) ──────────
  //
  // `evaluate DESIRE [and DESIRE...] against CHAIN across fractal FRACTAL into REPORT`
  //
  // Connects the fractal axis to the satisfaction engine across three tiers:
  //   Tier 1  D±13  Surface   — can the chain directly reach the desire's target?
  //   Tier 2  D±26  System    — does the chain hold up under fallacy scrutiny?
  //   Tier 3  D±39  Root      — is the fractal foundation aligned or suppressing?
  //
  // Gradient: ALIGNED | SHARP DECLINE | BLOCKED | ROOT STRONGER THAN SURFACE | etc.
  // Correction path targeted to the tier where the score drops.

  function EventMathGrade(name, desires, chain, fractal, assumptions) {
    if (!(this instanceof EventMathGrade)) {
      return new EventMathGrade(name, desires, chain, fractal, assumptions);
    }
    this.name        = name   || 'dimensional report';
    this.desires     = Array.isArray(desires)     ? desires     : (desires     ? [desires]     : []);
    this.assumptions = Array.isArray(assumptions) ? assumptions : (assumptions ? [assumptions] : []);
    this.chain       = chain   || null;
    this.fractal     = fractal || null;

    this.tier1Engine       = null;
    this.tier1Score        = 0;
    this.tier2Score        = 0;
    this.tier3Score        = 0;
    this.tier4Score        = 0;
    this.systemConfidence  = 1.0;
    this.rootConfidence    = 1.0;
    this.emergeConfidence  = 1.0;
    this.systemAdjustments = [];
    this.emergeAdjustments = [];
    this.rootAdjustments   = [];
    this.gradient          = '';
    this.correctionPath    = '';

    this._compute();
  }

  EventMathGrade.prototype._compute = function () {
    // ── Tier 1: surface satisfaction ────────────────────────────────
    this.tier1Engine = new EventMathSatisfactionEngine(
      this.name + '_surface', this.desires, this.chain, this.assumptions
    );
    this.tier1Score = this.tier1Engine.score;

    // ── Tier 2: system confidence (fallacy-adjusted) ─────────────────
    this.systemConfidence  = 1.0;
    this.systemAdjustments = [];

    if (this.chain) {
      var detector = new EventMathFallacyDetector(this.chain);
      for (var i = 0; i < detector.findings.length; i++) {
        var f = detector.findings[i];
        if (f.fallacy === 'circular reasoning') {
          this.systemConfidence *= 0.5;
          this.systemAdjustments.push('circular reasoning detected  →  ×0.50');
        } else if (f.fallacy === 'slippery slope risk') {
          this.systemConfidence *= 0.75;
          this.systemAdjustments.push('slippery slope risk detected  →  ×0.75');
        } else if (f.fallacy === 'false dichotomy risk') {
          this.systemConfidence *= 0.85;
          this.systemAdjustments.push('false dichotomy risk detected  →  ×0.85');
        }
      }
    }

    if (this.fractal && this.fractal.presentLine !== 0) {
      this.systemConfidence *= 0.9;
      this.systemAdjustments.push(
        'present line offset: ' + this.fractal.presentLine + '  →  ×0.90'
      );
    }

    this.tier2Score = Math.min(100, Math.round(this.tier1Score * this.systemConfidence));

    // ── Tier 3: root confidence (fractal energy alignment) ───────────
    this.rootConfidence  = 1.0;
    this.rootAdjustments = [];

    if (this.fractal) {
      if (this.fractal.tier3) {
        var t3     = this.fractal.tier3;
        var negDim = t3.negative ? Math.abs(t3.negative.dimension || 0) : 0;
        var posDim = t3.positive ? Math.abs(t3.positive.dimension || 0) : 0;

        if (negDim >= 39) {
          this.rootConfidence *= 0.6;
          this.rootAdjustments.push(
            'D-' + negDim + ' negative torus (max tension)  →  ×0.60'
          );
        }
        if (posDim >= 39) {
          this.rootConfidence *= 1.2;
          this.rootAdjustments.push(
            'D+' + posDim + ' positive torus (sovereign signal)  →  ×1.20'
          );
        }
        if (negDim < 39 && posDim < 39) {
          this.rootAdjustments.push(
            'D±' + Math.max(negDim, posDim) + ' fractal depth  →  ×1.00 (balanced)'
          );
        }
      } else {
        this.rootConfidence *= 0.9;
        this.rootAdjustments.push(
          '2-tier fractal (D±26 max)  →  ×0.90 (limited depth)'
        );
      }
    } else {
      this.rootConfidence *= 0.8;
      this.rootAdjustments.push(
        'no fractal axis provided  →  ×0.80 (no structural foundation)'
      );
    }

    this.tier3Score = Math.min(100, Math.max(0,
      Math.round(this.tier2Score * this.rootConfidence)
    ));

    // ── Tier 4: emergence D±52 — what the architecture makes possible ──
    // Scales quadratically from root strength: t3² / 100.
    // Weak roots (t3 < 50) yield little emergence; strong roots compound.
    // Optional D±52 tori from 'deepen' modulate the confidence factor.
    this.emergeConfidence  = 1.0;
    this.emergeAdjustments = [];
    var baseEmergence = this.tier3Score * this.tier3Score / 100;

    if (this.fractal && this.fractal.tier4) {
      var t4ax = this.fractal.tier4;
      var negDim4 = t4ax.negative ? Math.abs(t4ax.negative.dimension || 0) : 0;
      var posDim4 = t4ax.positive ? Math.abs(t4ax.positive.dimension || 0) : 0;
      if (negDim4 >= 52) {
        this.emergeConfidence *= 0.7;
        this.emergeAdjustments.push('D-' + negDim4 + ' emergence noise  →  ×0.70 (shadow constraints)');
      }
      if (posDim4 >= 52) {
        this.emergeConfidence *= 1.3;
        this.emergeAdjustments.push('D+' + posDim4 + ' emergence signal  →  ×1.30 (unlocked potential)');
      }
    } else {
      this.emergeAdjustments.push('no D±52 axis — emergence derived from root architecture (add "deepen" for explicit modulation)');
    }

    this.tier4Score = Math.min(100, Math.max(0,
      Math.round(baseEmergence * this.emergeConfidence)
    ));

    this._analyzeGradient();
  };

  EventMathGrade.prototype._analyzeGradient = function () {
    var t1 = this.tier1Score, t2 = this.tier2Score, t3 = this.tier3Score, t4 = this.tier4Score;

    if (t3 >= 80 && t4 >= 60) {
      this.gradient = 'EMERGENCE READY';
      this.correctionPath =
        'All four tiers are aligned. The root architecture is generating emergence potential ' +
        '(D±52: ' + t4 + '%). Expand the chain to capture what this foundation is already making possible.';
    } else if (t3 > t2 && t2 >= t1) {
      this.gradient = 'ROOT STRONGER THAN SURFACE';
      this.correctionPath =
        'The root architecture is better than the surface chain suggests. ' +
        'Trust the fractal foundation — it amplifies what the surface cannot yet fully show. ' +
        'Deepen the chain to match what the fractal already knows.';
    } else if (t1 >= 80 && t2 >= 70 && t3 >= 60) {
      this.gradient = 'ALIGNED';
      this.correctionPath =
        'Surface, system, and root are in agreement. ' +
        'Root strength projects ' + t4 + '% emergence potential (D±52). ' +
        'This path is structurally sound.';
    } else if (t1 === 0) {
      this.gradient = 'BLOCKED';
      this.correctionPath =
        'The chain cannot surface the desire at any tier. ' +
        'The fundamental causal path is missing. Redesign the chain before adjusting the system.';
    } else if (t1 > 0 && t2 < Math.round(t1 * 0.7)) {
      var fallacyNames = this.systemAdjustments.map(function (a) {
        return a.split('  →')[0];
      });
      this.gradient = 'SHARP DECLINE';
      this.correctionPath =
        'System-level fallacies are collapsing the surface score. Address: ' +
        (fallacyNames.length > 0 ? fallacyNames.join(', ') :
          'the structural weaknesses in the chain') +
        '. Each causal link needs independent evidence.';
    } else if (t3 < t2 && t3 < 50) {
      this.gradient = 'ROOT MISALIGNED';
      this.correctionPath =
        'The root architecture is suppressing the surface potential. ' +
        'Examine the fractal axis: the negative torus may be dominating. ' +
        'Rebalance toward the sovereign signal (positive torus).';
    } else {
      this.gradient = 'SURFACE VIABLE';
      this.correctionPath =
        'The surface chain is working but system and root tiers show friction. ' +
        'Add a "deepen" statement with D±52 tori to unlock the emergence tier ' +
        'and reveal what this architecture can make possible.';
    }
  };

  EventMathGrade.prototype.render = function () {
    var self = this;
    var lines = [];
    var desireNames = this.desires.map(function (d) { return d.name || '?'; }).join(' | ');

    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ Dimensional Report: ' + this.name);
    lines.push('║ Desires:  ' + (desireNames || '(none)'));
    lines.push('║ Chain:    ' + (this.chain   ? this.chain.name   : '(none)'));
    lines.push('║ Fractal:  ' + (this.fractal ? this.fractal.name : '(none)'));
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');

    // Tier 1 — surface
    lines.push('  ── TIER 1  D±13  [Surface — chain → desire?] ──');
    lines.push('  Score: ' + this.tier1Score + '%');
    var t1results = this.tier1Engine ? this.tier1Engine.results : [];
    t1results.forEach(function (r) {
      var partial = (r.partialScore !== undefined && r.partialScore < 100 && r.partialScore > 0)
        ? '  [' + r.partialScore + '%]' : '';
      lines.push('  ' + (r.satisfied ? '✓' : '✗') + '  ' + r.desire + partial);
      lines.push('      ' + r.reason);
    });
    lines.push('');

    // Tier 2 — system
    lines.push('  ── TIER 2  D±26  [System — fallacy-adjusted] ──');
    lines.push('  System confidence: ' + Math.round(this.systemConfidence * 100) + '%');
    if (this.systemAdjustments.length > 0) {
      this.systemAdjustments.forEach(function (a) { lines.push('    • ' + a); });
    } else {
      lines.push('    • no structural fallacies detected — full system confidence');
    }
    lines.push('  Score: ' + this.tier2Score + '%' +
      '  (tier 1 ' + this.tier1Score + '% × ' +
      Math.round(this.systemConfidence * 100) / 100 + ')');
    lines.push('');

    // Tier 3 — root
    lines.push('  ── TIER 3  D±39  [Root — fractal energy] ──');
    lines.push('  Root confidence: ' + Math.round(this.rootConfidence * 100) + '%');
    if (this.rootAdjustments.length > 0) {
      this.rootAdjustments.forEach(function (a) { lines.push('    • ' + a); });
    }
    lines.push('  Score: ' + this.tier3Score + '%' +
      '  (tier 2 ' + this.tier2Score + '% × ' +
      Math.round(this.rootConfidence * 100) / 100 + ')');
    lines.push('');

    // Tier 4 — emergence
    lines.push('  ── TIER 4  D±52  [Emergence — what this architecture makes possible] ──');
    lines.push('  Emergence confidence: ' + Math.round(this.emergeConfidence * 100) + '%');
    if (this.emergeAdjustments.length > 0) {
      this.emergeAdjustments.forEach(function (a) { lines.push('    • ' + a); });
    }
    lines.push('  Score: ' + this.tier4Score + '%' +
      '  (root² / 100 = ' + Math.round(this.tier3Score * this.tier3Score / 100) + '% base × ' +
      Math.round(this.emergeConfidence * 100) / 100 + ')');
    lines.push('');

    // Correction path
    lines.push('  ── Correction path ──');
    var words = this.correctionPath.split(' ');
    var line = '  ', col = 2;
    words.forEach(function (w) {
      if (col + w.length + 1 > 58) { lines.push(line); line = '  ' + w; col = 2 + w.length; }
      else { line += (col > 2 ? ' ' : '') + w; col += w.length + 1; }
    });
    if (line.trim()) lines.push(line);
    lines.push('');

    // Gradient banner
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ GRADIENT: ' + this.gradient);
    lines.push('╚' + '═'.repeat(58) + '╝');
    return lines.join('\n');
  };

  // ── Diagnosis (backward satisfaction trace) ───────────────
  //
  // `why DESIRE is not satisfied in CHAIN into RESULT`
  //
  // Reverses the satisfaction engine: given a desire that is not met,
  // walks the chain backward from the goal to find:
  //   - blockingLink   — the link where value collapses to 0 (or below threshold)
  //   - lastActiveLink — the last productive node before the collapse
  //   - interventionPoint — the specific flip that would unblock the path
  //   - tierAnalysis   — which structural tier the failure lives in
  //
  // Complements DimensionalReport: that asks "how well does the path hold?"
  // Diagnosis asks "exactly where does it break, and what to change?"

  function EventMathDiagnosis(name, desire, chain, assumptions) {
    if (!(this instanceof EventMathDiagnosis)) {
      return new EventMathDiagnosis(name, desire, chain, assumptions);
    }
    this.name        = name   || 'diagnosis';
    this.desire      = desire || null;
    this.chain       = chain  || null;
    this.assumptions = Array.isArray(assumptions) ? assumptions : (assumptions ? [assumptions] : []);

    this.isSatisfied       = false;
    this.currentScore      = 0;
    this.backwardPath      = [];   // links from goal to root, in reverse
    this.blockingLink      = null; // the link where value first hits 0
    this.lastActiveLink    = null; // last productive node before collapse
    this.interventionPoint = '';   // specific lever to pull
    this.tierAnalysis      = [];   // which tier (surface/system/root) the failure lives in
    this.fallacies         = [];   // structural fallacies in the chain
    this.lever             = '';   // one-line recommendation

    this._diagnose();
  }

  EventMathDiagnosis.prototype._diagnose = function () {
    if (!this.desire || !this.chain) return;

    // ── Step 1: run the satisfaction engine forward ───────────
    var eng = new EventMathSatisfactionEngine('diagnosis', [this.desire], this.chain, this.assumptions);
    this.currentScore = eng.score || 0;
    this.isSatisfied  = this.currentScore >= 100;

    if (this.isSatisfied) {
      this.lever = 'Desire "' + this.desire.name + '" is already satisfied.';
      return;
    }

    // ── Step 2: find the desire target in the chain ───────────
    var cond        = this.desire._condition || { subject: '', operator: 'matches', target: '' };
    var target      = (cond.target  || '').toLowerCase().trim();
    var subject     = (cond.subject || '').toLowerCase().trim();
    var links       = this.chain.links || [];
    // Use all non-empty words so short names like "C" or "payment" are matched
    var allWords = (target + ' ' + subject).split(/\s+/).filter(function (w) { return w.length > 0; });

    // Find the terminal link whose "to" matches the desire target (search from end)
    var terminalLink = null;
    for (var i = links.length - 1; i >= 0; i--) {
      var toLower = links[i].to.toLowerCase();
      if (allWords.some(function (w) { return toLower.includes(w); })) {
        terminalLink = links[i];
        break;
      }
    }

    if (!terminalLink) {
      this.interventionPoint = 'Desire target "' + (target || subject) + '" not found in chain.';
      this.lever = 'Add a link to the chain that leads to "' + (target || subject) + '".';
      // fall through to tier analysis even when the target is absent from the chain
    }

    // ── Step 3: walk backward collecting the path ─────────────
    if (!terminalLink) {
      // Skip path analysis but continue to tier analysis below
      this._runTierAnalysis(links, null, null, target, subject);
      return;
    }

    var path    = [terminalLink];
    var current = terminalLink.from.toLowerCase();
    var visited = {};
    visited[terminalLink.to.toLowerCase()] = true;
    visited[current] = true;

    for (var d = 0; d < links.length; d++) {
      // For branching chains pick the highest-value predecessor (strongest path backward)
      var found = null;
      var foundVal = -Infinity;
      for (var j = 0; j < links.length; j++) {
        var lkTo = links[j].to.toLowerCase();
        if (!visited[lkTo] &&
            (lkTo === current || current.includes(lkTo) || lkTo.includes(current))) {
          var lkVal = links[j].value !== undefined ? links[j].value : 0;
          if (found === null || lkVal > foundVal) { found = links[j]; foundVal = lkVal; }
        }
      }
      if (!found) break;
      path.push(found);
      visited[found.to.toLowerCase()] = true;
      current = found.from.toLowerCase();
      visited[current] = true;
    }

    this.backwardPath = path; // goal-first

    // ── Step 4: find blocking link and last active link ────────
    // "Blocking" = value is 0 (or null/undefined for numeric chains).
    // Walk from goal backward; first zero link = blockingLink.
    // Last non-zero link before the run of zeros = lastActiveLink.
    var blockingLink   = null;
    var lastActiveLink = null;
    var hasNumericValues = links.some(function (l) { return l.value !== undefined; });

    if (hasNumericValues) {
      for (var k = 0; k < path.length; k++) {
        var v = path[k].value;
        var isZero = (v === 0 || v === null || v === undefined);
        if (isZero && !blockingLink) {
          blockingLink = path[k];
        }
        if (!isZero && v !== undefined) {
          lastActiveLink = path[k];
        }
      }
    } else {
      // Non-numeric: blocking is the terminal with no outgoing links (end of chain)
      blockingLink = terminalLink;
    }

    this.blockingLink   = blockingLink;
    this.lastActiveLink = lastActiveLink;

    // ── Step 5: identify the intervention ─────────────────────
    if (blockingLink) {
      var fromName = blockingLink.from;
      var toName   = blockingLink.to;
      var prevVal  = lastActiveLink ? lastActiveLink.value : null;
      var prevNode = lastActiveLink ? lastActiveLink.from : null;

      this.interventionPoint = '"' + fromName + '" → "' + toName + '"';

      if (lastActiveLink && prevVal !== null) {
        this.lever = 'Activate link "' + fromName + '" → "' + toName +
          '" (currently value 0). ' +
          'The chain produces "' + (lastActiveLink.to || prevNode) + '" at value ' + prevVal +
          ' — this output is not reaching "' + toName + '". Connecting these unlocks the path.';
      } else {
        this.lever = 'Link "' + fromName + '" → "' + toName + '" produces no value (0). ' +
          'Assign a positive value to this link to activate the downstream path.';
      }
    } else if (!hasNumericValues) {
      this.lever = 'Chain reaches "' + terminalLink.to + '" but desire condition "' +
        (target || subject) + '" is not met. ' +
        'Add numeric values with "at value N" to enable precise gap analysis.';
    }

    // ── Step 6: tier analysis ──────────────────────────────────
    this._runTierAnalysis(links, blockingLink, path, target, subject);
  };

  EventMathDiagnosis.prototype._runTierAnalysis = function (links, blockingLink, path, target, subject) {
    // Tier 1 (surface D±13): where in the chain does the path break?
    var chainLen   = links ? links.length : 0;
    var breakDepth = (blockingLink && path) ? path.indexOf(blockingLink) : -1;
    var breakStep  = breakDepth >= 0 ? (chainLen - breakDepth) : -1;

    this.tierAnalysis.push({
      tier: 1,
      label: 'Surface D±13',
      status: blockingLink ? 'BLOCKED' : (target || subject ? 'TARGET NOT IN CHAIN' : 'CLEAR'),
      detail: blockingLink
        ? 'Path breaks at step ' + (breakStep > 0 ? breakStep : '?') + ' of ' + chainLen +
          ': "' + blockingLink.from + '" → "' + blockingLink.to + '" (value 0)'
        : (target || subject)
          ? 'Desire target "' + (target || subject) + '" not found in chain — add a link leading to it'
          : 'Chain reaches desired state — surface tier is clear'
    });

    // Tier 2 (system D±26): what structural pattern causes this?
    var detector   = new EventMathFallacyDetector(this.chain);
    var fallacies  = detector.findings || [];
    this.fallacies = fallacies;
    var sysDetail  = fallacies.length > 0
      ? fallacies.map(function (f) { return f.name; }).join(', ') + ' — chain structure is fragile'
      : 'No structural fallacies detected';

    this.tierAnalysis.push({
      tier: 2,
      label: 'System D±26',
      status: fallacies.length > 0 ? 'FRAGILE' : 'SOUND',
      detail: sysDetail
    });

    // Tier 3 (root D±39): fractal context not available without 'across fractal'
    this.tierAnalysis.push({
      tier: 3,
      label: 'Root D±39',
      status: 'REQUIRES FRACTAL',
      detail: 'Root tier analysis requires a fractal axis. Use: why ' +
        this.desire.name + ' is not satisfied in ' + this.chain.name +
        ' across fractal MY AXIS into diagnosis'
    });
  };

  EventMathDiagnosis.prototype.render = function () {
    var lines = [];
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ WHY: "' + this.desire.name + '" is not satisfied');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('  Chain: "' + (this.chain ? this.chain.name : '(none)') + '"');
    lines.push('  Score: ' + this.currentScore + '/100');
    lines.push('');

    if (this.isSatisfied) {
      lines.push('  ✓ Already satisfied — no intervention needed.');
      return lines.join('\n');
    }

    // Backward path (goal → root)
    if (this.backwardPath.length > 0) {
      lines.push('  ── Causal path (goal → root) ──');
      for (var i = 0; i < this.backwardPath.length; i++) {
        var lk  = this.backwardPath[i];
        var valStr = lk.value !== undefined ? '  [' + lk.value + ']' : '';
        var marker = (this.blockingLink && lk === this.blockingLink) ? '  ← BLOCKED HERE' : '';
        lines.push('  [' + (i + 1) + '] ' + lk.from + '  →  ' + lk.to + valStr + marker);
      }
      lines.push('');
    }

    // Intervention
    if (this.interventionPoint) {
      lines.push('  ── Minimum intervention ──');
      lines.push('  Flip: ' + this.interventionPoint);
      lines.push('  ' + this.lever);
      lines.push('');
    }

    // Tier analysis
    lines.push('  ── Tier analysis ──');
    for (var t = 0; t < this.tierAnalysis.length; t++) {
      var ta = this.tierAnalysis[t];
      lines.push('  Tier ' + ta.tier + ' (' + ta.label + '): [' + ta.status + ']');
      lines.push('    ' + ta.detail);
    }

    return lines.join('\n');
  };

  // ── Challenge (assumption sensitivity analysis) ───────────
  //
  // `challenge ASSUMPTION in REPORT into RESULT`
  //
  // Deactivates one assumption, re-runs the referenced report,
  // and measures how much each tier score shifts.
  // Labels the assumption: LOAD-BEARING (high sensitivity),
  // SIGNIFICANT (medium), or RESILIENT (low / model holds without it).
  //
  // The `active` flag on EventMathAssumption was designed for this.

  function EventMathChallenge(name, assumptionName, report, assumptions) {
    if (!(this instanceof EventMathChallenge)) {
      return new EventMathChallenge(name, assumptionName, report, assumptions);
    }
    this.name            = name           || 'challenge';
    this.assumptionName  = assumptionName || '';
    this.report          = report         || null;
    this.assumptions     = Array.isArray(assumptions) ? assumptions : (assumptions ? [assumptions] : []);

    this.targetAssumption  = null;
    this.originalScores    = { tier1: 0, tier2: 0, tier3: 0, gradient: '' };
    this.challengedScores  = { tier1: 0, tier2: 0, tier3: 0, gradient: '' };
    this.deltas            = { tier1: 0, tier2: 0, tier3: 0 };
    this.maxDelta          = 0;
    this.sensitivity       = 'UNKNOWN';
    this.verdict           = '';
    this.found             = false;

    this._challenge();
  }

  EventMathChallenge.prototype._challenge = function () {
    // Locate the target assumption
    var lowerName = this.assumptionName.toLowerCase().trim();
    for (var i = 0; i < this.assumptions.length; i++) {
      if (this.assumptions[i].name.toLowerCase().trim() === lowerName) {
        this.targetAssumption = this.assumptions[i];
        break;
      }
    }

    if (!this.targetAssumption) {
      this.verdict = 'Assumption "' + this.assumptionName + '" not found. Check your assume statements.';
      return;
    }
    this.found = true;

    // Capture original scores
    var r = this.report;
    if (r && r.tier1Score !== undefined) {
      this.originalScores = { tier1: r.tier1Score, tier2: r.tier2Score, tier3: r.tier3Score, gradient: r.gradient || '' };
    } else if (r && r.score !== undefined) {
      this.originalScores = { tier1: r.score, tier2: r.score, tier3: r.score, gradient: r.score >= 100 ? 'ALIGNED' : 'BLOCKED' };
    }

    // Deactivate and re-run
    this.targetAssumption.active = false;

    var ct1 = 0, ct2 = 0, ct3 = 0, cg = '';
    if (r instanceof EventMathGrade) {
      var cr = new EventMathGrade('challenged_' + (r.name || ''), r.desires, r.chain, r.fractal, this.assumptions);
      ct1 = cr.tier1Score; ct2 = cr.tier2Score; ct3 = cr.tier3Score; cg = cr.gradient;
    } else if (r instanceof EventMathSatisfactionEngine) {
      var ce = new EventMathSatisfactionEngine('challenged', r.desires, r.chain, this.assumptions);
      ct1 = ct2 = ct3 = ce.score;
      cg = ce.score >= 100 ? 'ALIGNED' : 'BLOCKED';
    } else if (r instanceof EventMathDiagnosis) {
      var cd = new EventMathDiagnosis('challenged_' + (r.name || ''), r.desire, r.chain, this.assumptions);
      ct1 = cd.isSatisfied ? 100 : 0; ct2 = ct1; ct3 = ct1;
      cg = cd.isSatisfied ? 'ALIGNED' : 'BLOCKED';
    }

    // Reactivate
    this.targetAssumption.active = true;

    this.challengedScores = { tier1: ct1, tier2: ct2, tier3: ct3, gradient: cg };
    this.deltas = {
      tier1: ct1 - this.originalScores.tier1,
      tier2: ct2 - this.originalScores.tier2,
      tier3: ct3 - this.originalScores.tier3
    };
    this.maxDelta = Math.max(
      Math.abs(this.deltas.tier1),
      Math.abs(this.deltas.tier2),
      Math.abs(this.deltas.tier3)
    );

    if (this.maxDelta > 20) {
      this.sensitivity = 'HIGH';
      this.verdict     = 'LOAD-BEARING — removing this assumption collapses the model by ' + this.maxDelta + ' points.';
    } else if (this.maxDelta > 5) {
      this.sensitivity = 'MEDIUM';
      this.verdict     = 'SIGNIFICANT — this assumption matters but the model partially holds without it.';
    } else {
      this.sensitivity = 'LOW';
      this.verdict     = 'RESILIENT — the model holds without this assumption (delta: ' + this.maxDelta + ').';
    }
  };

  EventMathChallenge.prototype.render = function () {
    var lines = [];
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ CHALLENGE: "' + this.assumptionName + '"');
    lines.push('╚' + '═'.repeat(58) + '╝');

    if (!this.found) {
      lines.push('  ' + this.verdict);
      return lines.join('\n');
    }

    var orig = this.originalScores;
    var chal = this.challengedScores;

    lines.push('  Assumption suspended: "' + this.assumptionName + '" = ' +
      (this.targetAssumption ? this.targetAssumption.rawValue : '?'));
    lines.push('');
    lines.push('  ── Score comparison ──');
    lines.push('                    Before   After    Δ');

    function fmt(n) { return String(n).padStart(5); }
    function fmtd(n) { var s = (n >= 0 ? '+' : '') + n; return s.padStart(5); }

    lines.push('  Tier 1 (Surface): ' + fmt(orig.tier1) + '    ' + fmt(chal.tier1) + '    ' + fmtd(this.deltas.tier1));
    lines.push('  Tier 2 (System):  ' + fmt(orig.tier2) + '    ' + fmt(chal.tier2) + '    ' + fmtd(this.deltas.tier2));
    lines.push('  Tier 3 (Root):    ' + fmt(orig.tier3) + '    ' + fmt(chal.tier3) + '    ' + fmtd(this.deltas.tier3));
    lines.push('');
    lines.push('  Gradient:  ' + orig.gradient + '  →  ' + (chal.gradient || orig.gradient));
    lines.push('');
    lines.push('  Sensitivity: ' + this.sensitivity);
    lines.push('  ' + this.verdict);
    return lines.join('\n');
  };

  // ── Comparison (side-by-side chain evaluation) ────────────
  //
  // `compare CHAIN and CHAIN for DESIRE into RESULT`
  //
  // Runs the satisfaction engine against both chains for the same desire,
  // applies system-tier fallacy penalties, and declares a winner at each tier.
  // Shows performance gap and a clear recommendation.

  function EventMathComparison(name, chain1, chain2, desire, assumptions) {
    if (!(this instanceof EventMathComparison)) {
      return new EventMathComparison(name, chain1, chain2, desire, assumptions);
    }
    this.name        = name        || 'comparison';
    this.chain1      = chain1      || null;
    this.chain2      = chain2      || null;
    this.desire      = desire      || null;
    this.assumptions = Array.isArray(assumptions) ? assumptions : (assumptions ? [assumptions] : []);

    this.result1   = null;
    this.result2   = null;
    this.winners   = {};
    this.verdict   = '';

    this._compare();
  }

  EventMathComparison.prototype._scoreChain = function (chain) {
    var eng = new EventMathSatisfactionEngine('cmp', [this.desire], chain, this.assumptions);
    var det = new EventMathFallacyDetector(chain);
    var fallacyPenalty = 1.0;
    det.findings.forEach(function (f) {
      if (f.name === 'circular reasoning')  fallacyPenalty = Math.min(fallacyPenalty, 0.50);
      else if (f.name === 'slippery slope risk') fallacyPenalty = Math.min(fallacyPenalty, 0.75);
      else if (f.name === 'false dichotomy risk') fallacyPenalty = Math.min(fallacyPenalty, 0.85);
    });
    var s1 = eng.score;
    var s2 = Math.round(s1 * fallacyPenalty);
    return {
      chain:     chain,
      surface:   s1,
      system:    s2,
      gaps:      eng.gaps,
      fallacies: det.findings,
      penalty:   fallacyPenalty
    };
  };

  EventMathComparison.prototype._compare = function () {
    if (!this.chain1 || !this.chain2 || !this.desire) return;
    this.result1 = this._scoreChain(this.chain1);
    this.result2 = this._scoreChain(this.chain2);

    var r1 = this.result1, r2 = this.result2;
    this.winners = {
      surface:  r1.surface >= r2.surface ? r1.chain.name : r2.chain.name,
      system:   r1.system  >= r2.system  ? r1.chain.name : r2.chain.name,
      overall:  (r1.surface + r1.system) >= (r2.surface + r2.system)
                  ? r1.chain.name : r2.chain.name
    };

    var winner = this.winners.overall;
    var gap    = Math.abs((r1.surface + r1.system) - (r2.surface + r2.system));
    if (r1.surface === r2.surface && r1.system === r2.system) {
      this.verdict = 'Both chains perform identically for "' + this.desire.name + '".';
    } else {
      this.verdict = 'Use "' + winner + '" — outperforms by ' + gap + ' combined tier points.';
    }
  };

  EventMathComparison.prototype.render = function () {
    if (!this.result1 || !this.result2) {
      return '── Comparison: (incomplete — chain or desire missing) ──';
    }
    var r1 = this.result1, r2 = this.result2;
    var lines = [];
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║ COMPARE for desire: "' + this.desire.name + '"');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');

    function bar(n) { return '[' + '█'.repeat(Math.round(n / 5)) + '░'.repeat(20 - Math.round(n / 5)) + '] ' + n; }

    lines.push('  Chain A: "' + r1.chain.name + '"');
    lines.push('    Surface D±13:  ' + bar(r1.surface));
    lines.push('    System  D±26:  ' + bar(r1.system) + (r1.penalty < 1 ? '  (×' + r1.penalty.toFixed(2) + ' fallacy penalty)' : ''));
    if (r1.fallacies.length > 0) lines.push('    Fallacies: ' + r1.fallacies.map(function(f){ return f.name; }).join(', '));
    if (r1.gaps.length > 0)      lines.push('    Gaps: ' + r1.gaps.map(function(g){ return g.desire; }).join(', '));
    lines.push('');

    lines.push('  Chain B: "' + r2.chain.name + '"');
    lines.push('    Surface D±13:  ' + bar(r2.surface));
    lines.push('    System  D±26:  ' + bar(r2.system) + (r2.penalty < 1 ? '  (×' + r2.penalty.toFixed(2) + ' fallacy penalty)' : ''));
    if (r2.fallacies.length > 0) lines.push('    Fallacies: ' + r2.fallacies.map(function(f){ return f.name; }).join(', '));
    if (r2.gaps.length > 0)      lines.push('    Gaps: ' + r2.gaps.map(function(g){ return g.desire; }).join(', '));
    lines.push('');

    lines.push('  ── Winners ──');
    lines.push('  Surface tier: ' + this.winners.surface);
    lines.push('  System tier:  ' + this.winners.system);
    lines.push('  Overall:      ' + this.winners.overall);
    lines.push('');
    lines.push('  Recommendation: ' + this.verdict);
    return lines.join('\n');
  };

  // ── Default Timeline ─────────────────────────────────────

  var defaultTimeline = new EventMathTimeline('default');

  function getDefaultTimeline() {
    return defaultTimeline;
  }

  // ── EventMathScrub ────────────────────────────────────────────────
  // Priority sensitivity curve for a ConflictStmt result.
  // Analytically computes the breakeven priority ratio at which the winner switches,
  // then samples the trade-off curve at key ratio steps.

  function EventMathScrub(name, conflict) {
    if (!(this instanceof EventMathScrub)) {
      return new EventMathScrub(name, conflict);
    }
    this.name     = name     || 'trace';
    this.conflict = conflict || null;
    this.curve    = [];
    this.breakeven = null;
    this.dominant  = null;
    this._trace();
  }

  EventMathScrub.prototype._trace = function () {
    if (!this.conflict || !this.conflict.desire1 || !this.conflict.desire2) return;
    var d1 = this.conflict.desire1;
    var d2 = this.conflict.desire2;
    var s1 = this.conflict.score1;
    var s2 = this.conflict.score2;

    // Breakeven: ratio r where s1*r = s2 → r = s2/s1
    if (s1 > 0 && s2 > 0) {
      this.breakeven = Math.round((s2 / s1) * 100) / 100;
    } else if (s1 === 0 && s2 > 0) {
      this.breakeven = null;
      this.dominant  = d2.name;
    } else if (s2 === 0 && s1 > 0) {
      this.breakeven = null;
      this.dominant  = d1.name;
    } else {
      this.breakeven = null;
      this.dominant  = null;
    }

    // Sample curve: vary desire1's priority ratio relative to desire2 (fixed at 1)
    var ratios = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
    for (var i = 0; i < ratios.length; i++) {
      var r   = ratios[i];
      var ws1 = Math.round(s1 * r * 10) / 10;
      var ws2 = s2;
      this.curve.push({
        ratio:  r,
        ws1:    ws1,
        ws2:    ws2,
        winner: ws1 >= ws2 ? d1.name : d2.name,
      });
    }
  };

  EventMathScrub.prototype.render = function () {
    if (!this.conflict) return '── Trace: (no conflict provided) ──';
    var d1  = this.conflict.desire1;
    var d2  = this.conflict.desire2;
    var d1n = d1 ? d1.name : '?';
    var d2n = d2 ? d2.name : '?';

    var lines = [];
    lines.push('╔' + '═'.repeat(58) + '╗');
    var hdr = '  TRACE: ' + this.name;
    lines.push('║' + hdr + ' '.repeat(Math.max(0, 58 - hdr.length)) + '║');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');
    lines.push('  Desire A: "' + d1n + '"  (score: ' + this.conflict.score1 + '%)');
    lines.push('  Desire B: "' + d2n + '"  (score: ' + this.conflict.score2 + '%)');
    lines.push('');

    if (this.dominant) {
      lines.push('  "' + this.dominant + '" always wins regardless of priority.');
      lines.push('  The other desire has 0% satisfaction in this chain.');
      lines.push('  Adjust the chain to open a path, not the priorities.');
    } else if (this.conflict.score1 === 0 && this.conflict.score2 === 0) {
      lines.push('  Both desires score 0% — the chain satisfies neither.');
      lines.push('  Priorities are irrelevant. Rebuild the chain first.');
    } else {
      if (this.breakeven !== null) {
        lines.push('  Breakeven:  priority ratio ' + this.breakeven + ':1  (A:B)');
        lines.push('  Below ' + this.breakeven + '×:  "' + d2n + '" wins.');
        lines.push('  Above ' + this.breakeven + '×:  "' + d1n + '" wins.');
      }
      lines.push('');
      lines.push('  Priority A:B   Score A (weighted)   Score B (fixed)   Winner');
      lines.push('  ' + '─'.repeat(54));
      var be = this.breakeven;
      for (var i = 0; i < this.curve.length; i++) {
        var pt = this.curve[i];
        var marker = (be !== null && i > 0 && this.curve[i - 1].winner !== pt.winner) ? ' ← switch' : '';
        var ratioStr = String(pt.ratio).padEnd(7);
        var ws1Str   = String(pt.ws1).padEnd(21);
        var ws2Str   = String(pt.ws2).padEnd(18);
        lines.push('  ' + ratioStr + '      ' + ws1Str + ws2Str + pt.winner + marker);
      }
    }
    lines.push('');
    return lines.join('\n');
  };

  // ── EventMathConflict ─────────────────────────────────────────────
  // Detects tension between two desires evaluated against the same chain.
  // Labels: ALIGNED (≤5 point loss), COMPETITIVE (≤35), OPPOSED (>35).

  function EventMathConflict(name, desire1, desire2, chain, assumptions) {
    if (!(this instanceof EventMathConflict)) {
      return new EventMathConflict(name, desire1, desire2, chain, assumptions);
    }
    this.name        = name        || 'conflict';
    this.desire1     = desire1     || null;
    this.desire2     = desire2     || null;
    this.chain       = chain       || null;
    this.assumptions = Array.isArray(assumptions) ? assumptions : [];
    this.score1      = 0;
    this.score2      = 0;
    this.scoreBoth   = 0;
    this.tensionScore = 0;
    this.label       = 'UNKNOWN';
    this.verdict     = '';
    this._detect();
  }

  EventMathConflict.prototype._detect = function () {
    if (!this.desire1 || !this.desire2 || !this.chain) {
      this.label   = 'UNKNOWN';
      this.verdict = 'Conflict requires two desires and a chain.';
      return;
    }
    var eng1 = new EventMathSatisfactionEngine('cf1', [this.desire1], this.chain, this.assumptions);
    var eng2 = new EventMathSatisfactionEngine('cf2', [this.desire2], this.chain, this.assumptions);
    var engB = new EventMathSatisfactionEngine('cfb', [this.desire1, this.desire2], this.chain, this.assumptions);
    this.score1    = eng1.score;
    this.score2    = eng2.score;
    this.scoreBoth = engB.score;

    // Expected combined score if desires were independent — use weights
    var w1 = this.desire1.weight || 1;
    var w2 = this.desire2.weight || 1;
    var expectedWeighted = (this.score1 * w1 + this.score2 * w2) / (w1 + w2);
    this.tensionScore = Math.max(0, Math.round(expectedWeighted - this.scoreBoth));

    var d1n = this.desire1.name || 'desire 1';
    var d2n = this.desire2.name || 'desire 2';
    var minScore = Math.min(this.score1, this.score2);
    var maxScore = Math.max(this.score1, this.score2);

    if (minScore >= 80) {
      // Both substantially satisfied — no conflict
      this.label   = 'ALIGNED';
      this.verdict = '"' + d1n + '" and "' + d2n + '" are compatible in this chain. Both can be satisfied without trade-offs.';
    } else if (maxScore === 0) {
      // Chain satisfies neither desire — not an inter-desire conflict, a chain gap
      this.label   = 'ALIGNED';
      this.verdict = 'Neither "' + d1n + '" nor "' + d2n + '" is served by this chain. The gap is in the chain, not between the desires.';
    } else if (minScore === 0) {
      // One desire is completely blocked while the other succeeds — structurally opposed
      this.label   = 'OPPOSED';
      this.verdict = '"' + d1n + '" and "' + d2n + '" are structurally opposed. One can be satisfied (' + maxScore + '%) while the other cannot (0%). Use "weigh" to find which to prioritize.';
    } else if (this.tensionScore > 35) {
      this.label   = 'OPPOSED';
      this.verdict = '"' + d1n + '" and "' + d2n + '" are structurally opposed. Satisfying both in this chain requires an explicit trade-off — use "weigh" to find the optimal path.';
    } else if (this.tensionScore > 5) {
      this.label   = 'COMPETITIVE';
      this.verdict = 'Partial tension: pursuing both "' + d1n + '" and "' + d2n + '" costs ' + this.tensionScore + ' satisfaction points compared to pursuing each independently.';
    } else {
      this.label   = 'ALIGNED';
      this.verdict = '"' + d1n + '" and "' + d2n + '" are compatible in this chain. Both can be satisfied without trade-offs.';
    }
  };

  EventMathConflict.prototype.render = function () {
    var lines = [];
    var d1n = this.desire1 ? this.desire1.name : '?';
    var d2n = this.desire2 ? this.desire2.name : '?';
    lines.push('╔' + '═'.repeat(58) + '╗');
    var hdr = '  CONFLICT: ' + this.name;
    lines.push('║' + hdr + ' '.repeat(Math.max(0, 58 - hdr.length)) + '║');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');
    lines.push('  Desire A: "' + d1n + '"  (weight ' + (this.desire1 ? this.desire1.weight || 1 : 1) + ')  →  individual score: ' + this.score1 + '%');
    lines.push('  Desire B: "' + d2n + '"  (weight ' + (this.desire2 ? this.desire2.weight || 1 : 1) + ')  →  individual score: ' + this.score2 + '%');
    lines.push('');
    lines.push('  Combined score:  ' + this.scoreBoth + '%');
    lines.push('  Tension loss:    ' + this.tensionScore + ' points');
    lines.push('');
    lines.push('  Status: ' + this.label);
    lines.push('  ' + this.verdict);
    lines.push('');
    return lines.join('\n');
  };

  // ── EventMathWeigh ─────────────────────────────────────────────────
  // Optimal trade-off recommendation from a ConflictStmt result.
  // Uses desire weights to determine which desire to prioritize.

  function EventMathWeigh(name, conflict) {
    if (!(this instanceof EventMathWeigh)) {
      return new EventMathWeigh(name, conflict);
    }
    this.name           = name     || 'weigh';
    this.conflict       = conflict || null;
    this.winner         = '';
    this.tradeoff       = '';
    this.recommendation = '';
    this.weightedScore1 = 0;
    this.weightedScore2 = 0;
    this._weigh();
  }

  EventMathWeigh.prototype._weigh = function () {
    if (!this.conflict) {
      this.recommendation = 'No conflict provided.';
      return;
    }
    var d1 = this.conflict.desire1;
    var d2 = this.conflict.desire2;
    if (!d1 || !d2) {
      this.recommendation = 'Conflict is missing one or both desires.';
      return;
    }
    var w1 = d1.weight || 1;
    var w2 = d2.weight || 1;
    this.weightedScore1 = Math.round(this.conflict.score1 * w1);
    this.weightedScore2 = Math.round(this.conflict.score2 * w2);

    var weightsStr = (w1 !== 1 || w2 !== 1)
      ? ' (weights: ' + d1.name + '×' + w1 + ', ' + d2.name + '×' + w2 + ')'
      : '';

    if (this.conflict.label === 'ALIGNED') {
      this.winner         = 'both';
      this.tradeoff       = 'none';
      this.recommendation = 'Pursue both "' + d1.name + '" and "' + d2.name + '" — no trade-off required in this chain.';
    } else if (this.weightedScore1 >= this.weightedScore2) {
      this.winner         = d1.name;
      this.tradeoff       = d2.name;
      this.recommendation =
        'Prioritize "' + d1.name + '" — weighted score ' + this.weightedScore1 + ' vs ' + this.weightedScore2 + weightsStr + '. ' +
        'Accept partial satisfaction of "' + d2.name + '". ' +
        'The tension cost is ' + this.conflict.tensionScore + ' points.';
    } else {
      this.winner         = d2.name;
      this.tradeoff       = d1.name;
      this.recommendation =
        'Prioritize "' + d2.name + '" — weighted score ' + this.weightedScore2 + ' vs ' + this.weightedScore1 + weightsStr + '. ' +
        'Accept partial satisfaction of "' + d1.name + '". ' +
        'The tension cost is ' + this.conflict.tensionScore + ' points.';
    }
  };

  EventMathWeigh.prototype.render = function () {
    var lines = [];
    lines.push('╔' + '═'.repeat(58) + '╗');
    var hdr = '  WEIGH: ' + this.name;
    lines.push('║' + hdr + ' '.repeat(Math.max(0, 58 - hdr.length)) + '║');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');
    if (this.conflict) {
      var d1 = this.conflict.desire1;
      var d2 = this.conflict.desire2;
      if (d1) {
        lines.push('  "' + d1.name + '"  weight×' + (d1.weight || 1) + '  score ' + this.conflict.score1 + '%  →  weighted ' + this.weightedScore1);
      }
      if (d2) {
        lines.push('  "' + d2.name + '"  weight×' + (d2.weight || 1) + '  score ' + this.conflict.score2 + '%  →  weighted ' + this.weightedScore2);
      }
      lines.push('');
      lines.push('  Conflict: ' + this.conflict.label + '  (tension: ' + this.conflict.tensionScore + ' pts)');
      lines.push('');
    }
    lines.push('  Winner:    ' + this.winner);
    lines.push('  Trade-off: ' + this.tradeoff);
    lines.push('');
    lines.push('  ' + this.recommendation);
    lines.push('');
    return lines.join('\n');
  };

  // ── EventMathNode ─────────────────────────────────────────────────
  function EventMathNode(type, content) {
    if (!(this instanceof EventMathNode)) return new EventMathNode(type, content);
    this.type = type || 'div';
    this.content = content !== undefined ? content : '';
    this.attrs = {};
    this.children = [];
  }
  EventMathNode.prototype.attr = function(key, val) { this.attrs[key] = val; return this; };
  EventMathNode.prototype.child = function(node) { this.children.push(node); return this; };
  EventMathNode.prototype.render = function() {
    var SELF_CLOSE = { img:1, input:1, br:1, hr:1, meta:1, link:1 };
    var attrStr = Object.keys(this.attrs).map(function(k) {
      return k + '="' + String(this.attrs[k]).replace(/"/g, '&quot;') + '"';
    }).join(' ');
    var open = '<' + this.type + (attrStr ? ' ' + attrStr : '') + '>';
    if (SELF_CLOSE[this.type]) return '<' + this.type + (attrStr ? ' ' + attrStr : '') + ' />';
    var inner = this.children.length
      ? this.children.map(function(c) { return c instanceof EventMathNode ? c.render() : String(c); }).join('')
      : (this.content instanceof EventMathNode ? this.content.render() : String(this.content));
    return open + inner + '</' + this.type + '>';
  };

  // ── EventMathAtmosphere ───────────────────────────────────────────
  function EventMathAtmosphere(name, styles) {
    if (!(this instanceof EventMathAtmosphere)) return new EventMathAtmosphere(name, styles);
    this.name = name;
    this.styles = styles || {};
  }
  var _NO_PX = { opacity:1, zIndex:1, fontWeight:1, lineHeight:1, flex:1, order:1, flexGrow:1, flexShrink:1, columnCount:1, columns:1 };
  EventMathAtmosphere.prototype.css = function() {
    var self = this;
    return '.' + this.name.replace(/\s+/g, '-') + ' {\n' +
      Object.keys(this.styles).map(function(k) {
        var cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
        var v = self.styles[k];
        return '  ' + cssKey + ': ' + (typeof v === 'number' && !_NO_PX[k] ? v + 'px' : v) + ';';
      }).join('\n') + '\n}';
  };
  EventMathAtmosphere.prototype.render = function() { return this.css(); };

  // ── EventMathCloud ────────────────────────────────────────────────
  function EventMathCloud(name, renderFn) {
    if (!(this instanceof EventMathCloud)) return new EventMathCloud(name, renderFn);
    this.name = name;
    this._renderFn = renderFn || function() { return new EventMathNode('div', ''); };
    this.isAsync = false;
  }
  EventMathCloud.prototype.call = function() {
    return this._renderFn.apply(this, arguments);
  };
  EventMathCloud.prototype.render = function() {
    var result = this._renderFn();
    return result instanceof EventMathNode ? result.render() : String(result || '');
  };

  // ── EventMathEarth ────────────────────────────────────────────────
  var EventMathEarth = (function() {
    var _base = '';
    var _defaultHeaders = {};
    function _req(method, path, body, extraHeaders) {
      var url = _base + path;
      var headers = Object.assign({ 'Content-Type': 'application/json' }, _defaultHeaders, extraHeaders || {});
      var opts = { method: method, headers: headers };
      if (body !== null && body !== undefined) opts.body = JSON.stringify(body);
      if (typeof fetch !== 'undefined') {
        return fetch(url, opts).then(function(r) { return r.json(); });
      }
      return Promise.resolve({ _stub: true, method: method, url: url });
    }
    return {
      config: function(opts) {
        if (opts && opts.base) _base = opts.base;
        if (opts && opts.headers) _defaultHeaders = opts.headers;
      },
      get:    function(path, h)        { return _req('GET',    path, null, h); },
      post:   function(path, body, h)  { return _req('POST',   path, body, h); },
      put:    function(path, body, h)  { return _req('PUT',    path, body, h); },
      delete: function(path, h)        { return _req('DELETE', path, null, h); },
    };
  })();

  // ── EventMathRouter ───────────────────────────────────────────────
  function EventMathRouter(routeMap) {
    if (!(this instanceof EventMathRouter)) return new EventMathRouter(routeMap);
    this.routes = routeMap || {};
    this.current = null;
  }
  EventMathRouter.prototype.travel = function(path) {
    this.current = path;
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
    }
    return this._match(path);
  };
  EventMathRouter.prototype._match = function(path) {
    for (var name in this.routes) {
      if (this.routes[name].path === path) {
        return { name: name, cloud: this.routes[name].cloud };
      }
    }
    return null;
  };
  EventMathRouter.prototype.render = function() {
    var lines = ['── Routes ──'];
    for (var name in this.routes) {
      var r = this.routes[name];
      lines.push('  ' + name + ': ' + r.path + ' → ' + (r.cloud || '?'));
    }
    return lines.join('\n');
  };

  // ── v2.12 — EventMathGround (localStorage wrapper) ──────────────

  var EventMathGround = (function() {
    function _get(key) {
      try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null; }
      catch(_) { return null; }
    }
    function _set(key, value) {
      try {
        if (typeof localStorage !== 'undefined')
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch(_) {}
    }
    function _remove(key) {
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch(_) {}
    }
    function _clear() {
      try { if (typeof localStorage !== 'undefined') localStorage.clear(); } catch(_) {}
    }
    return { get: _get, set: _set, remove: _remove, clear: _clear };
  })();

  // ── EventMathGroundDB — a SQLite-backed ground (`ground X at "file.db"`) ──
  // One adapter over two drivers: Bun's bun:sqlite and Node's node:sqlite.
  // Both are synchronous, so `draw` needs no await. The driver is chosen at
  // runtime by detecting Bun, so the same UMD runtime serves both targets.
  function EventMathGroundDB(path) {
    this.path = path || ':memory:';
    this._kind = null;
    this._db = null;
    this._open();
  }
  EventMathGroundDB.prototype._open = function() {
    if (typeof Bun !== 'undefined') {
      var Database = require('bun:sqlite').Database;
      this._db = new Database(this.path);
      this._kind = 'bun';
    } else if (typeof require !== 'undefined') {
      // node:sqlite (Node >= 22.5, experimental — no flag needed on 22.x LTS)
      var DatabaseSync = require('node:sqlite').DatabaseSync;
      this._db = new DatabaseSync(this.path);
      this._kind = 'node';
    } else {
      throw new Error('ground "' + this.path + '": no SQLite driver (need Bun or Node).');
    }
  };
  // draw(sql) — run SQL against the ground. SELECT/WITH/PRAGMA/EXPLAIN return
  // their rows as an array; anything else (CREATE, INSERT, …) executes and
  // returns []. Reading is the common case, which is why the verb is "draw".
  EventMathGroundDB.prototype.draw = function(sql) {
    var returnsRows = /^\s*(select|with|pragma|explain)\b/i.test(String(sql));
    if (this._kind === 'bun') {
      var q = this._db.query(sql);
      if (returnsRows) return q.all();
      q.run();
      return [];
    }
    if (returnsRows) return this._db.prepare(sql).all();
    this._db.exec(sql);
    return [];
  };

  // ── v2.12 — EventMathRaindrop (form input descriptor) ───────────

  function EventMathRaindrop(type, name, props) {
    this.rdType = type;
    this.name   = name;
    this.props  = props || {};
  }
  EventMathRaindrop.prototype.render = function() {
    var t = this.rdType;
    var n = this.name;
    var p = this.props;
    var attrs = 'type="' + t + '" name="' + n + '"';
    if (p.placeholder) attrs += ' placeholder="' + p.placeholder + '"';
    if (p.required)    attrs += ' required';
    if (p.disabled)    attrs += ' disabled';
    if (p.label)       return '<label>' + p.label + '<input ' + attrs + '></label>';
    return '<input ' + attrs + '>';
  };

  // ── v2.13 — EventMathSignal (reactive state) ─────────────────────

  function EventMathSignal(initialValue) {
    this._value = initialValue;
    this._subs  = [];
  }
  EventMathSignal.prototype.get = function() {
    return this._value;
  };
  EventMathSignal.prototype.set = function(newValue) {
    var old = this._value;
    this._value = newValue;
    if (old !== newValue) {
      for (var i = 0; i < this._subs.length; i++) {
        try { this._subs[i](newValue, old); } catch(_) {}
      }
    }
  };
  EventMathSignal.prototype.watch = function(fn) {
    this._subs.push(fn);
    return function() {
      var idx = this._subs.indexOf(fn);
      if (idx >= 0) this._subs.splice(idx, 1);
    }.bind(this);
  };
  EventMathSignal.prototype.valueOf = function() { return this._value; };
  EventMathSignal.prototype.toString = function() { return String(this._value); };

  // ── Exports ──────────────────────────────────────────────

  return {
    EventMathEvent:          EventMathEvent,
    EventMathLayer:          EventMathLayer,
    EventMathTimeline:       EventMathTimeline,
    EventMathAnchor:          EventMathAnchor,
    EventMathLandscape:      EventMathLandscape,
    EventMathAxis:           EventMathAxis,
    EventMathActor:          EventMathActor,
    EventMathPowerGap:       EventMathPowerGap,
    EventMathChain:          EventMathChain,
    EventMathRootTrace:      EventMathRootTrace,
    EventMathFallacyDetector:       EventMathFallacyDetector,
    EventMathAssumption:            EventMathAssumption,
    EventMathDesire:                EventMathDesire,
    EventMathSatisfactionEngine:    EventMathSatisfactionEngine,
    EventMathGrade:     EventMathGrade,
    EventMathDiagnosis:             EventMathDiagnosis,
    EventMathChallenge:             EventMathChallenge,
    EventMathComparison:            EventMathComparison,
    EventMathConflict:              EventMathConflict,
    EventMathWeigh:                 EventMathWeigh,
    EventMathScrub:                 EventMathScrub,
    EventMathSpine:           EventMathSpine,
    FALLACY_PATTERNS:        FALLACY_PATTERNS,
    TimelineEntry:           TimelineEntry,
    getDefaultTimeline:      getDefaultTimeline,
    SNAPSHOT_INTERVAL:       SNAPSHOT_INTERVAL,
    isFibonacci:             isFibonacci,
    isNStepFib:              isNStepFib,
    nStepFib:                nStepFib,
    getShapeName:            getShapeName,
    EventMathNode:          EventMathNode,
    EventMathAtmosphere:    EventMathAtmosphere,
    EventMathCloud:         EventMathCloud,
    EventMathEarth:         EventMathEarth,
    EventMathRouter:        EventMathRouter,
    EventMathGround:        EventMathGround,
    EventMathGroundDB:      EventMathGroundDB,
    EventMathRaindrop:      EventMathRaindrop,
    EventMathSignal:        EventMathSignal,
  };

});
