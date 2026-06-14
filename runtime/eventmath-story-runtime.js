/**
 * EventMath Story Runtime v0.1 — Minority Report Predictive Story Layer
 *
 * Provides the runtime classes for the v2.20 story layer:
 *   - EventMathStory: scans data sources (twitter, news, rss, scan, web)
 *   - EventMathNarrative: applies a perspective filter to a story's events
 *   - EventMathScope: multi-dimensional alternative mapping
 *
 * USAGE:
 *   const EM = require('./eventmath-runtime.js');
 *   const { EventMathStory, EventMathNarrative, EventMathScope } = require('./eventmath-story-runtime.js');
 *   EM.EventMathStory = EventMathStory;
 *   EM.EventMathNarrative = EventMathNarrative;
 *   EM.EventMathScope = EventMathScope;
 *
 * Or loaded via the codegen which references EM.EventMathStory etc.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EventMathStoryRuntime = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Simple HTTP GET helper using Node.js http/https.
   */
  function _httpGet(url) {
    return new Promise(function (resolve, reject) {
      var lib = url.indexOf('https://') === 0 ? require('https') : require('http');
      lib.get(url, function (res) {
        var data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () {
          try {
            var parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve(data);
          }
        });
      }).on('error', function (err) {
        reject(err);
      });
    });
  }

  // ── Probability word mapping ──────────────────────────────

  var PROB_MAP = {
    'low':     0.25,
    'medium':  0.50,
    'high':    0.75,
    'certain': 0.95,
    'impossible': 0.05,
    'unlikely':   0.20,
    'likely':     0.70,
    'very likely': 0.85,
  };

  function parseProbability(prob) {
    if (typeof prob === 'number') return Math.max(0, Math.min(1, prob));
    var p = PROB_MAP[String(prob).toLowerCase()];
    return p !== undefined ? p : 0.50;
  }

  // ── EventMathStory ─────────────────────────────────────────

  /**
   * Represents a story — a collection of events sourced from a data source.
   *
   * @param {string} name     - Unique name for this story
   * @param {string} source   - Source type: 'twitter', 'news', 'rss', 'scan', 'web'
   * @param {string} query    - Search query or topic
   */
  function EventMathStory(name, source, query) {
    if (!(this instanceof EventMathStory)) {
      return new EventMathStory(name, source, query);
    }
    this.name = name || '';
    this.source = source || 'web';
    this.query = query || '';
    this.events = [];
    this.status = 'idle'; // idle, scanning, complete, error
    this.error = null;
    this._type = 'story';
  }

  /**
   * Scan the data source for events matching the query.
   * Returns a Promise that resolves with the events array.
   */
  EventMathStory.prototype.scan = function () {
    var self = this;
    self.status = 'scanning';

    switch (self.source) {
      case 'twitter':
        return self._scanTwitter();
      case 'news':
        return self._scanNews();
      case 'rss':
        return self._scanRSS();
      case 'scan':
        return self._scanNetwork();
      case 'web':
      default:
        return self._scanWeb();
    }
  };

  /**
   * Simulated Twitter scan. In production, this would use the Twitter API.
   */
  EventMathStory.prototype._scanTwitter = function () {
    var self = this;
    return new Promise(function (resolve) {
      // Simulated delay for API call
      setTimeout(function () {
        self.events = [
          { id: 'tw_' + Date.now(), source: 'twitter', query: self.query,
            content: 'Simulated tweet about "' + self.query + '"', timestamp: new Date().toISOString() },
          { id: 'tw_' + (Date.now() + 1), source: 'twitter', query: self.query,
            content: 'Another simulated tweet', timestamp: new Date().toISOString() },
        ];
        self.status = 'complete';
        resolve(self.events);
      }, 100);
    });
  };

  /**
   * Simulated News scan.
   */
  EventMathStory.prototype._scanNews = function () {
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () {
        self.events = [
          { id: 'news_' + Date.now(), source: 'news', query: self.query,
            headline: 'Breaking: ' + self.query, outlet: 'EventMath Times', timestamp: new Date().toISOString() },
          { id: 'news_' + (Date.now() + 1), source: 'news', query: self.query,
            headline: 'Analysis: ' + self.query, outlet: 'EventMath Report', timestamp: new Date().toISOString() },
        ];
        self.status = 'complete';
        resolve(self.events);
      }, 150);
    });
  };

  /**
   * Simulated RSS feed scan.
   */
  EventMathStory.prototype._scanRSS = function () {
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () {
        self.events = [
          { id: 'rss_' + Date.now(), source: 'rss', query: self.query,
            title: 'RSS: ' + self.query, feed: 'example-feed', timestamp: new Date().toISOString() },
          { id: 'rss_' + (Date.now() + 1), source: 'rss', query: self.query,
            title: 'RSS Update: ' + self.query, feed: 'example-feed', timestamp: new Date().toISOString() },
        ];
        self.status = 'complete';
        resolve(self.events);
      }, 120);
    });
  };

  /**
   * Simulated network scan.
   */
  EventMathStory.prototype._scanNetwork = function () {
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () {
        self.events = [
          { id: 'scan_' + Date.now(), source: 'scan', query: self.query,
            host: '192.168.1.1', service: 'http', status: 'open', timestamp: new Date().toISOString() },
          { id: 'scan_' + (Date.now() + 1), source: 'scan', query: self.query,
            host: '192.168.1.2', service: 'ssh', status: 'open', timestamp: new Date().toISOString() },
        ];
        self.status = 'complete';
        resolve(self.events);
      }, 200);
    });
  };

  /**
   * Web scan — fetches data from a URL via HTTP.
   */
  EventMathStory.prototype._scanWeb = function () {
    var self = this;
    var url = self.query;
    // If the query doesn't look like a URL, simulate
    if (!url || (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0)) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          self.events = [
            { id: 'web_' + Date.now(), source: 'web', query: self.query,
              content: 'Web data for "' + self.query + '"', url: url, timestamp: new Date().toISOString() },
          ];
          self.status = 'complete';
          resolve(self.events);
        }, 80);
      });
    }
    // Real HTTP fetch
    return _httpGet(url).then(function (data) {
      var items = Array.isArray(data) ? data : (data.items || data.results || [data]);
      self.events = items.map(function (item, idx) {
        return {
          id: 'web_' + Date.now() + '_' + idx,
          source: 'web',
          query: self.query,
          content: item.title || item.name || item.content || JSON.stringify(item),
          url: item.url || item.link || url,
          timestamp: item.published || item.date || new Date().toISOString(),
        };
      });
      self.status = 'complete';
      return self.events;
    }).catch(function (err) {
      self.status = 'error';
      self.error = err;
      throw err;
    });
  };

  // ── EventMathNarrative ─────────────────────────────────────

  /**
   * A perspective/view over a story's events.
   *
   * @param {string} perspective - The viewpoint (e.g. "conservative", "liberal", "scientific")
   */
  function EventMathNarrative(perspective) {
    if (!(this instanceof EventMathNarrative)) {
      return new EventMathNarrative(perspective);
    }
    this.perspective = perspective || 'neutral';
    this._type = 'narrative';
  }

  /**
   * Apply this perspective to a story's events, returning filtered/scored events.
   *
   * @param {EventMathStory|Array} story - A story object or array of events
   * @returns {Array} Filtered and annotated events
   */
  EventMathNarrative.prototype.view = function (story) {
    var events = story && story.events ? story.events : (Array.isArray(story) ? story : []);
    var self = this;

    return events.map(function (evt) {
      return {
        event: evt,
        perspective: self.perspective,
        relevance: self._scoreRelevance(evt),
        bias: self._detectBias(evt),
        confidence: self._confidence(evt),
      };
    }).filter(function (item) {
      return item.relevance > 0.2;
    }).sort(function (a, b) {
      return b.relevance - a.relevance;
    });
  };

  /**
   * Score how relevant an event is to this perspective.
   * Uses keyword matching against a perspective-specific lexicon.
   */
  EventMathNarrative.prototype._scoreRelevance = function (evt) {
    var text = JSON.stringify(evt).toLowerCase();
    var perspective = this.perspective.toLowerCase();

    // Perspective keyword lexicons
    var keywords = {
      'conservative': ['tradition', 'security', 'order', 'authority', 'stability', 'national', 'family', 'duty'],
      'liberal':      ['freedom', 'equality', 'rights', 'progress', 'inclusion', 'justice', 'reform', 'diversity'],
      'scientific':   ['evidence', 'data', 'study', 'research', 'hypothesis', 'experiment', 'analysis', 'peer'],
      'skeptical':    ['doubt', 'question', 'uncertain', 'flaw', 'bias', 'contradict', 'unproven', 'critical'],
      'optimistic':   ['opportunity', 'growth', 'potential', 'hope', 'improve', 'breakthrough', 'promise', 'positive'],
      'pessimistic':  ['risk', 'threat', 'danger', 'decline', 'failure', 'crisis', 'loss', 'negative'],
      'neutral':      ['report', 'state', 'fact', 'information', 'announce', 'public', 'record', 'statement'],
    };

    var lexicon = keywords[perspective] || keywords['neutral'];
    var score = 0;
    for (var i = 0; i < lexicon.length; i++) {
      if (text.indexOf(lexicon[i]) !== -1) {
        score += 0.15;
      }
    }
    return Math.min(1.0, score);
  };

  /**
   * Detect potential bias in the event content.
   */
  EventMathNarrative.prototype._detectBias = function (evt) {
    var text = JSON.stringify(evt).toLowerCase();
    var biasIndicators = {
      'emotional': ['outrage', 'shocking', 'unbelievable', 'terrible', 'amazing', 'incredible'],
      'hyperbole': ['always', 'never', 'everyone', 'no one', 'completely', 'absolutely'],
      'framing':   ['obviously', 'clearly', 'of course', 'naturally', 'undoubtedly'],
    };

    var bias = { emotional: 0, hyperbole: 0, framing: 0 };
    for (var type in biasIndicators) {
      if (biasIndicators.hasOwnProperty(type)) {
        for (var i = 0; i < biasIndicators[type].length; i++) {
          if (text.indexOf(biasIndicators[type][i]) !== -1) {
            bias[type] += 0.2;
          }
        }
        bias[type] = Math.min(1.0, bias[type]);
      }
    }
    return bias;
  };

  /**
   * Confidence score for this narrative's assessment of the event.
   */
  EventMathNarrative.prototype._confidence = function (evt) {
    return 0.5 + Math.random() * 0.4;
  };

  // ── EventMathScope ─────────────────────────────────────────

  /**
   * Multi-dimensional alternative scenario mapper.
   * Analyzes a subject across multiple dimensions to generate alternative scenarios.
   */
  function EventMathScope() {
    if (!(this instanceof EventMathScope)) {
      return new EventMathScope();
    }
    this._type = 'scope';
  }

  /**
   * Static method: analyze a subject across dimensions.
   *
   * @param {string} subject    - The thing being analyzed
   * @param {Array} dimensions  - Array of dimension names
   * @returns {Object} Scope analysis with alternatives
   */
  EventMathScope.analyze = function (subject, dimensions) {
    if (!Array.isArray(dimensions)) dimensions = [dimensions];
    dimensions = dimensions.filter(Boolean);

    var alternatives = [];
    var extremes = ['positive', 'negative', 'neutral'];

    for (var di = 0; di < dimensions.length; di++) {
      var dim = dimensions[di];
      for (var ei = 0; ei < extremes.length; ei++) {
        var ext = extremes[ei];
        var probKey = ei === 0 ? 'high' : (ei === 1 ? 'low' : 'medium');
        alternatives.push({
          dimension: dim,
          polarity: ext,
          description: subject + ' — ' + dim + ' (' + ext + ' scenario)',
          probability: parseProbability(probKey),
          likelihood: probKey,
        });
      }
    }

    // Cross-dimensional combinations
    if (dimensions.length >= 2) {
      for (var a = 0; a < dimensions.length; a++) {
        for (var b = a + 1; b < dimensions.length; b++) {
          alternatives.push({
            dimension: dimensions[a] + ' × ' + dimensions[b],
            polarity: 'combined',
            description: subject + ' — intersection of ' + dimensions[a] + ' and ' + dimensions[b],
            probability: 0.35,
            likelihood: 'low',
          });
        }
      }
    }

    return {
      subject: subject,
      dimensions: dimensions,
      alternatives: alternatives,
      totalAlternatives: alternatives.length,
      generatedAt: new Date().toISOString(),
    };
  };

  // ── Exports ────────────────────────────────────────────────

  return {
    EventMathStory: EventMathStory,
    EventMathNarrative: EventMathNarrative,
    EventMathScope: EventMathScope,
  };

});
