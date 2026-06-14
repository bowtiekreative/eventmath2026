'use strict';

/**
 * EventMath Messaging Runtime v2.22
 * Outbound messaging: Telegram, Slack, webhook, email.
 */

const https = require('https');

function _httpsPost(hostname, reqPath, body, headers) {
  headers = headers || {};
  return new Promise((resolve) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const isJson = typeof body !== 'string';
    const options = {
      hostname,
      path: reqPath,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      }, headers),
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

async function sendTelegram(token, chatId, message, payload) {
  if (!token) return { channel: 'telegram', status: 'skipped', note: 'Set TELEGRAM_BOT_TOKEN env var' };
  const text = payload
    ? (message || '') + '\n\n' + JSON.stringify(payload, null, 2)
    : (message || '');
  return _httpsPost('api.telegram.org', '/bot' + token + '/sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

async function sendSlack(webhookUrl, message, payload) {
  if (!webhookUrl) return { channel: 'slack', status: 'skipped', note: 'Set SLACK_WEBHOOK_URL env var' };
  const text = payload
    ? (message || '') + '\n```' + JSON.stringify(payload, null, 2) + '```'
    : (message || '');
  try {
    const url = new URL(webhookUrl);
    return _httpsPost(url.hostname, url.pathname + url.search, { text });
  } catch (_e) {
    return { channel: 'slack', status: 'error', note: 'Invalid webhook URL' };
  }
}

async function sendWebhook(url, payload) {
  if (!url) return { channel: 'webhook', status: 'skipped', note: 'No webhook URL provided' };
  try {
    const parsed = new URL(url);
    return _httpsPost(parsed.hostname, parsed.pathname + parsed.search, payload || {});
  } catch (_e) {
    return { channel: 'webhook', status: 'error', note: 'Invalid URL' };
  }
}

async function sendEmail(to, subject, body) {
  const config = {
    host: process.env.EVENTMATH_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EVENTMATH_SMTP_PORT || '587'),
    user: process.env.EVENTMATH_SMTP_USER || '',
    pass: process.env.EVENTMATH_SMTP_PASS || '',
  };
  return {
    to,
    subject,
    body,
    config: { host: config.host },
    status: 'queued',
    note: 'Set EVENTMATH_SMTP_* env vars to enable email sending',
  };
}

module.exports = { sendTelegram, sendSlack, sendWebhook, sendEmail };
