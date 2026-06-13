# EventMath v2.16 — HTTP server example
#
# This program opens a SQLite-backed ground, seeds it, then starts an HTTP
# server with two routes. Run with:
#
#   node examples/v2.16-serve.em.js        # compiled node output
#   bun  examples/v2.16-serve.em.bun.js    # compiled bun output
#
# Compile:
#   node bin/em examples/v2.16-serve.em -o examples/v2.16-serve.em.js
#   node bin/em examples/v2.16-serve.em -o examples/v2.16-serve.em.bun.js --target bun

ground contacts at ":memory:"

draw "create table contacts (id integer primary key, name text, city text)" from contacts into _
draw "insert into contacts values (1,'Ada Lovelace','London'),(2,'Grace Hopper','New York')" from contacts into _

serve port 3000
  route get "/api/contacts"
    draw "select * from contacts order by id" from contacts into rows
    reply rows
  end
  route get "/api/contacts/london"
    draw "select * from contacts where city = 'London'" from contacts into london
    reply london
  end
end
