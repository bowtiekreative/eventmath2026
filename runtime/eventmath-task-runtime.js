'use strict';

/**
 * EventMath Task Runtime v2.26
 * Agent instruction parsing, task queuing, and task state management.
 * Uses ONLY Node.js standard library (no npm).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TASKS_DIR = path.join(os.homedir(), '.eventmath');
const TASKS_FILE = path.join(TASKS_DIR, 'tasks.json');

function _ensureTasksFile() {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([]), 'utf8');
  }
}

function _readTasks() {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  } catch (_e) {
    return [];
  }
}

function _writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function _uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

// sweepSystem — internal stub called by instructAgent on scan/sweep commands
async function sweepSystem() {
  return { action: 'sweep', status: 'queued' };
}

// _parseCommand — pattern-match a natural language command string to an EventMath action
async function _parseCommand(command) {
  const cmd = (command || '').toLowerCase();

  if (/scan|sweep/.test(cmd)) {
    return await sweepSystem();
  }

  if (/alert|notify|send/.test(cmd)) {
    return { action: 'alert', channel: 'default', status: 'queued' };
  }

  if (/buy|purchase|order/.test(cmd)) {
    const tickerMatch = command.match(/\b([A-Z]{1,5})\b/);
    const qtyMatch = command.match(/(\d+(?:\.\d+)?)\s*(?:shares?|units?|contracts?)?/i);
    const ticker = tickerMatch ? tickerMatch[1] : null;
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : null;
    return { action: 'trade', direction: 'buy', ticker, quantity, status: 'queued' };
  }

  if (/\bsell\b/.test(cmd)) {
    const tickerMatch = command.match(/\b([A-Z]{1,5})\b/);
    const qtyMatch = command.match(/(\d+(?:\.\d+)?)\s*(?:shares?|units?|contracts?)?/i);
    const ticker = tickerMatch ? tickerMatch[1] : null;
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : null;
    return { action: 'trade', direction: 'sell', ticker, quantity, status: 'queued' };
  }

  if (/analyze|analysis|fundamental/.test(cmd)) {
    return { action: 'analyze', status: 'queued' };
  }

  if (/monitor|watch|watchdog/.test(cmd)) {
    return { action: 'monitor', status: 'queued' };
  }

  return { action: 'unknown', command, status: 'queued' };
}

// instructAgent — parse a natural language command and return a queued task envelope
async function instructAgent(agentName, command, context = {}) {
  const parsed = await _parseCommand(command);
  return {
    taskId: _uuid(),
    agentName,
    command,
    parsed,
    context,
    timestamp: Date.now(),
    status: 'queued',
  };
}

// queueTask — append a pending task to ~/.eventmath/tasks.json for the given agent
function queueTask(agentName, taskDescription) {
  _ensureTasksFile();
  const tasks = _readTasks();
  const entry = {
    id: _uuid(),
    agentName,
    task: taskDescription,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  tasks.push(entry);
  _writeTasks(tasks);
  return entry;
}

// taskStatus — read tasks from disk and filter by agent name (null returns all)
function taskStatus(agentName) {
  _ensureTasksFile();
  const tasks = _readTasks();
  if (agentName === null || agentName === undefined) {
    return tasks;
  }
  return tasks.filter(t => t.agentName === agentName);
}

// clearTasks — remove completed tasks for the given agent from the persisted task list
function clearTasks(agentName) {
  _ensureTasksFile();
  const tasks = _readTasks();
  const remaining = tasks.filter(t => {
    if (t.agentName !== agentName) return true;
    return t.status !== 'completed' && t.status !== 'done';
  });
  _writeTasks(remaining);
  return { agentName, removed: tasks.length - remaining.length, remaining: remaining.length };
}

module.exports = { instructAgent, queueTask, taskStatus, clearTasks };
