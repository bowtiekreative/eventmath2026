note v2.19 — Security Layer: full audit workflow

note ── Authorization ───────────────────────────────────────────────────
note Declare the scope of this audit before any probes run.
note Every security statement validates against the active authorization.

authorize web audit
  scope is "web app security audit"
  target is "192.168.1.100"
end

note ── DNS Reconnaissance ──────────────────────────────────────────────
note Resolve A records to confirm the target resolves as expected.
note Resolve MX records to map mail infrastructure.

probe dns "192.168.1.100" into dns records
probe dns "mail.example.com" into mx records

show dns records
show mx records

note ── HTTP Header Inspection ───────────────────────────────────────────
note Fetch response headers and check for security-relevant fields:
note Content-Security-Policy, X-Frame-Options, Strict-Transport-Security.

probe headers at "https://192.168.1.100" into http headers

show http headers

note ── SSL Certificate Analysis ─────────────────────────────────────────
note Retrieve the TLS certificate and inspect expiry, issuer, and SANs.

probe ssl at "192.168.1.100" into cert info

show cert info

note ── Port Scan ────────────────────────────────────────────────────────
note Scan the well-known port range to identify exposed services.
note Ports 1 through 1024 cover all IANA-assigned standard services.

probe ports at "192.168.1.100" from 1 through 1024 into open ports

show open ports

note ── Network Discovery ──────────────────────────────────────────────
note Ping-sweep the /24 subnet to find live hosts before deeper probes.

discover hosts on "192.168.1.0/24" into live hosts

show live hosts

note ── Traffic Capture ───────────────────────────────────────────────────
note Capture a brief 5-second sample of HTTP traffic on the main interface.
note Filter to port 80 so the capture stays focused and small.

intercept traffic on "eth0" matching "tcp port 80" for 5 seconds into http traffic

show http traffic

note ── Threat Modeling ───────────────────────────────────────────────────
note Define the threats most relevant to a web application target.
note Each threat carries a category, attack vector, and baseline severity.

threat sql injection
category web
matter
  vector is database input
  severity is critical
  likelihood is high
  mitigations is parameterized queries and input validation
end
end

threat xss
category web
matter
  vector is browser output
  severity is high
  likelihood is medium
  mitigations is output encoding and content security policy
end
end

threat weak tls
category transport
matter
  vector is network intercept
  severity is high
  likelihood is low
  mitigations is tls 1.3 and strong cipher suites
end
end

note Weight the threats by exploitability and business impact.

weight sql injection at 9
weight xss at 7
weight weak tls at 5

note Predict which threats are most likely to be realized given the findings.

predict risk score across sql injection into sql risk
predict risk score across xss into xss risk
predict risk score across weak tls into tls risk

show sql risk
show xss risk
show tls risk

note Check for conflicts between threat mitigations (e.g. CSP may affect app UX).

conflict xss and sql injection for http headers into mitigation tension
show mitigation tension

note ── Log Analysis ─────────────────────────────────────────────────────
note Parse the access log for failed authentication attempts.
note The pattern captures timestamp, source IP, and reason.

pattern failed login
  stamp    is "[" then digits repeated then "]"
  spacer   is whitespace
  source   is digits repeated then "." then digits repeated then "." then digits repeated then "." then digits repeated
  sep      is whitespace
  reason   is "FAILED LOGIN:" then any text lazily
end

mark access log as "[1718323200] 192.168.1.50 FAILED LOGIN: bad password"

scan access log with failed login into login failures
seek access log with failed login into first failure

show login failures
show first failure

note ── Hardening Recommendations ────────────────────────────────────────
note Synthesize findings from all probes into a prioritized hardening report.
note Sources are the data collected above — the harden statement produces
note a structured set of recommendations ordered by severity.

harden from cert info and http headers and open ports into security report

show security report

note ── Audit Complete ─────────────────────────────────────────────────
note Display all gathered data in a single summary pass.

show dns records
show mx records
show http headers
show cert info
show open ports
show live hosts
show login failures
show security report
