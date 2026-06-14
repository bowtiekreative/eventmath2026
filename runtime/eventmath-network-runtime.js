'use strict';

/**
 * EventMath Network Runtime v2.26
 * Wi-Fi discovery, connection management, connectivity checking, and data caching.
 * Uses ONLY Node.js standard library (no npm).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_DIR = path.join(os.homedir(), '.eventmath', 'cache');
const AIRPORT_BIN = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
const EXEC_OPTS_5S = { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] };
const EXEC_OPTS_10S = { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] };

function _platform() {
  return process.platform;
}

function _safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// _ensureCacheDir — create the cache directory if it does not already exist
function _ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// _parseAirportOutput — convert macOS airport -s output into network objects
function _parseAirportOutput(raw) {
  const networks = [];
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  // Header line starts with SSID — skip it
  for (const line of lines) {
    if (/^\s*SSID/i.test(line)) continue;
    // airport columns: SSID, BSSID, RSSI, CHANNEL, HT, CC, SECURITY
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length < 2) continue;
    const ssid = parts[0] ? parts[0].trim() : null;
    if (!ssid) continue;
    const rssi = parseInt(parts[2], 10) || -100;
    // Convert RSSI (-100 to 0) to 0-100 signal scale
    const signal = Math.max(0, Math.min(100, 2 * (rssi + 100)));
    const secRaw = (parts[6] || parts[parts.length - 1] || '').toUpperCase();
    let security = 'unknown';
    if (secRaw.includes('WPA3')) security = 'WPA3';
    else if (secRaw.includes('WPA2') || secRaw.includes('WPA')) security = 'WPA2';
    else if (secRaw.includes('WEP')) security = 'WEP';
    else if (secRaw === 'NONE' || secRaw === '') security = 'open';
    networks.push({ ssid, signal, security, saved: false });
  }
  return networks;
}

// _parseNmcliOutput — convert nmcli -t output into network objects
function _parseNmcliOutput(raw) {
  const networks = [];
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  for (const line of lines) {
    // Format: SSID:SIGNAL:SECURITY  (fields may contain escaped colons \:)
    const parts = line.split(/(?<!\\):/);
    if (parts.length < 2) continue;
    const ssid = parts[0] ? parts[0].replace(/\\:/g, ':').trim() : null;
    if (!ssid) continue;
    const signal = parseInt(parts[1], 10) || 0;
    const secRaw = (parts[2] || '').toUpperCase().trim();
    let security = 'unknown';
    if (secRaw.includes('WPA3')) security = 'WPA3';
    else if (secRaw.includes('WPA2') || secRaw.includes('WPA')) security = 'WPA2';
    else if (secRaw.includes('WEP')) security = 'WEP';
    else if (!secRaw || secRaw === '--') security = 'open';
    networks.push({ ssid, signal, security, saved: false });
  }
  return networks;
}

// _parseNetshOutput — convert Windows netsh wlan output into network objects
function _parseNetshOutput(raw) {
  const networks = [];
  const blocks = raw.split(/SSID\s+\d+\s*:/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const ssidLine = block.split('\n')[0];
    const ssid = ssidLine ? ssidLine.trim() : null;
    if (!ssid) continue;
    const signalMatch = block.match(/Signal\s*:\s*(\d+)%/i);
    const signal = signalMatch ? parseInt(signalMatch[1], 10) : 0;
    const authMatch = block.match(/Authentication\s*:\s*(.+)/i);
    const authRaw = authMatch ? authMatch[1].trim().toUpperCase() : '';
    let security = 'unknown';
    if (authRaw.includes('WPA3')) security = 'WPA3';
    else if (authRaw.includes('WPA2') || authRaw.includes('WPA')) security = 'WPA2';
    else if (authRaw.includes('WEP')) security = 'WEP';
    else if (authRaw === 'OPEN' || authRaw === '') security = 'open';
    networks.push({ ssid, signal, security, saved: false });
  }
  return networks;
}

// discoverNetworks — scan for available Wi-Fi networks on the current platform
async function discoverNetworks() {
  const p = _platform();
  try {
    if (p === 'darwin') {
      const raw = execSync(`"${AIRPORT_BIN}" -s`, EXEC_OPTS_5S).toString();
      return _parseAirportOutput(raw).sort((a, b) => b.signal - a.signal);
    }
    if (p === 'linux') {
      const raw = execSync('nmcli -t -f SSID,SIGNAL,SECURITY device wifi list', EXEC_OPTS_5S).toString();
      return _parseNmcliOutput(raw).sort((a, b) => b.signal - a.signal);
    }
    if (p === 'win32') {
      const raw = execSync('netsh wlan show networks mode=bssid', EXEC_OPTS_5S).toString();
      return _parseNetshOutput(raw).sort((a, b) => b.signal - a.signal);
    }
    return [];
  } catch (_e) {
    return [];
  }
}

// connectToNetwork — connect to a named Wi-Fi network with an optional password
async function connectToNetwork(ssid, password = null) {
  const p = _platform();
  try {
    if (p === 'darwin') {
      const cmd = password
        ? `networksetup -setairportnetwork en0 "${ssid}" "${password}"`
        : `networksetup -setairportnetwork en0 "${ssid}"`;
      execSync(cmd, EXEC_OPTS_10S);
      return { success: true, ssid, message: `Connected to ${ssid}` };
    }

    if (p === 'linux') {
      const cmd = password
        ? `nmcli device wifi connect "${ssid}" password "${password}"`
        : `nmcli device wifi connect "${ssid}"`;
      execSync(cmd, EXEC_OPTS_10S);
      return { success: true, ssid, message: `Connected to ${ssid}` };
    }

    if (p === 'win32') {
      const profileXml = password
        ? `<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>${ssid}</name><SSIDConfig><SSID><name>${ssid}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>manual</connectionMode><MSM><security><authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${password}</keyMaterial></sharedKey></security></MSM></WLANProfile>`
        : `<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>${ssid}</name><SSIDConfig><SSID><name>${ssid}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>manual</connectionMode><MSM><security><authEncryption><authentication>open</authentication><encryption>none</encryption></authEncryption></security></MSM></WLANProfile>`;

      const tmpFile = path.join(os.tmpdir(), `em_wifi_${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, profileXml, 'utf8');
      try {
        execSync(`netsh wlan add profile filename="${tmpFile}"`, EXEC_OPTS_5S);
        execSync(`netsh wlan connect name="${ssid}"`, EXEC_OPTS_10S);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch (_e) {}
      }
      return { success: true, ssid, message: `Connected to ${ssid}` };
    }

    return { success: false, ssid, message: `Platform ${p} not supported` };
  } catch (err) {
    return { success: false, ssid, message: err.message || 'Connection failed' };
  }
}

// connectToBestAvailable — discover networks and connect to the highest-priority available one
async function connectToBestAvailable(savedNetworks = []) {
  const networks = await discoverNetworks();
  if (!networks || networks.length === 0) {
    return { success: false, message: 'No networks found' };
  }

  // Mark saved networks
  for (const net of networks) {
    if (savedNetworks.includes(net.ssid)) {
      net.saved = true;
    }
  }

  // Priority: saved > open > highest signal
  let winner = networks.find(n => n.saved);
  if (!winner) {
    winner = networks.find(n => n.security === 'open');
  }
  if (!winner) {
    winner = networks[0]; // already sorted by signal desc
  }

  return connectToNetwork(winner.ssid, null);
}

// cacheData — write a keyed value to disk with a TTL expiry
function cacheData(key, data, ttlHours = 24) {
  _ensureCacheDir();
  const file = path.join(CACHE_DIR, _safeName(key) + '.json');
  const now = Date.now();
  const payload = {
    key,
    data,
    cachedAt: now,
    expiresAt: now + ttlHours * 3600000,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

// readCache — return cached data if present and not expired, otherwise null
function readCache(key) {
  _ensureCacheDir();
  const file = path.join(CACHE_DIR, _safeName(key) + '.json');
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    return payload.data;
  } catch (_e) {
    return null;
  }
}

// checkConnectivity — ping a host and return online status and latency
async function checkConnectivity(host = '8.8.8.8') {
  const p = _platform();
  return new Promise((resolve) => {
    const cmd = p === 'win32'
      ? `ping -n 1 -w 2000 ${host}`
      : `ping -c 1 -W 2 ${host}`;

    try {
      const start = Date.now();
      const output = execSync(cmd, { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
      const elapsed = Date.now() - start;

      // Try to extract actual RTT from ping output
      let latencyMs = null;
      const rttMatch = output.match(/time[=<]([\d.]+)\s*ms/i);
      if (rttMatch) {
        latencyMs = parseFloat(rttMatch[1]);
      } else {
        latencyMs = elapsed;
      }

      resolve({ online: true, latencyMs });
    } catch (_e) {
      resolve({ online: false, latencyMs: null });
    }
  });
}

module.exports = {
  discoverNetworks,
  connectToNetwork,
  connectToBestAvailable,
  cacheData,
  readCache,
  checkConnectivity,
};
