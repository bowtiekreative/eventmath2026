# EventMath v2.16 — AI ask example
#
# Combines SQLite ground + draw (Phase 2) with ask (Phase 4).
# Requires Ollama running locally: ollama serve && ollama pull llama3
#
# Compile + run:
#   node bin/em compile examples/v2.16-ask.em -o /tmp/ask.js
#   node /tmp/ask.js

ground contacts at ":memory:"

draw "create table contacts (id integer primary key, name text, city text)" from contacts into _
draw "insert into contacts values (1,'Ada Lovelace','London'),(2,'Grace Hopper','New York'),(3,'Margaret Hamilton','Boston')" from contacts into _

draw "select name, city from contacts" from contacts into rows

ask "Which city appears most in this list?" with rows into answer
ask "Give each person a one-sentence bio based on their name" with rows into bios
