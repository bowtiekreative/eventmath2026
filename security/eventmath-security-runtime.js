/**
 * EventMath Security Runtime v1.0
 *
 * Ethical hacking / security auditing library for EventMath v2.19.
 * All functions are async. Designed for authorized security assessments only.
 *
 * Usage: const __emSec = require('./eventmath-security-runtime.js');
 */

'use strict';

const tls     = require('tls');
const http    = require('http');
const https   = require('https');
const net     = require('net');
const dns     = require('dns');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ── SSL / TLS inspection ─────────────────────────────────────────────────────

/**
 * probeSSL(host) — Connect via TLS and return certificate details.
 * @param {string} host
 * @returns {Promise<object>}
 */
async function probeSSL(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, rejectUnauthorized: false, timeout: 5000 }, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        socket.destroy();

        if (!cert || !cert.subject) {
          return resolve({ error: 'No certificate returned', host });
        }

        const validFrom = new Date(cert.valid_from);
        const validTo   = new Date(cert.valid_to);
        const now       = new Date();
        const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        resolve({
          host,
          subject:        cert.subject ? (cert.subject.CN || JSON.stringify(cert.subject)) : null,
          issuer:         cert.issuer  ? (cert.issuer.CN  || JSON.stringify(cert.issuer))  : null,
          valid_from:     cert.valid_from,
          valid_to:       cert.valid_to,
          fingerprint:    cert.fingerprint || null,
          days_remaining: daysRemaining,
          expired:        daysRemaining < 0,
          san:            cert.subjectaltname || null,
        });
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    socket.on('error', err => {
      resolve({ error: err.message, host });
    });

    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve({ error: 'timeout', host });
    });
  });
}

// ── HTTP header inspection ───────────────────────────────────────────────────

const SECURITY_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'strict-transport-security',
  'content-security-policy',
  'x-xss-protection',
];

/**
 * probeHeaders(url) — HTTP/HTTPS GET and analyse security headers.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function probeHeaders(url) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET',
      timeout:  5000,
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      const headers = {};
      for (const [key, val] of Object.entries(res.headers)) {
        headers[key.toLowerCase()] = val;
      }

      const presentSecurity   = SECURITY_HEADERS.filter(h => headers[h]);
      const missingSecurity   = SECURITY_HEADERS.filter(h => !headers[h]);
      const score             = Math.round((presentSecurity.length / SECURITY_HEADERS.length) * 100);

      let security_grade;
      if (score >= 80)      security_grade = 'A';
      else if (score >= 60) security_grade = 'B';
      else if (score >= 40) security_grade = 'C';
      else if (score >= 20) security_grade = 'D';
      else                  security_grade = 'F';

      // Consume response body to avoid socket hang
      res.resume();

      resolve({
        url,
        status:                   res.statusCode,
        headers,
        security_grade,
        score,
        present_security_headers: presentSecurity,
        missing_security_headers: missingSecurity,
      });
    });

    req.on('error', err => {
      resolve({ url, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ url, error: 'timeout' });
    });

    req.end();
  });
}

// ── Port scanning ────────────────────────────────────────────────────────────

/**
 * probePorts(host, start, end) — TCP connect probe each port.
 * @param {string} host
 * @param {number} [start=1]
 * @param {number} [end=1024]
 * @returns {Promise<number[]>} array of open port numbers
 */
async function probePorts(host, start = 1, end = 1024) {
  const TIMEOUT_MS   = 500;
  const CONCURRENCY  = 100;
  const openPorts    = [];

  const probePort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    let settled  = false;

    const done = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open ? port : null);
    };

    socket.setTimeout(TIMEOUT_MS);
    socket.connect(port, host, () => done(true));
    socket.on('error',   () => done(false));
    socket.on('timeout', () => done(false));
  });

  // Process in batches to cap concurrency
  const ports = [];
  for (let p = start; p <= end; p++) ports.push(p);

  for (let i = 0; i < ports.length; i += CONCURRENCY) {
    const batch   = ports.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(probePort));
    for (const r of results) {
      if (r !== null) openPorts.push(r);
    }
  }

  return openPorts.sort((a, b) => a - b);
}

// ── DNS lookup ───────────────────────────────────────────────────────────────

const dns4     = promisify(dns.resolve4);
const dnsMx    = promisify(dns.resolveMx);
const dnsTxt   = promisify(dns.resolveTxt);
const dnsNs    = promisify(dns.resolveNs);

/**
 * probeDNS(host, type) — DNS lookup for A, MX, TXT, NS records.
 * @param {string} host
 * @param {string} type  'A' | 'MX' | 'TXT' | 'NS'
 * @returns {Promise<object>}
 */
async function probeDNS(host, type = 'A') {
  try {
    switch (type.toUpperCase()) {
      case 'A':  return { host, type: 'A',  records: await dns4(host) };
      case 'MX': return { host, type: 'MX', records: await dnsMx(host) };
      case 'TXT':return { host, type: 'TXT',records: await dnsTxt(host) };
      case 'NS': return { host, type: 'NS', records: await dnsNs(host) };
      default:   return { host, type, error: `Unknown DNS record type: ${type}` };
    }
  } catch (err) {
    return { host, type, error: err.message };
  }
}

// ── Whois ────────────────────────────────────────────────────────────────────

const WHOIS_FIELDS = {
  registrar:    /registrar:\s*(.+)/i,
  created:      /creation date:\s*(.+)/i,
  expires:      /(?:expiry|expiration) date:\s*(.+)/i,
  updated:      /updated date:\s*(.+)/i,
  name_servers: /name server:\s*(.+)/i,
  status:       /domain status:\s*(.+)/i,
};

/**
 * probeWhois(host) — Run whois and parse key fields.
 * @param {string} host
 * @returns {Promise<object>}
 */
async function probeWhois(host) {
  try {
    const { stdout } = await execFileAsync('whois', [host], { timeout: 10000 });
    const result = { host, raw_length: stdout.length };
    const nameServers = [];

    for (const line of stdout.split('\n')) {
      for (const [field, pattern] of Object.entries(WHOIS_FIELDS)) {
        const m = line.match(pattern);
        if (m) {
          const val = m[1].trim();
          if (field === 'name_servers') {
            nameServers.push(val.toLowerCase());
          } else if (!result[field]) {
            result[field] = val;
          }
        }
      }
    }

    if (nameServers.length > 0) result.name_servers = [...new Set(nameServers)];
    return result;
  } catch (err) {
    return { host, error: err.message };
  }
}

// ── Host discovery ───────────────────────────────────────────────────────────

/**
 * Parse a CIDR block and return an array of host IPs.
 * Supports /8 through /32. Caps at 65536 hosts.
 */
function _cidrToHosts(cidr) {
  const [base, prefix] = cidr.split('/');
  const prefixLen = parseInt(prefix, 10);
  const octets = base.split('.').map(Number);
  const baseInt = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  const hostBits = 32 - prefixLen;
  const numHosts = Math.min(1 << hostBits, 65536);
  const networkInt = baseInt & ~((1 << hostBits) - 1);

  const hosts = [];
  // Skip network address (i=0) and broadcast (i=numHosts-1) for /31 and smaller
  const skip = prefixLen < 31;
  for (let i = (skip ? 1 : 0); i < (skip ? numHosts - 1 : numHosts); i++) {
    const ip = networkInt + i;
    hosts.push([
      (ip >>> 24) & 0xff,
      (ip >>> 16) & 0xff,
      (ip >>>  8) & 0xff,
       ip         & 0xff,
    ].join('.'));
  }
  return hosts;
}

/**
 * discoverHosts(cidr) — Probe each IP on port 80/443, return responsive ones.
 * @param {string} cidr  e.g. "192.168.1.0/24"
 * @returns {Promise<Array<{ip: string, ports: number[]}>>}
 */
async function discoverHosts(cidr) {
  const TIMEOUT_MS  = 300;
  const CONCURRENCY = 50;
  const CHECK_PORTS = [80, 443];

  const hosts = _cidrToHosts(cidr);
  const live  = [];

  const probeHost = async (ip) => {
    const openPorts = await Promise.all(
      CHECK_PORTS.map(port => new Promise((resolve) => {
        const socket = new net.Socket();
        let settled  = false;
        const done   = (open) => { if (settled) return; settled = true; socket.destroy(); resolve(open ? port : null); };
        socket.setTimeout(TIMEOUT_MS);
        socket.connect(port, ip, () => done(true));
        socket.on('error',   () => done(false));
        socket.on('timeout', () => done(false));
      }))
    );
    const found = openPorts.filter(p => p !== null);
    if (found.length > 0) return { ip, ports: found };
    return null;
  };

  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch   = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(probeHost));
    for (const r of results) {
      if (r) live.push(r);
    }
  }

  return live;
}

// ── Traffic capture ──────────────────────────────────────────────────────────

/**
 * captureTraffic(iface, seconds, filter) — Capture packets via tcpdump/tshark.
 * @param {string} iface    Network interface name, e.g. "eth0"
 * @param {number} seconds  How many seconds to capture
 * @param {string|null} filter  BPF filter expression, e.g. "tcp port 80"
 * @returns {Promise<Array<{time, src, dst, protocol, length, info}>>}
 */
async function captureTraffic(iface, seconds = 10, filter = null) {
  // Try tcpdump first, then tshark
  const useTshark = await _commandExists('tshark');
  const useTcpdump = !useTshark && await _commandExists('tcpdump');

  if (!useTshark && !useTcpdump) {
    return [{ error: 'Neither tcpdump nor tshark found. Install one to capture traffic.', iface, seconds }];
  }

  try {
    let stdout;

    if (useTshark) {
      const args = ['-i', iface, '-a', `duration:${seconds}`, '-T', 'fields',
        '-e', 'frame.time_relative', '-e', 'ip.src', '-e', 'ip.dst',
        '-e', '_ws.col.Protocol', '-e', 'frame.len', '-e', '_ws.col.Info'];
      if (filter) args.push('-f', filter);
      const result = await execFileAsync('tshark', args, { timeout: (seconds + 5) * 1000 });
      stdout = result.stdout;
    } else {
      // tcpdump — use -l (line-buffered) and -q (quiet), -G for duration trick
      const args = ['-i', iface, '-nn', '-q', '-c', '10000', '--immediate-mode'];
      if (filter) args.push(filter);
      // Run for `seconds` then kill — execFile timeout will do this
      const result = await execFileAsync('tcpdump', args, { timeout: (seconds + 2) * 1000 }).catch(e => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));
      stdout = result.stdout || '';
    }

    return _parsePacketOutput(stdout, useTshark ? 'tshark' : 'tcpdump');
  } catch (err) {
    return [{ error: err.message, iface, seconds }];
  }
}

async function _commandExists(cmd) {
  try {
    await execFileAsync('which', [cmd], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function _parsePacketOutput(stdout, tool) {
  const lines   = stdout.split('\n').filter(Boolean);
  const packets = [];

  if (tool === 'tshark') {
    for (const line of lines) {
      const parts = line.split('\t');
      packets.push({
        time:     parts[0] || null,
        src:      parts[1] || null,
        dst:      parts[2] || null,
        protocol: parts[3] || null,
        length:   parts[4] ? parseInt(parts[4], 10) : null,
        info:     parts[5] || null,
      });
    }
  } else {
    // tcpdump format: "HH:MM:SS.µs IP src > dst: flags length"
    const re = /^(\d{2}:\d{2}:\d{2}\.\d+)\s+IP(?:6)?\s+(\S+)\s+>\s+(\S+):\s*(.*?)\s+length\s+(\d+)/;
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        packets.push({
          time:     m[1],
          src:      m[2],
          dst:      m[3],
          protocol: 'IP',
          length:   parseInt(m[5], 10),
          info:     m[4] || null,
        });
      } else if (line.trim()) {
        packets.push({ time: null, src: null, dst: null, protocol: null, length: null, info: line.trim() });
      }
    }
  }

  return packets;
}

// ── Hardening report ─────────────────────────────────────────────────────────

/**
 * generateHardening(dataArray) — Analyse probe results and produce recommendations.
 * @param {any[]} dataArray  Array of probe results (headers, cert, open ports, etc.)
 * @returns {Array<{severity: string, finding: string, recommendation: string}>}
 */
function generateHardening(dataArray) {
  const findings = [];

  for (const data of dataArray) {
    if (!data || typeof data !== 'object') continue;

    // ── Certificate analysis ─────────────────────────────────
    if ('days_remaining' in data) {
      if (data.error) {
        findings.push({ severity: 'high', finding: `SSL probe failed for ${data.host}: ${data.error}`, recommendation: 'Verify TLS is configured and port 443 is open.' });
      } else if (data.expired) {
        findings.push({ severity: 'critical', finding: `TLS certificate for ${data.host || data.subject} has EXPIRED (${data.days_remaining} days ago).`, recommendation: 'Renew the TLS certificate immediately.' });
      } else if (data.days_remaining < 14) {
        findings.push({ severity: 'high', finding: `TLS certificate expires in ${data.days_remaining} days.`, recommendation: 'Renew the TLS certificate before it expires.' });
      } else if (data.days_remaining < 30) {
        findings.push({ severity: 'medium', finding: `TLS certificate expires in ${data.days_remaining} days.`, recommendation: 'Schedule certificate renewal.' });
      } else {
        findings.push({ severity: 'info', finding: `TLS certificate is valid for ${data.days_remaining} more days (issuer: ${data.issuer}).`, recommendation: 'No immediate action required.' });
      }
    }

    // ── Header analysis ──────────────────────────────────────
    if ('missing_security_headers' in data) {
      if (data.error) {
        findings.push({ severity: 'medium', finding: `Header probe failed for ${data.url}: ${data.error}`, recommendation: 'Ensure the server is reachable and returns HTTP responses.' });
        continue;
      }
      const grade = data.security_grade;
      if (grade === 'F' || grade === 'D') {
        findings.push({ severity: 'high', finding: `Security header grade is ${grade} (score: ${data.score}%).`, recommendation: `Add missing headers: ${data.missing_security_headers.join(', ')}.` });
      } else if (grade === 'C') {
        findings.push({ severity: 'medium', finding: `Security header grade is ${grade} (score: ${data.score}%).`, recommendation: `Consider adding: ${data.missing_security_headers.join(', ')}.` });
      } else {
        findings.push({ severity: 'info', finding: `Security header grade is ${grade} (score: ${data.score}%).`, recommendation: 'Header configuration looks good.' });
      }

      for (const missing of (data.missing_security_headers || [])) {
        const advice = {
          'x-content-type-options':  'Add "X-Content-Type-Options: nosniff" to prevent MIME-sniffing.',
          'x-frame-options':          'Add "X-Frame-Options: DENY" to prevent clickjacking.',
          'strict-transport-security':'Add "Strict-Transport-Security: max-age=31536000" to enforce HTTPS.',
          'content-security-policy':  'Add a Content-Security-Policy header to restrict resource origins.',
          'x-xss-protection':         'Add "X-XSS-Protection: 1; mode=block" to enable browser XSS filter.',
        };
        if (advice[missing]) {
          findings.push({ severity: 'low', finding: `Missing header: ${missing}`, recommendation: advice[missing] });
        }
      }
    }

    // ── Open port analysis ───────────────────────────────────
    if (Array.isArray(data) && data.every(n => typeof n === 'number')) {
      // This is an array of open port numbers from probePorts
      const dangerous = data.filter(p => [21, 23, 25, 110, 143, 3389, 5900].includes(p));
      if (dangerous.length > 0) {
        findings.push({ severity: 'high', finding: `Potentially dangerous ports open: ${dangerous.join(', ')}.`, recommendation: 'Close or firewall unnecessary services (FTP:21, Telnet:23, RDP:3389, VNC:5900, etc.).' });
      }
      if (data.length > 20) {
        findings.push({ severity: 'medium', finding: `${data.length} ports are open — large attack surface.`, recommendation: 'Review open ports and close those not required for business operations.' });
      } else if (data.length > 0) {
        findings.push({ severity: 'info', finding: `${data.length} open port(s): ${data.join(', ')}.`, recommendation: 'Verify each open port is intentional and properly secured.' });
      }
    }

    // ── DNS / whois analysis ─────────────────────────────────
    if ('registrar' in data || 'name_servers' in data) {
      if (data.error) {
        findings.push({ severity: 'low', finding: `Whois probe failed: ${data.error}`, recommendation: 'Verify the domain name and that whois is accessible.' });
      } else {
        if (data.expires) {
          const expiry = new Date(data.expires);
          const daysLeft = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
          if (!isNaN(daysLeft) && daysLeft < 30) {
            findings.push({ severity: 'high', finding: `Domain expires in ${daysLeft} days (${data.expires}).`, recommendation: 'Renew the domain registration immediately to avoid service disruption.' });
          }
        }
        findings.push({ severity: 'info', finding: `Domain registered via ${data.registrar || 'unknown registrar'}.`, recommendation: 'Ensure domain lock is enabled to prevent unauthorized transfers.' });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({ severity: 'info', finding: 'No probe data provided for analysis.', recommendation: 'Run probe statements first to collect security data.' });
  }

  return findings;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  probeSSL,
  probeHeaders,
  probePorts,
  probeDNS,
  probeWhois,
  discoverHosts,
  captureTraffic,
  generateHardening,
};
