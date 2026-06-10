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
    var lines = ['── Timeline: ' + this.name + ' ──'];
    lines.push('  Pointer: ' + this.pointer + ' / ' + this.log.length);
    lines.push('  Events: ' + (st.events ? Object.keys(st.events).length : 0));
    lines.push('  Marks: ' + (st.marks ? Object.keys(st.marks).length : 0));

    if (st.events) {
      for (var id in st.events) {
        if (st.events.hasOwnProperty(id)) {
          var evt = st.events[id];
          lines.push('  Event: ' + (evt.id || id) + ' [' + evt.cat + ']');
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

  // ── Auto-tracking ───────────────────────────────────────

  /**
   * Global default timeline for auto-tracked events.
   */
  var defaultTimeline = new EventMathTimeline('default');

  function getDefaultTimeline() {
    return defaultTimeline;
  }

  // ── Exports ──────────────────────────────────────────────

  return {
    EventMathEvent: EventMathEvent,
    EventMathLayer: EventMathLayer,
    EventMathTimeline: EventMathTimeline,
    TimelineEntry: TimelineEntry,
    getDefaultTimeline: getDefaultTimeline,
    SNAPSHOT_INTERVAL: SNAPSHOT_INTERVAL,
  };

});