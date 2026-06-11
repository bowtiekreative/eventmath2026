/**
 * EventMath Browser Bundle v0.9
 *
 * Self-contained IIFE — no require(), no module.exports.
 * Exposes window.EventMathCompiler and window.EventMathRuntime.
 *
 * Structure:
 *   SECTION 1 — Runtime (EventMathEvent, EventMathLayer, EventMathTimeline)
 *   SECTION 2 — Tokenizer (Token, KEYWORDS, EventMathTokenizer)
 *   SECTION 3 — Parser (EventMathParser)
 *   SECTION 4 — Code Generator (EventMathCodeGen)
 *   SECTION 5 — Compiler API (window.EventMathCompiler)
 */

(function (root) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1 — Runtime
  // ═══════════════════════════════════════════════════════════════

  // ── Event ──────────────────────────────────────────────────────

  function EventMathEvent(id, category, matter) {
    if (!(this instanceof EventMathEvent)) {
      return new EventMathEvent(id, category, matter);
    }
    this.id = id || '';
    this.cat = category || 'event';
    this.matter = matter || {};
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

  // ── Layer ──────────────────────────────────────────────────────

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

  // ── Timeline Entry ─────────────────────────────────────────────

  function TimelineEntry(type, data) {
    this.type = type;
    this.data = data;
    this.timestamp = Date.now();
  }

  // ── Timeline ───────────────────────────────────────────────────

  var SNAPSHOT_INTERVAL = 50;

  function EventMathTimeline(name) {
    if (!(this instanceof EventMathTimeline)) {
      return new EventMathTimeline(name);
    }
    this.name = name || '';
    this.log = [];
    this.pointer = 0;
    this.future = [];
    this.snapshots = {};
    this._state = {};
  }

  EventMathTimeline.prototype.append = function (entry) {
    this.log.push(entry);
    this.pointer = this.log.length;
    this._applyEntry(entry, this._state);
    if (this.log.length % SNAPSHOT_INTERVAL === 0) {
      this.snapshots[this.log.length] = JSON.parse(JSON.stringify(this._state));
    }
    return this;
  };

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
        if (layer) layer.push(entry.data.event);
        break;
      case 'remove':
        if (state.layers && entry.data.layer) {
          state.layers[entry.data.layer] = (state.layers[entry.data.layer] || []).filter(
            function (e) { return e.id !== entry.data.eventId; }
          );
        }
        break;
    }
  };

  EventMathTimeline.prototype._rebuild = function () {
    var state = {};
    var nearest = 0;
    for (var snap in this.snapshots) {
      if (this.snapshots.hasOwnProperty(snap)) {
        var idx = parseInt(snap, 10);
        if (idx <= this.pointer && idx > nearest) nearest = idx;
      }
    }
    if (nearest > 0) {
      state = JSON.parse(JSON.stringify(this.snapshots[nearest]));
    }
    for (var i = nearest; i < this.pointer; i++) {
      if (this.log[i]) this._applyEntry(this.log[i], state);
    }
    this._state = state;
    return state;
  };

  EventMathTimeline.prototype.state = function () {
    return this._rebuild();
  };

  EventMathTimeline.prototype.rewind = function (n) {
    n = n || 1;
    this.pointer = Math.max(0, this.pointer - n);
    return this;
  };

  EventMathTimeline.prototype.rewindTo = function (eventId) {
    for (var i = this.log.length - 1; i >= 0; i--) {
      var entry = this.log[i];
      if (entry.type === 'event' && entry.data && entry.data.id === eventId) {
        this.pointer = i + 1;
        return this;
      }
    }
    this.pointer = 0;
    return this;
  };

  EventMathTimeline.prototype.forward = function (n) {
    n = n || 1;
    this.pointer = Math.min(this.log.length, this.pointer + n);
    return this;
  };

  EventMathTimeline.prototype.forwardTo = function (eventId) {
    for (var i = 0; i < this.log.length; i++) {
      var entry = this.log[i];
      if (entry.type === 'event' && entry.data && entry.data.id === eventId) {
        this.pointer = i + 1;
        return this;
      }
    }
    this.pointer = this.log.length;
    return this;
  };

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

  EventMathTimeline.prototype.renderSection = function (section) {
    if (section === 'past') {
      return this.renderRange(0, this.pointer);
    } else if (section === 'present') {
      return this.render() + '\n\n  (present state)';
    } else if (section === 'future') {
      if (this.future.length === 0) return '  (no planned events)';
      return '── Future ──\n' + this.future.map(function (e) {
        return '  [planned] ' + (e.id || JSON.stringify(e));
      }).join('\n');
    }
    return this.render();
  };

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

  var defaultTimeline = new EventMathTimeline('default');

  function getDefaultTimeline() {
    return defaultTimeline;
  }

  // Expose runtime as a global namespace (EM) for compiled code
  var EM = {
    EventMathEvent: EventMathEvent,
    EventMathLayer: EventMathLayer,
    EventMathTimeline: EventMathTimeline,
    TimelineEntry: TimelineEntry,
    getDefaultTimeline: getDefaultTimeline,
    SNAPSHOT_INTERVAL: SNAPSHOT_INTERVAL,
  };

  // Also expose top-level for compiled output that references them directly
  root.EventMathRuntime = EM;
  root.EventMathEvent = EventMathEvent;
  root.EventMathLayer = EventMathLayer;
  root.EventMathTimeline = EventMathTimeline;
  root.TimelineEntry = TimelineEntry;

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2 — Tokenizer
  // ═══════════════════════════════════════════════════════════════

  var KEYWORDS = new Set([
    'event', 'matter', 'category', 'cat', 'layer', 'timeline', 'action',
    'door', 'open', 'closed', 'mark', 'set', 'run', 'when', 'otherwise',
    'split', 'path', 'again', 'walk', 'end', 'is', 'from', 'as', 'to',
    'by', 'with', 'into', 'times', 'past', 'present', 'future', 'stop',
    'merge', 'break', 'add', 'remove', 'before', 'after', 'rewind', 'forward',
    'and', 'not', 'until', 'overlap', 'note', 'broken', 'check', 'use',
    'sort', 'filter', 'find', 'count', 'where', 'descending',
    'predict', 'across', 'resolve', 'zoom', 'show',
  ]);

  function Token(type, value, line) {
    this.type = type;
    this.value = value;
    this.line = line;
  }

  function EventMathTokenizer() {}

  EventMathTokenizer.prototype.tokenize = function (source) {
    var tokens = [];
    var lines = source.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = this._stripComment(lines[i]).trim();
      if (!line) continue;
      var lineTokens = this._tokenizeLine(line, i + 1);
      tokens.push.apply(tokens, lineTokens);
    }
    return tokens;
  };

  EventMathTokenizer.prototype._stripComment = function (raw) {
    for (var i = 0; i < raw.length; i++) {
      if (raw[i] === '#' && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) {
        return raw.substring(0, i);
      }
    }
    return raw;
  };

  EventMathTokenizer.prototype._tokenizeLine = function (line, lineNum) {
    var self = this;
    var parts = line.split(/(\s+)/);
    var words = parts.filter(function (p, idx) { return idx % 2 === 0 && p !== ''; });
    if (words.length === 0) return [];

    var lead = words[0].toLowerCase();

    if (KEYWORDS.has(lead) && ['event', 'action', 'layer', 'timeline', 'path'].includes(lead)) {
      return this._keywordName(lead, words.slice(1), lineNum);
    }

    if (lead === 'category' || lead === 'cat') {
      if (words.length >= 2 && (words[1] === 'is' || words[1] === 'from')) {
        // fall through
      } else {
        return this._keywordName(lead, words.slice(1), lineNum);
      }
    }

    if (lead === 'use') return this._use(words, lineNum);
    if (lead === 'broken') return this._brokenEvent(words, lineNum);
    if (lead === 'check') return this._check(words, lineNum);
    if (lead === 'mark') return this._mark(words, lineNum);
    if (lead === 'set') return this._set(words, lineNum);
    if (lead === 'run') return this._run(words, lineNum);
    if (lead === 'show') return this._show(words, lineNum);
    if (lead === 'when') return this._when(words, lineNum);
    if (lead === 'again') return this._again(words, lineNum);
    if (lead === 'walk') return this._walk(words, lineNum);
    if (lead === 'split') return this._split(words, lineNum);
    if (lead === 'door') return this._door(words, lineNum);
    if (lead === 'rewind' || lead === 'forward') return this._timeTravel(lead, words, lineNum);
    if (lead === 'add') return this._add(words, lineNum);
    if (lead === 'remove') return this._remove(words, lineNum);
    if (lead === 'merge') return this._merge(words, lineNum);

    if (lead === 'stop') return [new Token('KEYWORD', 'stop', lineNum)];
    if (lead === 'otherwise') return [new Token('KEYWORD', 'otherwise', lineNum)];
    if (lead === 'matter') return [new Token('KEYWORD', 'matter', lineNum)];
    if (lead === 'past' || lead === 'present' || lead === 'future') return [new Token('KEYWORD', lead, lineNum)];
    if (lead === 'end') return [new Token('KEYWORD', 'end', lineNum)];
    if (lead === 'overlap') return [new Token('KEYWORD', 'overlap', lineNum)];
    if (lead === 'note') return this._note(words, lineNum);
    if (lead === 'and') return [new Token('KEYWORD', 'and', lineNum)];

    if (this._hasDelimiter(words, 'with')) {
      var withIdx = this._indexOf(words, 'with');
      var isIdx = this._indexOf(words, 'is');
      if (withIdx >= 0 && (isIdx < 0 || withIdx < isIdx)) {
        return this._actionCall(words, lineNum);
      }
    }

    if (this._hasDelimiter(words, 'is')) return this._matterLine(words, lineNum);
    if (this._hasDelimiter(words, 'from')) return this._matterRefLine(words, lineNum);
    if (this._hasDelimiter(words, 'with')) return this._actionCall(words, lineNum);

    return [new Token('NAME', words.join(' '), lineNum)];
  };

  EventMathTokenizer.prototype._hasDelimiter = function (words, delim) {
    return words.includes(delim);
  };

  EventMathTokenizer.prototype._indexOf = function (words, target) {
    for (var i = 0; i < words.length; i++) {
      if (words[i] === target) return i;
    }
    return -1;
  };

  EventMathTokenizer.prototype._keywordName = function (keyword, rest, lineNum) {
    var tokens = [new Token('KEYWORD', keyword, lineNum)];
    if (rest.length > 0) tokens.push(new Token('NAME', rest.join(' '), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._tokenizeValue = function (words, lineNum) {
    if (!words || words.length === 0) return [];

    var joinedIdx = this._findPhrase(words, ['joined', 'with']);
    if (joinedIdx >= 0) {
      var left = words.slice(0, joinedIdx).join(' ');
      var right = words.slice(joinedIdx + 2).join(' ');
      return [
        new Token('NAME', left, lineNum),
        new Token('KEYWORD', 'joined with', lineNum),
        new Token('NAME', right, lineNum),
      ];
    }

    var inIdx = this._indexOf(words, 'in');
    if (inIdx > 0 && words[inIdx + 1] === 'uppercase') {
      var subject = words.slice(0, inIdx).join(' ');
      return [new Token('NAME', subject, lineNum), new Token('KEYWORD', 'in uppercase', lineNum)];
    }
    if (inIdx > 0 && words[inIdx + 1] === 'lowercase') {
      var subject2 = words.slice(0, inIdx).join(' ');
      return [new Token('NAME', subject2, lineNum), new Token('KEYWORD', 'in lowercase', lineNum)];
    }

    if (words[0] === 'length' && words[1] === 'of') {
      var subject3 = words.slice(2).join(' ');
      return [new Token('KEYWORD', 'length of', lineNum), new Token('NAME', subject3, lineNum)];
    }

    var segments = [];
    var operators = [];
    var current = [];

    for (var i = 0; i < words.length; i++) {
      if (words[i] === 'divided' && i + 1 < words.length && words[i + 1] === 'by') {
        segments.push(current); operators.push('divided by'); current = []; i++;
      } else if (['plus', 'minus', 'times'].includes(words[i])) {
        segments.push(current); operators.push(words[i]); current = [];
      } else {
        current.push(words[i]);
      }
    }
    segments.push(current);

    if (operators.length === 0) {
      var raw = segments[0].join(' ');
      if (!raw) return [];
      if (/^\d+(\.\d+)?$/.test(raw)) return [new Token('NUMBER', raw, lineNum)];
      if (raw === 'true' || raw === 'false') return [new Token('BOOL', raw, lineNum)];
      return [new Token('NAME', raw, lineNum)];
    }

    var tokens = [];
    for (var j = 0; j < segments.length; j++) {
      var rawSeg = segments[j].join(' ');
      if (/^\d+(\.\d+)?$/.test(rawSeg)) tokens.push(new Token('NUMBER', rawSeg, lineNum));
      else tokens.push(new Token('NAME', rawSeg, lineNum));
      if (j < operators.length) tokens.push(new Token('KEYWORD', operators[j], lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._mark = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'mark', lineNum)];
    var asIdx = this._indexOf(words, 'as');
    if (asIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, asIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'as', lineNum));
      tokens.push.apply(tokens, this._tokenizeValue(words.slice(asIdx + 1), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._set = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'set', lineNum)];
    var toIdx = this._indexOf(words, 'to');
    if (toIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, toIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'to', lineNum));
      tokens.push.apply(tokens, this._tokenizeValue(words.slice(toIdx + 1), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._run = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'run', lineNum)];
    if (words.length > 1) tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._show = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'show', lineNum)];
    if (words.length > 1) tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._when = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'when', lineNum)];
    tokens.push.apply(tokens, this._tokenizeCondition(words.slice(1), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._again = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'again', lineNum)];
    var rest = words.slice(1);
    if (rest.length >= 2 && (rest[1] === 'times' || rest[1] === 'time')) {
      tokens.push(new Token('NUMBER', rest[0], lineNum));
      tokens.push(new Token('KEYWORD', 'times', lineNum));
    } else if (rest[0] === 'until') {
      tokens.push(new Token('KEYWORD', 'until', lineNum));
      tokens.push.apply(tokens, this._tokenizeCondition(rest.slice(1), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._walk = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'walk', lineNum)];
    var asIdx = this._indexOf(words, 'as');
    if (asIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, asIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'as', lineNum));
      tokens.push(new Token('NAME', words.slice(asIdx + 1).join(' '), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._split = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'split', lineNum)];
    var intoIdx = this._indexOf(words, 'into');
    if (intoIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, intoIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'into', lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._door = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'door', lineNum)];
    if (words.length >= 2 && (words[1] === 'open' || words[1] === 'closed')) {
      tokens.push(new Token('KEYWORD', words[1], lineNum));
      if (words[1] === 'open') {
        for (var i = 2; i < words.length; i++) {
          tokens.push(new Token('NAME', words[i], lineNum));
        }
      } else {
        if (words.length > 2) tokens.push(new Token('NAME', words.slice(2).join(' '), lineNum));
      }
    }
    return tokens;
  };

  EventMathTokenizer.prototype._timeTravel = function (cmd, words, lineNum) {
    var tokens = [new Token('KEYWORD', cmd, lineNum)];
    var byIdx = this._indexOf(words, 'by');
    var toIdx = this._indexOf(words, 'to');
    if (byIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, byIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'by', lineNum));
      tokens.push(new Token('NUMBER', words[byIdx + 1], lineNum));
    } else if (toIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, toIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'to', lineNum));
      tokens.push(new Token('NAME', words.slice(toIdx + 1).join(' '), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._add = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'add', lineNum)];
    for (var i = 1; i < words.length; i++) {
      var w = words[i].toLowerCase();
      if (KEYWORDS.has(w)) tokens.push(new Token('KEYWORD', w, lineNum));
      else tokens.push(new Token('NAME', w, lineNum));
    }
    return this._collapseNames(tokens);
  };

  EventMathTokenizer.prototype._remove = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'remove', lineNum)];
    for (var i = 1; i < words.length; i++) {
      var w = words[i].toLowerCase();
      if (KEYWORDS.has(w)) tokens.push(new Token('KEYWORD', w, lineNum));
      else tokens.push(new Token('NAME', w, lineNum));
    }
    return this._collapseNames(tokens);
  };

  EventMathTokenizer.prototype._merge = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'merge', lineNum)];
    var intoIdx = this._indexOf(words, 'into');
    if (intoIdx > 0) {
      tokens.push(new Token('NAME', words.slice(1, intoIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'into', lineNum));
      tokens.push(new Token('NAME', words.slice(intoIdx + 1).join(' '), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._use = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'use', lineNum)];
    var fromIdx = this._indexOf(words, 'from');
    if (fromIdx > 1) {
      tokens.push(new Token('NAME', words.slice(1, fromIdx).join(' '), lineNum));
      tokens.push(new Token('KEYWORD', 'from', lineNum));
      tokens.push(new Token('LITERAL', words.slice(fromIdx + 1).join(' '), lineNum));
    } else if (fromIdx === 1) {
      tokens.push(new Token('KEYWORD', 'from', lineNum));
      tokens.push(new Token('LITERAL', words.slice(fromIdx + 1).join(' '), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._brokenEvent = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'broken', lineNum)];
    if (words[1] === 'event') {
      tokens.push(new Token('KEYWORD', 'event', lineNum));
      if (words.length > 2) tokens.push(new Token('NAME', words.slice(2).join(' '), lineNum));
    }
    return tokens;
  };

  EventMathTokenizer.prototype._check = function (words, lineNum) {
    var tokens = [new Token('KEYWORD', 'check', lineNum)];
    tokens.push.apply(tokens, this._tokenizeCondition(words.slice(1), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._matterLine = function (words, lineNum) {
    var tokens = [];
    var isIdx = this._indexOf(words, 'is');
    tokens.push(new Token('NAME', words.slice(0, isIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'is', lineNum));
    tokens.push(new Token('LITERAL', words.slice(isIdx + 1).join(' '), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._matterRefLine = function (words, lineNum) {
    var tokens = [];
    var fromIdx = this._indexOf(words, 'from');
    tokens.push(new Token('NAME', words.slice(0, fromIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'from', lineNum));
    tokens.push(new Token('NAME', words.slice(fromIdx + 1).join(' '), lineNum));
    return tokens;
  };

  EventMathTokenizer.prototype._actionCall = function (words, lineNum) {
    var tokens = [];
    var withIdx = this._indexOf(words, 'with');
    tokens.push(new Token('NAME', words.slice(0, withIdx).join(' '), lineNum));
    tokens.push(new Token('KEYWORD', 'with', lineNum));
    var rest = words.slice(withIdx + 1);
    var i = 0;
    while (i < rest.length) {
      var keyWords = [];
      while (i < rest.length && rest[i] !== 'is' && rest[i] !== 'and') {
        keyWords.push(rest[i]); i++;
      }
      if (keyWords.length > 0) tokens.push(new Token('NAME', keyWords.join(' '), lineNum));
      if (i < rest.length && rest[i] === 'is') { tokens.push(new Token('KEYWORD', 'is', lineNum)); i++; }
      var valWords = [];
      while (i < rest.length && rest[i] !== 'and') { valWords.push(rest[i]); i++; }
      if (valWords.length > 0) tokens.push(new Token('LITERAL', valWords.join(' '), lineNum));
      if (i < rest.length && rest[i] === 'and') i++;
    }
    return tokens;
  };

  EventMathTokenizer.prototype._note = function (words, lineNum) {
    return [
      new Token('KEYWORD', 'note', lineNum),
      new Token('LITERAL', words.slice(1).join(' '), lineNum),
    ];
  };

  EventMathTokenizer.prototype._tokenizeCondition = function (words, lineNum) {
    var tokens = [];
    var i = 0;
    while (i < words.length) {
      if (words[i] === 'and' || words[i] === 'or') {
        tokens.push(new Token('KEYWORD', words[i], lineNum));
        i++; continue;
      }
      var isIdx = this._indexOfFrom(words, 'is', i);
      if (isIdx < 0) {
        tokens.push(new Token('NAME', words.slice(i).join(' '), lineNum));
        break;
      }
      var leftStr = words.slice(i, isIdx).join(' ');
      if (leftStr) tokens.push(new Token('NAME', leftStr, lineNum));
      tokens.push(new Token('KEYWORD', 'is', lineNum));
      var rest = words.slice(isIdx + 1);
      var nextConnector = this._findConnector(rest);
      var opWords = nextConnector >= 0 ? rest.slice(0, nextConnector) : rest;

      if (opWords[0] === 'not') {
        tokens.push(new Token('KEYWORD', 'not', lineNum));
        tokens.push(new Token('NAME', opWords.slice(1).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'greater' && opWords[1] === 'than') {
        tokens.push(new Token('KEYWORD', 'greater than', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'less' && opWords[1] === 'than') {
        tokens.push(new Token('KEYWORD', 'less than', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'at' && opWords[1] === 'least') {
        tokens.push(new Token('KEYWORD', 'at least', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'at' && opWords[1] === 'most') {
        tokens.push(new Token('KEYWORD', 'at most', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'starts' && opWords[1] === 'with') {
        tokens.push(new Token('KEYWORD', 'starts with', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords.length >= 2 && opWords[0] === 'ends' && opWords[1] === 'with') {
        tokens.push(new Token('KEYWORD', 'ends with', lineNum));
        tokens.push(new Token('NAME', opWords.slice(2).join(' '), lineNum));
      } else if (opWords[0] === 'contains') {
        tokens.push(new Token('KEYWORD', 'contains', lineNum));
        tokens.push(new Token('NAME', opWords.slice(1).join(' '), lineNum));
      } else {
        tokens.push(new Token('NAME', opWords.join(' '), lineNum));
      }
      i = isIdx + 1 + (nextConnector >= 0 ? nextConnector : opWords.length);
    }
    return tokens;
  };

  EventMathTokenizer.prototype._findConnector = function (words) {
    for (var i = 0; i < words.length; i++) {
      if (words[i] === 'and' || words[i] === 'or') return i;
    }
    return -1;
  };

  EventMathTokenizer.prototype._indexOfFrom = function (words, target, from) {
    for (var i = from; i < words.length; i++) {
      if (words[i] === target) return i;
    }
    return -1;
  };

  EventMathTokenizer.prototype._findPhrase = function (words, phrase) {
    for (var i = 0; i <= words.length - phrase.length; i++) {
      if (phrase.every(function (w, j) { return words[i + j] === w; })) return i;
    }
    return -1;
  };

  EventMathTokenizer.prototype._collapseNames = function (tokens) {
    var result = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'NAME' && result.length > 0 && result[result.length - 1].type === 'NAME') {
        result[result.length - 1].value += ' ' + tokens[i].value;
      } else {
        result.push(tokens[i]);
      }
    }
    return result;
  };

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3 — Parser
  // ═══════════════════════════════════════════════════════════════

  var MAX_ITERATIONS = 10000;

  function astNode(type, props) {
    props = props || {};
    return Object.assign({ type: type }, props);
  }

  function EventMathParser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
    this._iters = 0;
  }

  EventMathParser.prototype._checkIter = function () {
    if (++this._iters > MAX_ITERATIONS) {
      throw new Error('Parser exceeded ' + MAX_ITERATIONS + ' iterations — possible infinite loop.');
    }
  };

  EventMathParser.prototype.peek = function () {
    return this.tokens[this.pos] || null;
  };

  EventMathParser.prototype.advance = function () {
    this._checkIter();
    var t = this.tokens[this.pos];
    if (t) this.pos++;
    return t;
  };

  EventMathParser.prototype.expect = function (type, value) {
    var t = this.peek();
    if (!t) {
      this.errors.push('I was expecting ' + (value || type) + ' but the program ended unexpectedly.');
      return null;
    }
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      this.errors.push('Line ' + t.line + ': I was expecting "' + (value || type) + '" but found "' + t.value + '".');
      return null;
    }
    return this.advance();
  };

  EventMathParser.prototype.match = function (type, value) {
    var t = this.peek();
    if (t && t.type === type && (value === undefined || t.value === value)) return this.advance();
    return null;
  };

  EventMathParser.prototype.isKeyword = function (kw) {
    var t = this.peek();
    return t && t.type === 'KEYWORD' && t.value === kw;
  };

  EventMathParser.prototype.parse = function () {
    this._iters = 0;
    var statements = [];
    while (this.peek()) {
      this._checkIter();
      var stmt = this._parseStatement();
      if (stmt) {
        statements.push(stmt);
      } else {
        var t = this.advance();
        if (t) this.errors.push('Line ' + t.line + ': I don\'t know what to do with "' + t.value + '".');
      }
    }
    return astNode('Program', { statements: statements, errors: this.errors.length > 0 ? this.errors : undefined });
  };

  EventMathParser.prototype._parseStatement = function () {
    var t = this.peek();
    if (!t) return null;
    if (t.type === 'KEYWORD' && t.value === 'end') return null;

    switch (t.value) {
      case 'event':    return this._parseEvent();
      case 'layer':    return this._parseLayer();
      case 'timeline': return this._parseTimeline();
      case 'action':   return this._parseAction();
      case 'mark':     return this._parseMark();
      case 'set':      return this._parseSet();
      case 'run':      return this._parseRun();
      case 'show':     return this._parseShow();
      case 'when':     return this._parseWhen();
      case 'split':    return this._parseSplit();
      case 'again':    return this._parseAgain();
      case 'walk':     return this._parseWalk();
      case 'rewind':   return this._parseRewind();
      case 'forward':  return this._parseForward();
      case 'stop':     return this._parseStop();
      case 'add':      return this._parseAdd();
      case 'remove':   return this._parseRemove();
      case 'merge':    return this._parseMerge();
      case 'overlap':  return this._parseOverlap();
      case 'note':     return this._parseNote();
      case 'broken':   return this._parseBrokenEvent();
      case 'check':    return this._parseCheck();
      case 'use':      return this._parseUse();
      default:         return this._parseBodyName();
    }
  };

  EventMathParser.prototype._parseEvent = function () {
    this.expect('KEYWORD', 'event');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('event');
    var result = astNode('Event', { name: nameToken.value, category: null, matter: null });
    if (this.isKeyword('category') || this.isKeyword('cat')) {
      this.advance();
      var catName = this.expect('NAME');
      if (catName) result.category = catName.value;
    }
    if (this.isKeyword('matter')) {
      this.advance();
      result.matter = this._parseMatterBlock();
    }
    this.expect('KEYWORD', 'end');
    return result;
  };

  EventMathParser.prototype._parseMatterBlock = function () {
    var fields = [];
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      var t = this.peek();
      if (t.type === 'NAME') {
        var key = this.advance().value;
        var delim = this.peek();
        if (delim && delim.type === 'KEYWORD' && delim.value === 'is') {
          this.advance();
          var val = this.expect('LITERAL');
          fields.push({ key: key, kind: 'literal', value: val ? val.value : '' });
        } else if (delim && delim.type === 'KEYWORD' && delim.value === 'from') {
          this.advance();
          var ref = this.expect('NAME');
          fields.push({ key: key, kind: 'reference', value: ref ? ref.value : '' });
        } else {
          this.errors.push('Line ' + t.line + ': After "' + key + '" I expected "is" or "from".');
          this.advance();
        }
      } else if (t.type === 'KEYWORD' && (t.value === 'category' || t.value === 'cat')) {
        this.advance();
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return astNode('MatterBlock', { fields: fields });
  };

  EventMathParser.prototype._parseLayer = function () {
    this.expect('KEYWORD', 'layer');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('layer');
    var events = [];
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      var t = this.peek();
      if (t.type === 'NAME') events.push({ name: this.advance().value });
      else this.advance();
    }
    this.expect('KEYWORD', 'end');
    return astNode('Layer', { name: nameToken.value, events: events });
  };

  EventMathParser.prototype._parseTimeline = function () {
    this.expect('KEYWORD', 'timeline');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('timeline');
    var result = astNode('Timeline', { name: nameToken.value, past: null, present: null, future: null });
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      var t = this.peek();
      if (t.type === 'KEYWORD' && ['past', 'present', 'future'].includes(t.value)) {
        var section = this.advance().value;
        var layers = [];
        var g2 = 0;
        while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
          if (this.isKeyword('past') || this.isKeyword('present') || this.isKeyword('future')) break;
          var lt = this.peek();
          if (lt && lt.type === 'NAME') layers.push({ name: this.advance().value });
          else if (lt && lt.type === 'KEYWORD' && lt.value !== 'end') this.advance();
          else break;
        }
        this.expect('KEYWORD', 'end');
        result[section] = astNode('TimelineSection', { name: section, layers: layers });
      } else if (t.type === 'NAME') {
        if (!result.present) result.present = astNode('TimelineSection', { name: 'present', layers: [] });
        result.present.layers.push({ name: this.advance().value });
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return result;
  };

  EventMathParser.prototype._parseAction = function () {
    this.expect('KEYWORD', 'action');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('action');
    var result = astNode('Action', { name: nameToken.value, doorOpen: null, body: [], doorClosed: null });
    if (this.isKeyword('door')) {
      this.advance();
      if (this.isKeyword('open')) {
        this.advance();
        var inputs = [];
        while (this.peek() && this.peek().type === 'NAME') inputs.push(this.advance().value);
        result.doorOpen = astNode('DoorOpen', { inputs: inputs });
      }
    }
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      if (this.isKeyword('door')) {
        this.advance();
        if (this.isKeyword('closed')) {
          this.advance();
          var returnName = this.match('NAME');
          result.doorClosed = astNode('DoorClosed', { returns: returnName ? returnName.value : null });
          break;
        }
      }
      var stmt = this._parseStatement();
      if (stmt) result.body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return result;
  };

  EventMathParser.prototype._parseExprOrValue = function () {
    var firstTok = this.peek();
    if (!firstTok) return { value: '' };

    var ARITH_OPS = new Set(['plus', 'minus', 'times', 'divided by']);

    if (firstTok.type === 'KEYWORD' && firstTok.value === 'length of') {
      this.advance();
      var subject = this.peek();
      if (subject) this.advance();
      return { stringOp: 'length of', subject: { kind: 'name', value: subject ? subject.value : '' } };
    }

    var self = this;
    var isArith = function () {
      var t = self.peek();
      return t && t.type === 'KEYWORD' && ARITH_OPS.has(t.value);
    };

    var parseOperand = function () {
      var t = self.peek();
      if (!t) return null;
      if (t.type === 'NUMBER') { self.advance(); return { kind: 'number', value: t.value }; }
      if (t.type === 'BOOL')   { self.advance(); return { kind: 'bool',   value: t.value }; }
      if (t.type === 'NAME')   { self.advance(); return { kind: 'name',   value: t.value }; }
      if (t.type === 'LITERAL'){ self.advance(); return { kind: 'literal',value: t.value }; }
      return null;
    };

    var firstOp = parseOperand();
    if (!firstOp) return { value: '' };

    var t = this.peek();
    if (t && t.type === 'KEYWORD') {
      if (t.value === 'joined with') {
        this.advance();
        var right = this.peek();
        if (right) this.advance();
        return { stringOp: 'joined with', left: firstOp, right: { kind: 'name', value: right ? right.value : '' } };
      }
      if (t.value === 'in uppercase') { this.advance(); return { stringOp: 'in uppercase', subject: firstOp }; }
      if (t.value === 'in lowercase') { this.advance(); return { stringOp: 'in lowercase', subject: firstOp }; }
    }

    if (!isArith()) {
      return { value: firstOp.value };
    }

    var node = firstOp;
    while (isArith()) {
      var op = this.advance().value;
      var rightOp = parseOperand();
      if (!rightOp) break;
      node = { kind: 'expr', left: node, op: op, right: rightOp };
    }
    return { expr: node };
  };

  EventMathParser.prototype._parseMark = function () {
    this.expect('KEYWORD', 'mark');
    var nameToken = this.expect('NAME');
    if (!nameToken) return null;
    this.expect('KEYWORD', 'as');
    var parsed = this._parseExprOrValue();
    if (parsed.stringOp !== undefined) {
      return astNode('Mark', { name: nameToken.value, value: null, expr: null, stringOp: parsed.stringOp, left: parsed.left, right: parsed.right, subject: parsed.subject });
    }
    if (parsed.expr !== undefined) {
      return astNode('Mark', { name: nameToken.value, value: null, expr: parsed.expr });
    }
    return astNode('Mark', { name: nameToken.value, value: String(parsed.value !== undefined ? parsed.value : '') });
  };

  EventMathParser.prototype._parseSet = function () {
    this.expect('KEYWORD', 'set');
    var nameToken = this.expect('NAME');
    if (!nameToken) return null;
    this.expect('KEYWORD', 'to');
    var parsed = this._parseExprOrValue();
    if (parsed.stringOp !== undefined) {
      return astNode('Set', { name: nameToken.value, value: null, expr: null, stringOp: parsed.stringOp, left: parsed.left, right: parsed.right, subject: parsed.subject });
    }
    if (parsed.expr !== undefined) {
      return astNode('Set', { name: nameToken.value, value: null, expr: parsed.expr });
    }
    var raw = parsed.value !== undefined ? String(parsed.value) : '';
    return astNode('Set', { name: nameToken.value, value: { kind: 'literal', value: raw } });
  };

  EventMathParser.prototype._parseRun = function () {
    this.expect('KEYWORD', 'run');
    var t = this.peek();
    return astNode('Run', { target: t && t.type === 'NAME' ? this.advance().value : null });
  };

  EventMathParser.prototype._parseShow = function () {
    this.expect('KEYWORD', 'show');
    var t = this.peek();
    return astNode('Show', { target: t && t.type === 'NAME' ? this.advance().value : null });
  };

  EventMathParser.prototype._parseUse = function () {
    this.expect('KEYWORD', 'use');
    var nameWords = [];
    while (this.peek() && !(this.peek().type === 'KEYWORD' && this.peek().value === 'from')) {
      nameWords.push(this.advance().value);
    }
    this.expect('KEYWORD', 'from');
    var fileTok = this.expect('LITERAL');
    return astNode('Use', { name: nameWords.join(' '), from: fileTok ? fileTok.value : '' });
  };

  EventMathParser.prototype._parseBodyName = function () {
    var t = this.peek();
    if (!t || t.type !== 'NAME') return null;
    var name = this.advance().value;
    if (this.isKeyword('with')) {
      this.advance();
      var args = [];
      var guard = 0;
      while (this.peek() && this.peek().type === 'NAME' && !this.isKeyword('end') && !this.isKeyword('otherwise') && !this.isKeyword('path') && guard++ < 1000) {
        var key = this.expect('NAME');
        if (!key) break;
        this.expect('KEYWORD', 'is');
        var val = this.expect('LITERAL');
        args.push({ key: key.value, value: val ? val.value : '' });
        this.match('KEYWORD', 'and');
      }
      return astNode('ActionCall', { name: name, args: args });
    }
    return astNode('NameRef', { name: name });
  };

  EventMathParser.prototype._parseWhen = function () {
    this.expect('KEYWORD', 'when');
    var condition = this._parseCondition();
    var body = [];
    var guard = 0;
    while (this.peek() && !this.isKeyword('otherwise') && !this.isKeyword('end') && guard++ < 1000) {
      var stmt = this._parseStatement();
      if (stmt) body.push(stmt);
    }
    var otherwise = null;
    if (this.isKeyword('otherwise')) {
      this.advance();
      otherwise = [];
      var g2 = 0;
      while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
        var stmt2 = this._parseStatement();
        if (stmt2) otherwise.push(stmt2);
      }
    }
    this.expect('KEYWORD', 'end');
    return astNode('When', { condition: condition, body: body, otherwise: otherwise });
  };

  EventMathParser.prototype._parseCondition = function () {
    var first = this._parseSimpleCondition();
    if (!first) return null;
    if (this.peek() && this.peek().type === 'KEYWORD' && (this.peek().value === 'and' || this.peek().value === 'or')) {
      var op = this.advance().value;
      var right = this._parseCondition();
      return astNode('CompoundCondition', { left: first, op: op, right: right });
    }
    return first;
  };

  EventMathParser.prototype._parseSimpleCondition = function () {
    var left = this.expect('NAME');
    if (!left) return null;
    this.expect('KEYWORD', 'is');
    var peek = this.peek();
    if (peek && peek.type === 'KEYWORD') {
      var kw = peek.value;
      if (kw === 'not') { this.advance(); var r = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is not', right: r ? r.value : '' }); }
      if (kw === 'greater than') { this.advance(); var r2 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is greater than', right: r2 ? r2.value : '' }); }
      if (kw === 'less than') { this.advance(); var r3 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is less than', right: r3 ? r3.value : '' }); }
      if (kw === 'at least') { this.advance(); var r4 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is at least', right: r4 ? r4.value : '' }); }
      if (kw === 'at most') { this.advance(); var r5 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is at most', right: r5 ? r5.value : '' }); }
      if (kw === 'starts with') { this.advance(); var r6 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is starts with', right: r6 ? r6.value : '' }); }
      if (kw === 'ends with') { this.advance(); var r7 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is ends with', right: r7 ? r7.value : '' }); }
      if (kw === 'contains') { this.advance(); var r8 = this.expect('NAME'); return astNode('Condition', { left: left.value, op: 'is contains', right: r8 ? r8.value : '' }); }
    }
    var right = this.expect('NAME');
    return astNode('Condition', { left: left.value, op: 'is', right: right ? right.value : '' });
  };

  EventMathParser.prototype._parseSplit = function () {
    this.expect('KEYWORD', 'split');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('split');
    this.expect('KEYWORD', 'into');
    var paths = [];
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      if (this.isKeyword('path')) {
        this.advance();
        var pathName = this.expect('NAME');
        var body = [];
        var g2 = 0;
        while (this.peek() && !this.isKeyword('end') && g2++ < 1000) {
          if (this.isKeyword('path')) break;
          var s = this._parseStatement();
          if (s) body.push(s);
        }
        this.expect('KEYWORD', 'end');
        paths.push(astNode('Path', { name: pathName ? pathName.value : '', body: body }));
      } else {
        this.advance();
      }
    }
    this.expect('KEYWORD', 'end');
    return astNode('Split', { target: nameToken.value, paths: paths });
  };

  EventMathParser.prototype._parseAgain = function () {
    this.expect('KEYWORD', 'again');
    var t = this.peek();
    if (!t) return this._skipBlock('again');
    var loop;
    if (t.type === 'NUMBER') {
      var count = this.advance().value;
      this.expect('KEYWORD', 'times');
      loop = astNode('AgainCount', { count: parseInt(count), body: [] });
    } else if (t.type === 'KEYWORD' && t.value === 'until') {
      this.advance();
      var condition = this._parseCondition();
      loop = astNode('AgainUntil', { condition: condition, body: [] });
    } else {
      loop = astNode('AgainUntil', { body: [] });
    }
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      var stmt = this._parseStatement();
      if (stmt) loop.body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return loop;
  };

  EventMathParser.prototype._parseWalk = function () {
    this.expect('KEYWORD', 'walk');
    var layerTok = this.expect('NAME');
    if (!layerTok) return this._skipBlock('walk');
    this.expect('KEYWORD', 'as');
    var varTok = this.expect('NAME');
    var result = astNode('Walk', { layer: layerTok.value, variable: varTok ? varTok.value : '', body: [] });
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 1000) {
      var stmt = this._parseStatement();
      if (stmt) result.body.push(stmt);
    }
    this.expect('KEYWORD', 'end');
    return result;
  };

  EventMathParser.prototype._parseRewind = function () {
    this.expect('KEYWORD', 'rewind');
    var target = this.expect('NAME');
    if (!target) return null;
    if (this.isKeyword('by')) { this.advance(); var c = this.expect('NUMBER'); return astNode('Rewind', { target: target.value, mode: 'by', count: c ? parseInt(c.value) : 0 }); }
    if (this.isKeyword('to')) { this.advance(); var d = this.expect('NAME'); return astNode('Rewind', { target: target.value, mode: 'to', destination: d ? d.value : '' }); }
    return astNode('Rewind', { target: target.value, mode: 'by', count: 1 });
  };

  EventMathParser.prototype._parseForward = function () {
    this.expect('KEYWORD', 'forward');
    var target = this.expect('NAME');
    if (!target) return null;
    if (this.isKeyword('by')) { this.advance(); var c = this.expect('NUMBER'); return astNode('Forward', { target: target.value, mode: 'by', count: c ? parseInt(c.value) : 0 }); }
    if (this.isKeyword('to')) { this.advance(); var d = this.expect('NAME'); return astNode('Forward', { target: target.value, mode: 'to', destination: d ? d.value : '' }); }
    return astNode('Forward', { target: target.value, mode: 'by', count: 1 });
  };

  EventMathParser.prototype._parseStop = function () {
    this.expect('KEYWORD', 'stop');
    return astNode('Stop');
  };

  EventMathParser.prototype._parseAdd = function () {
    this.expect('KEYWORD', 'add');
    var kind = this.peek();
    if (!kind) return null;
    if (kind.type === 'KEYWORD' && (kind.value === 'event' || kind.value === 'layer')) {
      this.advance();
      var name = this.expect('NAME');
      var into = this.match('KEYWORD', 'into');
      var target = into ? this.expect('NAME') : null;
      if (kind.value === 'event') return astNode('AddEvent', { eventName: name ? name.value : '', layerName: target ? target.value : null });
      return astNode('AddLayer', { layerName: name ? name.value : '', toTimeline: target ? target.value : null });
    }
    return null;
  };

  EventMathParser.prototype._parseRemove = function () {
    this.expect('KEYWORD', 'remove');
    var kind = this.peek();
    if (!kind) return null;
    if (kind.type === 'KEYWORD' && (kind.value === 'layer' || kind.value === 'event')) {
      this.advance();
      var name = this.expect('NAME');
      return astNode(kind.value === 'layer' ? 'RemoveLayer' : 'RemoveEvent', { name: name ? name.value : '' });
    }
    return null;
  };

  EventMathParser.prototype._parseMerge = function () {
    this.expect('KEYWORD', 'merge');
    var source = this.expect('NAME');
    this.expect('KEYWORD', 'into');
    var target = this.expect('NAME');
    return astNode('Merge', { source: source ? source.value : '', target: target ? target.value : '' });
  };

  EventMathParser.prototype._parseOverlap = function () {
    this.expect('KEYWORD', 'overlap');
    var tracks = [];
    var current = [];
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < MAX_ITERATIONS) {
      if (this.isKeyword('and')) {
        this.advance();
        tracks.push(current);
        current = [];
      } else {
        var stmt = this._parseStatement();
        if (stmt) current.push(stmt);
      }
    }
    tracks.push(current);
    this.expect('KEYWORD', 'end');
    return astNode('Overlap', { tracks: tracks });
  };

  EventMathParser.prototype._parseNote = function () {
    this.expect('KEYWORD', 'note');
    var textTok = this.expect('LITERAL');
    return astNode('Note', { text: textTok ? textTok.value : '' });
  };

  EventMathParser.prototype._parseBrokenEvent = function () {
    this.expect('KEYWORD', 'broken');
    this.expect('KEYWORD', 'event');
    var nameToken = this.expect('NAME');
    if (!nameToken) return this._skipBlock('broken event');
    var result = astNode('BrokenEvent', { name: nameToken.value, matter: null });
    if (this.isKeyword('matter')) {
      this.advance();
      result.matter = this._parseMatterBlock();
    }
    this.expect('KEYWORD', 'end');
    return result;
  };

  EventMathParser.prototype._parseCheck = function () {
    this.expect('KEYWORD', 'check');
    var condition = this._parseCondition();
    return astNode('Check', { condition: condition });
  };

  EventMathParser.prototype._skipBlock = function (ctx) {
    this.errors.push('I was looking for the name of a ' + ctx + ' but couldn\'t find one.');
    var guard = 0;
    while (this.peek() && !this.isKeyword('end') && guard++ < 10000) this.advance();
    if (this.isKeyword('end')) this.advance();
    return null;
  };

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4 — Code Generator
  // ═══════════════════════════════════════════════════════════════

  function EventMathCodeGen() {
    this.output = [];
    this.indent = 0;
    this._vars = new Set();
    this._varDecls = [];
    this._inAction = false;
    this._eventNames = new Set();
    this._layerNames = new Set();
    this._timelineNames = new Set();
    this._actionNames = new Set();
    this._actionDoorInputs = {};
    this._useStmts = [];
    this._importedNames = new Set();
    this._walkVar = null;
    this._hasOverlap = false;
  }

  EventMathCodeGen.prototype._line = function (code) {
    this.output.push('  '.repeat(this.indent) + code);
  };

  EventMathCodeGen.prototype.generate = function (ast) {
    this.output = [];
    this.indent = 0;
    this._vars = new Set();
    this._varDecls = [];
    this._inAction = false;
    this._eventNames = new Set();
    this._layerNames = new Set();
    this._timelineNames = new Set();
    this._actionNames = new Set();
    this._actionDoorInputs = {};
    this._useStmts = [];
    this._importedNames = new Set();
    this._walkVar = null;

    this._line('// Generated by EventMath Compiler v0.4');
    this._line('// Runtime: EventMathRuntime is available globally');
    this._line('');
    this._line("const EM = typeof EventMathRuntime !== 'undefined'");
    this._line("  ? EventMathRuntime");
    this._line("  : require('../runtime/eventmath-runtime.js');");
    this._line('');

    this._firstPass(ast.statements);

    if (this._useStmts.length > 0) {
      for (var u = 0; u < this._useStmts.length; u++) this._genUse(this._useStmts[u]);
      this._line('');
    }

    if (this._varDecls.length > 0) {
      for (var d = 0; d < this._varDecls.length; d++) {
        var decl = this._varDecls[d];
        var safe = this._safeName(decl.name);
        var val = decl.rawExpr !== undefined ? decl.rawExpr : decl.value;
        this._line('let ' + safe + ' = ' + (val !== undefined ? val : 'undefined') + ';');
      }
      this._line('');
    }

    this._hasOverlap = this._detectOverlap(ast.statements);
    if (this._hasOverlap) {
      this._line('(async () => {');
      this.indent++;
    }

    for (var s = 0; s < ast.statements.length; s++) {
      this._genStatement(ast.statements[s]);
    }

    if (this._hasOverlap) {
      this.indent--;
      this._line('})().catch(err => {');
      this._line("  console.error('Broken event:', err.message);");
      this._line('});');
    }

    if (this._eventNames.size > 0 || this._layerNames.size > 0) {
      this._line('');
      this._line('// ── Export for use ─────────────────────────────────');
      this._line('if (typeof module !== "undefined" && module.exports) {');
      this.indent++;
      this._line('module.exports = {');
      this.indent++;
      var self = this;
      this._eventNames.forEach(function (name) { self._line(self._safeName(name) + ','); });
      this._layerNames.forEach(function (name) { self._line(self._safeName(name) + ','); });
      this._timelineNames.forEach(function (name) { self._line(self._safeName(name) + ','); });
      this._actionNames.forEach(function (name) { self._line(self._camelName(name) + ','); });
      this.indent--;
      this._line('};');
      this.indent--;
      this._line('}');
    }

    return this.output.join('\n');
  };

  EventMathCodeGen.prototype._firstPass = function (statements) {
    for (var i = 0; i < statements.length; i++) {
      var stmt = statements[i];
      switch (stmt.type) {
        case 'Event': this._eventNames.add(stmt.name); break;
        case 'Layer': this._layerNames.add(stmt.name); break;
        case 'Timeline': this._timelineNames.add(stmt.name); break;
        case 'Action':
          this._actionNames.add(stmt.name);
          if (stmt.doorOpen && stmt.doorOpen.inputs.length > 0) {
            this._actionDoorInputs[stmt.name] = stmt.doorOpen.inputs;
          }
          break;
        case 'Mark':
          if (!this._vars.has(stmt.name)) {
            this._vars.add(stmt.name);
            if (stmt.stringOp) {
              this._varDecls.push({ name: stmt.name, rawExpr: this._genStringOp(stmt) });
            } else if (stmt.expr) {
              this._varDecls.push({ name: stmt.name, rawExpr: this._genExpr(stmt.expr) });
            } else {
              this._varDecls.push({ name: stmt.name, value: this._typedValueFromString(stmt.value) });
            }
          }
          break;
        case 'Set':
          if (!this._vars.has(stmt.name)) {
            this._vars.add(stmt.name);
            this._varDecls.push({ name: stmt.name, value: undefined });
          }
          break;
        case 'Use':
          this._useStmts.push(stmt);
          this._importedNames.add(stmt.name);
          break;
        case 'When':
          this._firstPass(stmt.body || []);
          this._firstPass(stmt.otherwise || []);
          break;
        case 'AgainCount': case 'AgainUntil': case 'Walk':
          this._firstPass(stmt.body || []);
          break;
        case 'Overlap':
          for (var t = 0; t < (stmt.tracks || []).length; t++) this._firstPass(stmt.tracks[t]);
          break;
      }
    }
  };

  EventMathCodeGen.prototype._genStatement = function (stmt, inAction) {
    if (!stmt) return;
    switch (stmt.type) {
      case 'Event':       return this._genEvent(stmt, inAction);
      case 'Layer':       return this._genLayer(stmt);
      case 'Timeline':    return this._genTimeline(stmt);
      case 'Action':      return this._genAction(stmt);
      case 'Mark':        return; // hoisted
      case 'Set':         return this._genSet(stmt);
      case 'Run':         return this._genRun(stmt);
      case 'Show':        return this._genShow(stmt);
      case 'When':        return this._genWhen(stmt);
      case 'Split':       return this._genSplit(stmt);
      case 'AgainCount':  return this._genAgainCount(stmt);
      case 'AgainUntil':  return this._genAgainUntil(stmt);
      case 'Walk':        return this._genWalk(stmt);
      case 'ActionCall':  return this._genActionCall(stmt, inAction);
      case 'Rewind':      return this._genRewind(stmt);
      case 'Forward':     return this._genForward(stmt);
      case 'Stop':        return this._genStop();
      case 'AddEvent':    return this._genAddEvent(stmt);
      case 'AddLayer':    return this._genAddLayer(stmt);
      case 'RemoveLayer': return this._genRemoveLayer(stmt);
      case 'RemoveEvent': return this._genRemoveEvent(stmt);
      case 'Merge':       return this._genMerge(stmt);
      case 'Overlap':     return this._genOverlap(stmt);
      case 'Note':        return this._genNote(stmt);
      case 'BrokenEvent': return this._genBrokenEvent(stmt);
      case 'Check':       return this._genCheck(stmt);
      case 'Use':         return;
      case 'NameRef':     return;
      default: this._line('// (unknown node: ' + stmt.type + ')');
    }
  };

  EventMathCodeGen.prototype._genEvent = function (stmt, inAction) {
    if (inAction) return this._genInlineEvent(stmt);
    var varName = this._safeName(stmt.name);
    this._line('// Event: "' + this._escape(stmt.name) + '"');
    this._line('const ' + varName + ' = new EM.EventMathEvent(');
    this.indent++;
    this._line('"' + this._escape(stmt.name) + '",');
    this._line('"' + this._escape(stmt.category || 'event') + '",');
    if (stmt.matter && stmt.matter.fields.length > 0) {
      this._line('{');
      this.indent++;
      for (var f = 0; f < stmt.matter.fields.length; f++) {
        var field = stmt.matter.fields[f];
        if (field.kind === 'literal') this._line(this._safeKey(field.key) + ': "' + this._escape(field.value) + '",');
        else this._line(this._safeKey(field.key) + ': ' + this._safeRef(field.value) + ',');
      }
      this.indent--;
      this._line('}');
    } else {
      this._line('{}');
    }
    this.indent--;
    this._line(');');
    this._line('');
  };

  EventMathCodeGen.prototype._genInlineEvent = function (stmt) {
    var varName = this._safeName(stmt.name);
    this._line('const ' + varName + ' = new EM.EventMathEvent(');
    this.indent++;
    this._line('"' + this._escape(stmt.name) + '",');
    this._line('"' + this._escape(stmt.category || 'event') + '",');
    if (stmt.matter && stmt.matter.fields.length > 0) {
      this._line('{');
      this.indent++;
      for (var f = 0; f < stmt.matter.fields.length; f++) {
        var field = stmt.matter.fields[f];
        if (field.kind === 'literal') this._line(this._safeKey(field.key) + ': "' + this._escape(field.value) + '",');
        else this._line(this._safeKey(field.key) + ': ' + this._safeRef(field.value) + ',');
      }
      this.indent--;
      this._line('}');
    } else {
      this._line('{}');
    }
    this.indent--;
    this._line(');');
    this._line('EM.getDefaultTimeline().append(new EM.TimelineEntry("event", ' + varName + '));');
  };

  EventMathCodeGen.prototype._genLayer = function (stmt) {
    var varName = this._safeName(stmt.name);
    this._line('// Layer: "' + this._escape(stmt.name) + '"');
    this._line('const ' + varName + ' = new EM.EventMathLayer("' + this._escape(stmt.name) + '", [');
    if (stmt.events && stmt.events.length > 0) {
      this.indent++;
      for (var i = 0; i < stmt.events.length; i++) {
        this._line(this._safeName(stmt.events[i].name) + ',');
      }
      this.indent--;
    }
    this._line(']);');
    this._line('');
  };

  EventMathCodeGen.prototype._genTimeline = function (stmt) {
    var varName = this._safeName(stmt.name);
    this._line('// Timeline: "' + this._escape(stmt.name) + '"');
    this._line('const ' + varName + ' = new EM.EventMathTimeline("' + this._escape(stmt.name) + '");');
    this._line('');
    if (stmt.present && stmt.present.layers) {
      for (var i = 0; i < stmt.present.layers.length; i++) {
        this._line(varName + '.log.push(...' + this._safeName(stmt.present.layers[i].name) + '.events);');
      }
    }
    this._line('');
  };

  EventMathCodeGen.prototype._genAction = function (stmt) {
    var fnName = this._camelName(stmt.name);
    this._line('// Action: "' + this._escape(stmt.name) + '"');
    var params = '';
    if (stmt.doorOpen && stmt.doorOpen.inputs.length > 0) {
      params = stmt.doorOpen.inputs.map(function (p) { return p.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_$]/g, ''); }).join(', ');
    }
    this._line('function ' + fnName + '(' + params + ') {');
    this.indent++;
    this._inAction = true;
    for (var i = 0; i < (stmt.body || []).length; i++) this._genStatement(stmt.body[i], true);
    this._inAction = false;
    if (stmt.doorClosed) {
      if (stmt.doorClosed.returns) this._line('return ' + this._safeName(stmt.doorClosed.returns) + ';');
      else this._line('return;');
    }
    this.indent--;
    this._line('}');
    this._line('');
  };

  EventMathCodeGen.prototype._typedValueFromString = function (str) {
    if (!str) return '""';
    if (str === 'true') return 'true';
    if (str === 'false') return 'false';
    if (/^\d+(\.\d+)?$/.test(str)) return str;
    return '"' + this._escape(str) + '"';
  };

  EventMathCodeGen.prototype._genSet = function (stmt) {
    var varName = this._safeName(stmt.name);
    if (stmt.stringOp) this._line(varName + ' = ' + this._genStringOp(stmt) + ';');
    else if (stmt.expr) this._line(varName + ' = ' + this._genExpr(stmt.expr) + ';');
    else this._line(varName + ' = ' + this._typedValue(stmt.value) + ';');
  };

  EventMathCodeGen.prototype._typedValue = function (value) {
    if (!value) return '""';
    if (value.kind === 'number') return value.value;
    if (value.kind === 'bool') return value.value ? 'true' : 'false';
    if (value.kind === 'name') return this._safeRef(value.value);
    var raw = value.value || '';
    if (raw === 'true') return 'true';
    if (raw === 'false') return 'false';
    if (/^\d+(\.\d+)?$/.test(raw)) return raw;
    return '"' + this._escape(raw) + '"';
  };

  EventMathCodeGen.prototype._genStringOp = function (stmt) {
    var stringOp = stmt.stringOp;
    if (stringOp === 'joined with') {
      var l = this._safeRef(stmt.left.value);
      var r = /^\d+$/.test(stmt.right.value) ? stmt.right.value :
              (this._vars.has(stmt.right.value) ? this._safeRef(stmt.right.value) : '"' + this._escape(stmt.right.value) + '"');
      return 'String(' + l + ') + ' + r;
    }
    if (stringOp === 'in uppercase') return 'String(' + this._safeRef(stmt.subject.value) + ').toUpperCase()';
    if (stringOp === 'in lowercase') return 'String(' + this._safeRef(stmt.subject.value) + ').toLowerCase()';
    if (stringOp === 'length of') return 'String(' + this._safeRef(stmt.subject.value) + ').length';
    return '""';
  };

  EventMathCodeGen.prototype._genExpr = function (node) {
    if (!node) return '0';
    if (node.kind === 'expr') {
      var ops = { plus: '+', minus: '-', times: '*', 'divided by': '/' };
      var jsOp = ops[node.op] || '+';
      var left = node.left.kind === 'expr' ? '(' + this._genExpr(node.left) + ')' : this._exprOperand(node.left);
      var right = node.right.kind === 'expr' ? '(' + this._genExpr(node.right) + ')' : this._exprOperand(node.right);
      return left + ' ' + jsOp + ' ' + right;
    }
    return this._exprOperand(node);
  };

  EventMathCodeGen.prototype._exprOperand = function (operand) {
    if (!operand) return '0';
    if (operand.kind === 'number') return operand.value;
    if (operand.kind === 'name') return this._safeRef(operand.value);
    return '"' + this._escape(operand.value || '') + '"';
  };

  EventMathCodeGen.prototype._genRun = function (stmt) {
    if (!stmt.target) { this._line("console.log('');"); return; }
    var words = stmt.target.split(' ');
    var kind = words[0];
    var name = words.slice(1).join(' ') || words[0];
    if (kind === 'event') this._line('console.log(' + this._safeName(name) + '.render());');
    else if (kind === 'layer') this._line('console.log(' + this._safeName(name) + '.render());');
    else if (kind === 'timeline') this._line('console.log(' + this._safeName(name) + '.render());');
    else {
      var parts = stmt.target.split(' ');
      var section = parts[parts.length - 1];
      var timelineName = parts.slice(0, parts.length - 1).join(' ');
      if (['past', 'present', 'future'].includes(section)) {
        this._line("console.log(" + this._safeName(timelineName) + ".renderSection('" + section + "'));");
      } else {
        this._line('console.log(' + this._safeName(stmt.target) + '.render());');
      }
    }
  };

  EventMathCodeGen.prototype._genShow = function (stmt) {
    if (!stmt.target) { this._line("console.log('');"); return; }
    var label = stmt.target;
    var safeName = this._safeName(label);
    this._line('{ var __sv = ' + safeName + '; if (__sv !== null && __sv !== undefined && typeof __sv.render === "function") { console.log(__sv.render()); } else { console.log(' + JSON.stringify(label) + ' + ":", __sv); } }');
  };

  EventMathCodeGen.prototype._genWhen = function (stmt) {
    if (!stmt.condition) { this._line('// (when with no condition)'); return; }
    var cond = this._genCondition(stmt.condition);
    this._line('if (' + cond + ') {');
    this.indent++;
    for (var i = 0; i < (stmt.body || []).length; i++) this._genStatement(stmt.body[i], this._inAction);
    this.indent--;
    if (stmt.otherwise && stmt.otherwise.length > 0) {
      this._line('} else {');
      this.indent++;
      for (var j = 0; j < stmt.otherwise.length; j++) this._genStatement(stmt.otherwise[j], this._inAction);
      this.indent--;
    }
    this._line('}');
  };

  EventMathCodeGen.prototype._genCondition = function (cond) {
    if (!cond) return 'true';
    if (cond.type === 'CompoundCondition') {
      var left = this._genCondition(cond.left);
      var right = this._genCondition(cond.right);
      var op = cond.op === 'and' ? '&&' : '||';
      return '(' + left + ') ' + op + ' (' + right + ')';
    }
    var leftV = this._walkRef(cond.left);
    var rightVal = cond.right || '';
    var right;
    if (rightVal === 'true') right = 'true';
    else if (rightVal === 'false') right = 'false';
    else if (/^\d+(\.\d+)?$/.test(rightVal)) right = rightVal;
    else right = '"' + this._escape(rightVal) + '"';

    var ops = {
      'is':              leftV + ' === ' + right,
      'is not':          leftV + ' !== ' + right,
      'is greater than': leftV + ' > ' + this._numRef(cond.right),
      'is less than':    leftV + ' < ' + this._numRef(cond.right),
      'is at least':     leftV + ' >= ' + this._numRef(cond.right),
      'is at most':      leftV + ' <= ' + this._numRef(cond.right),
      'is starts with':  'String(' + leftV + ').startsWith(' + right + ')',
      'is ends with':    'String(' + leftV + ').endsWith(' + right + ')',
      'is contains':     'String(' + leftV + ').includes(' + right + ')',
    };
    return ops[cond.op] || (leftV + ' === ' + right);
  };

  EventMathCodeGen.prototype._numRef = function (val) {
    if (!val) return '0';
    if (/^\d+(\.\d+)?$/.test(val)) return val;
    return this._safeRef(val);
  };

  EventMathCodeGen.prototype._walkRef = function (name) {
    if (!this._walkVar || !name) return this._safeRef(name);
    var walkVarSafe = this._safeName(this._walkVar);
    if (name === this._walkVar) return walkVarSafe;
    var prefix = this._walkVar;
    if (name.startsWith(prefix + ' ')) {
      var rest = name.slice(prefix.length).trim();
      if (rest) return walkVarSafe + '.matter.' + this._safeName(rest);
      return walkVarSafe;
    }
    return this._safeRef(name);
  };

  EventMathCodeGen.prototype._genSplit = function (stmt) {
    var target = this._safeRef(stmt.target);
    this._line('// split ' + target);
    this._line('switch (' + target + ') {');
    this.indent++;
    for (var i = 0; i < (stmt.paths || []).length; i++) {
      var path = stmt.paths[i];
      this._line('case "' + this._escape(path.name) + '":');
      this.indent++;
      for (var j = 0; j < (path.body || []).length; j++) this._genStatement(path.body[j], this._inAction);
      this._line('break;');
      this.indent--;
    }
    this.indent--;
    this._line('}');
  };

  EventMathCodeGen.prototype._genAgainCount = function (stmt) {
    this._line('for (let __i = 0; __i < ' + (stmt.count || 0) + '; __i++) {');
    this.indent++;
    for (var i = 0; i < (stmt.body || []).length; i++) this._genStatement(stmt.body[i], this._inAction);
    this.indent--;
    this._line('}');
  };

  EventMathCodeGen.prototype._genAgainUntil = function (stmt) {
    if (!stmt.condition) {
      this._line('while (true) {');
    } else {
      var cond = this._genCondition(stmt.condition);
      this._line('while (!(' + cond + ')) {');
    }
    this.indent++;
    for (var i = 0; i < (stmt.body || []).length; i++) this._genStatement(stmt.body[i], this._inAction);
    this.indent--;
    this._line('}');
  };

  EventMathCodeGen.prototype._genWalk = function (stmt) {
    var layer = this._safeName(stmt.layer);
    var variable = this._safeName(stmt.variable);
    this._walkVar = stmt.variable;
    this._line('for (const ' + variable + ' of ' + layer + '.events) {');
    this.indent++;
    for (var i = 0; i < (stmt.body || []).length; i++) this._genStatement(stmt.body[i], this._inAction);
    this.indent--;
    this._line('}');
    this._walkVar = null;
  };

  EventMathCodeGen.prototype._genStop = function () {
    this._line('return;');
  };

  EventMathCodeGen.prototype._genActionCall = function (stmt, inAction) {
    var fnName = this._camelName(stmt.name);
    var doorInputs = this._actionDoorInputs[stmt.name] || [];
    var argMap = {};
    for (var i = 0; i < (stmt.args || []).length; i++) argMap[stmt.args[i].key] = stmt.args[i].value;
    var args = doorInputs.map(function (key) {
      var val = argMap[key];
      return val !== undefined ? '"' + val + '"' : 'undefined';
    });
    this._line(fnName + '(' + args.join(', ') + ');');
  };

  EventMathCodeGen.prototype._genRewind = function (stmt) {
    var target = this._safeName(stmt.target);
    if (stmt.mode === 'by') this._line(target + '.rewind(' + (stmt.count || 1) + ');');
    else if (stmt.mode === 'to') this._line(target + '.rewindTo("' + this._escape(stmt.destination) + '");');
  };

  EventMathCodeGen.prototype._genForward = function (stmt) {
    var target = this._safeName(stmt.target);
    if (stmt.mode === 'by') this._line(target + '.forward(' + (stmt.count || 1) + ');');
    else if (stmt.mode === 'to') this._line(target + '.forwardTo("' + this._escape(stmt.destination) + '");');
  };

  EventMathCodeGen.prototype._genAddEvent = function (stmt) {
    var eventName = this._safeName(stmt.eventName);
    var layerName = this._safeName(stmt.layerName);
    if (layerName) this._line(layerName + '.events.push(' + eventName + ');');
  };

  EventMathCodeGen.prototype._genAddLayer = function (stmt) {
    this._line('// add layer: ' + stmt.layerName);
  };

  EventMathCodeGen.prototype._genRemoveLayer = function (stmt) {
    this._line('// remove layer: ' + stmt.name);
  };

  EventMathCodeGen.prototype._genRemoveEvent = function (stmt) {
    this._line('// remove event: ' + stmt.name);
  };

  EventMathCodeGen.prototype._genMerge = function (stmt) {
    this._line('// merge ' + stmt.source + ' into ' + stmt.target);
  };

  EventMathCodeGen.prototype._genBrokenEvent = function (stmt) {
    var varName = this._safeName(stmt.name);
    this._line('// broken event: "' + this._escape(stmt.name) + '"');
    this._line('const ' + varName + ' = new EM.EventMathEvent(');
    this.indent++;
    this._line('"' + this._escape(stmt.name) + '",');
    this._line('"broken",');
    if (stmt.matter && stmt.matter.fields.length > 0) {
      this._line('{');
      this.indent++;
      for (var f = 0; f < stmt.matter.fields.length; f++) {
        var field = stmt.matter.fields[f];
        if (field.kind === 'literal') this._line(this._safeKey(field.key) + ': "' + this._escape(field.value) + '",');
        else this._line(this._safeKey(field.key) + ': ' + this._safeRef(field.value) + ',');
      }
      this.indent--;
      this._line('}');
    } else {
      this._line('{}');
    }
    this.indent--;
    this._line(');');
    this._line('console.error(' + varName + '.render());');
    this._line('');
  };

  EventMathCodeGen.prototype._genCheck = function (stmt) {
    if (!stmt.condition) return;
    var cond = this._genCondition(stmt.condition);
    var desc = stmt.condition.type === 'CompoundCondition' ? 'compound condition' :
      (stmt.condition.left + ' ' + stmt.condition.op + ' ' + stmt.condition.right);
    this._line('if (!(' + cond + ')) {');
    this.indent++;
    this._line('console.error(new EM.EventMathEvent("check failed", "broken", {');
    this.indent++;
    this._line('condition: "' + this._escape(desc) + '",');
    this._line('hint: "This condition was expected to be true.",');
    this.indent--;
    this._line('}).render());');
    this.indent--;
    this._line('}');
  };

  EventMathCodeGen.prototype._detectOverlap = function (statements) {
    if (!statements) return false;
    for (var i = 0; i < statements.length; i++) {
      var stmt = statements[i];
      if (!stmt) continue;
      if (stmt.type === 'Overlap') return true;
      if (stmt.body && this._detectOverlap(stmt.body)) return true;
      if (stmt.otherwise && this._detectOverlap(stmt.otherwise)) return true;
      if (stmt.tracks) {
        for (var j = 0; j < stmt.tracks.length; j++) {
          if (this._detectOverlap(stmt.tracks[j])) return true;
        }
      }
      if (stmt.paths) {
        for (var k = 0; k < stmt.paths.length; k++) {
          if (stmt.paths[k].body && this._detectOverlap(stmt.paths[k].body)) return true;
        }
      }
    }
    return false;
  };

  EventMathCodeGen.prototype._genOverlap = function (stmt) {
    this._line('// overlap: run these tracks at the same time');
    this._line('await Promise.all([');
    this.indent++;
    for (var i = 0; i < (stmt.tracks || []).length; i++) {
      this._line('(async () => {');
      this.indent++;
      for (var j = 0; j < stmt.tracks[i].length; j++) this._genStatement(stmt.tracks[i][j], this._inAction);
      this.indent--;
      this._line('})(),');
    }
    this.indent--;
    this._line(']);');
  };

  EventMathCodeGen.prototype._genNote = function (stmt) {
    this._line('// note: ' + stmt.text);
  };

  EventMathCodeGen.prototype._genUse = function (stmt) {
    if (!stmt.from) return;
    var compiledFile = stmt.from.replace(/\.em$/, '.em.js');
    var safeName = this._safeName(stmt.name);
    var camelName = this._camelName(stmt.name);
    var names = safeName === camelName ? safeName : (safeName + ', ' + camelName);
    this._line('// use ' + stmt.name + ' from ' + stmt.from);
    this._line("const { " + names + " } = require('./" + compiledFile + "');");
  };

  EventMathCodeGen.prototype._safeName = function (name) {
    if (!name) return '__empty';
    var s = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_$]/g, '');
    if (/^\d/.test(s)) s = '_' + s;
    if (/^[a-zA-Z_$]/.test(s)) return s;
    return '_' + s;
  };

  EventMathCodeGen.prototype._safeKey = function (key) {
    if (!key) return '"_empty"';
    var idRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    if (idRegex.test(key)) return key;
    return '"' + key + '"';
  };

  EventMathCodeGen.prototype._safeRef = function (name) {
    if (!name) return 'undefined';
    if (this._importedNames && this._importedNames.has(name)) return this._safeName(name);
    var safe = this._safeName(name);
    if (safe === 'true' || safe === 'false') return safe;
    if (safe === 'undefined') return 'undefined';
    return safe;
  };

  EventMathCodeGen.prototype._camelName = function (name) {
    if (!name) return 'unnamed';
    return name.split(/\s+/).map(function (w, i) {
      if (i === 0) return w.replace(/[^a-zA-Z0-9_$]/g, '');
      return w.charAt(0).toUpperCase() + w.slice(1).replace(/[^a-zA-Z0-9_$]/g, '');
    }).join('');
  };

  EventMathCodeGen.prototype._escape = function (str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  };

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5 — Compiler API
  // ═══════════════════════════════════════════════════════════════

  root.EventMathCompiler = {
    /**
     * Compile EventMath source to JavaScript.
     * @param {string} source - EventMath source code
     * @returns {{ js: string, errors: string[] }}
     */
    compile: function (source) {
      try {
        var tokenizer = new EventMathTokenizer();
        var tokens = tokenizer.tokenize(source);

        var parser = new EventMathParser(tokens);
        var ast = parser.parse();

        if (ast.errors && ast.errors.length > 0) {
          return { js: '', errors: ast.errors };
        }

        var codegen = new EventMathCodeGen();
        var js = codegen.generate(ast);

        return { js: js, errors: [] };
      } catch (e) {
        return { js: '', errors: [e.message || String(e)] };
      }
    },
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
