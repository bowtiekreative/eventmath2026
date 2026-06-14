# EventMath — AI Reference Skill

Use this skill whenever you are writing, reading, extending, or debugging EventMath
(`.em` files) or the EventMath compiler (`src/`, `runtime/`). Read it in full before
touching any `.em` source or compiler code.

---

## What EventMath Is

EventMath is a **bidirectionally legible programming language**. Every feature
serves two goals simultaneously:

- People can read the code and understand the system without reconstructing it.
- The system can narrate itself back in the same human vocabulary it was written in.

It compiles to plain JavaScript (Node.js and Bun targets) through a six-stage
pipeline: tokenizer → parser → codegen → formatter → validator → runtime.

**Two layers share one compiler:**
- **Reasoning layer** — events, timelines, actions, predictions, chains, desires,
  weights, analogies, conflict detection.
- **Web layer** — reactive signals, components, storage, HTTP, routing, collections.

Both layers compile through the same six-stage pipeline.

---

## The Five Laws

These are non-negotiable. Every feature, every PR, every suggestion must obey them.

1. **Bare words are literal.** Names and identifiers are taken exactly as written.
   `product name` is the variable named "product name". `"product name"` in quotes
   is a string literal. Never conflate them.

2. **Multi-word names are allowed.** Any phrase is a valid name. `last watered`,
   `cart total`, `user email address` — all legal, all distinct.

3. **One word, one meaning.** No overloading. `is` means assignment/equality
   everywhere. `end` closes every block everywhere. `rain` always means a mutable
   value. Never reuse a word for two concepts.

4. **Blocks end with `end`.** No curly braces. No `endfor`, no `endif`. Just `end`.

5. **No silent autocorrect.** If something is wrong, say so plainly and stop.
   Never guess and proceed.

---

## CLI

```bash
node bin/em compile FILE.em                  # → FILE.em.js (node target)
node bin/em compile FILE.em -o OUT.js        # → OUT.js
node bin/em compile FILE.em --target bun     # → bun target
node bin/em run FILE.em                      # compile + run
node bin/em format FILE.em                   # canonical formatting in-place
node bin/em check FILE.em                    # parse + validate, report errors
node bin/em debug FILE.em                    # debug output
```

---

## Compiler Pipeline

```
.em source
  ↓  src/tokenizer.js    Line-oriented. Lead word picks the statement type.
  ↓  src/parser.js       Flat tokens → AST (plain JS objects).
  ↓  src/expression.js   Natural-language expressions → JS operators.
  ↓  src/codegen.js      AST → JavaScript. Two passes: hoist then emit.
  ↓  src/formatter.js    AST → canonical .em source (for auto-format).
  ↓  src/validator.js    Semantic checks: collect declarations, validate refs.
     runtime/eventmath-runtime.js   <10KB UMD, zero deps.
```

When adding a new statement type, wire it through **all six stages** and add:
- a tokenizer method `_tokenizeXxxStmt`
- a parser method `_parseXxxStmt`
- a codegen method `_genXxxStmt`
- a formatter method `_formatXxxStmt`
- validator handling
- a test file entry
- an example file entry

---

## Expression Engine (`src/expression.js`)

Natural-language expressions work everywhere an expression is expected:
`rain`, `star`, `lens`, `guard`, `when`, `filter`, `find`, `sort`, `count`.

| EventMath             | JavaScript        |
|-----------------------|-------------------|
| `A plus B`            | `A + B`           |
| `A minus B`           | `A - B`           |
| `A times B`           | `A * B`           |
| `A divided by B`      | `A / B`           |
| `A more than B`       | `A > B`           |
| `A less than B`       | `A < B`           |
| `A at least B`        | `A >= B`          |
| `A at most B`         | `A <= B`          |
| `A is B`              | `A === B`         |
| `A is not B`          | `A !== B`         |
| `A and B`             | `A && B`          |
| `A or B`              | `A \|\| B`        |
| `not A`               | `!A`              |
| `A is void`           | `A == null`       |
| `A is not void`       | `A != null`       |
| `now`                 | `Date.now()`      |

Operator precedence (lowest to highest): `or` → `and` → `not` → comparison →
`plus/minus` → `times/divided by`.

---

## THE REASONING LAYER

### `event` — a named fact with optional matter

```eventmath
event user signed up
category auth
matter
  email is alice@example.com
  plan  is free
  timestamp is 1704067200
end
end
```

- `category` — an optional string tag for the event type.
- `matter` block — key/value pairs (bare words as keys, any value).
- Events are the atomic unit of EventMath time. Everything else organizes events.

### `layer` — a named collection of events

```eventmath
layer auth events
  user signed up
  password reset
  session expired
end
```

- Layers are ordered lists of events.
- They can be placed on timelines.
- They are the input to `walk`, `run`, `predict`, `explain`, `analogy`, `conflict`.

### `timeline` — an ordered sequence with past/present/future

```eventmath
timeline product launch

past
  planning complete
  mvp shipped
end

present
  beta testing
end

future
  general availability
  v2 planning
end

end
```

- `past`, `present`, `future` are the three time positions.
- Each contains one or more event names or layer names.
- Use `run TIMELINE present` to execute the present events.

### `action` — a named procedure with typed inputs and a return value

```eventmath
action calculate shipping
  door open
    input weight kg
    input destination country
  ground get rate table into rates
  rain base rate is rates default
  when destination country is "US"
    rain base rate is rates domestic
  end
  rain shipping cost is base rate times weight kg
  door closed shipping cost
end
```

- `door open` declares parameters — each `input NAME` is one parameter.
- `door closed VALUE` returns the value (like `return`).
- Body supports all statement types: `rain`, `when`, `lens`, `guard`, etc.
- Call an action: the name itself as an expression, or `run action NAME`.

### `walk` — iterate a layer with the current event bound

```eventmath
walk auth events as current event
  show current event
  when current event category is "auth"
    run current event
  end
end
```

- `current event` (or whatever alias you pick after `as`) is the loop variable.
- `skip` — like `continue`, advance to next item.
- `escape` — like `break`, exit the loop.

### `again until` — loop until a condition is true

```eventmath
mark all done as false

again until all done is true
  set all done to true
  walk project tasks as task
    when task status is not done
      set all done to false
    end
  end
end
```

### `run` — execute a specific event, layer, or timeline position

```eventmath
run event user signed up
run layer auth events
run timeline product launch present
```

### `predict` — forward-projection from a timeline

```eventmath
predict revenue growth across product launch into forecast
show forecast
```

### `chain` — a causal graph with numeric signal values

```eventmath
chain revenue pipeline
  authentic voice leads to trust at value 9
  trust leads to partnership at value 7
  partnership leads to payment at value 620
end
```

- Each link has a `value` — the signal strength at that node.
- Chains are inputs to `evaluate`, `challenge`, `compare`, `grade`.

### `desire` — a subjective goal with a satisfaction condition

```eventmath
desire fair payment
category creator goal
matter
  scenario is brand negotiation
  direction is more than
  satisfied when payment more than market rate
  priority is 3
end
end
```

- `priority` weights the desire in conflict resolution.
- `satisfied when` is an expression tested against the chain values.
- `direction` (`more than`, `less than`, `matches`) sets comparison orientation.

### `assume` — a named constant for reasoning

```eventmath
assume market rate is 80000
assume living cost is 60000
```

Used as baseline values in `evaluate`, `challenge`, `satisfy`, `conflict`.

### `satisfy` — test whether a chain satisfies a desire

```eventmath
satisfy fair payment against revenue pipeline into result
show result
```

### `evaluate` — dimensional analysis of a desire against a chain

```eventmath
evaluate fair payment against revenue pipeline across market axis into report
show report
```

### `explain` — abductive reasoning: find best explanation

```eventmath
explain observations from candidates into best explanation
show best explanation
```

- `candidates` and `observations` are both layers.
- Returns the candidate that best explains the observed pattern.

### `analogy` — compare two events for structural similarity

```eventmath
analogy high workload and unclear goals into similarity score
show similarity score
```

### `weight` — assign probabilistic weight to a matter key

```eventmath
weight workload at 3
weight communication at 1
weight environment at 0.5
```

Used by `explain` and `analogy` to weight fields when scoring.

### `zoom` — inspect the dimensional relationship between states

```eventmath
zoom in on state a and state b into bridge
zoom opposite on bridge into anti bridge
zoom meta on state a and state b and bridge and anti bridge into full field
```

- `zoom in` — the direct transformation between two events.
- `zoom opposite` — the inverse/resistance path.
- `zoom meta` — the full relational field across all four poles.

### `zoom out from` — reconstruct the parent context of a zoom result (v2.18)

```eventmath
zoom in on no income and consistent income into revenue bridge
zoom out from revenue bridge into bridge context
show bridge context
```

Reads the control matter of a zoom result and reconstructs its parent context.
Returns an object with: `source`, `zoom_level`, `parent_level`, `from`, `to`,
`gap_description`, `constituents`, and a `render()` method.

**Syntax:** `zoom out from SOURCE into CONTEXT`

### `zoom expand` — panoramic expansion from one node (v2.18)

```eventmath
event market suppression
category state
matter
  energy is against
  signal is suppressed
end
end

zoom expand on market suppression into suppression field
show suppression field
```

Expands outward from a single event/layer — inventories all matter keys, determines
polarity, and records connections. Source can optionally start with `layer` or
`timeline`.

Returns an object with: `source`, `source_type`, `zoom_level`, `matter`,
`surface_area`, `connections`, `polarity`, `expansion_axis`, and a `render()` method.

**Syntax:** `zoom expand on SOURCE into NETWORK`
- `zoom expand on EVENT into FIELD` — expand from an event
- `zoom expand on layer LAYER into FIELD` — expand from a layer (aggregates all event matter)
- `zoom expand on timeline TIMELINE into FIELD` — expand from a timeline

### `spin` / `fractal` — torus and fractal axis construction

```eventmath
spin market noise into noise torus at dimension -39
spin market signal into signal torus at dimension 39
fractal signal torus and noise torus into market axis
```

### `anchor` / `spine` / `grade` / `extend` — dimensional scaffolding

```eventmath
anchor economic low end at depth -13
anchor economic high end at depth 13
spine economic low end and economic high end into compensation spine
grade fair pay against compensation through compensation spine into pay grade
extend compensation spine with shadow and signal into deep spine
```

### `conflict` / `weigh` — detect tension between desires and resolve it

```eventmath
conflict fair payment and creative freedom for revenue pipeline into tension report
show tension report
weigh tension report into resolution
show resolution
```

- `conflict` returns ALIGNED, COMPETITIVE, or OPPOSED.
- `weigh` uses `priority` values to recommend the best trade-off.

### `challenge` / `compare` — sensitivity and path analysis

```eventmath
challenge market rate in leverage report into sensitivity
show sensitivity

compare waiting chain and leverage chain for fair payment into path comparison
show path comparison
```

### `scrub` — priority sensitivity sweep

```eventmath
scrub tension report into scrub result
show scrub result
```

### `why` / `trace` — causal explanation

```eventmath
why payment from revenue pipeline into reason
show reason

trace payment back through revenue pipeline into causal path
show causal path
```

### `broken` — declare an observed fault state

```eventmath
broken event reading goal not yet reached
matter
  pages so far is 707
  pages needed is 500
  message is You have exceeded your goal
end
end
```

A named negative event, usable in layers and timelines.

### `pulse` — oscillate a matter field on a tick

```eventmath
pulse nucleus presence every 2 tick
```

---

## THE WEB LAYER

### `rain` — a mutable variable (reactive slot)

```eventmath
rain status is loading
rain cart total is 0
rain current user is void
```

- Changes anywhere in the program update this value.
- Use `set NAME to VALUE` (in reasoning contexts) or re-assign with `rain NAME is VALUE`.
- `void` is the explicit empty value (like `null`).

### `star` — an immutable constant

```eventmath
star max results is 20
star api base is "https://api.example.com"
star rate limit is 100
```

### `live rain` — a reactive signal that notifies watchers on change

```eventmath
live rain price is 10
live rain quantity is 1
live rain cart total is 0
```

Compiles to `EventMathSignal`. Downstream `lens` values that reference a `live rain`
automatically recompute when the signal changes.

### `lens` — a derived computed value

```eventmath
lens total is price times quantity
lens discounted is total minus discount
lens show banner is logged in and not dismissed
lens has user is current user is not void
```

When any upstream `live rain` changes, dependent `lens` values recompute.
Safe to use with possibly-void values.

### `sky` — document-level context (title, meta)

```eventmath
sky document title is EventMath — Build With Time
```

### `zone` — a computed slice of a collection

```eventmath
zone visible products is products filtered by active
```

### `mark` / `set` — imperative variable assignment (reasoning contexts)

```eventmath
mark total price as 0
set total price to base price plus tax
set total price to total price plus shipping
```

`mark` declares; `set` updates.

### `check` — assert a condition, report if false

```eventmath
check pages read is greater than goal pages
check books finished is greater than minimum books
```

Emits a runtime assertion. Does not throw; reports the result.

### `when` / `otherwise` — conditional branch

```eventmath
when status is loading
  show loading spinner
end

when cart total at least 50
  rain shipping is free
otherwise
  rain shipping is 4.99
end
```

`otherwise` is the else branch. Multiple `when` blocks are sequential (not else-if).

### `match` / `arm` — pattern switch

```eventmath
match status
  arm loading
    show spinner
  arm ready
    show dashboard
  arm error
    show error state
  arm else
    show not found
end
```

`arm else` is the default case. `arm` values are exact string matches.

### `orbit` — loop over a collection

```eventmath
orbit product in visible products
  lens item total is product price times product quantity
  when product deleted
    skip
  end
  show product
end
```

- `skip` — continue to next item.
- `escape` — break out of the loop.

### `filter` — keep items matching a condition

```eventmath
filter product from products where product active into active products
filter user from users where user role is "admin" into admins
filter order from orders where order total at least 50 into qualifying orders
```

### `find` — first item matching a condition

```eventmath
find product in products where product id is selected id into current product
find user in users where user email is login email into matched user
```

Returns `null` if no match.

### `sort` — reorder a collection

```eventmath
sort products by name into alphabetical
sort products by price descending into most expensive first
sort orders by created at descending into recent orders
```

Default is ascending. Add `descending` to flip.

### `count` — count items, optionally with a condition

```eventmath
count products into product count
count item in cart items where item quantity more than 0 into items in cart
count order from orders where order status is "pending" into pending count
```

### `pipe` — chain a value through transforms

```eventmath
pipe raw email through trim and lowercase into normalized email
pipe user input through sanitize and validate and encode into safe input
```

Each transform name is a JS function in scope.

### `cast` — type conversion

```eventmath
cast raw count as number into count
cast count as text into count label
cast count as boolean into has items
```

### `log` — debug output with source reference

```eventmath
log count
log "Cart total:" with cart total
log a plus b
```

### `guard` — early exit if condition fails

```eventmath
guard session token else reflect void
guard current user is not void else reflect void
guard cart total at least 10 else reflect "Minimum order not met"
```

Compiles to: if condition fails, return the else value immediately.

### `cloud` — a synchronous UI component

```eventmath
cloud product card
  node h2 Product Details
  node p Click to expand
  reflect rendered content
end
```

### `expand cloud` — an async UI component (fetches before rendering)

```eventmath
expand cloud user dashboard
  earth get /api/user/profile into profile
  node h1 Welcome
  reflect profile
end
```

### `node` — an HTML element inside a cloud

```eventmath
node h1 Welcome Back
node p Your cart is ready
node div wrapper content
```

### `reflect` — return a value from a cloud or action

```eventmath
reflect profile
reflect void
reflect "Minimum order not met"
```

Like `return` — exits the component and passes the value up.

### `slot` — children placeholder in a cloud

```eventmath
cloud modal wrapper
  node div header
  slot content
  node div footer
end
```

### `raindrop` — a form input field inside a cloud

```eventmath
cloud login form
  raindrop text username
  raindrop email contact
  raindrop password secret
  raindrop select role
  raindrop checkbox remember me
  raindrop textarea bio
end
```

### `atmosphere` — a CSS style block

```eventmath
atmosphere card style
  style background is white
  style border-radius is 8px
  style padding is 16px
  style box-shadow is 0 2px 4px rgba(0,0,0,0.1)
end
```

### `universe` / `field` — a data schema (blueprint for objects)

```eventmath
universe Product
  field id is string
  field name is string
  field price is number
  field active is boolean
end
```

### `new` — create an instance from a universe

```eventmath
new User into current user
new Product into draft product
```

### `burst` — merge objects (spread)

```eventmath
burst defaults and user config into final config
burst base styles and overrides into merged styles
```

### `earth` — HTTP network calls

```eventmath
earth get /api/products into products
earth post /api/products with new product into created
earth put /api/products/1 with updated into saved
earth delete /api/products/1 into result
```

### `travel` — client-side navigation

```eventmath
travel /dashboard
travel /login
```

### `map` — routing table

```eventmath
map
  route home / as product card
  route dashboard /dashboard as user dashboard
  route nav /nav as header bar
end
```

### `on` / `off` / `trigger` — event bus

```eventmath
on data updated
  observe status
    show sync badge
  end
end

off stale listener

trigger app ready
trigger page viewed with page data
```

### `observe` — watch a value and react on change

```eventmath
observe current user
  when current user
    ground set user cache is current user
  end
end
```

### `on birth` / `on shift` / `on death` — component lifecycle

```eventmath
on birth
  ground get session token into stored token
  rain session token is stored token
end

on shift
  show status bar
end

on death
  clear sync timer
  off data updated
  ground remove session token
end
```

### `every` / `clear` — recurring timers

```eventmath
every 30000 sync data into sync timer
every 5000 ping health into health timer
clear health timer
```

### `attempt` / `collapse` / `always` — error handling (try/catch/finally)

```eventmath
attempt
  earth get /api/products into products
collapse network error
  rain status is offline
always
  show loading complete
end
```

### `await` — explicit async wait inside expand cloud

```eventmath
expand cloud dashboard
  await fetch user data into user data
  await fetch planet list into planets
  reflect planets
end
```

### `pull` / `emit` — module system

```eventmath
pull format date and slugify from utils
pull User and Planet from universes

emit star version
emit cloud planet card
```

### `ground` — persistent key-value storage

```eventmath
ground set user name is ryan
ground set theme is dark
ground get user name into cached name
ground get theme into current theme
ground remove stale cache
```

Compiles to `localStorage` (browser) or a Node.js file-backed store.

### `note` — a comment that stays in the AST

```eventmath
note These events describe the billing system
note ── Section break ──────────────────────────
```

Unlike `//`, `note` is preserved in formatted output and visible to the formatter.

### `show` — output/display a value

```eventmath
show product
show current event
show best explanation
```

Compiles to `console.log` (with the runtime's render method if available).

---

## v2.16 — SQLite, HTTP Server, AI, Manifest

### `ground NAME at PATH` — open a SQLite database

```eventmath
ground contacts at ":memory:"
ground orders at "orders.db"
```

### `draw QUERY from DB into RESULT` — execute SQL

```eventmath
draw "create table contacts (id integer primary key, name text, city text)" from contacts into _
draw "insert into contacts values (1,'Ada','London')" from contacts into _
draw "select * from contacts order by name" from contacts into rows
show rows
```

`_` discards the result. `rows` receives an array of row objects.

### `live draw QUERY from DB into RESULT` — reactive SQL query

```eventmath
live draw "select * from contacts order by id" from contacts into rows
```

`rows` auto-refreshes whenever anything writes to the database. No polling.

### `serve port N` — HTTP server

```eventmath
serve port 3000
  route get "/api/contacts"
    draw "select * from contacts" from contacts into data
    reply data
  end
  route post "/api/orders"
    draw "insert into orders ..." from orders into _
    reply "created"
  end
end
```

- `route get PATH` / `route post PATH` — HTTP route handlers.
- `reply VALUE` — sends the JSON response.
- Compiles to `node:http` (node target) or Bun's `serve()` (bun target).

### `ask QUESTION with DATA into RESULT` — local AI (Ollama)

```eventmath
ask "Which city appears most in this list?" with rows into answer
ask "Give each person a one-sentence bio" with rows into bios
show answer
show bios
```

Requires Ollama running locally (`ollama serve && ollama pull llama3`).
Sends `DATA` as JSON context along with the question.

### `manifest` — self-generating app declaration (capstone form)

```eventmath
manifest contacts app
  store contacts in "contacts.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  summarize contacts as "Give a brief overview of these contacts" with ai at "/api/summary"
  accept contacts at "/api/contacts"
end
```

Eight lines generate a full Node.js/Bun HTTP server with SQLite storage,
reactive live queries, a write endpoint, and an AI summary endpoint.

| Manifest line | What it generates |
|---|---|
| `store TABLE in "FILE" with FIELDS` | SQLite DB open + CREATE TABLE |
| `serve on PORT` | HTTP server on that port |
| `show all TABLE at "/PATH"` | GET route returning all rows |
| `summarize TABLE as "PROMPT" with ai at "/PATH"` | GET route: query rows, send to Ollama with prompt |
| `accept TABLE at "/PATH"` | POST route: parse JSON body, INSERT into table |

---

## v2.17 — Named Patterns (Human-Readable Regex)

`pattern NAME…end` declares a named regex where every part is labeled.
Each part becomes a named capture group `(?<name>…)`.

```eventmath
pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end
```

Compiles to:
```js
const email_address = new RegExp(
  "(?<user>[a-zA-Z0-9._%-+]+)(?<at>@)(?<domain>[a-zA-Z0-9.-]+)(?<extension>\\.[a-zA-Z]{2,})",
  'gm'
);
```

### Pattern vocabulary

**Atoms (what to match)**

| EventMath           | Regex          | Notes                        |
|---------------------|----------------|------------------------------|
| `letters`           | `[a-zA-Z]`     | Single letter (add quantifier) |
| `digits`            | `[0-9]`        | Single digit                 |
| `digit`             | `[0-9]`        | Same as `digits`             |
| `uppercase`         | `[A-Z]`        | Single uppercase letter      |
| `uppercase letters` | `[A-Z]`        | Same as `uppercase`          |
| `lowercase`         | `[a-z]`        | Single lowercase letter      |
| `lowercase letters` | `[a-z]`        | Same as `lowercase`          |
| `hex digit`         | `[0-9a-fA-F]`  | Single hexadecimal digit     |
| `hex digits`        | `[0-9a-fA-F]`  | Same as `hex digit`          |
| `word`              | `\w`           | Word character (letter/digit/_) |
| `whitespace`        | `\s`           | Any whitespace character     |
| `tab`               | `\t`           | Tab character                |
| `newline`           | `\n`           | Newline character            |
| `start of line`     | `^`            | Start of line anchor         |
| `end of line`       | `$`            | End of line anchor           |
| `start of text`     | `^`            | Start of text anchor         |
| `end of text`       | `$`            | End of text anchor           |
| `any text`          | `[\s\S]`       | Any character including newlines |
| `any character`     | `[\s\S]`       | Same as `any text`           |
| `boundary`          | `\b`           | Word boundary (zero-width)   |
| `optional whitespace` | `\s*`        | Zero or more whitespace      |
| `optional attributes` | `[^>]*`      | Anything that isn't `>`      |
| `"literal"`         | escaped        | Exact literal text           |
| `digit N through M` | `[N-M]`       | Digit in range N-M (e.g. `digit 1 through 6` → `[1-6]`) |

**Quantifiers (how many)**

| EventMath       | Regex  | Notes                  |
|-----------------|--------|------------------------|
| `repeated`      | `+`    | One or more (greedy)   |
| `repeated lazily` | `+?` | One or more (lazy)     |
| `lazily`        | `*?`   | Zero or more (lazy)    |
| `optional`      | `?`    | Zero or one            |
| `at least N`    | `{N,}` | N or more              |
| `N through M`   | `{N,M}`| Between N and M times  |

**Combinators (how to combine)**

| EventMath           | Meaning                            |
|---------------------|------------------------------------|
| `A then B`          | A followed by B (sequence)         |
| `A or B`            | A or B (alternation)               |
| `A and B and "C"`   | Character class `[AB C]`           |
| `not "chars"`       | Negated: `[^chars]`                |
| `not digits`        | `[^0-9]`                           |
| `PARTNAME`          | Inline-expand that part's regex    |
| `matches PARTNAME`  | Backreference `\k<partname>`       |

**Part reference rules:**
- `tag` appearing in `opening is "<" then tag then ">"` → the regex for `tag` is
  inline-expanded at that position (no named group wrapping).
- `matches tag` → emits `\k<tag>` (true backreference, requires `tag` to be a
  prior named group).
- Parts are sequential capture groups — they cannot nest. A part named after a
  prior part inline-expands that part's compiled regex.

### Part name limitations

Part names that are EventMath keywords may be silently consumed by the tokenizer:
- **Safe to use:** `tag`, `content`, `user`, `domain`, `prefix`, `suffix`, `open`,
  `close`, `body`, `head`, `foot`, `not`, `to`, `by`, `from` — these tokenize as
  NAME and work fine.
- **Avoid:** `again`, `path`, `mark`, `note` — these are keywords whose tokenizer
  dispatch consumes the entire part line, silently dropping the part.

### `scan` — all matches as an array of groups objects

```eventmath
scan text with email address into found emails
```

Compiles to:
```js
const found_emails = [...text.matchAll(email_address)].map(m => m.groups);
```

`found_emails` is an array of plain objects with one property per named part.

### `seek` — first match as a groups object or null

```eventmath
seek text with email address into first email
```

Compiles to a non-global `.exec()` — no `lastIndex` side effects.
`first_email` is either `{ user, at, domain, extension }` or `null`.

### `replace in` — replace all pattern matches using a template

```eventmath
replace in text with email address using "$<user> at $<domain>" into cleaned
```

Compiles to:
```js
const cleaned = text.replace(email_address, "$<user> at $<domain>");
```

Named groups in the template use `$<name>` syntax (JS native named group replacement).
The pattern already has `gm` flags so all matches are replaced.

**Syntax:** `replace in TEXT with PATTERN using "TEMPLATE" into RESULT`

### Full pattern example

```eventmath
pattern html heading
  open tag  is "<h" then digit 1 through 6 then optional attributes then ">"
  content   is any text lazily
  close tag is "</h" then digit 1 through 6 then ">"
end

mark page as "<h1>Welcome</h1><h2>Chapter One</h2>"

scan page with html heading into headings
```

`headings` is `[{ open_tag: '<h1>', content: 'Welcome', close_tag: '</h1>' }, …]`.

---

## Complete Programs

### Minimal reasoning program

```eventmath
event project done
category milestone
matter
  name is Ship v1
  status is complete
end
end

layer milestones
  project done
end

timeline project

present
  milestones
end

end

run timeline project present
```

### Reactive counter (web layer)

```eventmath
live rain count is 0
lens doubled is count times 2
lens is high is count more than 10

cloud counter display
  on birth
    live rain count is 0
  end
  node h1 Counter
  show count
  show doubled
end
```

### Full API with SQLite (v2.16)

```eventmath
ground orders at "orders.db"

draw "create table if not exists orders (id integer primary key autoincrement, item text, amount real)" from orders into _

live draw "select * from orders order by id desc" from orders into rows

serve port 3000
  route get "/api/orders"
    reply rows
  end
  route post "/api/orders"
    draw "insert into orders (item, amount) values ('" from orders into _
    reply rows
  end
end
```

### Six-line contacts API (manifest mode)

```eventmath
manifest contacts app
  store contacts in "contacts.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  accept contacts at "/api/contacts"
end
```

### Email parser (v2.17 patterns)

```eventmath
pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

mark text as "Contact alice@example.com or bob@corp.org"

scan text with email address into emails
seek text with email address into first email
```

---

## Common Mistakes and Rules

**Never write `//` comments.** Use `note` — it stays in the AST and round-trips
through the formatter.

**`void` is the null value.** `rain token is void`. Never write `null` or
`undefined` in `.em` source.

**`mark` before `set`.** You must declare a variable with `mark NAME as VALUE`
before updating it with `set NAME to VALUE`. In web contexts, `rain NAME is VALUE`
both declares and assigns in one line.

**`door closed` returns, not `return`.** Inside an `action`, `door closed VALUE`
exits with a return value. Bare `door closed` with no value returns nothing.

**`live draw` needs a `ground` first.** Always open the database with
`ground NAME at "PATH"` before using `draw` or `live draw`.

**Sequential parts.** In `pattern` blocks, each part is a sequential capture group.
Parts cannot overlap or nest. If you need `opening` to contain `tag`, put the `tag`
regex inline in `opening`'s expression — don't declare `tag` as a separate part
and reference it in `opening` (they'd each consume their own section of the string).

**`scan` returns an array; `seek` returns one match or null.** Use `scan` when
you expect multiple matches; use `seek` when you expect at most one.

**`manifest` generates everything.** You don't add `ground`, `draw`, `serve`,
`route` manually when using `manifest`. The manifest statement generates all of
that from the declarations.

**`expand cloud` is async; `cloud` is sync.** If a component fetches data (`earth`,
`await`, `draw`), it must use `expand cloud`, not `cloud`.

**Expressions are natural language.** Write `count plus 1`, not `count + 1`.
The expression compiler handles all arithmetic and comparison operators as words.

**Multi-word names use spaces, not underscores.** `cart total` not `cart_total`.
The compiler generates safe JS identifiers internally (`cart_total`). Your source
always uses spaces.

---

## Bun Target

```bash
node bin/em compile FILE.em --target bun -o out.js
bun out.js
```

The bun target uses:
- `Bun.serve()` instead of `node:http` for the HTTP server.
- `bun:sqlite` for SQLite (Bun's built-in, no `node:sqlite` shim needed).
- `await req.json()` for POST body parsing (instead of Buffer.concat streams).

The source `.em` file is identical for both targets. Only the output changes.

---

## Formatting and Style

Run `node bin/em format FILE.em` to apply canonical style:

- 2-space indentation inside blocks.
- `note` lines preserved exactly.
- Multi-word names preserved with spaces.
- Blank lines between top-level declarations.
- String literals in double quotes.

The formatter is a round-trip: `format(parse(source))` is idempotent.

---

## When to Use Each Layer

| Situation | Use |
|---|---|
| Modeling facts, timelines, causation | Reasoning layer: `event`, `layer`, `timeline` |
| Named procedures with inputs | `action` / `door open` / `door closed` |
| Reactive UI state | `live rain`, `lens`, `cloud`, `expand cloud` |
| REST API with SQLite | `ground`, `draw`, `serve`/`route` or `manifest` |
| Full self-generating app (6-8 lines) | `manifest` |
| Text parsing | `pattern`, `scan`, `seek` |
| Local AI reasoning over data | `ask` with an Ollama model |
| Probabilistic / abductive analysis | `weight`, `explain`, `analogy`, `conflict`, `weigh` |
| Causal chain analysis | `chain`, `evaluate`, `challenge`, `compare` |
| Collection processing | `filter`, `find`, `sort`, `count`, `pipe`, `cast` |
| Browser app routing | `map`, `travel`, `cloud`, `earth` |

---

## Repository Map

```
bin/em                         CLI entry point
src/tokenizer.js               Tokenizer — line-oriented, lead word dispatch
src/parser.js                  Parser — tokens → AST
src/expression.js              Natural-language expression compiler
src/codegen.js                 Code generator — AST → JavaScript
src/formatter.js               Formatter — AST → canonical .em
src/validator.js               Semantic validator
runtime/eventmath-runtime.js   <10KB runtime, zero deps
examples/                      Working .em programs (feature demos + real scenarios)
tests/                         Per-feature test suites
spec/                          Language spec and friendly-error catalog
mender/                        Interactive debugger
playground/                    Browser playground
DEVELOPER-GUIDE.md             Architecture + how to add a statement
```

---

## Recalibration Note for AI

EventMath is easy to mistake for "a beginner DSL" because it reads simply. Avoid
that framing — it misses the design goal.

What the language actually values:

- **Legibility is the product, not a convenience.** A feature that makes the
  system harder to see is a regression even if it compiles. When in doubt,
  optimize for "read it once and understand it" — not for cleverness or brevity.

- **The metaphor is load-bearing.** Vocabulary comes from the physical world and
  film-editing: `rain`, `ground`, `lens`, `orbit`, `earth`, `atmosphere`, `cloud`.
  Don't drift into framework jargon. If a word disconnects a reader from the
  picture it names, it's wrong.

- **The Five Laws are enforced, not advisory.** Do not suggest workarounds.

- **Every statement goes end-to-end.** Tokenizer → parser → codegen → formatter →
  validator → tests → example. Half-wired features are not features.

- **The frontier is self-explanation, not more keywords.** System maps, `why`
  queries, trace narration — that's the research edge. New keywords should serve
  that goal or stay out.
