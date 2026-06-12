// EventMath v2.10 — anchor, spine, grade, extend, scrub
// Demonstrates the video-editor vocabulary for dimensional analysis.

// ── Events ──────────────────────────────────────────────────────────────────

event raise requested
event market rate published
event performance review done
event job offer received
event negotiation complete

// ── Chain ───────────────────────────────────────────────────────────────────

chain compensation
  work leads to review at value 82
  review leads to offer at value 95
  offer leads to payment at value 95000
end

// ── Assumptions ─────────────────────────────────────────────────────────────

assume market rate is 80000
assume living cost is 60000

// ── Desires with priority ────────────────────────────────────────────────────

desire fair pay
matter
  direction is more than
  satisfied when payment more than market rate
  priority is 3
end
end

desire job security
matter
  direction is more than
  satisfied when review more than 70
  priority is 2
end
end

// ── Anchors (dimensional poles) ──────────────────────────────────────────────

anchor economic low end at depth -13
anchor economic high end at depth 13

// ── Spine (structural through-line) ─────────────────────────────────────────

spine economic low end and economic high end into compensation spine

// ── Grade (dimensional analysis of a desire against a chain) ─────────────────

grade fair pay against compensation through compensation spine into pay grade

// ── Anchors for emergence tier (D±52) ───────────────────────────────────────

anchor emergence shadow at depth -52
anchor emergence signal at depth 52

// ── Extend the spine to D±52 ─────────────────────────────────────────────────

extend compensation spine with emergence shadow and emergence signal into deep spine

// ── Conflict detection ───────────────────────────────────────────────────────

conflict fair pay and job security for compensation into pay vs security

// ── Trade-off resolution ─────────────────────────────────────────────────────

weigh pay vs security into pay resolution

// ── Priority sensitivity scrub ────────────────────────────────────────────────

scrub pay vs security into pay scrub
