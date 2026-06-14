note v2.23 — Organizational Intelligence: incentive mapping

note ── Role Definitions ───────────────────────────────────────────────────
note Define each role with its core focus, time horizon, and key incentives.

role CEO
  focus profit growth market share
  horizon yearly
  incentives revenue stock valuation expansion
end

role VP of Product
  focus roadmap delivery customer satisfaction
  horizon quarterly
  incentives launches retention revenue
end

role Engineering Manager
  focus team velocity code quality stability
  horizon monthly
  incentives uptime delivery technical debt
end

role Engineer
  focus shipping quality testing
  horizon weekly
  incentives features bugs performance
end

note ── Organizational Hierarchy ─────────────────────────────────────────────
note List roles from most senior to most junior.

hierarchy company
  CEO
  VP of Product
  Engineering Manager
  Engineer
end

note ── Incentive Mapping ───────────────────────────────────────────────────
note Map incentive alignment between any two roles.
note Score: 0 = fully misaligned, 100 = fully aligned.

incentive CEO and Engineer in company into exec engineer gap
incentive CEO and Engineering Manager in company into exec manager gap
incentive VP of Product and Engineer in company into product engineer gap

show exec engineer gap
show exec manager gap
show product engineer gap

note ── Alignment Across a Group ───────────────────────────────────────────
note Align all roles for a specific topic (e.g. "cost reduction").

align CEO and VP of Product and Engineering Manager for cost reduction in company into cost alignment
show cost alignment

note ── Full Team Alignment ──────────────────────────────────────────────────
note No topic — checks overall incentive alignment across the hierarchy.

align CEO and VP of Product and Engineering Manager and Engineer in company into team alignment
show team alignment

note ── End of v2.23 Incentive Example ────────────────────────────────────────
note Run: em v2.23-incentive.em
