// EventMath v2.8 — Conflict Detection & Weighted Trade-offs
// Demonstrates: priority on desires, conflict detection, weigh resolution

assume market rate is 500
assume creative floor is 50

// ── Chain under analysis ─────────────────────────────────────────────
chain leverage chain
  authentic voice leads to rate card published at value 9
  rate card published leads to direct outreach at value 12
  direct outreach leads to inbound brand interest at value 8
  inbound brand interest leads to negotiation at value 6
  negotiation leads to payment at value 620
  payment leads to reach expansion at value 18500
end

// ── Two desires with explicit priority ───────────────────────────────
desire fair payment
category creator goal
matter
  scenario is brand negotiation
  direction is more than
  satisfied when is payment more than market rate
  priority is 3
end
end

desire creative freedom
category creator goal
matter
  scenario is brand partnership
  direction is more than
  satisfied when is creative control more than creative floor
  priority is 2
end
end

// ── Detect conflict between the two desires ───────────────────────────
// ALIGNED    — both can be satisfied without trade-offs
// COMPETITIVE — partial tension, both viable but competing
// OPPOSED    — one blocks the other; explicit trade-off required
conflict fair payment and creative freedom for leverage chain into tension report
show tension report

// ── Optimal trade-off recommendation using priority weights ───────────
weigh tension report into resolution
show resolution
