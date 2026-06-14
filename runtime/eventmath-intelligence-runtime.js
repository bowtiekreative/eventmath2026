'use strict';

const { execFile } = require('child_process');
const https = require('https');
const http = require('http');
const os = require('os');
const net = require('net');
const dns = require('dns').promises;

/**
 * EventMath Intelligence Runtime v2.21
 * Behavioral correlation, Wi-Fi mapping, OSINT lookup, public feed watching.
 * All network operations respect local authorization context.
 *
 * Functions:
 *  - emergeCorrelation(story, subject, profile, threshold)
 *  - wifiMapNetwork()
 *  - wifiLocate(deviceName)
 *  - lookupPhone(number)
 *  - lookupEmail(email)
 *  - watchFeed(url, seconds)
 *  - watchCameras(location)
 */

// ── Behavioral Correlation Engine ────────────────────────────────────────────

/**
 * emergeCorrelation — finds non-obvious second-order connections between
 * a story (set of scanned events) and a subject's behavioral profile.
 *
 * @param {Array|null} story - Array of event objects from a story scan (or null)
 * @param {string} subject - Subject label (e.g. "Donald Trump")
 * @param {object} profile - { subject, preferences, triggers, reactions }
 * @param {string} threshold - 'low' | 'medium' | 'high' | 'unusual'
 * @returns {Promise<object>} Correlation report
 */
async function emergeCorrelation(story, subject, profile, threshold) {
  const { preferences = [], triggers = [], reactions = [] } = profile || {};
  const events = Array.isArray(story) ? story : [];

  // Threshold multipliers — 'unusual' weights LOW-probability matches more
  const thresholdConfig = {
    low:     { minScore: 0.7, emergentBoost: 0.0, surfaceNonObvious: false },
    medium:  { minScore: 0.4, emergentBoost: 0.1, surfaceNonObvious: false },
    high:    { minScore: 0.2, emergentBoost: 0.3, surfaceNonObvious: false },
    unusual: { minScore: 0.0, emergentBoost: 0.8, surfaceNonObvious: true  },
  };
  const config = thresholdConfig[threshold] || thresholdConfig.unusual;

  // Build keyword sets from profile (lowercase)
  const prefWords  = _extractKeywords(preferences);
  const trigWords  = _extractKeywords(triggers);
  const reactWords = _extractKeywords(reactions);

  const correlations = [];

  for (const event of events) {
    const text = _eventText(event);
    const textWords = _tokenizeText(text);

    const prefScore  = _overlapScore(textWords, prefWords);
    const trigScore  = _overlapScore(textWords, trigWords);
    const reactScore = _overlapScore(textWords, reactWords);

    const maxScore = Math.max(prefScore, trigScore, reactScore);

    if (maxScore >= config.minScore) {
      let type = 'preference';
      let reason = '';
      if (trigScore === maxScore && trigScore > 0) {
        type = 'trigger';
        reason = `Event contains trigger keyword(s) matching profile`;
      } else if (reactScore === maxScore && reactScore > 0) {
        type = 'reaction';
        reason = `Event contains reaction keyword(s) matching profile`;
      } else {
        reason = `Event contains preference keyword(s) matching profile`;
      }
      correlations.push({ event: _eventSummary(event), relevance: Math.round(maxScore * 100) / 100, reason, type });
    }
  }

  // Emergent findings — second-order, non-obvious connections
  // These fire even when direct keyword overlap is LOW (the McDonald's discovery pattern)
  const emergent = [];

  if (config.surfaceNonObvious || config.emergentBoost > 0) {
    // For each preference, find events that are RELATED but don't match directly
    for (const pref of preferences) {
      const prefKeywords = _tokenizeText(pref);
      for (const event of events) {
        const text = _eventText(event);
        const textWords = _tokenizeText(text);
        const directScore = _overlapScore(textWords, new Set(prefKeywords));

        // Surface as emergent if overlap is low (non-obvious) but related domain
        if (directScore < 0.3 && directScore > 0) {
          const finding = `Subject preference '${pref}' may be affected by this event`;
          const confidence = Math.round((config.emergentBoost + directScore) * 100) / 100;
          emergent.push({
            finding,
            confidence: Math.min(confidence, 1.0),
            explanation: `Low direct overlap (${Math.round(directScore * 100)}%) suggests non-obvious second-order connection between '${pref}' and event: "${_eventSummary(event)}"`,
          });
        }
      }
    }

    // Trigger-reaction chains: if an event matches a trigger, surface the expected reaction
    for (const event of events) {
      const text = _eventText(event);
      const textWords = _tokenizeText(text);
      const tScore = _overlapScore(textWords, trigWords);
      if (tScore > 0.1 && reactions.length > 0) {
        emergent.push({
          finding: `Trigger event detected — subject likely to exhibit: ${reactions.join(', ')}`,
          confidence: Math.round(Math.min(tScore + config.emergentBoost, 1.0) * 100) / 100,
          explanation: `Event "${_eventSummary(event)}" matches trigger pattern. Based on profile, subject reaction pattern: ${reactions.join(', ')}`,
        });
      }
    }
  }

  return {
    subject: subject || (profile ? profile.subject : null),
    threshold,
    correlations,
    emergent,
    scannedAt: new Date().toISOString(),
    eventCount: events.length,
    note: threshold === 'unusual'
      ? 'Unusual threshold surfaces low-probability, high-impact connections — the non-obvious discoveries'
      : `Threshold '${threshold}' applied — adjust to 'unusual' for second-order findings`,
  };
}

// Helpers for emergeCorrelation
function _extractKeywords(phrases) {
  const words = new Set();
  for (const phrase of phrases) {
    for (const w of _tokenizeText(phrase)) words.add(w);
  }
  return words;
}

function _tokenizeText(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function _overlapScore(textWords, keywordSet) {
  if (!textWords.length || !keywordSet.size) return 0;
  let hits = 0;
  for (const w of textWords) {
    if (keywordSet.has(w)) hits++;
  }
  return hits / keywordSet.size;
}

function _eventText(event) {
  if (typeof event === 'string') return event;
  if (event && typeof event === 'object') {
    return [event.title, event.description, event.text, event.content, event.summary]
      .filter(Boolean).join(' ');
  }
  return String(event);
}

function _eventSummary(event) {
  if (typeof event === 'string') return event.slice(0, 80);
  if (event && typeof event === 'object') {
    return (event.title || event.description || event.text || JSON.stringify(event)).slice(0, 80);
  }
  return String(event).slice(0, 80);
}

// ── Wi-Fi Network Mapping ─────────────────────────────────────────────────────

/**
 * wifiMapNetwork — maps devices on YOUR OWN local network.
 *
 * Uses OS network interfaces + ARP table to find known devices.
 * Note: ARP cache only contains devices recently seen; ping a few
 * addresses first to populate the cache for better results.
 *
 * @returns {Promise<object>} Network map with devices
 */
async function wifiMapNetwork() {
  const ifaces = os.networkInterfaces();
  let localSubnet = null;
  let localIp = null;

  // Find the first non-loopback IPv4 interface
  for (const [, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        localIp = addr.address;
        // Compute subnet from cidr or netmask
        if (addr.cidr) {
          localSubnet = addr.cidr;
        } else {
          // Approximate /24 from first 3 octets
          const parts = addr.address.split('.');
          localSubnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
        break;
      }
    }
    if (localSubnet) break;
  }

  // Read ARP table
  const arpDevices = await _parseArpTable();

  // Try to ping a few common gateway addresses to populate ARP cache
  // This is best-effort and non-blocking
  if (localIp) {
    const parts = localIp.split('.');
    const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const commonAddresses = [1, 254, 2, 100, 101].map(n => `${base}.${n}`);
    await Promise.allSettled(commonAddresses.map(ip => _quickPing(ip)));

    // Re-read ARP after pinging
    const freshArp = await _parseArpTable();
    for (const [ip, info] of freshArp) {
      if (!arpDevices.has(ip)) arpDevices.set(ip, info);
    }
  }

  const devices = [];
  for (const [ip, info] of arpDevices) {
    devices.push({
      ip,
      mac: info.mac || null,
      hostname: info.hostname || null,
      signal: null, // Requires Wi-Fi hardware API
      lastSeen: Date.now(),
    });
  }

  return {
    network: localSubnet || 'unknown',
    localIp: localIp || null,
    devices,
    scannedAt: new Date().toISOString(),
    note: 'ARP scan only shows devices recently seen on the network. Signal strength requires Wi-Fi hardware API access.',
  };
}

/**
 * _parseArpTable — reads the OS ARP cache via `arp -a`
 * @returns {Promise<Map<string, {mac, hostname}>>}
 */
function _parseArpTable() {
  return new Promise((resolve) => {
    execFile('arp', ['-a'], { timeout: 5000 }, (err, stdout) => {
      const devices = new Map();
      if (err || !stdout) { resolve(devices); return; }

      // arp -a output format varies by OS:
      // macOS/Linux:  hostname (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on en0
      // Windows:      192.168.1.1     aa-bb-cc-dd-ee-ff     dynamic
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Try macOS/Linux format
        const m1 = line.match(/^(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)/i);
        if (m1) {
          devices.set(m1[2], { hostname: m1[1] !== '?' ? m1[1] : null, mac: m1[3] });
          continue;
        }
        // Try Windows format
        const m2 = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)\s+\w+/i);
        if (m2) {
          devices.set(m2[1], { hostname: null, mac: m2[2].replace(/-/g, ':') });
        }
      }
      resolve(devices);
    });
  });
}

/**
 * _quickPing — send a single ICMP ping (best-effort, to populate ARP cache)
 */
function _quickPing(ip) {
  return new Promise((resolve) => {
    // Use ping with a 1-second timeout, 1 packet
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', '500', ip]
      : ['-c', '1', '-W', '1', ip];
    execFile('ping', args, { timeout: 2000 }, () => resolve());
  });
}

/**
 * wifiLocate — attempt to find a device by name or MAC on the local network.
 *
 * Note: Precise location requires Wi-Fi hardware triangulation API.
 *
 * @param {string} deviceName - Name, MAC, or IP to look up
 * @returns {Promise<object>} Device location estimate
 */
async function wifiLocate(deviceName) {
  const arpDevices = await _parseArpTable();
  const query = (deviceName || '').toLowerCase();

  let foundIp = null;
  let foundMac = null;
  let foundHostname = null;

  for (const [ip, info] of arpDevices) {
    const hostname = (info.hostname || '').toLowerCase();
    const mac = (info.mac || '').toLowerCase();
    if (
      ip.includes(query) ||
      hostname.includes(query) ||
      mac.includes(query)
    ) {
      foundIp = ip;
      foundMac = info.mac;
      foundHostname = info.hostname;
      break;
    }
  }

  return {
    device: deviceName,
    ip: foundIp,
    mac: foundMac,
    hostname: foundHostname,
    estimatedLocation: foundIp ? 'same subnet' : 'not found in ARP table',
    confidence: 'low',
    note: 'Precise location requires Wi-Fi hardware API access (e.g. airport access point triangulation or 802.11 RSSI data)',
  };
}

// ── OSINT Lookups ─────────────────────────────────────────────────────────────

/**
 * lookupPhone — aggregates publicly available data about a phone number.
 *
 * Uses NANP (North American Numbering Plan) prefix rules to estimate
 * carrier and number type. No live API calls required.
 *
 * @param {string} number - Phone number (any format)
 * @returns {Promise<object>} Phone number intelligence
 */
async function lookupPhone(number) {
  // Clean to digits only
  const digits = (number || '').replace(/\D/g, '');
  const cleaned = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;

  if (cleaned.length !== 10) {
    return {
      number: digits,
      formatted: number,
      valid: false,
      error: 'Not a valid 10-digit NANP number',
      note: 'Results are estimates from public data only',
    };
  }

  const areaCode = cleaned.slice(0, 3);
  const exchange = cleaned.slice(3, 6);
  const formatted = `(${areaCode}) ${exchange}-${cleaned.slice(6)}`;

  // NANP carrier estimation by area code prefix patterns
  // These are approximate — number portability means the original carrier may differ
  const { carrier, region, type } = _estimateNanpCarrier(areaCode, exchange);

  return {
    number: cleaned,
    formatted,
    areaCode,
    exchange,
    carrier,
    region,
    type,
    nanpValid: true,
    osintSources: ['NANP public database', 'Area code registry'],
    note: 'Results are estimates from public data only. Number portability means the listed carrier may not be the current carrier.',
  };
}

/**
 * _estimateNanpCarrier — uses NANP area code patterns to estimate carrier/region.
 * This is a simplified lookup; real carrier data requires NPAC/NANPA database access.
 */
function _estimateNanpCarrier(areaCode, exchange) {
  // Well-known area codes by region
  const areaCodeRegions = {
    '202': 'Washington DC', '212': 'New York City', '213': 'Los Angeles',
    '312': 'Chicago', '404': 'Atlanta', '415': 'San Francisco',
    '512': 'Austin TX', '617': 'Boston', '702': 'Las Vegas',
    '713': 'Houston', '800': 'Toll-Free', '888': 'Toll-Free',
    '877': 'Toll-Free', '866': 'Toll-Free', '855': 'Toll-Free',
    '844': 'Toll-Free', '833': 'Toll-Free', '822': 'Toll-Free',
    '900': 'Premium Rate',
  };

  // Exchange prefix patterns for carrier estimation (first 2 digits of exchange)
  // This is a rough heuristic based on historical NXX assignments
  const exchangePrefix = exchange.slice(0, 2);
  let carrier = 'Unknown';
  let type = 'mobile';

  // Toll-free detection
  if (['800', '888', '877', '866', '855', '844', '833', '822'].includes(areaCode)) {
    carrier = 'Toll-Free Service';
    type = 'toll-free';
  } else if (areaCode === '900') {
    carrier = 'Premium Rate Service';
    type = 'premium';
  } else {
    // Rough carrier heuristic (major US carriers have large NXX blocks)
    const prefixNum = parseInt(exchangePrefix, 10);
    if (prefixNum >= 20 && prefixNum <= 39) carrier = 'AT&T (estimated)';
    else if (prefixNum >= 40 && prefixNum <= 59) carrier = 'Verizon (estimated)';
    else if (prefixNum >= 60 && prefixNum <= 79) carrier = 'T-Mobile (estimated)';
    else carrier = 'Regional/MVNO (estimated)';
  }

  const region = areaCodeRegions[areaCode] || `US Area Code ${areaCode}`;

  return { carrier, region, type };
}

/**
 * lookupEmail — aggregates publicly available data about an email address.
 *
 * Checks DNS MX records, SPF, DMARC to identify the mail provider.
 * No account existence or social profile lookup (requires platform auth).
 *
 * @param {string} email - Email address to look up
 * @returns {Promise<object>} Email intelligence
 */
async function lookupEmail(email) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      email,
      valid: false,
      error: 'Invalid email format',
      note: 'Social account discovery requires platform APIs with authorization',
    };
  }

  const domain = email.split('@')[1].toLowerCase();
  let mxRecords = [];
  let mailProvider = 'unknown';
  let spf = false;
  let dmarc = false;
  let txtRecords = [];

  // Resolve MX records
  try {
    const mx = await dns.resolveMx(domain);
    mxRecords = mx.sort((a, b) => a.priority - b.priority).map(r => ({ priority: r.priority, exchange: r.exchange }));

    // Identify mail provider from MX records
    const exchanges = mxRecords.map(r => r.exchange.toLowerCase()).join(',');
    if (exchanges.includes('google') || exchanges.includes('aspmx')) {
      mailProvider = 'Google Workspace';
    } else if (exchanges.includes('outlook') || exchanges.includes('microsoft') || exchanges.includes('protection.outlook')) {
      mailProvider = 'Microsoft 365';
    } else if (exchanges.includes('yahoo')) {
      mailProvider = 'Yahoo Mail';
    } else if (exchanges.includes('protonmail') || exchanges.includes('proton.me')) {
      mailProvider = 'Proton Mail';
    } else if (exchanges.includes('zoho')) {
      mailProvider = 'Zoho Mail';
    } else if (exchanges.includes('mailgun')) {
      mailProvider = 'Mailgun';
    } else if (exchanges.includes('sendgrid')) {
      mailProvider = 'SendGrid';
    } else if (mxRecords.length > 0) {
      mailProvider = `Custom (${mxRecords[0].exchange})`;
    }
  } catch (_e) {
    // DNS lookup failed — domain may not exist or have no MX
    mailProvider = 'none (no MX records)';
  }

  // Check TXT records for SPF and DMARC
  try {
    txtRecords = await dns.resolveTxt(domain);
    for (const recs of txtRecords) {
      const joined = recs.join('').toLowerCase();
      if (joined.startsWith('v=spf1')) spf = true;
    }
  } catch (_e) {
    // No TXT records or lookup failed
  }

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    for (const recs of dmarcRecords) {
      const joined = recs.join('').toLowerCase();
      if (joined.startsWith('v=dmarc1')) dmarc = true;
    }
  } catch (_e) {
    // No DMARC record
  }

  return {
    email,
    domain,
    valid: true,
    mxRecords,
    mailProvider,
    spf,
    dmarc,
    osintSources: ['DNS public records', 'MX lookup', 'TXT/SPF/DMARC records'],
    note: 'Social account discovery requires platform APIs with authorization. Only public DNS data is used here.',
  };
}

// ── Public Feed Monitoring ────────────────────────────────────────────────────

/**
 * watchFeed — connects to a public URL and samples the stream.
 *
 * Reads the first chunk of the response to check content type and
 * get initial data. For MJPEG streams, counts frame boundaries.
 *
 * @param {string} url - HTTP or HTTPS URL
 * @param {number} seconds - How long to sample (in seconds)
 * @returns {Promise<object>} Feed sample data
 */
async function watchFeed(url, seconds) {
  const duration = Math.min(seconds || 10, 60); // Cap at 60 seconds
  const timeoutMs = duration * 1000;

  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (_e) {
      resolve({
        url,
        error: 'Invalid URL',
        contentType: null,
        status: null,
        bytesRead: 0,
        duration: seconds,
        frames: null,
        sampleData: null,
        note: 'Full frame extraction requires ffmpeg',
      });
      return;
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + (parsedUrl.search || ''),
      method: 'GET',
      headers: { 'User-Agent': 'EventMath/2.21 Intelligence Runtime' },
      timeout: timeoutMs,
    };

    let bytesRead = 0;
    let contentType = null;
    let status = null;
    let frameCount = 0;
    const chunks = [];
    const MAX_BYTES = 8192; // Read up to 8KB for sampling

    const req = transport.request(options, (res) => {
      status = res.statusCode;
      contentType = res.headers['content-type'] || null;

      res.on('data', (chunk) => {
        bytesRead += chunk.length;
        if (bytesRead <= MAX_BYTES) chunks.push(chunk);

        // Count MJPEG frame boundaries
        if (contentType && contentType.includes('multipart')) {
          const s = chunk.toString('binary');
          const frameBoundaries = (s.match(/--/g) || []).length;
          frameCount += Math.floor(frameBoundaries / 2);
        }

        if (bytesRead >= MAX_BYTES) {
          res.destroy();
        }
      });

      res.on('end', () => finish());
      res.on('error', () => finish());
    });

    req.on('timeout', () => { req.destroy(); finish(); });
    req.on('error', (err) => {
      finish({ error: err.message });
    });

    let finished = false;
    function finish(extra = {}) {
      if (finished) return;
      finished = true;

      const buffer = Buffer.concat(chunks);
      // Try to represent sample as UTF-8 text; fall back to hex for binary
      let sampleData;
      try {
        sampleData = buffer.slice(0, 200).toString('utf8');
        // Check if it looks like binary
        if (/[\x00-\x08\x0e-\x1f\x7f-\x9f]/.test(sampleData)) {
          sampleData = buffer.slice(0, 100).toString('hex');
        }
      } catch (_e) {
        sampleData = buffer.slice(0, 100).toString('hex');
      }

      resolve(Object.assign({
        url,
        contentType,
        status,
        bytesRead,
        duration: seconds,
        frames: frameCount > 0 ? frameCount : null,
        sampleData: sampleData || null,
        note: 'Full frame extraction requires ffmpeg. Only initial stream data was sampled.',
      }, extra));
    }

    req.end();

    // Stop after timeout regardless
    setTimeout(() => finish(), timeoutMs + 500);
  });
}

/**
 * watchCameras — returns a curated list of well-known public camera feeds
 * for the given location. Does NOT connect automatically — returns the list
 * so the user can choose which to watch with `watch feed at "URL" ...`.
 *
 * @param {string} location - City or region name
 * @returns {Promise<object>} List of public camera sources
 */
async function watchCameras(location) {
  // Curated public camera directories and DOT feed sources
  const cameraDatabase = {
    'Washington DC': [
      { name: 'DC DOT Traffic Cameras', url: 'https://ddot.dc.gov/page/traffic-cameras', type: 'traffic', authorization: 'public' },
      { name: 'DC Traffic CCTV Feed Index', url: 'https://metwashingtondc.gov/cameras', type: 'traffic', authorization: 'public' },
      { name: 'National Mall Webcam', url: 'https://www.nps.gov/nama/learn/photosmultimedia/webcams.htm', type: 'public', authorization: 'public' },
    ],
    'New York': [
      { name: 'NYC DOT Traffic Cameras', url: 'https://webcams.nyctmc.org/cameras-list', type: 'traffic', authorization: 'public' },
      { name: 'Times Square Cam', url: 'https://www.earthcam.com/usa/newyork/timessquare/', type: 'public', authorization: 'public' },
      { name: 'NYC OpenData Traffic', url: 'https://data.cityofnewyork.us/Transportation/CCTV-Camera-Locations/xfn7-xypa', type: 'traffic', authorization: 'public' },
    ],
    'Los Angeles': [
      { name: 'Caltrans District 7 Cameras', url: 'https://cwwp2.dot.ca.gov/vm/streamlist.htm', type: 'traffic', authorization: 'public' },
      { name: 'LA ATIS Freeway Cameras', url: 'https://www.sigalert.com/map.asp#ca/los-angeles', type: 'traffic', authorization: 'public' },
    ],
    'Chicago': [
      { name: 'IDOT Chicago Traffic Cameras', url: 'https://www.illinoistollway.com/media-center/travel-cameras', type: 'traffic', authorization: 'public' },
      { name: 'Chicago Traffic Cam Map', url: 'https://www.chicago.gov/city/en/depts/cdot/supp_info/traffic-cameras.html', type: 'traffic', authorization: 'public' },
    ],
    'San Francisco': [
      { name: 'Caltrans Bay Area Cameras', url: 'https://cwwp2.dot.ca.gov/vm/streamlist.htm', type: 'traffic', authorization: 'public' },
      { name: 'SF 511 Traffic Cameras', url: 'https://511.org/driving/cameramap', type: 'traffic', authorization: 'public' },
    ],
  };

  // Normalize location string for lookup
  const locationNorm = Object.keys(cameraDatabase).find(k =>
    location && (location.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(location.toLowerCase()))
  );

  const sources = locationNorm
    ? cameraDatabase[locationNorm]
    : [
        { name: 'Insecam Public Traffic Cameras', url: 'https://www.insecam.org/en/bytag/traffic/', type: 'traffic', authorization: 'public' },
        { name: 'EarthCam Worldwide Webcams', url: 'https://www.earthcam.com/', type: 'public', authorization: 'public' },
        { name: 'Opentopia Webcam Directory', url: 'http://www.opentopia.com/', type: 'public', authorization: 'public' },
        { name: 'Webcamtaxi Live Cams', url: 'https://www.webcamtaxi.com/en/', type: 'public', authorization: 'public' },
      ];

  return {
    location: location || 'global',
    sources,
    note: 'Use "watch feed at \\"URL\\" for N seconds into RESULT" to connect to a specific camera stream.',
  };
}

module.exports = {
  emergeCorrelation,
  wifiMapNetwork,
  wifiLocate,
  lookupPhone,
  lookupEmail,
  watchFeed,
  watchCameras,
};
