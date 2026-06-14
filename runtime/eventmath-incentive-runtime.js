'use strict';

/**
 * EventMath v2.23 — Organizational Incentive Mapping Engine
 * Models role motivations and finds alignments/conflicts across org hierarchies.
 * Uses only Node.js standard library.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a string of comma-separated or "and"-separated values into a clean array.
 * Handles: "sales, revenue and growth" => ["sales", "revenue", "growth"]
 */
function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/,|\band\b/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Normalise a goal string into a set of lowercase keywords (stop-words removed).
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'at', 'by', 'from', 'with', 'as',
  'into', 'through', 'during', 'including', 'until', 'against', 'among',
  'throughout', 'despite', 'towards', 'upon', 'concerning'
]);

function toKeywordSet(goals) {
  const words = new Set();
  for (const goal of goals) {
    for (const word of goal.toLowerCase().split(/\W+/)) {
      if (word && !STOP_WORDS.has(word)) words.add(word);
    }
  }
  return words;
}

/**
 * Horizon order for gap computation.
 */
const HORIZON_ORDER = { immediate: 0, short: 1, medium: 2, long: 3, strategic: 4 };

function horizonValue(h) {
  if (!h) return -1;
  const key = String(h).toLowerCase().split(/[\s-]/)[0];
  return HORIZON_ORDER[key] !== undefined ? HORIZON_ORDER[key] : -1;
}

function horizonGapLabel(h1, h2) {
  const v1 = horizonValue(h1);
  const v2 = horizonValue(h2);
  if (v1 === -1 || v2 === -1) return 'none';
  const diff = Math.abs(v1 - v2);
  if (diff === 0) return 'none';
  const lo = [h1, h2].find(h => horizonValue(h) === Math.min(v1, v2));
  const hi = [h1, h2].find(h => horizonValue(h) === Math.max(v1, v2));
  return `${lo}-${hi}`;
}

function horizonPenalty(h1, h2) {
  const v1 = horizonValue(h1);
  const v2 = horizonValue(h2);
  if (v1 === -1 || v2 === -1) return 0;
  const diff = Math.abs(v1 - v2);
  if (diff >= 3) return 30;
  if (diff === 2) return 20;
  if (diff === 1) return 10;
  return 0;
}

// ---------------------------------------------------------------------------
// defineRole
// ---------------------------------------------------------------------------

/**
 * Define a role with named motivational fields.
 *
 * @param {string} name
 * @param {{ primary?: string|string[], secondary?: string|string[], risk?: string|string[], horizon?: string }} fields
 * @returns {{ name: string, primary: string[], secondary: string[], risk: string[], horizon: string }}
 */
function defineRole(name, fields = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('defineRole: name must be a non-empty string');
  return {
    name: String(name).trim(),
    primary: parseList(fields.primary),
    secondary: parseList(fields.secondary),
    risk: parseList(fields.risk),
    horizon: fields.horizon ? String(fields.horizon).trim() : 'medium'
  };
}

// ---------------------------------------------------------------------------
// buildHierarchy
// ---------------------------------------------------------------------------

/**
 * Build a hierarchy object from a list of role names looked up in a registry.
 *
 * @param {string} name  — name of this hierarchy/org
 * @param {string[]} roleNames
 * @param {Map<string, object>} roleRegistry  — Map of role name -> role object
 * @returns {{ name: string, roles: object[], levels: Map<string, number>, graph: object }}
 */
function buildHierarchy(name, roleNames, roleRegistry) {
  if (!name) throw new TypeError('buildHierarchy: name is required');
  if (!Array.isArray(roleNames)) throw new TypeError('buildHierarchy: roleNames must be an array');
  if (!(roleRegistry instanceof Map)) throw new TypeError('buildHierarchy: roleRegistry must be a Map');

  const roles = [];
  const levels = new Map();
  const graph = {}; // adjacency list: { roleName: [connectedRoleNames] }

  for (let i = 0; i < roleNames.length; i++) {
    const rname = roleNames[i];
    const role = roleRegistry.get(rname);
    if (!role) throw new Error(`buildHierarchy: role "${rname}" not found in registry`);
    roles.push(role);
    levels.set(rname, i); // level = position in the array (top-down order)
    graph[rname] = [];
  }

  // Connect adjacent levels (parent -> child)
  for (let i = 0; i < roleNames.length - 1; i++) {
    const parent = roleNames[i];
    const child = roleNames[i + 1];
    graph[parent].push(child);
    graph[child].push(parent);
  }

  return { name, roles, levels, graph };
}

// ---------------------------------------------------------------------------
// mapIncentives
// ---------------------------------------------------------------------------

/**
 * Compare two roles and quantify their incentive alignment.
 *
 * @param {object} role1
 * @param {object} role2
 * @param {object} hierarchy  — optional, used for future graph traversal
 * @returns {{ alignment: string[], tension: string[], flow: string, score: number, horizon_gap: string }}
 */
function mapIncentives(role1, role2, _hierarchy) {
  if (!role1 || !role2) throw new TypeError('mapIncentives: two role objects are required');

  const goals1 = [...(role1.primary || []), ...(role1.secondary || [])];
  const goals2 = [...(role2.primary || []), ...(role2.secondary || [])];

  const kw1 = toKeywordSet(goals1);
  const kw2 = toKeywordSet(goals2);

  // Intersection
  const intersection = new Set([...kw1].filter(k => kw2.has(k)));
  // Union
  const union = new Set([...kw1, ...kw2]);

  // Build human-readable alignment / tension from the original goal strings
  const alignmentGoals = [];
  const tensionGoals = [];

  for (const g of goals1) {
    const gkw = toKeywordSet([g]);
    const overlap = [...gkw].filter(k => kw2.has(k));
    if (overlap.length > 0) {
      alignmentGoals.push(g);
    } else if (gkw.size > 0) {
      tensionGoals.push(g);
    }
  }
  for (const g of goals2) {
    const gkw = toKeywordSet([g]);
    const overlap = [...gkw].filter(k => kw1.has(k));
    if (overlap.length === 0 && gkw.size > 0) {
      // Only add if not already present
      if (!tensionGoals.includes(g)) tensionGoals.push(g);
    }
  }

  // Base score
  let score = union.size > 0 ? (intersection.size / union.size) * 100 : 0;

  // Horizon penalty
  const penalty = horizonPenalty(role1.horizon, role2.horizon);
  score = Math.max(0, score - penalty);

  // Round to 1 decimal
  score = Math.round(score * 10) / 10;

  // Flow classification
  let flow;
  if (score > 60) flow = 'aligned';
  else if (score >= 30) flow = 'partial';
  else flow = 'misaligned';

  const horizon_gap = horizonGapLabel(role1.horizon, role2.horizon);

  // Deduplicate
  const alignment = [...new Set(alignmentGoals)];
  const tension = [...new Set(tensionGoals)];

  return { alignment, tension, flow, score, horizon_gap };
}

// ---------------------------------------------------------------------------
// alignRoles
// ---------------------------------------------------------------------------

/**
 * Generate a full alignment matrix across all role pairs.
 *
 * @param {string[]} roleNames
 * @param {object} hierarchy  — returned by buildHierarchy
 * @param {string} [topic]    — optional keyword filter
 * @returns {{ pairs: object[], overall_score: number, strongest_alignment: object|null, biggest_tension: object|null }}
 */
function alignRoles(roleNames, hierarchy, topic) {
  if (!Array.isArray(roleNames)) throw new TypeError('alignRoles: roleNames must be an array');
  if (!hierarchy || !Array.isArray(hierarchy.roles)) throw new TypeError('alignRoles: hierarchy object is required');

  const topicFilter = topic ? String(topic).toLowerCase().trim() : null;

  // Build role lookup from hierarchy
  const roleMap = new Map();
  for (const role of hierarchy.roles) {
    roleMap.set(role.name, role);
  }

  const pairs = [];

  for (let i = 0; i < roleNames.length; i++) {
    for (let j = i + 1; j < roleNames.length; j++) {
      const r1name = roleNames[i];
      const r2name = roleNames[j];
      const r1 = roleMap.get(r1name);
      const r2 = roleMap.get(r2name);
      if (!r1 || !r2) continue;

      const result = mapIncentives(r1, r2, hierarchy);

      // Apply topic filter
      let alignment = result.alignment;
      let tension = result.tension;
      if (topicFilter) {
        alignment = alignment.filter(g => g.toLowerCase().includes(topicFilter));
        tension = tension.filter(g => g.toLowerCase().includes(topicFilter));
      }

      pairs.push({
        role1: r1name,
        role2: r2name,
        score: result.score,
        flow: result.flow,
        alignment,
        tension,
        horizon_gap: result.horizon_gap
      });
    }
  }

  // Aggregate
  const overall_score = pairs.length > 0
    ? Math.round((pairs.reduce((s, p) => s + p.score, 0) / pairs.length) * 10) / 10
    : 0;

  const strongest_alignment = pairs.length > 0
    ? pairs.reduce((best, p) => p.score > best.score ? p : best, pairs[0])
    : null;

  const biggest_tension = pairs.length > 0
    ? pairs.reduce((worst, p) => p.score < worst.score ? p : worst, pairs[0])
    : null;

  return { pairs, overall_score, strongest_alignment, biggest_tension };
}

// ---------------------------------------------------------------------------
// findTensions
// ---------------------------------------------------------------------------

/**
 * Find all misaligned incentive pairs within a hierarchy.
 *
 * @param {object} hierarchy
 * @returns {Array<{ roles: string[], tension_points: string[], severity: "low"|"medium"|"high" }>}
 */
function findTensions(hierarchy) {
  if (!hierarchy || !Array.isArray(hierarchy.roles)) throw new TypeError('findTensions: hierarchy object is required');

  const roles = hierarchy.roles;
  const tensions = [];

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const r1 = roles[i];
      const r2 = roles[j];
      const result = mapIncentives(r1, r2, hierarchy);

      if (result.tension.length === 0 && result.flow === 'aligned') continue;

      // Only report genuine tensions (score below 70 or explicit tension items)
      if (result.score >= 70 && result.tension.length === 0) continue;

      let severity;
      if (result.score < 30) severity = 'high';
      else if (result.score < 60) severity = 'medium';
      else severity = 'low';

      tensions.push({
        roles: [r1.name, r2.name],
        tension_points: result.tension,
        severity
      });
    }
  }

  // Sort: high -> medium -> low
  const sev = { high: 0, medium: 1, low: 2 };
  tensions.sort((a, b) => sev[a.severity] - sev[b.severity]);

  return tensions;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { defineRole, buildHierarchy, mapIncentives, alignRoles, findTensions };
