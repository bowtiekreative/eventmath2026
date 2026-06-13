// EventMath v2.13 — Expression Engine + Reactive Signals
// Natural-language arithmetic and logic in every assignment.
// Operators are reserved words; everything else is a name or literal.

// ── Arithmetic expressions ────────────────────────────────────────────
// The Five Laws hold: operators split; bare words are literal strings.

lens total is price times quantity
lens discounted is total minus discount
lens tax is total times 0.08
lens final price is discounted plus tax
lens average is total divided by item count

// ── Comparison expressions ────────────────────────────────────────────
lens is admin is role is "admin"
lens is premium is plan more than 1
lens can checkout is cart items at least 1
lens shipping free is subtotal at least 50

// ── Boolean logic ─────────────────────────────────────────────────────
lens show banner is logged in and not dismissed
lens show fallback is not ready or timed out
lens valid form is username is not void and password is not void

// ── Null checks ───────────────────────────────────────────────────────
lens has user is current user is not void
lens no session is session token is void
guard current user is not void else reflect void

// ── Rain with expressions ─────────────────────────────────────────────
rain total price is base price plus shipping cost
rain status message is "Loading…"
rain item count is 0

// ── Star with expressions (constants) ────────────────────────────────
star max retries is 3
star api base is "https://api.example.com"
star rate limit is requests per minute at most 100

// ── live rain: reactive signals ───────────────────────────────────────
// A live rain value notifies watchers when it changes.
// Think of it like a bus on the timeline — when the signal fires,
// connected clips update automatically.

live rain count is 0
live rain user name is void
live rain cart total is 0

// ── Guard with expressions ────────────────────────────────────────────
guard count more than 0 else reflect void
guard user name is not void else reflect void
guard cart total at least 10 else reflect "Minimum order not met"

// ── Match remains pattern-based (not expression) ─────────────────────
rain status is loading

match status
  arm loading
    show loading spinner
  arm ready
    show content
  arm error
    show error message
  arm else
    show not found
end

// ── Orbit with lens inside ────────────────────────────────────────────
rain items is active list

orbit item in items
  lens item total is item price times item quantity
  when item deleted
    skip
  show item
end

// ── Full component: shopping cart ─────────────────────────────────────
expand cloud cart summary
  on birth
    ground get cart items into cart items
    rain item count is 0
    rain cart total is 0
  end

  live rain cart total is 0

  orbit item in cart items
    lens line total is item price times item quantity
    rain cart total is cart total plus line total
    rain item count is item count plus 1
  end

  lens tax amount is cart total times 0.09
  lens order total is cart total plus tax amount
  lens qualifies for free shipping is cart total at least 50

  guard item count more than 0 else reflect void

  show cart summary
end
