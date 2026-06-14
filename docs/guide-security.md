# EventMath v2.19 Security Layer

**Audience:** Security professionals, developers, and people learning ethical hacking — including those who find traditional tool interfaces difficult to use.

---

## 1. Why This Exists

Wireshark, nmap, Burp Suite, and Metasploit are powerful tools. They are also genuinely difficult to use. Not difficult because security is easy — difficult because the interfaces were designed for people who can memorize dense flag syntax, navigate multi-pane GUIs, and hold multiple windows in focus simultaneously.

That design excludes people. Screen reader users navigate Wireshark's packet tree by repeatedly tabbing through hundreds of unlabeled cells. nmap's flag space (`-sS`, `-sV`, `-sC`, `-T4`, `--script vuln`, `-oX`) requires recall under pressure. Burp Suite's Repeater and Intruder panels have no equivalent in plain text. These are real barriers for people with cognitive disabilities, motor impairments, or visual disabilities — and they are not necessary barriers. The underlying operations are not more complex than what plaintext can describe.

EventMath's security layer translates every major ethical hacking operation into the same plain English syntax the rest of the language uses. A DNS probe looks like a sentence. A port scan reads like a request. A threat model looks like a list of events with weights — because that is what it is.

Authorization is built in as a first-class statement. Before probing anything, you declare what you are permitted to test, who approved it, and when permission expires. That declaration stays in the source file. It is readable by you, your team, and any auditor who looks at the code.

---

## 2. Authorized Use Only

This is a professional tool for authorized security auditing. Everything in this layer sends real network traffic to real systems. An unauthorized port scan is illegal in most jurisdictions. An unauthorized SSL probe that touches a system you do not own may violate computer fraud law even if no damage results.

Before running any probe, you need one of the following:

- You own the target system outright
- You have written permission from the owner covering the specific tests you intend to run
- You are working in an isolated lab environment you control entirely

The `authorize` statement makes this explicit in your code. It is not optional ceremony — it is part of the audit record.

```
authorize web audit q3 2026
  target is "staging.example.com"
  scope is "DNS, headers, SSL, ports 1-1024"
  approved by is "security@example.com"
  expires is "2026-09-30"
end
```

If your authorization block does not cover a specific probe you are about to run, add it to the written permission before you run the probe — not after.

---

## 3. Quick Start

This is a complete, working audit of a single web host. It takes about five minutes to read and under two minutes to run.

```
note ── web host quick audit ───────────────────────────────

authorize quick check
  target is "example.com"
  scope is "DNS, headers, SSL, ports 1-1024"
  approved by is "ops@example.com"
  expires is "2026-12-31"
end

probe dns "example.com" into dns result
probe headers at "https://example.com" into header result
probe ssl at "example.com" into ssl result
probe ports at "example.com" into port result

harden from dns result and header result and ssl result into recommendations

show dns result
show header result
show ssl result
show port result
show recommendations
```

That is twelve lines of active code. Each line does exactly what it says.

---

## 4. Authorization

The `authorize` block compiles to a structured audit record that is attached to the runtime session. It does not perform any network operation. Its purpose is documentation and scope enforcement.

Full syntax:

```
authorize AUDIT NAME
  target is "HOST OR CIDR"
  scope is "DESCRIPTION OF PERMITTED TESTS"
  approved by is "NAME OR EMAIL"
  expires is "DATE"
end
```

All fields are strings. `target` and `scope` accept any value — they are descriptive, not programmatically enforced. `expires` is compared to the current date at runtime. If the current date is past `expires`, the runtime emits a warning before any probe runs. It does not silently proceed.

The compiled output includes the full authorization object in a `__audit__` constant that appears at the top of the generated JavaScript. This makes authorization visible to static analysis tools and log aggregators.

For engagements with multiple targets or multiple testers:

```
authorize external network assessment
  target is "10.0.0.0/8 internal range"
  scope is "host discovery, port scan, SSL, headers — no exploitation"
  approved by is "ciso@client.com"
  expires is "2026-08-15"
end
```

---

## 5. Reconnaissance

### DNS Probe

```
probe dns "target.com" into dns result
show dns result
```

Returns an object with:

- `host` — the queried hostname
- `a_records` — array of IPv4 addresses (all A records)
- `query_time_ms` — round-trip time for the DNS query
- `resolver` — which resolver was used

```
probe mx "target.com" into mail servers
show mail servers
```

Returns:

- `host` — queried hostname
- `mx_records` — array of `{ priority, exchange }` objects, sorted by priority (lowest first)

```
probe whois "target.com" into registration
show registration
```

Returns:

- `domain` — the queried domain
- `registrar` — registrar name
- `registered` — registration date string
- `expires` — expiry date string
- `updated` — last update date string
- `nameservers` — array of nameserver hostnames
- `raw` — the full whois text, for cases where structured parsing fails

### HTTP/HTTPS Headers

```
probe headers at "https://target.com" into header result
show header result
```

Returns:

- `url` — the probed URL
- `status` — HTTP status code (integer)
- `headers` — object of all response headers, lowercased keys
- `security grade` — letter grade A through F
- `missing security headers` — array of header names that were absent

The security grade is calculated from five headers:

| Header | Missing penalty |
|---|---|
| `X-Content-Type-Options` | −1 grade |
| `X-Frame-Options` | −1 grade |
| `Strict-Transport-Security` | −2 grades |
| `Content-Security-Policy` | −1 grade |
| `X-XSS-Protection` | −1 grade |

A site with all five headers present starts at A. Each missing header drops the grade. An F means three or more critical headers are absent.

To check a specific header value:

```
probe headers at "https://target.com" into header result
rain hsts is header result headers "strict-transport-security"
when hsts is void
  show "HSTS not configured"
end
```

### SSL/TLS Certificate

```
probe ssl at "target.com" into ssl result
show ssl result
```

Returns:

- `host` — the probed host
- `subject` — certificate common name (CN field)
- `issuer` — issuing CA name
- `valid from` — certificate start date string
- `valid to` — certificate expiry date string
- `fingerprint` — SHA-256 fingerprint, colon-separated hex
- `days remaining` — integer days until expiry (negative if expired)
- `expired` — boolean

Detecting an expiring certificate:

```
probe ssl at "target.com" into ssl result

when ssl result days remaining less than 30
  show "Certificate expires soon"
  show ssl result valid to
end

when ssl result expired is true
  show "Certificate has expired"
end
```

---

## 6. Port Scanning

The port scanner performs TCP connect probes — a full three-way handshake is completed on each tested port. This is the nmap equivalent of `-sT`. It does not require root or elevated privileges, and it does not send raw packets. It is the appropriate choice for authorized audits on systems you do not control the kernel of.

Standard scan (ports 1–1024):

```
probe ports at "target.com" into open ports
show open ports
```

Full scan (all 65535 ports — slower):

```
probe ports at "target.com" from 1 through 65535 into all open ports
show all open ports
```

Custom range:

```
probe ports at "target.com" from 8000 through 9000 into high ports
show high ports
```

Returns an array of integers representing open port numbers. A host with ports 22, 80, and 443 open returns `[22, 80, 443]`.

To work with the results:

```
probe ports at "target.com" into open ports

walk open ports as port
  when port is 21
    show "FTP open — verify this is intentional"
  end
  when port is 23
    show "Telnet open — unencrypted protocol"
  end
end
```

Speed note: TCP connect scanning is reliable but not fast for large ranges. A full 65535-port scan on a remote host typically takes two to five minutes over a standard internet connection. For internal network audits on gigabit LAN, full scans are considerably faster. The runtime uses concurrent probes with an internal concurrency limit to avoid overwhelming the target.

---

## 7. Network Discovery

For mapping an authorized internal network — finding which hosts are alive on a subnet:

```
discover hosts on "192.168.1.0/24" into live hosts
show live hosts
```

This probes each IP address in the CIDR range on a set of common ports (22, 80, 443, 445, 3389, 8080). If any port responds, the host is considered live.

Returns an array of objects, each with:

- `ip` — the IP address string
- `ports` — array of open port numbers found during discovery

```
discover hosts on "10.0.0.0/24" into internal hosts

walk internal hosts as host
  show host ip
  show host ports
end
```

For subnets larger than /24, the runtime emits a warning about scan duration before beginning. Discovery on a /16 (65536 addresses) can take considerable time and generate significant traffic. Confirm your authorization covers this scope before running.

---

## 8. Traffic Analysis

EventMath's packet capture compiles to `tcpdump` or `tshark` (whichever is available on the host). One of them must be installed and in PATH. Packet capture requires elevated privileges — root on Linux, or membership in the `wireshark` group if tshark is configured for unprivileged capture.

Basic capture:

```
intercept traffic on "eth0" for 10 seconds into packets
show packets
```

Filtered capture (tcpdump/BPF filter syntax):

```
intercept traffic on "eth0" matching "tcp port 80" for 30 seconds into http traffic
show http traffic
```

Common filter strings:
- `"tcp port 443"` — HTTPS traffic only
- `"host 192.168.1.100"` — traffic to or from a specific host
- `"port 53"` — DNS traffic
- `"not port 22"` — exclude SSH

Each captured packet in the result array is an object with:

- `time` — timestamp string from the capture tool
- `src` — source address (IP:port for TCP/UDP)
- `dst` — destination address
- `protocol` — protocol string (TCP, UDP, DNS, HTTP, etc.)
- `length` — packet length in bytes
- `info` — human-readable summary line from tshark/tcpdump

Filtering the results with EventMath's existing collection tools:

```
intercept traffic on "eth0" matching "tcp" for 60 seconds into raw traffic

filter pkt from raw traffic where pkt protocol is "HTTP" into http packets
filter pkt from raw traffic where pkt length more than 1400 into large packets

count http packets into http count
show http count

walk http packets as pkt
  show pkt src
  show pkt info
end
```

Scanning packet info fields with a pattern:

```
pattern http request line
  method  is uppercase letters repeated
  space   is " "
  url     is not whitespace repeated
  rest    is any text lazily
end

walk http packets as pkt
  seek pkt info with http request line into request
  when request is not void
    show request method
    show request url
  end
end
```

---

## 9. Threat Modeling

The `threat` statement maps directly to the EventMath reasoning layer. A threat is structurally identical to an `event` — a named fact with optional matter. The distinction is conceptual: threats describe attack vectors, not observations.

```
threat sql injection
  category web application
  matter
    surface is "login form, search, API parameters"
    likelihood is medium
    impact is high
    owasp is "A03:2021 Injection"
  end
end

threat broken authentication
  category web application
  matter
    surface is "session tokens, password reset flow"
    likelihood is medium
    impact is high
    owasp is "A07:2021 Identification and Authentication Failures"
  end
end

threat security misconfiguration
  category infrastructure
  matter
    surface is "headers, TLS settings, exposed admin interfaces"
    likelihood is high
    impact is medium
    owasp is "A05:2021 Security Misconfiguration"
  end
end
```

Weighting threats by likelihood (0.0 to 1.0):

```
weight sql injection at 0.6
weight broken authentication at 0.5
weight security misconfiguration at 0.8
```

Placing threats on a layer for analysis:

```
layer active threats
  sql injection
  broken authentication
  security misconfiguration
end
```

Predicting attack success probability using the chain and predict engine:

```
chain attack surface
  security misconfiguration leads to exposed entry at value 8
  exposed entry leads to authentication bypass at value 6
  authentication bypass leads to data access at value 7
end

predict attack success from attack surface into risk score
show risk score
```

Modeling conflicting assumptions — for example, when a threat's impact assessment conflicts with a desire for low residual risk:

```
desire low residual risk
  category security goal
  matter
    satisfied when risk score less than 0.3
    priority is 1
  end
end

conflict sql injection and low residual risk for attack surface into tension
show tension
weigh tension into resolution
show resolution
```

`conflict` returns ALIGNED, COMPETITIVE, or OPPOSED. `weigh` uses the priority values to recommend the trade-off.

Full threat table example — generating structured output from a layer:

```
layer application threats
  sql injection
  broken authentication
  security misconfiguration
end

walk application threats as threat
  show threat
  show threat matter owasp
  show threat matter likelihood
  show threat matter impact
end
```

---

## 10. Log Analysis

The pattern system (v2.17) handles security log parsing directly. There is no separate log-parsing API — patterns work on any string, including raw log lines.

### Apache/Nginx Access Log

```
pattern access log entry
  ip        is digits and "." repeated
  space     is " - - ["
  timestamp is not "]" repeated
  close     is "] \""
  method    is uppercase letters repeated
  sep       is " "
  url       is not whitespace repeated
  trail     is any text lazily
end

mark log line as '192.168.1.100 - - [14/Jun/2026:10:23:01 +0000] "GET /admin HTTP/1.1" 403 512'

seek log line with access log entry into access entry
show access entry ip
show access entry method
show access entry url
```

To scan a full log:

```
scan full log text with access log entry into access entries

filter entry from access entries where entry url is "/admin" into admin attempts
count admin attempts into admin count
show admin count
```

### SSH Failed Login

```
pattern ssh failure
  month     is uppercase then lowercase letters at least 2
  day       is " " then digits repeated
  time      is " " then digits and ":" repeated
  host      is " " then not whitespace repeated
  service   is " sshd"
  detail    is any text lazily
  user      is "invalid user " then not whitespace repeated
  from      is " from " then digits and "." repeated
end

scan sshd log with ssh failure into failed logins

count failed logins into failure count
show failure count

filter attempt from failed logins where attempt from is "192.168.1.50" into from single ip
show from single ip
```

### Windows Event Log (text export)

```
pattern windows event
  prefix    is "EventID:"
  event id  is whitespace then digits repeated
  sep       is any text lazily
  account   is "Account Name:" then whitespace then not whitespace repeated
  source    is "Source Network Address:" then whitespace then not whitespace repeated
end

scan event log text with windows event into security events

filter evt from security events where evt event id is "4625" into failed logons
count failed logons into logon failure count
show logon failure count
```

EventID 4625 is a Windows failed logon. EventID 4624 is a successful logon. EventID 4688 is process creation (useful for detecting lateral movement).

---

## 11. Hardening Recommendations

The `harden` statement takes one or more probe result objects and generates a structured recommendations report. It does not probe the network — it analyzes data already collected.

```
probe headers at "https://target.com" into header result
probe ssl at "target.com" into ssl result

harden from header result and ssl result into report
show report
```

To include DNS results:

```
harden from dns result and header result and ssl result and port result into full report
show full report
```

Each item in the report array is an object with:

- `severity` — `"high"`, `"medium"`, or `"low"`
- `finding` — what was found (plain English)
- `recommendation` — what to change

Example output for a misconfigured host:

```
[
  {
    severity: "high",
    finding: "Strict-Transport-Security header is missing",
    recommendation: "Add 'Strict-Transport-Security: max-age=63072000; includeSubDomains' to all HTTPS responses"
  },
  {
    severity: "medium",
    finding: "X-Frame-Options header is missing",
    recommendation: "Add 'X-Frame-Options: DENY' to prevent clickjacking"
  },
  {
    severity: "medium",
    finding: "SSL certificate expires in 12 days",
    recommendation: "Renew certificate before 2026-06-26"
  },
  {
    severity: "low",
    finding: "FTP port 21 is open",
    recommendation: "Disable FTP if not in use; use SFTP (port 22) instead"
  }
]
```

Filtering by severity:

```
harden from header result and ssl result and port result into report

filter item from report where item severity is "high" into critical findings
walk critical findings as finding
  show finding finding
  show finding recommendation
end
```

---

## 12. Complete Walkthrough: Web Application Audit

This is a full audit program — from authorization through recommendations. It covers DNS, headers, SSL, port scanning, threat modeling, log analysis, and hardening. Annotations explain each section.

```
note ── Web Application Security Audit ─────────────────────────────────────
note    Target: staging.example.com
note    Run: node bin/em run audit.em

note ── 1. Authorization ────────────────────────────────────────────────────

authorize q3 web audit
  target is "staging.example.com"
  scope is "DNS, HTTP headers, SSL/TLS, TCP ports 1-1024, threat modeling"
  approved by is "security@example.com"
  expires is "2026-09-30"
end

note ── 2. Reconnaissance ───────────────────────────────────────────────────

probe dns "staging.example.com" into dns result
probe mx "staging.example.com" into mx result
probe headers at "https://staging.example.com" into header result
probe ssl at "staging.example.com" into ssl result
probe ports at "staging.example.com" into open ports

note ── 3. Alert on critical SSL state ──────────────────────────────────────

when ssl result days remaining less than 30
  show "WARNING: Certificate expires soon"
  show ssl result valid to
end

when ssl result expired is true
  show "CRITICAL: Certificate has expired"
end

note ── 4. Threat Model (OWASP Top 10 abbreviated) ──────────────────────────

threat injection attacks
  category owasp
  matter
    surface is "SQL queries, OS commands, LDAP"
    owasp is "A03:2021"
    impact is high
  end
end

threat authentication failures
  category owasp
  matter
    surface is "session management, credential handling"
    owasp is "A07:2021"
    impact is high
  end
end

threat security misconfiguration
  category owasp
  matter
    surface is "headers, TLS, default credentials, open ports"
    owasp is "A05:2021"
    impact is medium
  end
end

weight injection attacks at 0.6
weight authentication failures at 0.5
weight security misconfiguration at 0.7

layer identified threats
  injection attacks
  authentication failures
  security misconfiguration
end

chain application attack chain
  security misconfiguration leads to initial access at value 7
  initial access leads to authentication bypass at value 5
  authentication bypass leads to data exfiltration at value 8
end

predict attack success from application attack chain into risk prediction
show risk prediction

note ── 5. Log Analysis (if log data is available) ──────────────────────────

pattern access log line
  ip     is digits and "." repeated
  sep    is any text lazily
  method is uppercase letters repeated
  space  is " "
  url    is not whitespace repeated
  trail  is any text lazily
end

note (replace log sample with actual log file content)
mark log sample as "10.0.0.5 - - [14/Jun/2026:11:02:44 +0000] \"POST /admin/login HTTP/1.1\" 401 89"

scan log sample with access log line into log entries
show log entries

note ── 6. Hardening Report ─────────────────────────────────────────────────

harden from dns result and header result and ssl result and open ports into audit report

note ── 7. Display Results ──────────────────────────────────────────────────

show dns result
show mx result
show header result security grade
show header result missing security headers
show ssl result days remaining
show open ports

note ── Critical findings only ───────────────────────────────────────────────

filter item from audit report where item severity is "high" into critical items
walk critical items as item
  show item finding
  show item recommendation
end

show "Audit complete"
```

This program is approximately 70 lines with annotations. It compiles and runs with:

```bash
node bin/em run audit.em
```

---

## 13. Accessibility Tips

**EventMath security programs are plain text files.** There are no GUI panels to navigate, no multi-pane interfaces, no icons without labels. Every operation is a line you can read, dictate, or have read to you.

**Screen readers.** Open the `.em` file in any accessible text editor. NVDA and JAWS both work with VS Code in their standard configurations. The language has no brackets, sigils, or punctuation-heavy syntax that causes screen readers to stumble. A line like `probe ssl at "target.com" into ssl result` reads clearly at normal dictation speed.

**Navigation with `note` lines.** Use `note` as section markers. The EventMath formatter preserves `note` lines in the AST — they round-trip through `node bin/em format` unchanged. Add them at the top of each logical section. Most accessible editors treat heading-like lines as navigation landmarks when you configure them to; in VS Code, the Outline panel surfaces any line the EventMath extension registers as a block opener.

**Voice input.** Because syntax is bare words, voice-to-text tools like Dragon NaturallySpeaking transcribe EventMath code accurately. `probe headers at "https://example.com" into header result` is dictatable as spoken English. No bracket balancing, no special-character insertion.

**VS Code with the EventMath extension:**

- Format on save is on by default (`node bin/em format` runs automatically). Every save normalizes indentation and spacing, so you never need to manage whitespace manually.
- The check command (`node bin/em check FILE.em`) reports all parse and validation errors as a plain list. No inline squiggle navigation required — run the check, read the output.
- Recommended VS Code accessibility settings to pair with the EventMath extension:

  ```json
  {
    "editor.accessibilitySupport": "on",
    "editor.renderWhitespace": "none",
    "editor.minimap.enabled": false,
    "editor.lineNumbers": "on",
    "workbench.activityBar.visible": false,
    "editor.wordWrap": "on"
  }
  ```

  `accessibilitySupport: "on"` enables screen reader mode. `wordWrap: "on"` keeps long probe lines visible without horizontal scrolling. Disabling the minimap reduces visual noise for users with low contrast needs.

**Motor considerations.** All EventMath operations are single-line statements. You do not need to enter multi-line constructs to run a probe — a block like `authorize` can be prepared once and reused across multiple audit files with copy-paste or a snippet. The VS Code EventMath extension ships with snippets for every security statement.

**Cognitive load.** Each statement does one thing. `probe dns` does a DNS lookup. `probe ssl` checks a certificate. `harden` generates recommendations. There is no mode switching, no flag memorization, no mental context about what state the tool is in. The audit record is the source file itself.

---

## 14. Reference: All Security Statements

| Statement | What it does | Requires network |
|---|---|---|
| `authorize NAME...end` | Documents permission scope; attaches audit record to session | No |
| `probe dns "host" into R` | DNS A record lookup — returns IP addresses | Yes |
| `probe mx "host" into R` | Mail server (MX) record lookup | Yes |
| `probe whois "host" into R` | Domain registration information | Yes |
| `probe headers at "url" into R` | HTTP response headers and security grade | Yes |
| `probe ssl at "host" into R` | TLS certificate details and expiry | Yes |
| `probe ports at "host" into R` | TCP connect scan, ports 1–1024 | Yes |
| `probe ports at "host" from N through M into R` | TCP connect scan, specified port range | Yes |
| `discover hosts on "cidr" into R` | Network host discovery across a CIDR range | Yes |
| `intercept traffic on "iface" for N seconds into R` | Packet capture (requires tcpdump/tshark, elevated privileges) | Yes |
| `intercept traffic on "iface" matching "filter" for N seconds into R` | Filtered packet capture using BPF filter syntax | Yes |
| `threat NAME...end` | Declare an attack vector (same structure as `event`) | No |
| `harden from X and Y into R` | Generate hardening recommendations from probe results | No |

All other analysis — `weight`, `predict`, `chain`, `conflict`, `weigh`, `filter`, `walk`, `pattern`, `scan` — comes from the standard EventMath reasoning layer and works on security data the same way it works on any other data.

---

## 15. What's Next

The security layer (v2.19) is the probe, capture, and harden surface. Everything else was already there.

The **pattern system (v2.17)** handles log analysis. Apache logs, SSH logs, Windows Event Logs, and any other structured text format are parseable with `pattern` and `scan`. The patterns in section 10 of this document are starting points — adapt the field names and literals to match whatever log format you are working with.

The **prediction and weight engine** handles threat modeling. `predict`, `weight`, `chain`, and `conflict` were designed for causal reasoning under uncertainty. Attack probability modeling is exactly that use case. The threat modeling examples in section 9 show how the existing vocabulary maps directly to OWASP-style risk assessment.

**Combining both layers** is the intended workflow for a real audit. Probes collect data. Patterns parse log evidence. Chains model attack paths. Weights assign likelihood. `harden` closes the loop with concrete recommendations. The full walkthrough in section 12 shows all of these working together.

If you are new to EventMath and starting here: run `node bin/em check FILE.em` on any program before running it. The validator catches undefined variable references, missing `end` statements, and type mismatches before anything hits the network.
