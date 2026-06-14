'use strict';

/**
 * EventMath Agent Runtime v2.22
 * Persistent cross-run memory (JSON store) and multi-channel alerting.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const MEMORY_DIR = path.join(os.homedir(), '.eventmath');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.json');

function _ensureMemoryFile() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({}), 'utf8');
  }
}

async function rememberValue(key, value) {
  _ensureMemoryFile();
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch (_e) {}
  data[key] = { value, savedAt: new Date().toISOString() };
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
  return { key, savedAt: data[key].savedAt };
}

async function recallValue(key) {
  _ensureMemoryFile();
  try {
    const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    return data[key] ? data[key].value : null;
  } catch (_e) {
    return null;
  }
}

async function sendAlert(channel, recipient, message, payload) {
  const text = [message, payload ? JSON.stringify(payload) : null].filter(Boolean).join('\n\n');

  if (channel === 'telegram') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { channel, recipient, status: 'skipped', note: 'Set TELEGRAM_BOT_TOKEN env var' };
    return _httpsPost('api.telegram.org', '/bot' + token + '/sendMessage', {
      chat_id: recipient,
      text: text || '(no message)',
      parse_mode: 'Markdown',
    });
  }

  if (channel === 'slack') {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || recipient;
    if (!webhookUrl) return { channel, recipient, status: 'skipped', note: 'Set SLACK_WEBHOOK_URL env var' };
    try {
      const url = new URL(webhookUrl);
      return _httpsPost(url.hostname, url.pathname + url.search, { text: text || '(no message)' });
    } catch (_e) {
      return { channel, recipient, status: 'error', note: 'Invalid Slack webhook URL' };
    }
  }

  if (channel === 'webhook') {
    if (!recipient) return { channel, status: 'skipped', note: 'No webhook URL provided' };
    try {
      const url = new URL(recipient);
      return _httpsPost(url.hostname, url.pathname + url.search, payload || { message: text });
    } catch (_e) {
      return { channel, recipient, status: 'error', note: 'Invalid webhook URL' };
    }
  }

  // Default: log to console
  console.log('[ALERT] channel=' + channel + ' recipient=' + recipient);
  if (text) console.log(text);
  return { channel, recipient, status: 'logged', message: text };
}

function createAgentLoop(name, intervalMinutes, fn) {
  const ms = (intervalMinutes || 5) * 60 * 1000;
  const interval = setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      console.error('[Agent:' + name + '] Error:', err.message);
    }
  }, ms);
  // Run once immediately
  fn().catch(err => console.error('[Agent:' + name + '] Initial run error:', err.message));
  return { name, intervalMinutes, intervalId: interval };
}

function _httpsPost(hostname, reqPath, body) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname,
      path: reqPath,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (_e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(bodyStr);
    req.end();
  });
}

module.exports = { rememberValue, recallValue, sendAlert, createAgentLoop };
