'use strict';

/**
 * EventMath v2.24 — Watchdog Runtime
 * Process and endpoint monitoring with auto-recovery.
 * Uses ONLY Node.js standard library (no npm).
 */

const { exec } = require('child_process');
const http = require('http');
const https = require('https');
const os = require('os');

// Module-level registry of all active watchers
const _watchers = new Map();
let _watcherIdCounter = 0;

const LOG_PREFIX = '[EM:watchdog]';

function _log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function _err(...args) {
  console.error(LOG_PREFIX, '[ERROR]', ...args);
}

// ---------------------------------------------------------------------------
// checkProcess(processName)
// Returns Promise<{ name, running: boolean, pid: number|null, uptime: string|null }>
// ---------------------------------------------------------------------------
function checkProcess(processName) {
  return new Promise((resolve) => {
    const platform = os.platform();
    let cmd;

    if (platform === 'win32') {
      cmd = `tasklist /FI "IMAGENAME eq ${processName}*" /NH /FO CSV`;
    } else {
      // Linux / macOS
      cmd = `ps aux | grep ${processName} | grep -v grep`;
    }

    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      const output = (stdout || '').trim();

      if (platform === 'win32') {
        // tasklist returns the header even when no match; a match contains the name
        const lines = output.split('\n').filter(l => l.trim().length > 0);
        const matched = lines.find(l => l.toLowerCase().includes(processName.toLowerCase()));
        if (!matched) {
          return resolve({ name: processName, running: false, pid: null, uptime: null });
        }
        // CSV fields: "Image Name","PID","Session Name","Session#","Mem Usage"
        const parts = matched.split(',').map(p => p.replace(/"/g, '').trim());
        const pid = parts[1] ? parseInt(parts[1], 10) : null;
        return resolve({ name: processName, running: true, pid: isNaN(pid) ? null : pid, uptime: null });
      } else {
        if (error || !output) {
          return resolve({ name: processName, running: false, pid: null, uptime: null });
        }

        // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        const lines = output.split('\n').filter(l => l.trim().length > 0);
        if (lines.length === 0) {
          return resolve({ name: processName, running: false, pid: null, uptime: null });
        }

        const firstLine = lines[0];
        const parts = firstLine.trim().split(/\s+/);
        const pid = parts[1] ? parseInt(parts[1], 10) : null;
        // START is index 8, TIME (cpu time) is index 9
        const startTime = parts[8] || null;
        const cpuTime = parts[9] || null;
        const uptime = startTime ? `started=${startTime} cpu=${cpuTime}` : null;

        return resolve({
          name: processName,
          running: true,
          pid: isNaN(pid) ? null : pid,
          uptime,
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// checkEndpoint(url, timeoutMs)
// Returns Promise<{ url, ok: boolean, statusCode: number|null, latencyMs: number, error: string|null }>
// ---------------------------------------------------------------------------
function checkEndpoint(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let parsed;

    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve({ url, ok: false, statusCode: null, latencyMs: 0, error: `Invalid URL: ${e.message}` });
    }

    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'HEAD',
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'EventMath-Watchdog/2.24',
      },
    };

    const req = lib.request(options, (res) => {
      const latencyMs = Date.now() - start;
      // Drain response body so socket can be reused
      res.resume();
      resolve({
        url,
        ok: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode,
        latencyMs,
        error: null,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        ok: false,
        statusCode: null,
        latencyMs: Date.now() - start,
        error: `Request timed out after ${timeoutMs}ms`,
      });
    });

    req.on('error', (e) => {
      resolve({
        url,
        ok: false,
        statusCode: null,
        latencyMs: Date.now() - start,
        error: e.message,
      });
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// restartProcess(processName)
// Returns Promise<{ name, action: 'restart', result: string }>
// ---------------------------------------------------------------------------
function restartProcess(processName) {
  return new Promise((resolve) => {
    _log(`Attempting to restart process: ${processName}`);
    _log(`WARNING: Restarting system services may require elevated permissions (root/sudo/Administrator).`);

    const platform = os.platform();
    let cmd;

    if (platform === 'win32') {
      cmd = `net start "${processName}"`;
    } else if (platform === 'darwin') {
      // Try launchctl first, then systemctl as fallback
      cmd = `launchctl kickstart -k system/${processName} 2>/dev/null || systemctl restart ${processName} 2>/dev/null || true`;
    } else {
      // Linux
      cmd = `systemctl restart ${processName}`;
    }

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      const result = error
        ? `Failed: ${stderr || error.message}`
        : `Success: ${stdout.trim() || 'restart command executed'}`;

      _log(`Restart result for '${processName}': ${result}`);
      resolve({ name: processName, action: 'restart', result });
    });
  });
}

// ---------------------------------------------------------------------------
// watchProcess(processName, intervalMinutes, onDown, onRecover)
// ---------------------------------------------------------------------------
function watchProcess(processName, intervalMinutes, onDown, onRecover) {
  const id = ++_watcherIdCounter;
  const intervalMs = intervalMinutes * 60 * 1000;
  let lastStatus = null;
  const watcherMeta = {
    id,
    type: 'process',
    name: processName,
    status: 'monitoring',
    lastCheck: null,
  };

  _log(`Starting process watcher for '${processName}' every ${intervalMinutes}m (id=${id})`);

  const tick = async () => {
    watcherMeta.lastCheck = new Date().toISOString();
    try {
      const result = await checkProcess(processName);
      const isRunning = result.running;

      if (!isRunning && lastStatus !== 'down') {
        lastStatus = 'down';
        watcherMeta.status = 'down';
        _log(`Process '${processName}' is DOWN`);
        try {
          await onDown({ name: processName, result });
        } catch (cbErr) {
          _err(`onDown callback threw for '${processName}':`, cbErr.message);
        }
      } else if (isRunning && lastStatus === 'down') {
        lastStatus = 'up';
        watcherMeta.status = 'monitoring';
        _log(`Process '${processName}' has RECOVERED (pid=${result.pid})`);
        try {
          await onRecover({ name: processName, result });
        } catch (cbErr) {
          _err(`onRecover callback threw for '${processName}':`, cbErr.message);
        }
      } else {
        lastStatus = isRunning ? 'up' : 'down';
      }
    } catch (err) {
      _err(`Error checking process '${processName}':`, err.message);
    }
  };

  // Run immediately then on interval
  tick();
  const handle = setInterval(tick, intervalMs);
  watcherMeta.handle = handle;

  _watchers.set(id, watcherMeta);

  return { handle, name: processName, status: 'monitoring' };
}

// ---------------------------------------------------------------------------
// watchEndpoint(url, intervalSeconds, onDown, onRecover)
// ---------------------------------------------------------------------------
function watchEndpoint(url, intervalSeconds, onDown, onRecover) {
  const id = ++_watcherIdCounter;
  const intervalMs = intervalSeconds * 1000;
  let lastStatus = null;
  const watcherMeta = {
    id,
    type: 'endpoint',
    name: url,
    status: 'monitoring',
    lastCheck: null,
  };

  _log(`Starting endpoint watcher for '${url}' every ${intervalSeconds}s (id=${id})`);

  const tick = async () => {
    watcherMeta.lastCheck = new Date().toISOString();
    try {
      const result = await checkEndpoint(url, Math.min(intervalMs * 0.8, 10000));

      if (!result.ok && lastStatus !== 'down') {
        lastStatus = 'down';
        watcherMeta.status = 'down';
        _log(`Endpoint '${url}' is DOWN — statusCode=${result.statusCode}, error=${result.error}`);
        try {
          await onDown({ url, statusCode: result.statusCode, error: result.error });
        } catch (cbErr) {
          _err(`onDown callback threw for '${url}':`, cbErr.message);
        }
      } else if (result.ok && lastStatus === 'down') {
        lastStatus = 'up';
        watcherMeta.status = 'monitoring';
        _log(`Endpoint '${url}' has RECOVERED — statusCode=${result.statusCode}, latency=${result.latencyMs}ms`);
        try {
          await onRecover({ url, statusCode: result.statusCode, latencyMs: result.latencyMs });
        } catch (cbErr) {
          _err(`onRecover callback threw for '${url}':`, cbErr.message);
        }
      } else {
        lastStatus = result.ok ? 'up' : 'down';
      }
    } catch (err) {
      _err(`Error checking endpoint '${url}':`, err.message);
    }
  };

  tick();
  const handle = setInterval(tick, intervalMs);
  watcherMeta.handle = handle;

  _watchers.set(id, watcherMeta);

  return { handle, url, status: 'monitoring' };
}

// ---------------------------------------------------------------------------
// stopWatcher(handle)
// ---------------------------------------------------------------------------
function stopWatcher(handle) {
  clearInterval(handle);

  // Remove from registry by matching handle reference
  for (const [id, meta] of _watchers.entries()) {
    if (meta.handle === handle) {
      _log(`Stopped watcher id=${id} (${meta.type}: ${meta.name})`);
      _watchers.delete(id);
      break;
    }
  }

  return { stopped: true };
}

// ---------------------------------------------------------------------------
// watcherStatus()
// ---------------------------------------------------------------------------
function watcherStatus() {
  const watchers = [];
  for (const meta of _watchers.values()) {
    watchers.push({
      type: meta.type,
      name: meta.name,
      status: meta.status,
      lastCheck: meta.lastCheck,
    });
  }
  return {
    activeCount: _watchers.size,
    watchers,
  };
}

module.exports = {
  watchProcess,
  watchEndpoint,
  checkProcess,
  checkEndpoint,
  restartProcess,
  stopWatcher,
  watcherStatus,
};
