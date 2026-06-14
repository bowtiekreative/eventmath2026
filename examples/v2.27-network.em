note v2.27 — Offline + Network: Work offline, discover and connect to networks

note ── Check Connectivity ─────────────────────────────────────────────────────
note Pings 8.8.8.8 to verify you're online. Returns { online, latencyMs }.

offline check into connectivity
show connectivity

note ── Discover Available Networks ───────────────────────────────────────────
note Scans for visible WiFi networks (requires platform WiFi tools).
note Returns array sorted by signal strength: [{ ssid, signal, security }]

network scan into available networks
show available networks

note ── Connect to a Specific Network ─────────────────────────────────────────
note Connect to a known network by SSID.
note Use "with password" for secured networks.

network connect to "CoffeeShop_Free" into cafe connection
show cafe connection

note ── Connect with Password ─────────────────────────────────────────────────

network connect to "HomeNetwork" with password "my-wifi-password" into home connection
show home connection

note ── Offline Data Cache ─────────────────────────────────────────────────────
note Cache data for offline use. TTL in hours. Stored at ~/.eventmath/cache/
note Key is a string label for the data slot.

offline cache "market-data" for 24 hours

note ── Read from Cache ─────────────────────────────────────────────────────────
note Read previously cached data back by key. Returns null if missing or expired.

offline read "market-data" into cached prices
show cached prices

note ── Combined Offline Pipeline ──────────────────────────────────────────────
note Full workflow: check connectivity → scan networks → connect → cache results.

offline check into status
network scan into networks
network connect to "Open_Cafe" into wifi
offline cache "session" for 6 hours
offline read "session" into session data
show status
show wifi
show session data

note ── Platform Support ───────────────────────────────────────────────────────
note macOS   — uses airport + networksetup
note Linux   — uses nmcli
note Windows — uses netsh
note
note Network scan returns empty array if WiFi tools are not available.
note Cache always works — filesystem-only, no WiFi required.

note ── End of v2.27 Network + Offline Example ─────────────────────────────────
note Run: em v2.27-network.em
note Cache location: ~/.eventmath/cache/
