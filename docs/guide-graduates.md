# EventMath: A Comprehensive Guide for Graduates

> For readers who have used at least one programming language before and want to understand not just how EventMath works, but why it was designed the way it was.

---

## What EventMath Is

### Language philosophy: bidirectional legibility, the compiler as documentation

Most programming languages are designed to be read by machines first and humans second. Comments are added after the fact to explain what the code does. Documentation is written separately and drifts out of sync. The program and the description of the program live in different places.

EventMath inverts this. The design goal is **bidirectional legibility**: code that a person can read and understand without reconstruction, and a system that can narrate itself back in the same vocabulary it was written in. The language is not a DSL (domain-specific language) dressed up to look friendly. It is a general-purpose language where legibility is the primary design constraint, not a convenience feature layered on top.

This has a concrete consequence: if a feature makes the system harder to read, it is a regression even if it compiles and runs correctly. The compiler is not just a tool that converts source to JavaScript — it is the system's documentation engine. The `why`, `map`, and `trace` commands produce structured explanations by reading the same AST that generates the runtime code. There is no separate documentation to maintain.

The vocabulary is drawn from physical and cinematic metaphors: `rain` (a mutable value that flows and changes), `ground` (persistent storage, solid and stable), `lens` (a derived view that recomputes when its source changes), `orbit` (looping around a collection), `earth` (reaching out across the network), `cloud` (a UI component, something formed from air). These words are not decorative. They carry semantic weight. When you read `live rain price is 10`, you know immediately that `price` is a reactive, changing value. When you read `lens total is price times quantity`, you know `total` is computed from something upstream.

### Two layers sharing one compiler: reasoning layer and web layer

EventMath has two distinct modes of programming, and they compile through the same six-stage pipeline.

The **reasoning layer** is for modeling facts, time, causation, and inference. It gives you events, timelines, causal chains, desires, conflict detection, probabilistic weights, and abductive reasoning. This is the layer you use when you want to represent and analyze a system — a business process, a project trajectory, a decision under uncertainty.

The **web layer** is for building software: reactive state, UI components, HTTP servers, database access, routing, and local AI integration. This is the layer you use when you are shipping something that runs.

The two layers are not separate files or separate compilers. They are two vocabularies within the same language, and they compose freely. A reasoning layer analysis can feed a web layer API. A web layer component can display the result of a causal chain evaluation. The same `when`/`otherwise` conditional works in both.

### How it compiles: tokenizer → parser → codegen → formatter → validator → runtime

EventMath source (`.em` files) passes through six stages before running:

1. **Tokenizer** (`src/tokenizer.js`) — Reads source line by line. The first word of each line determines what kind of statement it is. This line-oriented, lead-word dispatch is what makes multi-word names possible: the tokenizer knows where each statement begins and can safely treat everything after the keyword as a name or expression.

2. **Parser** (`src/parser.js`) — Converts the flat token stream into an Abstract Syntax Tree (AST) — a plain JavaScript object tree that represents the structure of the program.

3. **Expression compiler** (`src/expression.js`) — Natural-language expressions like `price times quantity` and `count at least 10` are converted into their JavaScript equivalents (`price * quantity`, `count >= 10`). This stage handles operator precedence, void checks, and all arithmetic and comparison operators.

4. **Code generator** (`src/codegen.js`) — Walks the AST and emits JavaScript. Two passes: first hoist declarations, then emit statements in order. The output targets either Node.js or Bun.

5. **Formatter** (`src/formatter.js`) — Walks the same AST and emits canonical `.em` source. The formatter is a round-trip: `format(parse(source))` is idempotent. This is what `em format` uses.

6. **Validator** (`src/validator.js`) — Semantic checks: collect declarations, validate references, catch undefined names before runtime. Currently non-blocking (prints warnings) to allow incremental development.

The **runtime** (`runtime/eventmath-runtime.js`) is a single file under 10KB with zero external dependencies. It provides reactive signals (`EventMathSignal`), event execution, rendering helpers, and the chain/desire/conflict analysis engine.

---

## The Five Laws

These are not style guidelines. They are enforced by the language design itself, and every feature in EventMath exists within their constraints.

### Law 1: Bare words are literal

Names and identifiers are taken exactly as written. `product name` is the variable named `product name`. `"product name"` in double quotes is a string literal containing that text.

**Why it exists:** In most languages, variables are single tokens (`productName`, `product_name`) and string literals are quoted. EventMath allows multi-word names (Law 2), so the distinction between a name and a string must be made by quoting, not by the absence of spaces. The bare word is always the name. The quoted form is always the literal text.

**What happens if you break it:**

```eventmath
note WRONG — comparing a variable to itself
when status is status
  show always true
end

note RIGHT — comparing a variable to a string literal
when status is "loading"
  show loading spinner
end
```

### Law 2: Multi-word names are allowed

Any phrase is a valid identifier. `last watered`, `cart total`, `user email address` — all legal, all distinct. The compiler generates safe JavaScript identifiers internally (`cart_total`, `user_email_address`). Your source always uses spaces.

**Why it exists:** Systems have concepts with natural names that span multiple words. Forcing programmers to compress `cart total` into `cartTotal` or `cart_total` is a legibility tax paid on every line the code is read. EventMath refuses that tax. The internal JavaScript identifiers are an implementation detail the programmer never sees.

**What happens if you break it:**

```eventmath
note WRONG — underscore notation is not EventMath style
rain cart_total is 0

note RIGHT — multi-word name with spaces
rain cart total is 0
```

### Law 3: One word, one meaning

No overloading. `is` means assignment or equality comparison everywhere. `end` closes every block everywhere. `rain` always means a mutable value. A word never means two different things depending on context.

**Why it exists:** Overloaded keywords create cognitive load. The reader must infer meaning from context. EventMath eliminates that inference requirement. When you see `end`, you know it closes a block — any block. When you see `is`, you know it either assigns or compares. The parser resolves which interpretation applies structurally, not by keyword switching.

**What happens if you break it:** You cannot break this law from user code — the language simply does not give you the facility to overload a keyword. Attempting to use `end` or `rain` as a variable name will be parsed as the keyword, not a name.

### Law 4: Blocks end with `end`

No curly braces. No `endfor`, `endif`, `endwhile`. Every block — `when`, `action`, `walk`, `cloud`, `pattern`, `serve`, `again until`, everything — closes with the bare word `end`.

**Why it exists:** Consistent block termination removes a whole class of syntactic decisions. You do not need to remember that `if` uses `end if` while `for` uses `end for` (as some languages do). You do not need to track mismatched braces. The `end` is unambiguous and visually scannable.

**What happens if you break it:**

```eventmath
note WRONG — no braces, no endif
when status is "loading" {
  show spinner
}

note RIGHT
when status is "loading"
  show spinner
end
```

### Law 5: No silent autocorrect

If something is wrong, the compiler says so plainly and stops. It does not guess what you meant and proceed. It does not silently drop unrecognized statements. It does not default to a behavior that might be what you intended.

**Why it exists:** Silent failures are the most expensive kind. A system that guesses and proceeds can run for months before the guessed behavior causes a visible problem. EventMath treats an unclear input as an error, not an opportunity to be helpful. This is especially important in the reasoning layer, where a silently dropped `weight` statement could corrupt an analysis without any indication something went wrong.

**What happens if you break it:** You cannot — this law governs the compiler's behavior, not the programmer's. What you will experience is that misspelled keywords or malformed statements produce error messages rather than silently compiling.

---

## CLI Reference

The CLI is invoked as `node bin/em` (or `em` if installed globally). All commands accept a file path or `-` for stdin.

| Command | Flags | What it does |
|---|---|---|
| `em compile FILE.em` | `-o OUT.js`, `--target node\|bun`, `--map`, `--map-only` | Compile `.em` to JavaScript. Default output: `FILE.em.js`. |
| `em format FILE.em` | `-c` / `--check`, `-d` / `--diff` | Rewrite file in canonical style. `-c` exits 1 if not canonical without changing the file. `-d` shows a diff without writing. |
| `em run FILE.em` | `--no-runtime` | Compile to a temp file and execute immediately. |
| `em check FILE.em` | `-v` / `--verbose` | Parse and validate; report errors. `-v` prints token list and AST statement summary. |
| `em debug FILE.em` | — | Launch the Mender interactive debugger. |
| `em map FILE.em` | `-o PATH`, `--pretty` | Emit a JSON dependency graph (system map) of all nodes and edges. `--pretty` formats the JSON. |
| `em why NAME FILE.em` | `-r` / `--report` | Explain a named signal, lens, cloud, or action. `-r` shows a full annotated report of all nodes in the file. |

**Examples:**

```bash
# Compile for Node.js
node bin/em compile app.em

# Compile for Bun with a specific output path
node bin/em compile app.em --target bun -o dist/app.js

# Check formatting without changing the file
node bin/em format app.em --check

# Explain why "cart total" exists in the program
node bin/em why "cart total" app.em

# Generate a system dependency map
node bin/em map app.em --pretty -o app.system-map.json

# Compile and emit the system map at the same time
node bin/em compile app.em --map
```

---

## The Reasoning Layer

The reasoning layer gives you a vocabulary for modeling facts, time, causation, and analysis. Its primitives are events, layers, timelines, actions, and a set of analytical operations that operate on them.

### Events

An `event` is the atomic unit of EventMath time — a named fact that happened or could happen, with optional typed data attached via a `matter` block.

```eventmath
event user signed up
category auth
matter
  email is "alice@example.com"
  plan is "free"
  timestamp is 1704067200
end
end
```

The `category` tag is a string label for the event type. The `matter` block holds key/value pairs where keys are bare-word names and values are any expression. Events are passive records until placed in a layer or timeline, or explicitly run.

### Matter

`matter` blocks attach structured data to events, desires, and broken states. Keys are multi-word bare names; values are expressions or literals. A matter block is always closed with `end` and is itself contained within the outer `end` of its parent.

```eventmath
event contract signed
matter
  client name is "Acme Corp"
  contract value is 85000
  terms agreed is true
end
end
```

### Category

`category` is a single-line string tag on an event. It is distinct from `matter` — it does not go inside a `matter` block. It is used for filtering, routing, and explanation:

```eventmath
event payment received
category billing
matter
  amount is 5000
  currency is "USD"
end
end
```

### Layers

A `layer` is an ordered, named list of events. Think of it as a chapter heading for a group of related events. Layers are the inputs to `walk`, `run`, `predict`, `explain`, `analogy`, and `conflict`.

```eventmath
layer onboarding flow
  account created
  email verified
  profile completed
  first project added
end
```

Layers can reference other events by name. The events must be declared before they are referenced.

### Timelines (past / present / future)

A `timeline` is an ordered sequence with three temporal positions: `past`, `present`, and `future`. Each position holds event names or layer names.

```eventmath
timeline product roadmap

past
  discovery research
  mvp shipped
end

present
  beta program
end

future
  general availability
  enterprise tier
end

end
```

Run the present: `run timeline product roadmap present`. Use `predict` to project forward from the current state.

### Actions

An `action` is a named procedure with typed inputs and a return value. It uses `door open` to declare its parameter list and `door closed VALUE` to return.

```eventmath
action calculate discount
  door open
    input order total
    input membership tier
  end
  rain discount rate is 0
  when membership tier is "gold"
    rain discount rate is 0.15
  end
  when membership tier is "platinum"
    rain discount rate is 0.20
  end
  rain discount amount is order total times discount rate
  door closed discount amount
end
```

The `door` metaphor is deliberate: the action opens a door to accept inputs and closes it when done, returning a value as it shuts. Call an action by name as an expression, or with `run action NAME`.

### Doors (open/closed state machines)

The `door open` / `door closed` pair is not just syntax for parameters and return values — it models a state machine idiom. An action is a door: it opens to receive, processes, and closes with a result. This makes the entry and exit points of any procedure visually explicit in the source.

`door closed` with no value closes without returning (equivalent to `return` with no argument). `door closed VALUE` returns that value.

### mark and set

In reasoning contexts, `mark` declares a mutable variable and `set` updates it. This two-step pattern is intentional: it makes every variable's introduction visible as a distinct declaration.

```eventmath
mark running total as 0
mark item count as 0

walk order items as item
  set running total to running total plus item price
  set item count to item count plus 1
end

show running total
show item count
```

`mark` is declaration; `set` is mutation. You cannot `set` a name that has not been `mark`ed. In web contexts, `rain NAME is VALUE` handles both declaration and assignment in one line.

### When / Otherwise / Split / Path

`when` is the conditional. `otherwise` is the else branch. They are not tied together syntactically — `when` stands alone, and `otherwise` optionally follows it.

```eventmath
when order total at least 50
  rain shipping cost is 0
otherwise
  rain shipping cost is 4.99
end
```

Multiple `when` blocks are sequential (not else-if chains). Each `when` is evaluated independently unless you structure them explicitly with `otherwise`. For multi-value branching, use `match` / `arm`:

```eventmath
match subscription status
  arm "trialing"
    show trial banner
  arm "active"
    show dashboard
  arm "past_due"
    show payment warning
  arm else
    show login prompt
end
```

### Walk / Again

`walk` iterates a layer, binding each event to an alias:

```eventmath
walk audit events as current event
  show current event
  when current event category is "security"
    run current event
  end
end
```

Use `skip` to continue to the next item (like `continue`) and `escape` to exit the loop early (like `break`).

`again until` is an imperative loop that runs until a condition becomes true:

```eventmath
mark converged as false

again until converged is true
  note update state and check convergence
  set converged to true
end
```

### Add / Remove

Within the web layer, collections are modified with `add` and `remove` (or equivalent `filter` for derived views). In the reasoning layer, `walk` and layer composition handle iteration and selection. See the web layer section for collection operations including `filter`, `find`, `sort`, and `count`.

---

## Expression Engine

Expressions in EventMath are written in natural language. The expression compiler (`src/expression.js`) handles all arithmetic, comparison, and logical operations as English words.

### Arithmetic

| EventMath | JavaScript | Example |
|---|---|---|
| `A plus B` | `A + B` | `price plus tax` |
| `A minus B` | `A - B` | `total minus discount` |
| `A times B` | `A * B` | `rate times quantity` |
| `A divided by B` | `A / B` | `revenue divided by months` |

### String operations

| EventMath | Result |
|---|---|
| `A joined with B` | String concatenation |
| `A in uppercase` | `A.toUpperCase()` |
| `length of A` | `A.length` |

### Comparisons

| EventMath | JavaScript |
|---|---|
| `A is B` | `A === B` |
| `A is not B` | `A !== B` |
| `A more than B` | `A > B` |
| `A less than B` | `A < B` |
| `A at least B` | `A >= B` |
| `A at most B` | `A <= B` |
| `A is void` | `A == null` |
| `A is not void` | `A != null` |

### Logic and special values

| EventMath | JavaScript |
|---|---|
| `A and B` | `A && B` |
| `A or B` | `A \|\| B` |
| `not A` | `!A` |
| `now` | `Date.now()` |

Operator precedence (lowest to highest): `or` → `and` → `not` → comparisons → `plus`/`minus` → `times`/`divided by`. This mirrors standard mathematical precedence.

---

## Reasoning and Analysis

### Zoom (in / out / expand)

`zoom` inspects the dimensional relationship between states. It is the reasoning layer's way of asking: what is the transformation between here and there?

```eventmath
zoom in on no income and consistent income into revenue bridge
```

`zoom in` captures the direct transformation between two events — the gap between them and what crossing that gap means.

`zoom opposite` takes a zoom result and finds its inverse — the resistance or counter-path:

```eventmath
zoom opposite on revenue bridge into anti bridge
```

`zoom meta` builds the full relational field across four poles:

```eventmath
zoom meta on no income and consistent income and revenue bridge and anti bridge into full field
```

**zoom out from** (v2.18) reconstructs the parent context of a zoom result. Given a bridge, it reads the control matter and returns an object describing where the bridge came from:

```eventmath
zoom out from revenue bridge into bridge context
show bridge context
```

The returned object includes: `source`, `zoom_level`, `parent_level`, `from`, `to`, `gap_description`, `constituents`, and a `render()` method.

**zoom expand** (v2.18) expands outward from a single event or layer — inventorying all matter keys, determining polarity, and recording connections. It is a panoramic view rather than a directional one:

```eventmath
zoom expand on market suppression into suppression field
show suppression field
```

Can also expand from a layer or timeline:

```eventmath
zoom expand on layer market states into market field
zoom expand on timeline product roadmap into roadmap field
```

### Predictions and weights

`predict` projects forward from a timeline based on its past and present events:

```eventmath
predict revenue growth across product roadmap into forecast
show forecast
```

`weight` assigns probabilistic importance to matter fields, used by `explain` and `analogy` when scoring candidates:

```eventmath
weight workload at 3
weight communication at 1
weight environment at 0.5
```

Higher weights make those fields count more when comparing events for similarity or explanatory fit.

### Chain analysis

A `chain` is a causal graph with numeric signal values at each node:

```eventmath
chain revenue pipeline
  authentic voice leads to trust at value 9
  trust leads to partnership at value 7
  partnership leads to payment at value 620
end
```

Chains are inputs to `evaluate`, `challenge`, `compare`, and `grade`. They model how signal flows through a causal sequence and where it strengthens or weakens.

### Conflict detection

`conflict` detects tension between two desires operating against the same chain:

```eventmath
conflict fair payment and creative freedom for revenue pipeline into tension report
show tension report
```

Returns one of: `ALIGNED`, `COMPETITIVE`, or `OPPOSED`.

`weigh` takes that tension report and uses the `priority` values from each desire to recommend the best trade-off:

```eventmath
weigh tension report into resolution
show resolution
```

### Why queries

`why` explains a specific node in a causal chain — what factors contributed to that signal value:

```eventmath
why payment from revenue pipeline into reason
show reason
```

`trace` follows the causal path backward from a node:

```eventmath
trace payment back through revenue pipeline into causal path
show causal path
```

From the CLI, `em why "payment" app.em` runs this analysis without adding it to the source file. `em why --report app.em` shows a full annotated breakdown of every node in the program.

### Sensitivity analysis

`challenge` tests how sensitive a chain is to changes in a specific assumption:

```eventmath
challenge market rate in leverage report into sensitivity
show sensitivity
```

`scrub` performs a priority sweep across an entire tension report, testing how the resolution changes as priorities shift:

```eventmath
scrub tension report into scrub result
show scrub result
```

`compare` evaluates two chains against the same desire and reports which path better satisfies it:

```eventmath
compare waiting chain and leverage chain for fair payment into path comparison
show path comparison
```

---

## Named Patterns (v2.17–v2.18)

Named patterns are EventMath's alternative to raw regular expressions. Every part of a regex gets a name. The compiled output is a named-capture-group regex. Results are plain objects with one property per named part — no array index arithmetic, no `match[1]` guessing.

### Pattern declaration syntax

```eventmath
pattern PATTERN NAME
  part name  is EXPRESSION
  part name  is EXPRESSION
end
```

Each line inside the block is `PART-NAME is ATOM-EXPRESSION`. Parts are sequential — they match in order, one after the other. Each part compiles to a named capture group `(?<part_name>...)`.

### Full atom/quantifier/combinator reference table

**Atoms**

| EventMath | Regex | Notes |
|---|---|---|
| `letters` | `[a-zA-Z]` | Single letter (add a quantifier) |
| `digits` | `[0-9]` | Single digit |
| `uppercase letters` | `[A-Z]` | Single uppercase letter |
| `lowercase letters` | `[a-z]` | Single lowercase letter |
| `hex digit` | `[0-9a-fA-F]` | Hexadecimal digit |
| `word` | `\w` | Letter, digit, or underscore |
| `whitespace` | `\s` | Any whitespace |
| `tab` | `\t` | Tab character |
| `newline` | `\n` | Newline |
| `any text` | `[\s\S]` | Any character including newlines |
| `boundary` | `\b` | Word boundary (zero-width) |
| `start of line` | `^` | Line start anchor |
| `end of line` | `$` | Line end anchor |
| `optional whitespace` | `\s*` | Zero or more spaces |
| `optional attributes` | `[^>]*` | Anything that isn't `>` |
| `"literal"` | escaped | Exact text |
| `digit N through M` | `[N-M]` | Digit in range (e.g. `digit 1 through 6`) |

**Quantifiers**

| EventMath | Regex | Notes |
|---|---|---|
| `repeated` | `+` | One or more (greedy) |
| `repeated lazily` | `+?` | One or more (lazy) |
| `lazily` | `*?` | Zero or more (lazy) |
| `optional` | `?` | Zero or one |
| `at least N` | `{N,}` | N or more times |
| `N through M` | `{N,M}` | Between N and M times |

**Combinators**

| EventMath | Meaning |
|---|---|
| `A then B` | A followed by B (sequence) |
| `A or B` | A or B (alternation) |
| `A and B and "C"` | Character class `[ABC]` |
| `not "chars"` | Negated character class `[^chars]` |
| `not digits` | `[^0-9]` |
| `PARTNAME` | Inline-expand that part's regex |
| `matches PARTNAME` | Backreference `\k<partname>` |

### scan, seek, replace

`scan` returns all matches as an array of objects, one per match, with named properties:

```eventmath
scan contact text with email address into found emails
```

`found emails` is an array like `[{ user: "alice", at: "@", domain: "example", extension: ".com" }, ...]`.

`seek` returns the first match as an object, or `null` if nothing matches:

```eventmath
seek contact text with email address into first email
```

`replace in` replaces all matches using a template string with `$<name>` group references:

```eventmath
replace in contact text with email address using "$<user> [at] $<domain>$<extension>" into redacted
```

### Part name rules and limitations

Parts are sequential named capture groups. They cannot overlap or nest. If one part's expression needs to reuse another part's regex, reference the part by name to inline-expand it. Use `matches PARTNAME` (with the `matches` keyword) only when you want a true backreference — text that must equal what the named group previously captured.

Avoid using these as part names: `again`, `path`, `mark`, `note`. These are EventMath keywords that the tokenizer will consume before the pattern parser sees them, silently dropping the part. Safe part names include: `tag`, `content`, `user`, `domain`, `prefix`, `suffix`, `open`, `close`, `body`, `head`, `from`, `to`.

---

## Web Layer

### Reactive signals: live rain, lens

`live rain` declares a reactive signal — a mutable value that notifies all downstream computations when it changes:

```eventmath
live rain price is 10
live rain quantity is 1
```

`lens` declares a derived computed value. When any upstream `live rain` changes, dependent lenses recompute automatically:

```eventmath
lens subtotal is price times quantity
lens with tax is subtotal times 1.08
lens show checkout is subtotal more than 0
```

Plain `rain` is a mutable variable that does not trigger reactive recomputation. Use `live rain` when you need downstream lenses to update; use plain `rain` for local state that is read directly.

### Components: cloud, node, style, on/off

`cloud` declares a synchronous UI component. `expand cloud` declares an async one (for components that fetch data before rendering):

```eventmath
cloud product card
  node h2 Product Details
  node p description
  reflect rendered content
end

expand cloud user profile
  earth get /api/user into user data
  node h1 Welcome
  reflect user data
end
```

`node` creates an HTML element: `node TAG CONTENT`. `reflect` returns a value from the component (equivalent to `return`).

`atmosphere` defines a CSS style block:

```eventmath
atmosphere card style
  style border-radius is 8px
  style padding is 16px
  style box-shadow is 0 2px 4px rgba(0,0,0,0.1)
end
```

`on birth`, `on shift`, and `on death` are lifecycle hooks that run when a component mounts, updates, and unmounts respectively. `on` and `off` subscribe and unsubscribe from the event bus.

### Routing: earth, travel, map

`earth` makes HTTP requests:

```eventmath
earth get /api/products into products
earth post /api/orders with new order into created
earth put /api/products/1 with updated product into saved
earth delete /api/products/1 into result
```

`travel` navigates to a client-side route:

```eventmath
travel /dashboard
travel /login
```

`map` declares the routing table:

```eventmath
map
  route home / as product list
  route detail /products/:id as product detail
  route admin /admin as admin panel
end
```

### HTTP: serve, route, reply

`serve port N` opens an HTTP server. Inside it, `route METHOD PATH` handles requests, and `reply VALUE` sends the JSON response:

```eventmath
serve port 3000
  route get "/api/products"
    draw "select * from products" from store into rows
    reply rows
  end
  route post "/api/products"
    draw "insert into products (name) values (?)" from store into _
    reply "created"
  end
end
```

Compiles to `node:http` for the Node target and `Bun.serve()` for the Bun target.

### Storage: ground, draw

`ground NAME at PATH` opens a SQLite database. `draw QUERY from DB into RESULT` executes SQL. `_` discards the result:

```eventmath
ground catalog at "catalog.db"

draw "create table if not exists products (id integer primary key autoincrement, name text, price real)" from catalog into _

draw "select * from products order by name" from catalog into rows
show rows
```

`live draw` is a reactive variant — `rows` auto-refreshes whenever the database is written:

```eventmath
live draw "select * from products" from catalog into rows
```

`ground set KEY is VALUE`, `ground get KEY into VAR`, and `ground remove KEY` access persistent key-value storage (localStorage in browser, file-backed in Node).

### AI integration: ask

`ask` sends a question and structured data to a locally running Ollama model:

```eventmath
ask "Which product has the highest average rating?" with rows into answer
show answer
```

Requires Ollama running locally (`ollama serve` with a model pulled). The data is serialized as JSON context alongside the question.

---

## Manifest Mode

`manifest` is EventMath's highest-altitude declaration form. Six to eight lines generate a complete, running application: SQLite database, HTTP server, CRUD endpoints, and optional AI summary.

```eventmath
manifest contacts app
  store contacts in "contacts.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
  summarize contacts as "Give a brief overview of these contacts" with ai at "/api/summary"
  accept contacts at "/api/contacts"
end
```

What each line generates:

| Manifest line | Generated code |
|---|---|
| `store TABLE in "FILE" with FIELDS` | Opens SQLite DB, creates table with those columns |
| `serve on PORT` | HTTP server on that port |
| `show all TABLE at "/PATH"` | `GET /PATH` returning all rows as JSON |
| `summarize TABLE as "PROMPT" with ai at "/PATH"` | `GET /PATH`: queries rows, sends to Ollama with prompt |
| `accept TABLE at "/PATH"` | `POST /PATH`: parses JSON body, inserts row into table |

You do not add `ground`, `draw`, `serve`, or `route` manually when using `manifest`. The manifest statement generates all of that from its declarations. Mixing manifest and manual routing in the same file is not recommended.

---

## Bun Target

By default, EventMath compiles to Node.js. The `--target bun` flag produces output optimized for the Bun runtime.

**When to use Bun:**
- You are deploying a server that handles high request volume and want Bun's faster startup and lower overhead.
- You want Bun's built-in SQLite (`bun:sqlite`) without the Node.js shim layer.
- You are building a CLI tool that benefits from Bun's faster cold starts.

**What changes in the compiled output:**

| Feature | Node target | Bun target |
|---|---|---|
| HTTP server | `node:http` | `Bun.serve()` |
| SQLite | `node:sqlite` | `bun:sqlite` |
| POST body parsing | `Buffer.concat(chunks)` stream | `await req.json()` |
| File permissions | Standard | Output marked executable (chmod 755) |

The `.em` source file is identical for both targets. You write the program once and choose the output at compile time:

```bash
node bin/em compile app.em --target bun -o app.js
bun app.js
```

---

## Complete Example Programs

### 1. A business events tracker (reasoning layer, ~30 lines)

```eventmath
note Business events tracker — reasoning layer

event contract signed
category sales
matter
  client name is "Meridian Partners"
  contract value is 42000
  signed on is "2026-03-15"
end
end

event invoice sent
category billing
matter
  amount is 42000
  due date is "2026-04-15"
end
end

event payment received
category billing
matter
  amount is 42000
  received on is "2026-04-10"
end
end

layer q1 deal
  contract signed
  invoice sent
  payment received
end

timeline meridian account

past
  contract signed
  invoice sent
end

present
  payment received
end

end

chain deal flow
  contract signed leads to invoice sent at value 8
  invoice sent leads to payment received at value 9
end

why payment received from deal flow into reason
show reason

run timeline meridian account present
```

### 2. A REST API with SQLite (web layer, ~20 lines)

```eventmath
note Task API — web layer with SQLite

ground tasks at "tasks.db"

draw "create table if not exists tasks (id integer primary key autoincrement, title text, done integer default 0)" from tasks into _

live draw "select * from tasks order by id desc" from tasks into task list

serve port 4000
  route get "/api/tasks"
    reply task list
  end
  route post "/api/tasks"
    draw "insert into tasks (title) values ('New task')" from tasks into _
    reply "created"
  end
  route post "/api/tasks/done"
    draw "update tasks set done = 1 where done = 0" from tasks into _
    reply "updated"
  end
end
```

### 3. A text parser that extracts and reformats data (patterns, ~20 lines)

```eventmath
note Log entry parser — named patterns

pattern log entry
  level     is uppercase letters repeated
  separator is "]" then whitespace
  timestamp is digits repeated
  spacer    is whitespace repeated
  body      is any text lazily
end

pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end

mark log data as "ERROR] 1718000000 Contact alice@example.com for support"

seek log data with log entry into parsed entry
show parsed entry

scan log data with email address into contacts found
show contacts found

replace in log data with email address using "[REDACTED@$<domain>$<extension>]" into safe log
show safe log
```

---

## Common Mistakes

### 1. Using `null` instead of `void`

```eventmath
note WRONG
rain current user is null

note RIGHT
rain current user is void
```

`void` is EventMath's null value. Writing `null` in `.em` source is not valid EventMath. Use `void` everywhere you mean "no value" and `A is void` to test for it.

### 2. Using `set` without a prior `mark`

```eventmath
note WRONG — set before mark
set running total to 0

note RIGHT — declare first, then update
mark running total as 0
set running total to running total plus item price
```

In reasoning contexts, `mark` is declaration. `set` is mutation. `set` on an undeclared name will fail. In web contexts, use `rain` instead — it declares and assigns in one line.

### 3. Using arithmetic symbols instead of words

```eventmath
note WRONG
rain price is 10 * quantity

note RIGHT
rain price is 10 times quantity
```

The expression engine expects natural-language operators. Symbols like `*`, `+`, `>`, `===` are not valid in EventMath expressions.

### 4. Writing `//` comments

```eventmath
note WRONG
// This event tracks signups

note RIGHT
note This event tracks signups
```

`//` is JavaScript syntax. It is not valid EventMath. Use `note` — it is preserved in the AST and appears in formatted output.

### 5. Using underscores in variable names

```eventmath
note WRONG
rain cart_total is 0

note RIGHT
rain cart total is 0
```

Multi-word names use spaces. The compiler generates `cart_total` as the JavaScript identifier internally; your source never uses underscores.

### 6. Using `cloud` for async components

```eventmath
note WRONG — cloud cannot await
cloud user dashboard
  earth get /api/user into profile
  reflect profile
end

note RIGHT — expand cloud for async
expand cloud user dashboard
  earth get /api/user into profile
  reflect profile
end
```

`cloud` is synchronous. Any component that makes network calls, reads from SQLite, or uses `await` must use `expand cloud`.

### 7. Expecting scan to return strings

```eventmath
note scan returns an array of objects, not an array of strings

scan text with email address into emails
note emails is [ { user: "alice", at: "@", domain: "example", extension: ".com" }, ... ]
note access parts by name, not by index
```

`scan` and `seek` return objects with named properties matching your pattern part names. There are no integer indexes. To get the full matched string, use the `$<name>` references in a `replace in` template.

### 8. Mixing manifest and manual routing

```eventmath
note WRONG — do not add manual routes inside a manifest app
manifest contacts app
  store contacts in "contacts.db" with name and city
  serve on 3000
  show all contacts at "/api/contacts"
end

serve port 3000
  route get "/api/extra"
    reply "extra"
  end
end
```

`manifest` generates the server and all its routes. Adding a separate `serve` block creates a second server and will conflict. Use either `manifest` or manual `ground`/`serve`/`route`, not both.

### 9. Forgetting `end` on nested blocks

```eventmath
note WRONG — missing end for matter block
event payment received
category billing
matter
  amount is 500
end

note RIGHT — matter needs its own end, then the event needs its end
event payment received
category billing
matter
  amount is 500
end
end
```

Every block gets its own `end`. `matter` is a block. The enclosing `event` is also a block. Both need `end`.

### 10. Using keyword words as pattern part names

```eventmath
note WRONG — 'mark' is a keyword and will be consumed before the pattern parser sees it
pattern log entry
  mark is uppercase letters repeated
  body is any text lazily
end

note RIGHT — use a safe name
pattern log entry
  level is uppercase letters repeated
  body  is any text lazily
end
```

Avoid `again`, `path`, `mark`, and `note` as pattern part names. These are keywords the tokenizer dispatches on, and the part line will be silently consumed before reaching the pattern parser.

---

*EventMath v2.18 — compiled to JavaScript (Node.js and Bun targets). CLI: `node bin/em help`.*
