note v2.22 — Hermes Agent: autonomous system orchestrator

note ── Persistent Memory ────────────────────────────────────────────────────
note Store key/value pairs that survive between program runs.
note Persisted to ~/.eventmath/memory.json automatically.

remember "hermes start" as "2026-06-14"
remember "alert threshold" as "0.85"
remember "slack channel" as "#ops-alerts"

note Recall a previously stored value into a named variable.

recall "hermes start" into first run date
recall "alert threshold" into threshold

show first run date
show threshold

note ── OS Control ────────────────────────────────────────────────────────────
note EventMath can control your computer across macOS, Linux, and Windows.
note Control volume, brightness, sleep, and launch apps.

control volume set 60
control brightness set 80

note Launch a specific application
control launch "Spotify"

note Put the machine to sleep (uncomment to actually run)
note control sleep

note ── Messaging ─────────────────────────────────────────────────────────────
note Send alerts through Telegram, Slack, email, or webhooks.
note Credentials are read from environment variables.

send via telegram "Hermes is online" to "123456789"
send via slack "System monitor started" to "#ops-alerts"
send via email "Hermes Status" to "ops@example.com"

note ── Media Control ──────────────────────────────────────────────────────────
note EventMath controls Spotify, system media players, and media keys.

play
control volume up 10

note ── Commerce ──────────────────────────────────────────────────────────────
note Process payments and manage inventory programmatically.

note Charge a customer via Stripe
charge via stripe 29.99 usd to "cus_HermesTest" into payment result

note Refund a charge
refund via stripe charge "pi_3abc123" into refund result

note Sync inventory from Shopify
sync via shopify products into inventory

show payment result
show inventory

note ── Autonomous Agent Loop ──────────────────────────────────────────────────
note The agent block runs its body on a fixed interval — forever.
note Credentials, memory, and OS control all work inside the loop.
note This is what makes Hermes truly autonomous.

agent hermes loop every 15 minutes
  recall "alert threshold" into threshold
  sync via shopify products into catalog
  send via telegram "Hermes heartbeat" to "123456789"
  show catalog
end

note ── End of Hermes Manifest ─────────────────────────────────────────────────
note Run: em v2.22-hermes.em
note Required env vars (only for live operations):
note   TELEGRAM_BOT_TOKEN, SLACK_WEBHOOK_URL,
note   STRIPE_SECRET_KEY, SHOPIFY_STORE, SHOPIFY_ACCESS_TOKEN
