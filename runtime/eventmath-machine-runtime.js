'use strict';

/**
 * EventMath Machine Layer Runtime v2.28
 * Network / Physical / Process protocol primitives — Node.js standard library only.
 */

const http  = require('node:http');
const https = require('node:https');
const net   = require('node:net');
const dgram = require('node:dgram');
const fs    = require('node:fs');
const { exec, execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Protocol-info factories
// ---------------------------------------------------------------------------

function piHTTP() {
  return {
    layer: 'Application',
    protocol: 'HTTP/1.1',
    osi_model_layer: 7,
    what_it_does: 'Transfers hypertext documents and structured data between clients and servers over TCP.',
    is_reliable: true,
    is_connection_oriented: true,
  };
}

function piTCP() {
  return {
    layer: 'Transport',
    protocol: 'TCP',
    osi_model_layer: 4,
    what_it_does: 'Provides ordered, reliable, error-checked delivery of a byte stream between two endpoints.',
    is_reliable: true,
    is_connection_oriented: true,
  };
}

function piUDP() {
  return {
    layer: 'Transport',
    protocol: 'UDP',
    osi_model_layer: 4,
    what_it_does: 'Sends discrete datagrams without connection setup or delivery guarantees.',
    is_reliable: false,
    is_connection_oriented: false,
  };
}

function piUART() {
  return {
    layer: 'Physical',
    protocol: 'UART',
    osi_model_layer: 1,
    what_it_does: 'Transmits bytes serially over a physical wire using a fixed baud rate clock.',
    is_reliable: true,
    is_connection_oriented: true,
  };
}

function piPOSIX() {
  return {
    layer: 'Process',
    protocol: 'POSIX',
    osi_model_layer: 7,
    what_it_does: 'Launches and manages operating-system processes, capturing their standard I/O streams.',
    is_reliable: true,
    is_connection_oriented: false,
  };
}

function piBinary() {
  return {
    layer: 'Data',
    protocol: 'Binary',
    osi_model_layer: 6,
    what_it_does: 'Interprets raw bytes as structured binary data independent of any transport protocol.',
    is_reliable: true,
    is_connection_oriented: false,
  };
}

// ---------------------------------------------------------------------------
// httpGet(url, headers) → async { status, statusText, body, headers, protocol_info }
// ---------------------------------------------------------------------------

async function httpGet(url, headers = {}) {
  const pi = piHTTP();
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers,
        timeout: 5000,
      };
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
            protocol_info: pi,
          });
        });
        res.on('error', (err) => resolve({ error: err.message, protocol_info: pi }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ error: 'Request timed out after 5s', protocol_info: pi }); });
      req.on('error', (err) => resolve({ error: err.message, protocol_info: pi }));
      req.end();
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// httpPost(url, body, headers) → async { status, statusText, body, headers, protocol_info }
// ---------------------------------------------------------------------------

async function httpPost(url, body = '', hdrs = {}) {
  const pi = piHTTP();
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
      const headers = Object.assign({ 'Content-Length': bodyBuf.length }, hdrs);
      const options = {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers,
        timeout: 5000,
      };
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
            protocol_info: pi,
          });
        });
        res.on('error', (err) => resolve({ error: err.message, protocol_info: pi }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ error: 'Request timed out after 5s', protocol_info: pi }); });
      req.on('error', (err) => resolve({ error: err.message, protocol_info: pi }));
      req.write(bodyBuf);
      req.end();
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// socketConnect(host, port) → async handle { _net, write, end, host, port, _buf, protocol_info }
// ---------------------------------------------------------------------------

async function socketConnect(host, port) {
  const pi = piTCP();
  return new Promise((resolve) => {
    try {
      const socket = new net.Socket();
      const handle = {
        _net: socket,
        host,
        port,
        _buf: [],          // buffered incoming data chunks
        _waiters: [],      // pending read resolvers
        protocol_info: pi,
        write: (data) => socketSend(handle, data),
        end: () => socketClose(handle),
      };

      socket.on('data', (chunk) => {
        if (handle._waiters.length > 0) {
          const resolve = handle._waiters.shift();
          resolve(chunk);
        } else {
          handle._buf.push(chunk);
        }
      });

      socket.on('error', () => {});   // prevent unhandled error crashes

      socket.connect({ host, port }, () => {
        resolve(handle);
      });

      socket.on('error', (err) => {
        // If error before connected, resolve with error object
        resolve({ error: err.message, protocol_info: pi });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// socketSend(conn, data) → async { bytesSent, protocol_info }
// ---------------------------------------------------------------------------

async function socketSend(conn, data) {
  const pi = piTCP();
  return new Promise((resolve) => {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
      conn._net.write(buf, (err) => {
        if (err) return resolve({ error: err.message, protocol_info: pi });
        resolve({ bytesSent: buf.length, protocol_info: pi });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// socketRead(conn, timeout) → async { data, bytesReceived, protocol_info }
// ---------------------------------------------------------------------------

async function socketRead(conn, timeout = 5000) {
  const pi = piTCP();
  return new Promise((resolve) => {
    try {
      // If there is already buffered data, return it immediately
      if (conn._buf && conn._buf.length > 0) {
        const chunk = conn._buf.shift();
        return resolve({ data: chunk.toString('utf8'), bytesReceived: chunk.length, protocol_info: pi });
      }

      // Otherwise wait for the next data event
      let timer;
      const onData = (chunk) => {
        clearTimeout(timer);
        resolve({ data: chunk.toString('utf8'), bytesReceived: chunk.length, protocol_info: pi });
      };

      timer = setTimeout(() => {
        // Remove our waiter
        if (conn._waiters) {
          const idx = conn._waiters.indexOf(onData);
          if (idx !== -1) conn._waiters.splice(idx, 1);
        }
        resolve({ data: '', bytesReceived: 0, protocol_info: pi });
      }, timeout);

      if (conn._waiters) {
        conn._waiters.push(onData);
      } else {
        clearTimeout(timer);
        resolve({ error: 'Invalid connection handle', protocol_info: pi });
      }
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// socketClose(conn) → async { closed, protocol_info }
// ---------------------------------------------------------------------------

async function socketClose(conn) {
  const pi = piTCP();
  return new Promise((resolve) => {
    try {
      conn._net.end(() => {
        resolve({ closed: true, protocol_info: pi });
      });
      conn._net.on('error', () => resolve({ closed: true, protocol_info: pi }));
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// socketUdpSend(host, port, data) → async { bytesSent, protocol_info }
// ---------------------------------------------------------------------------

async function socketUdpSend(host, port, data) {
  const pi = piUDP();
  return new Promise((resolve) => {
    try {
      const sock = dgram.createSocket('udp4');
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
      sock.send(buf, 0, buf.length, port, host, (err) => {
        sock.close();
        if (err) return resolve({ error: err.message, protocol_info: pi });
        resolve({ bytesSent: buf.length, protocol_info: pi });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// serialConnect(path, baud) → async handle { path, baud, _fd, protocol_info }
// ---------------------------------------------------------------------------

async function serialConnect(path, baud = 9600) {
  const pi = piUART();
  return new Promise((resolve) => {
    try {
      // Try to set baud rate via stty before opening
      try {
        execSync(`stty -F ${path} ${baud} raw -echo`, { timeout: 3000 });
      } catch (_) {
        // stty failed — device may not be available; fall through to mock
      }

      fs.open(path, 'r+', (err, fd) => {
        if (err) {
          // Return mock handle instead of throwing
          return resolve({
            path,
            baud,
            _fd: null,
            _mock: true,
            protocol_info: Object.assign({}, pi, {
              note: `Serial device ${path} not available (${err.message}). Using mock handle.`,
            }),
          });
        }
        resolve({
          path,
          baud,
          _fd: fd,
          _mock: false,
          protocol_info: pi,
        });
      });
    } catch (err) {
      resolve({
        path,
        baud,
        _fd: null,
        _mock: true,
        protocol_info: Object.assign({}, pi, {
          note: `Serial device ${path} not available (${err.message}). Using mock handle.`,
        }),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// serialSend(portRef, data) → async { bytesSent, protocol_info }
// ---------------------------------------------------------------------------

async function serialSend(portRef, data) {
  const pi = piUART();
  return new Promise((resolve) => {
    try {
      if (portRef._mock) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
        return resolve({ bytesSent: buf.length, protocol_info: pi });
      }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
      fs.write(portRef._fd, buf, 0, buf.length, null, (err, written) => {
        if (err) return resolve({ error: err.message, protocol_info: pi });
        resolve({ bytesSent: written, protocol_info: pi });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// serialRead(portRef, timeoutMs) → async { data, bytesReceived, protocol_info }
// ---------------------------------------------------------------------------

async function serialRead(portRef, timeoutMs = 2000) {
  const pi = piUART();
  return new Promise((resolve) => {
    try {
      if (portRef._mock) {
        return resolve({ data: '', bytesReceived: 0, protocol_info: pi });
      }

      const bufSize = 256;
      const readBuf = Buffer.alloc(bufSize);
      let done = false;

      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve({ data: '', bytesReceived: 0, protocol_info: pi });
        }
      }, timeoutMs);

      const tryRead = () => {
        fs.read(portRef._fd, readBuf, 0, bufSize, null, (err, bytesRead) => {
          if (done) return;
          if (err) {
            done = true;
            clearTimeout(timer);
            return resolve({ error: err.message, protocol_info: pi });
          }
          if (bytesRead > 0) {
            done = true;
            clearTimeout(timer);
            return resolve({
              data: readBuf.slice(0, bytesRead).toString('utf8'),
              bytesReceived: bytesRead,
              protocol_info: pi,
            });
          }
          // No data yet — retry after short delay
          setTimeout(tryRead, 50);
        });
      };

      tryRead();
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// serialClose(portRef) → async { closed, protocol_info }
// ---------------------------------------------------------------------------

async function serialClose(portRef) {
  const pi = piUART();
  return new Promise((resolve) => {
    try {
      if (portRef._mock || portRef._fd === null) {
        return resolve({ closed: true, protocol_info: pi });
      }
      fs.close(portRef._fd, (err) => {
        if (err) return resolve({ error: err.message, protocol_info: pi });
        resolve({ closed: true, protocol_info: pi });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// serialScan() → async { ports, count, platform, protocol_info }
// serialScan — discover available serial port devices by platform
// ---------------------------------------------------------------------------

async function serialScan() {
  const os = require('node:os');
  const platform = os.platform();

  return new Promise((resolve) => {
    let command;
    if (platform === 'darwin') {
      command = 'ls /dev/cu.* /dev/tty.* 2>/dev/null';
    } else if (platform === 'linux') {
      command = 'ls /dev/ttyUSB* /dev/ttyACM* /dev/ttyS* 2>/dev/null';
    } else if (platform === 'win32') {
      command = 'mode 2>nul | findstr /R "COM[0-9]"';
    } else {
      resolve({ ports: [], protocol_info: piUART() });
      return;
    }

    exec(command, { timeout: 5000 }, (err, stdout) => {
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      const ports = lines.map(line => {
        const path = line.trim();
        return {
          path,
          name: path.split('/').pop(),
          likely_device: _guessSerialDevice(path),
        };
      });
      resolve({
        ports,
        count: ports.length,
        platform,
        protocol_info: piUART(),
      });
    });
  });
}

function _guessSerialDevice(path) {
  const p = path.toLowerCase();
  if (p.includes('arduino') || p.includes('acm')) return 'Arduino / AVR';
  if (p.includes('usbserial') || p.includes('ch340') || p.includes('cp210')) return 'USB-Serial adapter';
  if (p.includes('bluetooth')) return 'Bluetooth serial';
  if (p.includes('gps') || p.includes('gnss')) return 'GPS receiver';
  return 'Unknown device';
}

// ---------------------------------------------------------------------------
// spawnProcess(command) → async { stdout, stderr, exitCode, protocol_info }
// ---------------------------------------------------------------------------

async function spawnProcess(command) {
  const pi = piPOSIX();
  return new Promise((resolve) => {
    try {
      exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: err ? (err.code !== undefined ? err.code : 1) : 0,
          protocol_info: pi,
        });
      });
    } catch (err) {
      resolve({ error: err.message, protocol_info: pi });
    }
  });
}

// ---------------------------------------------------------------------------
// parseBytes(hexString) → SYNC { buffer, hex, byteArray, byteCount, protocol_info }
// ---------------------------------------------------------------------------

function parseBytes(hexString) {
  const pi = piBinary();
  try {
    const tokens = String(hexString).trim().split(/\s+/).filter(Boolean);
    const byteArray = tokens.map((t) => parseInt(t, 16));
    const buffer = Buffer.from(byteArray);
    const hex = byteArray.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    return {
      buffer,
      hex,
      byteArray,
      byteCount: byteArray.length,
      protocol_info: pi,
    };
  } catch (err) {
    return { error: err.message, protocol_info: pi };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  httpGet,
  httpPost,
  socketConnect,
  socketSend,
  socketRead,
  socketClose,
  socketUdpSend,
  serialConnect,
  serialSend,
  serialRead,
  serialClose,
  serialScan,
  spawnProcess,
  parseBytes,
};
