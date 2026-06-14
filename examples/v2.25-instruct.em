note v2.25 — Agent Commands: instruct Hermes and other agents

note ── Basic Agent Instruction ─────────────────────────────────────────────
note Give Hermes a natural language command. It pattern-matches the command
note to an action type: scan, alert, buy, sell, analyze, monitor, or unknown.
note Returns a task envelope with action, status, agent, and taskId.

instruct hermes "scan my system for vulnerabilities" into scan result
show scan result

note ── Analysis Command ──────────────────────────────────────────────────────
note Fundamental analysis commands route to the analyze handler.
note Ticker and quantity are extracted automatically from the command text.

instruct hermes "analyze AAPL fundamentals" into analysis result
show analysis result

note ── Trade Commands ──────────────────────────────────────────────────────────
note Buy and sell commands extract ticker and quantity from the command.

instruct hermes "buy 100 shares of AAPL" into buy order
show buy order

instruct hermes "sell 50 shares of TSLA" into sell order
show sell order

note ── Monitoring Command ─────────────────────────────────────────────────────
note Monitor commands set up continuous observation instructions.

instruct hermes "monitor CPU usage and alert when above 90 percent" into monitor task
show monitor task

note ── Alert Command ─────────────────────────────────────────────────────────
note Alert/notify/send commands route to the alert handler.

instruct hermes "send alert to team about outage" into alert task
show alert task

note ── Multiple Agents ────────────────────────────────────────────────────────
note You can instruct any named agent, not just Hermes.

instruct Athena "analyze market trends for Q3" into athena result
instruct hermes "monitor Athena task completion" into monitor result
show athena result
show monitor result

note ── Task Queue ─────────────────────────────────────────────────────────────
note Tasks are queued to ~/.eventmath/tasks.json for persistence.
note Use taskStatus to check what's queued for an agent.

note ── End of v2.25 Agent Commands Example ─────────────────────────────────────
note Run: em v2.25-instruct.em
note Tasks persist to: ~/.eventmath/tasks.json
