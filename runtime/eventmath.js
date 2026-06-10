/**
 * EventMath Runtime — <10KB minified
 * 
 * Event/layer/timeline structures, timeline log with pointer,
 * render functions for `run`, structural sharing for efficiency.
 */

class EventMathEvent {
  constructor(id, category, matter) {
    this.id = id;
    this.cat = category;
    this.matter = matter || {};
  }
}

class EventMathLayer {
  constructor(name, events = []) {
    this.name = name;
    this.events = events; // Array of event references
  }
}

class EventMathTimeline {
  constructor(name) {
    this.name = name;
    this.log = [];        // Append-only event log
    this.pointer = 0;     // Current position
    this.snapshots = new Map(); // Periodic snapshots for fast rewind
    this.future = [];     // Planned events
  }
}

// Structural sharing: events are immutable, layers share references
// Timeline operations: rewind, forward, merge

module.exports = { EventMathEvent, EventMathLayer, EventMathTimeline };