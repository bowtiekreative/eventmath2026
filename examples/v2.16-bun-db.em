# v2.16 — a SQLite-backed ground, queried with draw.
# Compile for Bun:  ./bin/em compile examples/v2.16-bun-db.em --target bun
# Then run:         bun examples/v2.16-bun-db.em.js
# (Runs under node too — node:sqlite is used when Bun isn't present.)

ground contacts at ":memory:"

draw "create table contacts (name, city)" from contacts into setup
draw "insert into contacts values ('Ada', 'London'), ('Grace', 'New York')" from contacts into seed

draw "select name, city from contacts order by name" from contacts into rows
show rows
