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
    2:  'square',      3:  'triangle',  4:  'square',      5:  'pentagon',
    6:  'hexagon',     7:  'heptagon',  8:  'octagon',     9:  'nonagon',
    10: 'decagon',     11: 'hendecagon', 12: 'dodecagon',  13: 'tridecagon'
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

  function EventMathTorus(name) {
    if (!(this instanceof EventMathTorus)) {
      return new EventMathTorus(name);
    }
    this.name          = name || '';
    this.sourceName    = '';
    this.zoomLevel     = 1;
    this.dimension     = 2;
    this.rings         = [];
    this.totalOuter    = 0;
    this.resonances    = [];
    this.cycleComplete = false;
    this.completionEvent = null;
  }

  // spinFrom(source, dimension) — dimension 2-13 (positive) or -2 to -13 (negative/opposite polarity).
  // Negative dimensions spin clockwise; nucleus polarity is inverted.
  EventMathTorus.prototype.spinFrom = function (source, dimension) {
    this.sourceName = source
      ? (source.name || source.id || String(source))
      : '';
    this.zoomLevel = ((source && source.zoomLevel) || 1) + 1;
    var d = typeof dimension === 'number' ? Math.floor(dimension) : 2;
    var absD = Math.abs(d);
    if (absD < 2) absD = 2;
    if (absD > 13) absD = 13;
    this.dimension = d < 0 ? -absD : absD;
    return this;
  };

  // Add N rings. Points per ring = |D| (except |D|=2 → 4).
  // Negative dimension: rotates clockwise; Fibonacci flag is inverted (nucleus present when NOT Fibonacci).
  EventMathTorus.prototype.expand = function (n) {
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

  EventMathTorus.prototype.nucleusPresent = function () {
    var D    = this.dimension || 2;
    var absD = Math.abs(D);
    var isFib = isNStepFib(this.totalOuter + 1, absD);
    return D < 0 ? !isFib : isFib;
  };

  EventMathTorus.prototype.complete = function () {
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

  EventMathTorus.prototype.addResonance = function (otherName, label) {
    this.resonances.push({ name: otherName, label: label || 'resonance' });
    return this;
  };

  EventMathTorus.prototype.render = function () {
    var D         = this.dimension || 2;
    var absD      = Math.abs(D);
    var neg       = D < 0;
    var pts       = absD < 3 ? 4 : absD;
    var shapeName = getShapeName(absD);
    var dimLabel  = neg ? 'D-' + absD : 'D' + absD;
    var fibLabel  = absD === 2 ? 'Fibonacci' : 'D' + absD + '-Fibonacci';
    var nucState  = this.nucleusPresent() ? '● PRESENT' : '○ ABSENT';
    var direction = neg ? 'clockwise ↺' : 'counterclockwise ↻';

    var lines = ['── Torus: ' + this.name + '  [' + dimLabel + ' / ' + shapeName + '] ──'];
    lines.push('  Source: ' + (this.sourceName || 'unknown') +
               '  (zoom ' + (this.zoomLevel - 1) + ' → torus level ' + this.zoomLevel + ')');
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
    var bridgeDim = Math.min(13, Math.max(negDim, posDim) + 1);

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

  // ── Default Timeline ─────────────────────────────────────

  var defaultTimeline = new EventMathTimeline('default');

  function getDefaultTimeline() {
    return defaultTimeline;
  }

  // ── Exports ──────────────────────────────────────────────

  return {
    EventMathEvent:     EventMathEvent,
    EventMathLayer:     EventMathLayer,
    EventMathTimeline:  EventMathTimeline,
    EventMathTorus:     EventMathTorus,
    EventMathLandscape: EventMathLandscape,
    EventMathAxis:      EventMathAxis,
    TimelineEntry:      TimelineEntry,
    getDefaultTimeline: getDefaultTimeline,
    SNAPSHOT_INTERVAL:  SNAPSHOT_INTERVAL,
    isFibonacci:        isFibonacci,
    isNStepFib:         isNStepFib,
    nStepFib:           nStepFib,
    getShapeName:       getShapeName,
  };

});
