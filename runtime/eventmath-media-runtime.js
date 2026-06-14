'use strict';

/**
 * EventMath Media Runtime v2.22
 * Cross-platform media control: play, pause, stop, next, previous track.
 */

const { exec } = require('child_process');

function execCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ cmd, stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code : 0 });
    });
  });
}

async function playMedia(target) {
  const p = process.platform;
  if (p === 'darwin') {
    if (target && target.startsWith('spotify:')) {
      return execCmd('osascript -e \'tell app "Spotify" to play track "' + target + '"\'');
    }
    if (target) return execCmd('open "' + target + '"');
    return execCmd('osascript -e \'tell app "Spotify" to play\'');
  }
  if (p === 'linux') return execCmd('playerctl play' + (target ? ' || xdg-open "' + target + '"' : ''));
  if (p === 'win32') return execCmd('powershell -c "Add-Type -AssemblyName presentationCore; [System.Windows.Input.MediaCommands]::Play.Execute($null, $null)"');
  return { platform: p, action: 'play', target, status: 'not supported' };
}

async function pauseMedia() {
  const p = process.platform;
  if (p === 'darwin') return execCmd('osascript -e \'tell app "Spotify" to pause\'');
  if (p === 'linux') return execCmd('playerctl pause');
  if (p === 'win32') return execCmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]179)"');
  return { platform: p, action: 'pause', status: 'not supported' };
}

async function stopMedia() {
  const p = process.platform;
  if (p === 'darwin') return execCmd('osascript -e \'tell app "Spotify" to stop\'');
  if (p === 'linux') return execCmd('playerctl stop');
  if (p === 'win32') return execCmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]178)"');
  return { platform: p, action: 'stop', status: 'not supported' };
}

async function nextTrack() {
  const p = process.platform;
  if (p === 'darwin') return execCmd('osascript -e \'tell app "Spotify" to next track\'');
  if (p === 'linux') return execCmd('playerctl next');
  if (p === 'win32') return execCmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]176)"');
  return { platform: p, action: 'next', status: 'not supported' };
}

async function previousTrack() {
  const p = process.platform;
  if (p === 'darwin') return execCmd('osascript -e \'tell app "Spotify" to previous track\'');
  if (p === 'linux') return execCmd('playerctl previous');
  if (p === 'win32') return execCmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]177)"');
  return { platform: p, action: 'previous', status: 'not supported' };
}

module.exports = { playMedia, pauseMedia, stopMedia, nextTrack, previousTrack };
