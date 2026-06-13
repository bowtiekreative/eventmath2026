# EventMath v2.17 — named patterns (human-readable regex)
#
# Pattern blocks give every part of a regular expression a name.
# EventMath compiles them to named-capture regex. Results have
# named properties you can access directly.
#
# Compile + run:
#   node bin/em compile examples/v2.17-pattern.em -o /tmp/pattern.js
#   node /tmp/pattern.js

# ── Email address ────────────────────────────────────────────
pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

# ── HTML headings ─────────────────────────────────────────────
pattern html heading
  tag     is "h" then digit 1 through 6
  opening is "<" then tag then optional attributes then ">"
  content is any text lazily
  closing is "</" then matches tag then ">"
end

# ── Usage ─────────────────────────────────────────────────────
mark source as "<h1>Welcome</h1><h2>Chapter One</h2>"

scan source with html heading into all headings

walk all headings as heading
  show heading.tag
  show heading.content
end
