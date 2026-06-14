'use strict';

/**
 * EventMath v2.23 — Text-Based Deception Signal Detector
 * Analyzes linguistic patterns associated with deceptive speech.
 * Does NOT claim to detect lies — surfaces linguistic signals for human review.
 * Uses only Node.js standard library.
 */

// ---------------------------------------------------------------------------
// Signal dictionaries
// ---------------------------------------------------------------------------

const HEDGING_WORDS = [
  'maybe', 'perhaps', 'possibly', 'probably', 'might', 'could',
  'sort of', 'kind of', 'somewhat', 'rather', 'fairly', 'quite',
  'seemingly', 'apparently', 'allegedly', 'supposedly',
  'i think', 'i believe', 'i feel like', 'it seems', 'it appears',
  'as far as i know', 'to my knowledge'
];

const DISTANCING_PASSIVE = [
  'it was decided', 'it was determined', 'it was agreed', 'it was found',
  'it was noted', 'it was done', 'it was made', 'it was reported',
  'it has been', 'there was a', 'one could', 'one might',
  'mistakes were made', 'errors were made', 'action was taken',
  'steps were taken', 'a decision was made', 'that situation', 'the matter',
  'the issue', 'the incident', 'the event', 'that thing', 'that problem'
];

const NEGATION_WORDS = [
  'never', 'not', "n't", 'no', 'nothing', 'nobody', 'none',
  'nowhere', 'neither', 'nor', 'cannot', "can't", "won't", "don't",
  "doesn't", "didn't", "hasn't", "haven't", "hadn't", "isn't", "aren't", "wasn't", "weren't"
];

const EXCLUSIVE_WORDS = [
  'but', 'except', 'without', 'excluding', 'however', 'although',
  'whereas', 'nevertheless', 'nonetheless', 'despite', 'yet',
  'even though', 'even so', 'on the other hand', 'that said',
  'having said that', 'while', 'though'
];

const SELF_CORRECTION_PHRASES = [
  'i mean', 'that is', 'or rather', 'what i mean', 'what i meant',
  'let me rephrase', 'in other words', 'to be clear', 'to clarify',
  'actually', 'well actually', 'i should say', 'i meant to say',
  'correction', 'strike that', 'no wait', 'scratch that'
];

// Over-qualification patterns: contradictory or redundant qualifiers
const OVER_QUALIFICATION_PATTERNS = [
  /definitely\s+maybe/i,
  /absolutely\s+certain\s+that\s+it\s+might/i,
  /completely\s+possible/i,
  /totally\s+uncertain/i,
  /100%\s+sure\s+it\s+could/i,
  /quite\s+possibly\s+certain/i,
  /very\s+maybe/i,
  /almost\s+certainly\s+might/i,
  /positively\s+might/i,
  /definitely\s+could/i,
  /certainly\s+possibly/i,
  /undoubtedly\s+perhaps/i,
  /always\s+sometimes/i,
  /never\s+usually/i,
  /very\s+unique/i,
  /completely\s+empty/i,
  /absolutely\s+possibly/i,
  /totally\s+might/i
];

// Pronoun patterns
const FIRST_PERSON_SINGULAR_RE = /\b(i|me|my|myself|mine)\b/gi;
const THIRD_PERSON_DISTANCING_RE = /\b(he|she|they|them|their|it|that|those|one)\b/gi;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function lc(text) {
  return String(text || '').toLowerCase();
}

/** Split text into sentences (heuristic). */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n)/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Split text into words (non-empty tokens). */
function wordTokens(text) {
  return text.split(/\s+/).filter(Boolean);
}

/** Count non-overlapping occurrences of a substring (case-insensitive). */
function countSubstring(haystack, needle) {
  let count = 0;
  let pos = 0;
  const h = lc(haystack);
  const n = lc(needle);
  while ((pos = h.indexOf(n, pos)) !== -1) {
    count++;
    pos += n.length;
  }
  return count;
}

/**
 * Normalise a raw count into a 0-100 score using a soft saturation curve.
 * @param {number} count
 * @param {number} satAt  — count at which the score saturates to ~100
 */
function normalizeScore(count, satAt = 10) {
  if (count <= 0) return 0;
  // Logarithmic saturation
  const raw = Math.min(count / satAt, 1) * 100;
  return Math.round(raw);
}

/** Variance of an array of numbers. */
function variance(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
}

// ---------------------------------------------------------------------------
// Individual signal detectors
// ---------------------------------------------------------------------------

function detectHedging(text) {
  const t = lc(text);
  const found = [];
  for (const word of HEDGING_WORDS) {
    if (t.includes(word)) {
      const c = countSubstring(t, word);
      for (let i = 0; i < c; i++) found.push(word);
    }
  }
  const count = found.length;
  const uniqueWords = [...new Set(found)];
  return { count, words: uniqueWords, score: normalizeScore(count, 8) };
}

function detectDistancing(text) {
  const t = lc(text);
  let count = 0;
  const matchedPhrases = [];

  for (const phrase of DISTANCING_PASSIVE) {
    const c = countSubstring(t, phrase);
    if (c > 0) {
      count += c;
      matchedPhrases.push(phrase);
    }
  }

  // Passive voice heuristic: "was/were/been/being + past participle"
  const passiveRe = /\b(was|were|been|being|is|are|am)\s+\w+ed\b/gi;
  const passiveMatches = text.match(passiveRe) || [];
  count += passiveMatches.length;

  const words = [...new Set([...matchedPhrases, ...passiveMatches.map(lc)])];
  return { count, words, score: normalizeScore(count, 6) };
}

function detectNegationDensity(text) {
  const words = wordTokens(text);
  let count = 0;
  for (const w of words) {
    const wl = lc(w).replace(/[^a-z']/g, '');
    if (NEGATION_WORDS.some(neg => wl === neg || wl.endsWith(neg))) count++;
  }
  const wordCount = words.length || 1;
  // Score based on density (count / words) scaled to 0-100; saturation at 15%
  const density = count / wordCount;
  const score = Math.round(Math.min(density / 0.15, 1) * 100);
  return { count, score };
}

function detectOverQualification(text) {
  let count = 0;
  for (const re of OVER_QUALIFICATION_PATTERNS) {
    const matches = text.match(re);
    if (matches) count += matches.length;
  }
  // Also flag repeated qualifiers in close proximity (within 5 words)
  const words = wordTokens(lc(text));
  const qualifiers = new Set(['very', 'quite', 'rather', 'really', 'extremely', 'totally', 'absolutely', 'completely', 'definitely', 'certainly']);
  for (let i = 0; i < words.length - 2; i++) {
    if (qualifiers.has(words[i]) && qualifiers.has(words[i + 1])) {
      count++;
    }
  }
  return { count, score: normalizeScore(count, 5) };
}

function detectPronounDistancing(text) {
  const fp = (text.match(FIRST_PERSON_SINGULAR_RE) || []).length;
  const tp = (text.match(THIRD_PERSON_DISTANCING_RE) || []).length;
  const total = fp + tp;
  // High score = heavy use of third-person over first-person (distancing)
  let score = 0;
  if (total > 0) {
    score = Math.round((tp / total) * 100);
  }
  return { count: tp, score };
}

function detectExclusiveWords(text) {
  const t = lc(text);
  const found = [];
  for (const word of EXCLUSIVE_WORDS) {
    const c = countSubstring(t, ' ' + word + ' ') +
              (t.startsWith(word + ' ') ? 1 : 0);
    if (c > 0) {
      for (let i = 0; i < c; i++) found.push(word);
    }
  }
  const count = found.length;
  const words = [...new Set(found)];
  return { count, words, score: normalizeScore(count, 8) };
}

function detectCognitiveLoad(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return { score: 0 };

  const lengths = sentences.map(s => wordTokens(s).length);
  const sentenceVariance = variance(lengths);

  // Self-corrections
  const tl = lc(text);
  let corrections = 0;
  for (const phrase of SELF_CORRECTION_PHRASES) {
    corrections += countSubstring(tl, phrase);
  }

  // Score: combination of sentence length variance + self-corrections
  // Variance saturates at 100 (high variance = high cognitive load)
  const varianceScore = Math.round(Math.min(sentenceVariance / 100, 1) * 60);
  const correctionScore = Math.round(Math.min(corrections / 5, 1) * 40);
  const score = varianceScore + correctionScore;

  return { score: Math.min(score, 100) };
}

// ---------------------------------------------------------------------------
// scoreBaseline
// ---------------------------------------------------------------------------

/**
 * Return raw signal counts for use as a comparison baseline.
 *
 * @param {string} text
 * @returns {{ hedging: number, distancing: number, negation_density: number, over_qualification: number, exclusive_words: number }}
 */
function scoreBaseline(text) {
  if (typeof text !== 'string') throw new TypeError('scoreBaseline: text must be a string');
  return {
    hedging: detectHedging(text).count,
    distancing: detectDistancing(text).count,
    negation_density: detectNegationDensity(text).count,
    over_qualification: detectOverQualification(text).count,
    exclusive_words: detectExclusiveWords(text).count
  };
}

// ---------------------------------------------------------------------------
// analyzeCredibility
// ---------------------------------------------------------------------------

/**
 * Analyze a text for linguistic deception signals.
 *
 * @param {string} text
 * @param {string} [baseline]  — optional baseline text from the same person
 * @returns {object}
 */
function analyzeCredibility(text, baseline) {
  if (typeof text !== 'string') throw new TypeError('analyzeCredibility: text must be a string');

  const words = wordTokens(text);
  const word_count = words.length;
  const text_length = text.length;

  const hedging = detectHedging(text);
  const distancing = detectDistancing(text);
  const negation_density = detectNegationDensity(text);
  const over_qualification = detectOverQualification(text);
  const pronoun_distancing = detectPronounDistancing(text);
  const exclusive_words = detectExclusiveWords(text);
  const cognitive_load = detectCognitiveLoad(text);

  const signals = {
    hedging,
    distancing,
    negation_density,
    over_qualification,
    pronoun_distancing,
    exclusive_words,
    cognitive_load
  };

  // Weighted aggregate deception signal score (higher = more signals)
  // Weights reflect relative diagnostic value of each signal
  const weights = {
    hedging: 0.20,
    distancing: 0.20,
    negation_density: 0.15,
    over_qualification: 0.15,
    pronoun_distancing: 0.10,
    exclusive_words: 0.10,
    cognitive_load: 0.10
  };

  const rawSignalScore =
    hedging.score * weights.hedging +
    distancing.score * weights.distancing +
    negation_density.score * weights.negation_density +
    over_qualification.score * weights.over_qualification +
    pronoun_distancing.score * weights.pronoun_distancing +
    exclusive_words.score * weights.exclusive_words +
    cognitive_load.score * weights.cognitive_load;

  // credibility_score is inverse (100 = no deception signals)
  const credibility_score = Math.round(Math.max(0, Math.min(100, 100 - rawSignalScore)));

  // Risk level
  let risk_level;
  if (credibility_score >= 70) risk_level = 'low';
  else if (credibility_score >= 40) risk_level = 'medium';
  else risk_level = 'high';

  // Top signals (human-readable, only report signals that fired)
  const top_signals = [];
  if (hedging.score > 20) top_signals.push(`Hedging language detected (${hedging.count} instance${hedging.count !== 1 ? 's' : ''}: ${hedging.words.slice(0, 3).join(', ')})`);
  if (distancing.score > 20) top_signals.push(`Distancing language or passive voice detected (${distancing.count} instance${distancing.count !== 1 ? 's' : ''})`);
  if (negation_density.score > 20) top_signals.push(`High negation density (${negation_density.count} negation word${negation_density.count !== 1 ? 's' : ''})`);
  if (over_qualification.score > 20) top_signals.push(`Over-qualification or contradictory qualifiers detected (${over_qualification.count} instance${over_qualification.count !== 1 ? 's' : ''})`);
  if (pronoun_distancing.score > 40) top_signals.push(`Pronoun distancing — heavy third-person usage over first-person`);
  if (exclusive_words.score > 20) top_signals.push(`Frequent exclusive words (${exclusive_words.words.slice(0, 3).join(', ')}) may indicate evasion`);
  if (cognitive_load.score > 30) top_signals.push(`High cognitive load indicators — sentence length variance and/or self-corrections`);

  // Baseline deviation
  let baseline_deviation = null;
  if (baseline && typeof baseline === 'string') {
    const base = scoreBaseline(baseline);
    const current = scoreBaseline(text);
    const keys = Object.keys(base);
    const deviations = keys.map(k => {
      const b = base[k];
      const c = current[k];
      if (b === 0 && c === 0) return 0;
      if (b === 0) return 100;
      return Math.abs((c - b) / b) * 100;
    });
    baseline_deviation = Math.round(deviations.reduce((s, d) => s + d, 0) / deviations.length);
  }

  const disclaimer = 'These are linguistic signals only. Not a lie detector.';

  return {
    text_length,
    word_count,
    signals,
    baseline_deviation,
    credibility_score,
    risk_level,
    top_signals,
    disclaimer
  };
}

// ---------------------------------------------------------------------------
// compareStatements
// ---------------------------------------------------------------------------

/**
 * Compare multiple statements from the same person for consistency.
 *
 * @param {string[]} texts
 * @returns {{ consistent: boolean, inconsistencies: string[], confidence: "low"|"medium"|"high" }}
 */
function compareStatements(texts) {
  if (!Array.isArray(texts) || texts.length < 2) {
    throw new TypeError('compareStatements: texts must be an array of at least 2 strings');
  }

  const analyses = texts.map(t => analyzeCredibility(t));
  const baselines = texts.map(t => scoreBaseline(t));
  const inconsistencies = [];

  // 1. Check for major swings in credibility score across statements
  const scores = analyses.map(a => a.credibility_score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  if (maxScore - minScore > 30) {
    inconsistencies.push(
      `Credibility score swings significantly across statements (range: ${minScore}–${maxScore})`
    );
  }

  // 2. Detect shifts in pronoun usage (first-person vs distancing)
  const pronounScores = analyses.map(a => a.signals.pronoun_distancing.score);
  const maxPronouns = Math.max(...pronounScores);
  const minPronouns = Math.min(...pronounScores);
  if (maxPronouns - minPronouns > 40) {
    inconsistencies.push(
      'Pronoun usage shifts significantly — some statements use more first-person, others use more distancing language'
    );
  }

  // 3. Detect inconsistency in negation density
  const negScores = analyses.map(a => a.signals.negation_density.score);
  const negMax = Math.max(...negScores);
  const negMin = Math.min(...negScores);
  if (negMax - negMin > 35) {
    inconsistencies.push(
      'Negation density varies substantially across statements — some are notably more assertive or more denying than others'
    );
  }

  // 4. Compare hedging counts across statements
  const hedgeCounts = baselines.map(b => b.hedging);
  const hedgeMax = Math.max(...hedgeCounts);
  const hedgeMin = Math.min(...hedgeCounts);
  if (hedgeMax - hedgeMin > 5) {
    inconsistencies.push(
      `Hedging level varies across statements (min: ${hedgeMin}, max: ${hedgeMax} hedging expressions)`
    );
  }

  // 5. Cognitive load comparison
  const cogScores = analyses.map(a => a.signals.cognitive_load.score);
  const cogMax = Math.max(...cogScores);
  const cogMin = Math.min(...cogScores);
  if (cogMax - cogMin > 40) {
    inconsistencies.push(
      'Cognitive load indicators (sentence complexity, self-corrections) shift noticeably across statements'
    );
  }

  // 6. Risk level inconsistency (e.g., one "low", another "high")
  const riskLevels = analyses.map(a => a.risk_level);
  const uniqueRisks = new Set(riskLevels);
  if (uniqueRisks.has('low') && uniqueRisks.has('high')) {
    inconsistencies.push(
      'Risk level assessment shifts between "low" and "high" across statements — significant linguistic inconsistency'
    );
  }

  const consistent = inconsistencies.length === 0;

  // Confidence is higher with more statements and larger swings
  let confidence;
  if (texts.length >= 4 && inconsistencies.length > 0) {
    confidence = 'high';
  } else if (texts.length >= 3 || inconsistencies.length >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { consistent, inconsistencies, confidence };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { analyzeCredibility, scoreBaseline, compareStatements };
