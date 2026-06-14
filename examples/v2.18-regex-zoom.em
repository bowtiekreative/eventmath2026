note v2.18 — new pattern atoms, replace, zoom out from, zoom expand

note ── Email Replace Example ──────────────────────────────────────────

pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

mark contact text as "Reach alice@example.com or bob@corp.org for help"

scan contact text with email address into found emails
seek contact text with email address into first email

replace in contact text with email address using "$<user> [at] $<domain>$<extension>" into redacted contacts

show redacted contacts
show first email

note ── Phone Number Reformat ──────────────────────────────────────────

pattern us phone
  area     is "(" then digits 3 through 3 then ")"
  spacer   is whitespace optional
  prefix   is digits 3 through 3
  dash     is "-"
  number   is digits 4 through 4
end

mark raw phone as "(555) 867-5309"

replace in raw phone with us phone using "$<area> $<prefix>$<dash>$<number>" into formatted phone

show formatted phone

note ── Heading Extraction and Replace ─────────────────────────────────

pattern html heading
  open tag  is "<h" then digit 1 through 6 then optional attributes then ">"
  content   is any text lazily
  close tag is "</h" then digit 1 through 6 then ">"
end

mark page html as "<h1>Welcome to EventMath</h1><h2>Getting Started</h2><h3>Examples</h3>"

scan page html with html heading into headings
replace in page html with html heading using "<span>$<content></span>" into stripped headings

show headings
show stripped headings

note ── Uppercase and Lowercase Patterns ────────────────────────────────

pattern identifier
  start     is uppercase letters
  rest      is lowercase letters and digits and "_" repeated
end

mark sample as "OrderTotal is Amount plus Tax"
seek sample with identifier into first word

show first word

note ── Hex Color Pattern ───────────────────────────────────────────────

pattern hex color
  hash    is "#"
  red     is hex digit 2 through 2
  green   is hex digit 2 through 2
  blue    is hex digit 2 through 2
end

mark colors as "#FF5733 and #1ABC9C and #3498DB"
scan colors with hex color into found colors

show found colors

note ── Zoom Out From Example ───────────────────────────────────────────

event no income
category state
matter
  energy is low
  signal is absent
end
end

event consistent income
category state
matter
  energy is high
  signal is present
end
end

zoom in on no income and consistent income into revenue bridge
zoom out from revenue bridge into bridge context

show bridge context

note ── Zoom Expand Example ─────────────────────────────────────────────

event market suppression
category state
matter
  energy is against
  signal is suppressed
  force is external
end
end

zoom expand on market suppression into suppression field

show suppression field

note ── Zoom Expand on Layer ────────────────────────────────────────────

layer market states
  no income
  market suppression
end

zoom expand on layer market states into market field

show market field
