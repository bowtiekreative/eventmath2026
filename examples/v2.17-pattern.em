# EventMath v2.17 — named patterns (human-readable regex)
#
# Pattern blocks give every part of a regular expression a name.
# EventMath compiles them to named-capture regex. Results have
# named properties you can access directly.
#
# Compile + run:
#   node bin/em compile examples/v2.17-pattern.em -o /tmp/pattern.js
#   node /tmp/pattern.js

# ── Email address ────────────────────────────────────────────────
pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

# ── HTML headings (sequential — each part matches in order) ──────
# Parts declare a sequence: open tag, then content, then close tag.
# All three become named capture groups in the compiled regex.
pattern html heading
  open tag  is "<h" then digit 1 through 6 then optional attributes then ">"
  content   is any text lazily
  close tag is "</h" then digit 1 through 6 then ">"
end

# ── Duplicate word detection (backreference) ─────────────────────
# 'matches word' emits \k<word> — matches the same text word captured.
pattern duplicate word
  word is letters repeated
  gap  is whitespace repeated
  dup  is matches word
end

# ── Usage ────────────────────────────────────────────────────────
mark page as "<h1>Welcome</h1><h2>Chapter One</h2>"

scan page with html heading into headings

mark emails as "Contact alice@example.com or bob@corp.org"

scan emails with email address into found emails

seek emails with email address into first email
