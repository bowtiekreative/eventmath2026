'use strict';

/**
 * EventMath v2.24 — Defense Runtime
 * System threat detection and quarantine.
 * Behavioral analysis only — no signature database download.
 * Uses ONLY Node.js standard library (no npm).
 *
 * SAFETY RULES:
 *   - NEVER auto-quarantine or auto-inoculate — explicit calls only
 *   - ALWAYS return { ok: false, reason: '...' } instead of throwing
 *   - NEVER scan paths outside the target directory
 *   - Log all actions with [EM:defense] prefix
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_PREFIX = '[EM:defense]';

function _log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function _err(...args) {
  console.error(LOG_PREFIX, '[ERROR]', ...args);
}

// Known-bad name fragments (lowercase)
const KNOWN_BAD_FRAGMENTS = [
  'cryptominer',
  'xmrig',
  'coinminer',
  'mimikatz',
  'kinsing',
  'masscan',
  'zgrab',
];

// Suspicious high-risk ports
const SUSPICIOUS_PORTS = new Set([4444, 1337, 31337, 6666, 9999, 5554, 12345, 8888, 2222]);

// System-critical process names that must never be inoculated
const SYSTEM_CRITICAL_NAMES = new Set([
  'init', 'systemd', 'kernel', 'kthreadd', 'migration',
  'ksoftirqd', 'kworker', 'rcu_sched', 'idle', 'launchd',
  'svchost', 'lsass', 'csrss', 'smss', 'winlogon', 'services',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calculate Shannon entropy of a string (bits per character).
 * Used to detect random-looking names.
 */
function _shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Run a shell command, resolving with stdout or rejecting with error.
 */
function _exec(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 20000, ...opts }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || '');
    });
  });
}

/**
 * Parse `ps aux` output into an array of process objects.
 * Columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
 */
function _parsePsAux(output) {
  const lines = output.split('\n').filter(l => l.trim().length > 0);
  // Skip header line
  if (lines.length > 0 && lines[0].trim().startsWith('USER')) {
    lines.shift();
  }
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      user: parts[0] || '',
      pid: parseInt(parts[1], 10) || 0,
      cpu: parseFloat(parts[2]) || 0,
      mem: parseFloat(parts[3]) || 0,
      // COMMAND may have spaces — rejoin from index 10
      name: parts.slice(10).join(' ') || parts[parts.length - 1] || '',
    };
  });
}

/**
 * Parse Windows `tasklist` CSV output.
 */
function _parseTasklist(output) {
  const lines = output.split('\n').filter(l => l.trim().length > 0);
  if (lines.length > 0 && lines[0].startsWith('"Image Name"')) {
    lines.shift(); // skip header
  }
  return lines.map(line => {
    const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
    return {
      user: parts[6] || 'SYSTEM',
      pid: parseInt(parts[1], 10) || 0,
      cpu: 0,    // tasklist doesn't give CPU%
      mem: 0,
      name: parts[0] || '',
    };
  });
}

/**
 * Evaluate a single process record for suspicious indicators.
 * Returns null if clean, or { reason, risk } if suspicious.
 */
function _evaluateProcess(proc) {
  const nameLower = (proc.name || '').toLowerCase();
  const baseName = path.basename(nameLower.split(' ')[0]); // just the executable name

  // Known-bad fragment check
  for (const frag of KNOWN_BAD_FRAGMENTS) {
    if (nameLower.includes(frag)) {
      return { reason: `Name contains known-bad fragment: "${frag}"`, risk: 'high' };
    }
  }

  // Running from /tmp or temp directories
  const tmpPatterns = ['/tmp/', '/var/tmp/', '/dev/shm/', '\\temp\\', '\\tmp\\'];
  for (const tp of tmpPatterns) {
    if (nameLower.includes(tp)) {
      return { reason: `Process running from temp directory: ${tp}`, risk: 'high' };
    }
  }

  // Root/SYSTEM with unusual name heuristic
  const isPrivileged = proc.user === 'root' || proc.user.toUpperCase() === 'SYSTEM';
  if (isPrivileged && baseName.length > 0) {
    // Short random-looking names for privileged processes are suspicious
    const entropy = _shannonEntropy(baseName);
    if (entropy > 3.8 && baseName.length >= 6 && baseName.length <= 16) {
      return { reason: `Privileged process with high-entropy name (entropy=${entropy.toFixed(2)}): ${baseName}`, risk: 'high' };
    }
  }

  // Very high CPU with unknown/random-looking name
  if (proc.cpu > 90) {
    const entropy = _shannonEntropy(baseName);
    if (entropy > 3.5) {
      return { reason: `Very high CPU (${proc.cpu}%) with random-looking name (entropy=${entropy.toFixed(2)})`, risk: 'medium' };
    }
    // Even without high entropy, extreme CPU is worth flagging
    return { reason: `Very high CPU usage (${proc.cpu}%)`, risk: 'low' };
  }

  // Random-looking name (high entropy) for any process
  const entropy = _shannonEntropy(baseName);
  if (entropy > 4.2 && baseName.length >= 8) {
    return { reason: `Process name has unusually high entropy (${entropy.toFixed(2)}), may be random: ${baseName}`, risk: 'medium' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// sweepProcesses(options)
// ---------------------------------------------------------------------------
async function sweepProcesses(options = {}) {
  const { checkNetworkConnections: _checkNet = false } = options;
  const scannedAt = new Date().toISOString();
  _log(`Starting process sweep at ${scannedAt}`);

  let procs = [];

  try {
    const platform = os.platform();
    if (platform === 'win32') {
      const out = await _exec('tasklist /NH /FO CSV /V');
      procs = _parseTasklist(out);
    } else {
      const out = await _exec('ps aux');
      procs = _parsePsAux(out);
    }
  } catch (err) {
    _err('Failed to enumerate processes:', err.message);
    return {
      scannedAt,
      processCount: 0,
      suspicious: [],
      clean: 0,
      threat_count: 0,
      ok: false,
      reason: `Failed to list processes: ${err.message}`,
    };
  }

  const suspicious = [];
  let clean = 0;

  for (const proc of procs) {
    if (!proc.pid) continue;
    const verdict = _evaluateProcess(proc);
    if (verdict) {
      suspicious.push({
        pid: proc.pid,
        name: proc.name,
        user: proc.user,
        cpu: proc.cpu,
        mem: proc.mem,
        reason: verdict.reason,
        risk: verdict.risk,
      });
    } else {
      clean++;
    }
  }

  _log(`Process sweep complete: ${procs.length} scanned, ${suspicious.length} suspicious, ${clean} clean`);

  return {
    scannedAt,
    processCount: procs.length,
    suspicious,
    clean,
    threat_count: suspicious.length,
  };
}

// ---------------------------------------------------------------------------
// sweepFiles(dirPath, options)
// ---------------------------------------------------------------------------
async function sweepFiles(dirPath, options = {}) {
  const { recursive = false, checkHidden = true } = options;
  const scannedAt = new Date().toISOString();
  _log(`Starting file sweep of '${dirPath}' (recursive=${recursive}) at ${scannedAt}`);

  // Resolve and canonicalize the target directory
  let resolvedDir;
  try {
    resolvedDir = fs.realpathSync(dirPath);
  } catch (e) {
    _err(`Cannot resolve dirPath '${dirPath}':`, e.message);
    return {
      scannedAt,
      dirPath,
      fileCount: 0,
      suspicious: [],
      clean: 0,
      threat_count: 0,
      ok: false,
      reason: `Cannot resolve directory: ${e.message}`,
    };
  }

  const suspicious = [];
  let fileCount = 0;
  let clean = 0;

  /**
   * Collect all files to scan. Returns array of absolute paths.
   * Enforces that all paths remain inside resolvedDir.
   */
  function collectFiles(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      _err(`Cannot read directory '${dir}':`, e.message);
      return [];
    }

    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Safety: ensure we stay inside the target directory
      const realFull = (() => { try { return fs.realpathSync(fullPath); } catch { return fullPath; } })();
      if (!realFull.startsWith(resolvedDir)) {
        _log(`Skipping '${fullPath}' — outside target directory (symlink escape?)`);
        continue;
      }

      // Skip hidden files if not requested
      if (!checkHidden && entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        if (recursive) {
          files.push(...collectFiles(fullPath));
        }
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = collectFiles(resolvedDir);

  for (const filePath of allFiles) {
    fileCount++;
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      // Can't stat — skip
      continue;
    }

    const verdict = _evaluateFile(filePath, stat);
    if (verdict) {
      suspicious.push({
        path: filePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        permissions: (stat.mode >>> 0).toString(8),
        reason: verdict.reason,
        risk: verdict.risk,
      });
    } else {
      clean++;
    }
  }

  _log(`File sweep complete: ${fileCount} files, ${suspicious.length} suspicious, ${clean} clean`);

  return {
    scannedAt,
    dirPath: resolvedDir,
    fileCount,
    suspicious,
    clean,
    threat_count: suspicious.length,
  };
}

/**
 * Evaluate a single file. Returns null if clean, or { reason, risk } if suspicious.
 */
function _evaluateFile(filePath, stat) {
  const name = path.basename(filePath);
  const nameLower = name.toLowerCase();
  const mode = stat.mode;

  // World-writable executable
  const isExecutable = !!(mode & 0o111);
  const isWorldWritable = !!(mode & 0o002);
  if (isExecutable && isWorldWritable) {
    return { reason: 'World-writable executable file', risk: 'high' };
  }

  // Executable in /tmp or /var/tmp
  const absLower = filePath.toLowerCase();
  const inTempDir = absLower.includes('/tmp/') || absLower.includes('/var/tmp/') ||
                    absLower.includes('\\temp\\') || absLower.includes('\\tmp\\');
  if (isExecutable && inTempDir) {
    return { reason: `Executable file in temp directory: ${path.dirname(filePath)}`, risk: 'high' };
  }

  // Double extension (e.g., .pdf.exe, .doc.sh, .txt.py)
  const dangerousExts = new Set(['.exe', '.sh', '.bat', '.cmd', '.ps1', '.py', '.rb', '.pl', '.php', '.js']);
  const parts = nameLower.split('.');
  if (parts.length >= 3) {
    const lastExt = '.' + parts[parts.length - 1];
    const secondExt = '.' + parts[parts.length - 2];
    const docExts = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.png', '.gif']);
    if (dangerousExts.has(lastExt) && docExts.has(secondExt)) {
      return { reason: `Double extension detected: ...${secondExt}${lastExt}`, risk: 'high' };
    }
  }

  // Hidden file with executable bit
  if (name.startsWith('.') && isExecutable) {
    return { reason: 'Hidden file with executable permission', risk: 'medium' };
  }

  // High-entropy filename (random-looking)
  // Strip extension for entropy check
  const nameBase = parts[0];
  if (nameBase.length >= 8) {
    const entropy = _shannonEntropy(nameBase);
    if (entropy > 4.2) {
      return { reason: `File name has high entropy (${entropy.toFixed(2)}), may be randomly generated: ${name}`, risk: 'low' };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// checkNetworkConnections(options)
// ---------------------------------------------------------------------------
async function checkNetworkConnections(options = {}) {
  _log('Checking network connections...');

  let rawOutput = '';
  const platform = os.platform();

  try {
    if (platform === 'win32') {
      rawOutput = await _exec('netstat -ano');
    } else if (platform === 'darwin') {
      rawOutput = await _exec('netstat -anv -p tcp');
    } else {
      // Linux — try ss first, fall back to netstat
      try {
        rawOutput = await _exec('ss -tunap');
      } catch {
        rawOutput = await _exec('netstat -tunap 2>/dev/null || netstat -tuna 2>/dev/null');
      }
    }
  } catch (err) {
    _err('Failed to get network connections:', err.message);
    return {
      connections: [],
      suspicious: [],
      ok: false,
      reason: `Failed to enumerate connections: ${err.message}`,
    };
  }

  const connections = _parseNetworkOutput(rawOutput, platform);
  const suspicious = [];

  for (const conn of connections) {
    const verdict = _evaluateConnection(conn);
    if (verdict) {
      suspicious.push({ connection: conn, reason: verdict.reason, risk: verdict.risk });
    }
  }

  _log(`Network check complete: ${connections.length} connections, ${suspicious.length} suspicious`);

  return { connections, suspicious };
}

/**
 * Parse network command output into connection objects.
 */
function _parseNetworkOutput(output, platform) {
  const lines = output.split('\n').filter(l => l.trim().length > 0);
  const connections = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip header lines
    if (trimmed.startsWith('Proto') || trimmed.startsWith('Netid') ||
        trimmed.startsWith('Active') || trimmed.startsWith('tcp') === false &&
        trimmed.startsWith('udp') === false && !trimmed.match(/^\d/)) {
      // Allow lines starting with tcp/udp; skip others unless they look like data
      if (!/^(tcp|udp|TCP|UDP)/i.test(trimmed)) continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

    let protocol, localAddress, remoteAddress, state, pid;

    if (platform === 'win32') {
      // Proto  Local Address  Foreign Address  State  PID
      protocol = parts[0];
      localAddress = parts[1];
      remoteAddress = parts[2];
      state = parts[3];
      pid = parts[4] ? parseInt(parts[4], 10) : null;
    } else {
      // ss/netstat: varies, but generally: Proto RecvQ SendQ Local Foreign State [PID/name]
      protocol = parts[0];
      // Find local and remote addresses — they contain ':'
      const addrParts = parts.filter(p => p.includes(':') || p.includes('.'));
      localAddress = addrParts[0] || '';
      remoteAddress = addrParts[1] || '';
      // State is typically after the addresses
      const stateIdx = parts.findIndex(p => /^(ESTABLISHED|LISTEN|TIME_WAIT|CLOSE_WAIT|SYN_SENT|UNCONN|ESTAB)$/i.test(p));
      state = stateIdx !== -1 ? parts[stateIdx] : '';
      // PID/program — look for "pid=NNN" or "NNN/name" pattern
      const pidPart = parts.find(p => /pid=\d+/i.test(p) || /^\d+\//.test(p));
      if (pidPart) {
        const m = pidPart.match(/pid=(\d+)/i) || pidPart.match(/^(\d+)\//);
        pid = m ? parseInt(m[1], 10) : null;
      } else {
        pid = null;
      }
    }

    if (localAddress || remoteAddress) {
      connections.push({ protocol, localAddress, remoteAddress, state: state || '', pid: pid || null });
    }
  }

  return connections;
}

/**
 * Evaluate a connection for suspicious indicators.
 */
function _evaluateConnection(conn) {
  const remote = conn.remoteAddress || '';

  // Extract remote port
  const portMatch = remote.match(/:(\d+)$/) || remote.match(/\.(\d+)$/);
  if (portMatch) {
    const port = parseInt(portMatch[1], 10);
    if (SUSPICIOUS_PORTS.has(port)) {
      return {
        reason: `Connection to suspicious port ${port} (${conn.remoteAddress})`,
        risk: 'high',
      };
    }
  }

  // Extract local port
  const local = conn.localAddress || '';
  const localPortMatch = local.match(/:(\d+)$/) || local.match(/\.(\d+)$/);
  if (localPortMatch) {
    const localPort = parseInt(localPortMatch[1], 10);
    if (SUSPICIOUS_PORTS.has(localPort)) {
      return {
        reason: `Listening on suspicious port ${localPort}`,
        risk: 'medium',
      };
    }
  }

  // Connections to private ranges that are ESTABLISHED (lateral movement heuristic)
  // Flag RFC1918 connections that are ESTABLISHED and not on standard ports
  if (/ESTAB/i.test(conn.state) || /ESTABLISHED/i.test(conn.state)) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
    ];
    for (const re of privateRanges) {
      if (re.test(remote)) {
        // Only flag if on an unusual port
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          // Standard ports to ignore
          const standardPorts = new Set([22, 80, 443, 3306, 5432, 6379, 8080, 8443, 9200, 27017]);
          if (!standardPorts.has(port) && port > 1024) {
            return {
              reason: `Established connection to private IP on non-standard port ${port}: ${remote}`,
              risk: 'low',
            };
          }
        }
        break;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// quarantineFile(filePath, quarantineDir)
// ---------------------------------------------------------------------------
async function quarantineFile(filePath, quarantineDir) {
  const defaultDir = path.join(os.homedir(), '.eventmath', 'quarantine');
  const qDir = quarantineDir || defaultDir;
  const timestamp = new Date().toISOString();

  _log(`Quarantine requested: '${filePath}' -> '${qDir}'`);

  // Validate source file exists
  if (!fs.existsSync(filePath)) {
    _err(`Source file not found: ${filePath}`);
    return { original: filePath, quarantined: null, timestamp, ok: false, reason: 'Source file not found' };
  }

  // Create quarantine directory
  try {
    fs.mkdirSync(qDir, { recursive: true });
  } catch (e) {
    _err(`Cannot create quarantine directory '${qDir}':`, e.message);
    return { original: filePath, quarantined: null, timestamp, ok: false, reason: `Cannot create quarantine dir: ${e.message}` };
  }

  // Build destination path, avoid collisions with timestamp prefix
  const baseName = path.basename(filePath);
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  const destName = `${safeTimestamp}_${baseName}`;
  const destPath = path.join(qDir, destName);

  try {
    fs.renameSync(filePath, destPath);
  } catch (moveErr) {
    // rename may fail across devices — try copy + delete
    try {
      fs.copyFileSync(filePath, destPath);
      fs.unlinkSync(filePath);
    } catch (copyErr) {
      _err(`Failed to move file to quarantine:`, copyErr.message);
      return { original: filePath, quarantined: null, timestamp, ok: false, reason: `Move failed: ${copyErr.message}` };
    }
  }

  _log(`File quarantined: '${filePath}' -> '${destPath}'`);

  // Update manifest
  const manifestPath = path.join(qDir, 'quarantine.json');
  let manifest = [];
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(raw);
    }
  } catch (e) {
    _err('Could not read existing manifest, starting fresh:', e.message);
    manifest = [];
  }

  manifest.push({ original: filePath, quarantined: destPath, timestamp });

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (e) {
    _err('Could not write manifest:', e.message);
    // Non-fatal — file was already moved
  }

  return { original: filePath, quarantined: destPath, timestamp, ok: true };
}

// ---------------------------------------------------------------------------
// inoculateProcess(pid)
// ---------------------------------------------------------------------------
async function inoculateProcess(pid) {
  _log(`Inoculation requested for PID ${pid}`);

  // Never terminate PID 1 or 0
  if (!pid || pid <= 1) {
    _log(`SKIPPED: PID ${pid} is a system-critical process (PID <=1)`);
    return { pid, action: 'skipped', reason: 'PID 1 and below are system-critical and cannot be terminated' };
  }

  // Check if this process is a known system-critical process by name
  let procName = '';
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      const out = await _exec(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`);
      const parts = out.split(',');
      procName = parts[0] ? parts[0].replace(/"/g, '').trim().toLowerCase() : '';
    } else {
      const out = await _exec(`ps -p ${pid} -o comm= 2>/dev/null`);
      procName = out.trim().toLowerCase();
    }
  } catch (e) {
    // Couldn't determine name — proceed with caution
    _err(`Could not determine process name for PID ${pid}:`, e.message);
  }

  if (procName && SYSTEM_CRITICAL_NAMES.has(procName)) {
    _log(`SKIPPED: PID ${pid} (${procName}) is a system-critical process`);
    return { pid, action: 'skipped', reason: `Process '${procName}' is system-critical and cannot be terminated` };
  }

  // Attempt termination
  const platform = os.platform();
  const cmd = platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill -TERM ${pid}`;

  try {
    await _exec(cmd);
    _log(`Terminated PID ${pid} (${procName || 'unknown'})`);
    return { pid, action: 'terminated', reason: `Process${procName ? ` '${procName}'` : ''} terminated with SIGTERM` };
  } catch (err) {
    _err(`Failed to terminate PID ${pid}:`, err.message);
    return { pid, action: 'skipped', reason: `Termination failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// sweepSystem()
// ---------------------------------------------------------------------------
async function sweepSystem() {
  _log('Running full system sweep (processes + network)...');

  const [processes, network] = await Promise.all([
    sweepProcesses({ checkNetworkConnections: false }),
    checkNetworkConnections({}),
  ]);

  // Determine overall risk level
  const highRiskProc = processes.suspicious
    ? processes.suspicious.some(s => s.risk === 'high')
    : false;
  const highRiskNet = network.suspicious
    ? network.suspicious.some(s => s.risk === 'high')
    : false;
  const medRiskProc = processes.suspicious
    ? processes.suspicious.some(s => s.risk === 'medium')
    : false;
  const medRiskNet = network.suspicious
    ? network.suspicious.some(s => s.risk === 'medium')
    : false;

  let risk_level;
  if (highRiskProc || highRiskNet) {
    risk_level = 'high';
  } else if (medRiskProc || medRiskNet) {
    risk_level = 'medium';
  } else {
    risk_level = 'low';
  }

  const procThreatCount = processes.threat_count || 0;
  const netThreatCount = network.suspicious ? network.suspicious.length : 0;

  const summary =
    `System sweep complete. ` +
    `Processes: ${processes.processCount || 0} scanned, ${procThreatCount} suspicious. ` +
    `Network: ${network.connections ? network.connections.length : 0} connections, ${netThreatCount} suspicious. ` +
    `Overall risk level: ${risk_level.toUpperCase()}.`;

  _log(summary);

  return { processes, network, summary, risk_level };
}

module.exports = {
  sweepProcesses,
  sweepFiles,
  checkNetworkConnections,
  quarantineFile,
  inoculateProcess,
  sweepSystem,
};
