note v2.28 — Machine Layer: talk to machines precisely

note ── What is This? ──────────────────────────────────────────────────────────
note Computers talk to each other using protocols — agreed-upon rules for
note exchanging data. This layer exposes those protocols directly so you can
note communicate with any machine: web servers, hardware, other programs.
note
note Every result includes a protocol_info field that explains what happened
note at the network/hardware level — a built-in computer science lesson.

note ── HTTP: Talk to Web Servers (OSI Layer 7 — Application) ─────────────────
note HTTP is how browsers talk to web servers. You send a GET request,
note the server sends back a response. It runs over TCP/IP underneath.

fetch "https://api.github.com/users/octocat" into github profile
show github profile

note POST sends data to a server (e.g. submitting a form or calling an API).
note The body is the data you're sending.

fetch "https://httpbin.org/post" with body "{\"action\":\"ping\"}" into post result
show post result

note What you'll see in protocol_info:
note   protocol: HTTP/1.1
note   osi_model_layer: 7
note   what_it_does: HTTP asks a server for a resource and the server sends it back.
note   is_reliable: true   ← HTTP runs over TCP, which guarantees delivery

note ── TCP Sockets: Talk Directly to Machines (OSI Layer 4 — Transport) ───────
note HTTP is built on top of TCP. A TCP socket is a direct connection to
note another machine — no rules about what you send, just raw data.
note This is how HTTP, SSH, FTP, and almost every internet protocol works.

socket connect to "example.com" port 80 into web connection
socket send "GET / HTTP/1.0\r\nHost: example.com\r\n\r\n" to web connection
socket read from web connection into raw response
socket close web connection

show raw response

note You just built a raw HTTP request by hand! What you sent:
note  GET / HTTP/1.0        ← Request line: method, path, HTTP version
note  Host: example.com     ← Required header in HTTP/1.1+
note  (blank line)          ← Signals end of headers

note What protocol_info tells you:
note   protocol: TCP
note   osi_model_layer: 4
note   is_connection_oriented: true   ← TCP handshakes before sending
note   is_reliable: true              ← TCP resends lost packets

note ── UDP: Fast, Fire-and-Forget (OSI Layer 4 — Transport) ──────────────────
note UDP skips the connection handshake. It's faster but unreliable.
note Used for: gaming, video streaming, DNS lookups, IoT sensors.

socket udp send "DISCOVERY" to "255.255.255.255" port 9999

note What protocol_info tells you:
note   protocol: UDP
note   is_reliable: false              ← UDP doesn't resend lost packets
note   is_connection_oriented: false   ← No handshake

note ── Serial/UART: Talk to Hardware (OSI Layer 1 — Physical) ────────────────
note Serial ports connect your computer to hardware: Arduinos, sensors,
note GPS modules, robots, industrial equipment. Data is sent as electrical
note signals at a rate measured in baud (bits per second).

serial connect to "/dev/ttyUSB0" at 9600 baud into arduino
serial send "LED_ON\n" to arduino
serial read from arduino into sensor reading
serial close arduino

show sensor reading

note What protocol_info tells you:
note   protocol: UART   ← Universal Asynchronous Receiver/Transmitter
note   layer: Physical  ← Actual electrical signals on a wire
note   osi_model_layer: 1
note   is_connection_oriented: false   ← Serial has no handshake by default

note Common baud rates: 9600, 19200, 38400, 57600, 115200
note Higher baud = faster, but more susceptible to noise on long cables.

note ── Process Spawn: Run Other Programs ──────────────────────────────────────
note Your EventMath program can launch any shell command and capture output.
note This is how programs talk to each other through the POSIX process model.

spawn "ls -la /tmp" into temp files
show temp files

spawn "uname -a" into system info
show system info

note The result has: stdout, stderr, exitCode, protocol_info
note exitCode 0 = success. Non-zero = something went wrong.

note ── Binary Data: Bytes Are the Foundation ───────────────────────────────────
note Everything in a computer is ultimately bytes — sequences of numbers 0-255.
note Hexadecimal (base 16) is the universal language for expressing bytes.
note 0xFF = 255 = 11111111 in binary. Two hex digits = one byte.

bytes "48 65 6C 6C 6F" into hello bytes
show hello bytes

note That spells "Hello" in ASCII!
note  48 = H    65 = e    6C = l    6C = l    6F = o

bytes "DE AD BE EF" into magic number
show magic number

note "DEADBEEF" is a famous debugging magic number used by
note operating systems to mark uninitialized memory.

note ── A Full Machine Communication Pipeline ───────────────────────────────────
note Real programs combine these layers. Here's what fetching a webpage looks like:
note 1. DNS lookup (UDP, port 53) → resolves example.com to an IP address
note 2. TCP handshake (SYN, SYN-ACK, ACK) → establishes connection
note 3. HTTP GET request (application layer) → asks for the page
note 4. TCP sends response in packets → your browser reassembles them
note 5. TCP teardown (FIN, FIN-ACK, ACK) → closes connection

note When you call: fetch "https://example.com" into result
note EventMath handles steps 2-5 for you. The protocol_info explains each step.

fetch "https://httpbin.org/json" into json response
show json response

note ── End of v2.28 Machine Layer Example ─────────────────────────────────────
note Run: em v2.28-machine.em
note
note OSI Model reference (what the layers mean):
note   Layer 7 — Application  (HTTP, DNS, FTP)
note   Layer 6 — Presentation (TLS encryption, JPEG, UTF-8)
note   Layer 5 — Session      (authentication sessions)
note   Layer 4 — Transport    (TCP = reliable, UDP = fast)
note   Layer 3 — Network      (IP addresses, routing)
note   Layer 2 — Data Link    (Ethernet frames, WiFi packets)
note   Layer 1 — Physical     (electrical signals, fiber optic, radio waves)
