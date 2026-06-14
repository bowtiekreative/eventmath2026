'use strict';

/**
 * EventMath OS Runtime v2.22
 * Cross-platform OS control: volume, sleep, shutdown, launch, brightness.
 */

const { exec } = require('child_process');

function getPlatform() {
  return process.platform;
}

function execCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ cmd, stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code : 0 });
    });
  });
}

async function controlVolume(action, value) {
  const p = getPlatform();
  if (p === 'darwin') {
    if (action === 'set') return execCmd('osascript -e \'set volume output volume ' + value + '\'');
    if (action === 'up') return execCmd('osascript -e \'set volume output volume (output volume of (get volume settings) + ' + value + ')\'');
    if (action === 'down') return execCmd('osascript -e \'set volume output volume (output volume of (get volume settings) - ' + value + ')\'');
    if (action === 'mute') return execCmd('osascript -e \'set volume with output muted\'');
    if (action === 'unmute') return execCmd('osascript -e \'set volume without output muted\'');
  }
  if (p === 'linux') {
    if (action === 'set') return execCmd('pactl set-sink-volume @DEFAULT_SINK@ ' + value + '%');
    if (action === 'up') return execCmd('pactl set-sink-volume @DEFAULT_SINK@ +' + value + '%');
    if (action === 'down') return execCmd('pactl set-sink-volume @DEFAULT_SINK@ -' + value + '%');
    if (action === 'mute') return execCmd('pactl set-sink-mute @DEFAULT_SINK@ 1');
    if (action === 'unmute') return execCmd('pactl set-sink-mute @DEFAULT_SINK@ 0');
  }
  if (p === 'win32') {
    return execCmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"');
  }
  return { platform: p, action, value, status: 'executed' };
}

async function controlSleep() {
  const p = getPlatform();
  if (p === 'darwin') return execCmd('pmset sleepnow');
  if (p === 'linux') return execCmd('systemctl suspend');
  if (p === 'win32') return execCmd('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
  return { platform: p, action: 'sleep', status: 'not supported' };
}

async function controlShutdown() {
  const p = getPlatform();
  if (p === 'darwin') return execCmd('sudo shutdown -h now');
  if (p === 'linux') return execCmd('sudo shutdown -h now');
  if (p === 'win32') return execCmd('shutdown /s /t 0');
  return { platform: p, action: 'shutdown', status: 'not supported' };
}

async function controlRestart() {
  const p = getPlatform();
  if (p === 'darwin') return execCmd('sudo shutdown -r now');
  if (p === 'linux') return execCmd('sudo reboot');
  if (p === 'win32') return execCmd('shutdown /r /t 0');
  return { platform: p, action: 'restart', status: 'not supported' };
}

async function controlLaunch(app) {
  const p = getPlatform();
  if (p === 'darwin') return execCmd('open -a "' + app + '"');
  if (p === 'linux') return execCmd('xdg-open "' + app + '" || ' + app.toLowerCase() + ' &');
  if (p === 'win32') return execCmd('start "" "' + app + '"');
  return { platform: p, action: 'launch', app, status: 'not supported' };
}

async function controlBrightness(action, value) {
  const p = getPlatform();
  if (p === 'darwin') return execCmd('osascript -e \'tell application "System Events" to set brightness of screen 1 to ' + (value / 100) + '\'');
  if (p === 'linux') return execCmd('brightnessctl set ' + value + '%');
  return { platform: p, action: 'brightness', value, note: 'not supported on this platform' };
}

module.exports = { controlVolume, controlSleep, controlShutdown, controlRestart, controlLaunch, controlBrightness, getPlatform };
