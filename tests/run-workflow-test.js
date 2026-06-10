/**
 * Workflow Automation isolated test (runs in child process with timeout).
 * Reports module structure without executing the infinite loop fully.
 */
const EM = require('../runtime/eventmath-runtime.js');
const mod = require('./workflow-automation.em.js');

const keys = Object.keys(mod);
const events = keys.filter(k => mod[k] instanceof EM.EventMathEvent);
const layers = keys.filter(k => mod[k] instanceof EM.EventMathLayer);
const fns = keys.filter(k => typeof mod[k] === 'function');
const timelines = keys.filter(k => mod[k] instanceof EM.EventMathTimeline);

console.log(JSON.stringify({
  events: events.length,
  layers: layers.map(function(k) { return { name: mod[k].name, count: mod[k].events.length }; }),
  fns: fns,
  timelines: timelines.map(function(k) { return mod[k].name; }),
}));