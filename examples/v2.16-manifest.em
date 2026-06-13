# EventMath v2.16 — manifest mode (capstone)
#
# Eight lines declare a complete contacts API with SQLite storage,
# reactive queries, a write endpoint, and an AI summary endpoint.
# EventMath generates itself from the declaration.
#
# Compile + run:
#   node bin/em compile examples/v2.16-manifest.em -o /tmp/manifest.js
#   node /tmp/manifest.js
#
# Then curl:
#   curl http://localhost:3000/api/contacts
#   curl -X POST http://localhost:3000/api/contacts \
#        -H "Content-Type: application/json" \
#        -d '{"name":"Alice","city":"Portland"}'
#   curl http://localhost:3000/api/summary   (requires Ollama)

manifest contacts app
  store contacts in "contacts.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  summarize contacts as "Give a brief overview of these contacts" with ai at "/api/summary"
  accept contacts at "/api/contacts"
end
