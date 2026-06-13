# EventMath v2.16 — reactive live draw example
#
# `live draw` subscribes to a ground. Any write to the ground automatically
# refreshes the result — no polling, no manual re-query.
#
# The server below always returns fresh data because `rows` is updated the
# moment a POST writes to the database.
#
# Compile + run:
#   node bin/em compile examples/v2.16-live.em -o /tmp/live.js
#   node /tmp/live.js
#
# Test it:
#   curl http://localhost:3000/api/contacts
#   curl -X POST http://localhost:3000/api/contacts/add
#   curl http://localhost:3000/api/contacts   # see the new row

ground contacts at ":memory:"

draw "create table contacts (id integer primary key autoincrement, name text, city text)" from contacts into _
draw "insert into contacts values (null,'Ada Lovelace','London'),(null,'Grace Hopper','New York')" from contacts into _

live draw "select * from contacts order by id" from contacts into rows

serve port 3000
  route get "/api/contacts"
    reply rows
  end
  route post "/api/contacts/add"
    draw "insert into contacts values (null,'Margaret Hamilton','Boston')" from contacts into _
    reply rows
  end
end
