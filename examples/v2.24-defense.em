note v2.24 — Defense Layer: watchdog, sweep, quarantine, inoculate

note ── Watchdog: Self-Healing Monitor ────────────────────────────────────────
note Watch a process or URL. Fires a callback on status change (up→down, down→up).
note Non-blocking — creates a background interval, returns immediately.

watchdog "my-api" every 2 minutes into api status
watchdog "http://localhost:3000/health" every 30 seconds into health check

note ── System Sweep ────────────────────────────────────────────────────────────
note Scan for threats: suspicious processes, files, and network connections.
note sweepSystem runs all three sweeps and merges results.

sweep system into system threats

note Targeted sweeps for specific surfaces:

sweep processes into suspicious processes
sweep files at "/tmp" into temp file threats

show system threats
show suspicious processes
show temp file threats

note ── Quarantine ────────────────────────────────────────────────────────────
note Move flagged items to ~/.eventmath/quarantine/ — never deleted, always logged.

quarantine from system threats into quarantine log
show quarantine log

note You can also quarantine a specific file path directly:
note quarantine "/tmp/exploit.sh" into removed files

note ── Inoculate ─────────────────────────────────────────────────────────────
note Terminate suspicious processes identified in a sweep result.
note Refuses to kill PID ≤1 or system-critical processes (init, launchd, etc.).

inoculate from suspicious processes

note Inoculate a specific PID:
note inoculate 12345 from suspicious processes

note ── Combined Defense Pipeline ──────────────────────────────────────────────
note Full sweep → quarantine → inoculate in one program flow.

sweep system into full scan
quarantine from full scan into safe log
inoculate from full scan

show safe log

note ── End of v2.24 Defense Example ────────────────────────────────────────────
note Run: em v2.24-defense.em
note Quarantine manifest: ~/.eventmath/quarantine/manifest.json
note Watchdog uses setInterval — keep the process alive for continuous monitoring.
