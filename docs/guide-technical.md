# EventMath: Technical Reference

**Version 2.18** | Targets: Node.js, Bun | Compiler: `src/{tokenizer,parser,codegen,formatter,validator}.js`

---

## Abstract

EventMath is a line-oriented, single-pass compiled language that targets JavaScript (Node.js and Bun) via a six-stage pipeline: tokenize → parse → validate → codegen → format → runtime. The language operates across two compositional layers — a **reasoning layer** for causal, probabilistic, and temporal analysis, and a **web layer** for reactive UI and HTTP services — unified by a single grammar and shared compiler. Formally, the language exhibits: (1) **deterministic compilation** — the compiler carries no ambient state between programs; (2) **referential transparency** in the expression engine — every `lens` is a pure function of its upstream signals; (3) **idempotent formatting** — `format(parse(format(parse(s)))) = format(parse(s))` for all well-formed sources; (4) **injective name mapping** — the `safeName` function is injective on valid EventMath identifiers; and (5) **a decidable pattern language** — every `pattern` declaration reduces to a finite, non-recursive ECMA-262 `RegExp`. The language's intended domain spans temporal event modeling, causal graph analysis, probabilistic abduction, reactive data flow, and self-documenting HTTP services — any system where the structure of knowledge must remain visible to its operators.

---

## 1. Syntax and Grammar

### 1.1 Line-Oriented Dispatch

EventMath is **strictly line-oriented**: one logical statement per source line. The tokenizer reads each line, identifies the leading word (_lead token_), and dispatches to a statement-specific tokenizer method. No multi-line statements exist except within block bodies (bounded by `end`). Indentation is cosmetic and carries no semantic weight; blocks are delimited exclusively by the closing keyword `end`.

Formally, the tokenizer implements a **lead-word dispatch table**: for each non-empty, non-blank line ℓ with first word w, there exists a unique tokenizer function `_tokenize_{w}Stmt(ℓ)`. If w is not in the dispatch table and contains no known delimiter (`is`, `from`, `with`), the line is emitted as a bare `NAME` token (a reference or event body entry).

### 1.2 BNF Production Rules

The top-level statement forms are:

```
program        ::= statement*

statement      ::= event-decl
               | layer-decl
               | timeline-decl
               | action-decl
               | chain-decl
               | desire-decl
               | pattern-decl
               | rain-stmt
               | star-stmt
               | lens-stmt
               | mark-stmt
               | set-stmt
               | run-stmt
               | show-stmt
               | when-stmt
               | walk-stmt
               | orbit-stmt
               | again-stmt
               | zoom-stmt
               | weight-stmt
               | explain-stmt
               | analogy-stmt
               | satisfy-stmt
               | evaluate-stmt
               | conflict-stmt
               | why-stmt
               | predict-stmt
               | scan-stmt
               | seek-stmt
               | replace-stmt
               | serve-stmt
               | ground-stmt
               | draw-stmt
               | manifest-decl
               | note-stmt
               | ...

event-decl     ::= "event" NAME NEWLINE
                   ("category" NAME NEWLINE)?
                   ("matter" NEWLINE (NAME "is" LITERAL NEWLINE)* "end" NEWLINE)?
                   "end"

layer-decl     ::= "layer" NAME NEWLINE NAME* "end"

timeline-decl  ::= "timeline" NAME NEWLINE
                   ("past"    NEWLINE NAME* "end" NEWLINE)?
                   ("present" NEWLINE NAME* "end" NEWLINE)?
                   ("future"  NEWLINE NAME* "end" NEWLINE)?
                   "end"

action-decl    ::= "action" NAME NEWLINE
                   ("door" "open" NEWLINE ("input" NAME NEWLINE)* )?
                   statement*
                   ("door" "closed" NAME? NEWLINE)?
                   "end"

chain-decl     ::= "chain" NAME NEWLINE
                   (NAME "leads" "to" NAME "at" "value" NUMBER NEWLINE)*
                   "end"

pattern-decl   ::= "pattern" NAME NEWLINE
                   (NAME "is" pattern-expr NEWLINE)*
                   "end"

pattern-expr   ::= atom (quantifier)? (combinator atom (quantifier)?)*

when-stmt      ::= "when" condition NEWLINE statement* ("otherwise" statement*)? "end"

mark-stmt      ::= "mark" NAME "as" expr
set-stmt       ::= "set" NAME "to" expr
rain-stmt      ::= ("live")? "rain" NAME "is" expr
lens-stmt      ::= "lens" NAME "is" expr
```

### 1.3 Token Types

The tokenizer produces exactly five token types:

| Type      | Semantics                                                                 | Example values                  |
|-----------|---------------------------------------------------------------------------|----------------------------------|
| `KEYWORD` | Reserved dispatch word or structural delimiter                            | `event`, `is`, `into`, `end`    |
| `NAME`    | Multi-word bare identifier (spaces preserved; safe-name mapped in codegen)| `cart total`, `user signed up`  |
| `NUMBER`  | Numeric literal, integer or decimal, matched by `/^-?\d+(\.\d+)?$/`      | `42`, `3.14`, `-7`              |
| `BOOL`    | Boolean literal                                                           | `true`, `false`                 |
| `LITERAL` | String literal — content after quote-stripping, or bare text after `is`  | `alice@example.com`, `free`     |

Additionally, complex single-line statements are pre-parsed by the tokenizer into compound structured tokens (e.g., `ZOOM_IN`, `SPIN_STMT`, `LEADS_TO_STMT`) whose `.value` is a plain object carrying all parsed sub-fields. This shifts sub-statement parsing cost to the tokenizer phase, keeping the parser single-pass.

The KEYWORD set is closed: it contains ~120 reserved words. Any word not in `KEYWORDS` is always a `NAME`. There is no identifier-vs-keyword ambiguity at the character level — distinction is determined by set membership alone.

### 1.4 Name Resolution and Safe-Name Mapping

EventMath permits **multi-word identifiers** with internal spaces: `cart total`, `last watered`, `user email address`. This is _Law 2_ of the language specification. The compiler maps these to JavaScript identifiers via the `_safeName` function:

```
safeName(s) = s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '_')
```

**Injectivity**: `safeName` is injective on the domain of valid EventMath names (names not containing underscore as a source character), since the only transformation is `' ' → '_'`. Names that differ only by underscore vs. space are considered distinct in EventMath source but would collide in the compiled output — this is a known limitation noted in the specification. The compiler does not currently detect such collisions.

**camelName** is used for action names in compiled output: words are title-cased and concatenated, e.g., `calculate shipping` → `calculateShipping`.

### 1.5 Comment Syntax

The `note` keyword is the **only** comment form. Unlike `//`, a `note` is tokenized, parsed into the AST as a `Note` node, and preserved through the formatter. This makes comments part of the formal structure of the program — they survive `format(parse(s))` unchanged.

```
note-stmt ::= "note" LITERAL
```

Inline `#` comments (preceded by whitespace or at line start, outside quoted strings) are stripped by the tokenizer's `_stripComment` method before dispatch and do **not** appear in the AST.

---

## 2. Semantic Domains

### 2.1 Value Domain

The EventMath value domain V is:

$$V = \mathbb{N} \cup \mathbb{R} \cup \texttt{String} \cup \texttt{Boolean} \cup \texttt{Event} \cup \texttt{Layer} \cup \texttt{Timeline} \cup \texttt{Array}(V) \cup \texttt{Map}(\texttt{String}, V)$$

There is **no implicit coercion** between numeric, string, and boolean subtypes. Coercions are explicit via `cast`:

```
cast-stmt ::= "cast" NAME "as" ("number" | "text" | "boolean") "into" NAME
```

Compiled output: `Number(x)`, `String(x)`, `Boolean(x)` respectively.

### 2.2 Events

An **Event** is a labeled record:

$$\texttt{Event} = \{ \textit{name} : \texttt{String},\ \textit{category} : \texttt{String},\ \textit{matter} : \texttt{Map}(\texttt{String}, \texttt{Value}) \}$$

Events are **immutable at declaration**: their matter fields are set at construction and not subsequently mutated by the language (though the runtime object is a plain JS object and can be externally modified). Events are the atomic unit of temporal reasoning — all higher-level structures (layers, timelines, chains) are collections or orderings of events.

Compiled form: `new EM.EventMathEvent(name, category, matterObj)`.

### 2.3 Layers

A **Layer** is an ordered list of event references:

$$\texttt{Layer} = \langle e_1, e_2, \ldots, e_n \rangle,\quad e_i \in \texttt{Event}$$

Layers are the primary operand for `walk`, `predict`, `explain`, `analogy`, `conflict`, and `filter` operations. The ordering is declaration order; no sort is applied at construction. Compiled form: `new EM.EventMathLayer(name, [ref1, ref2, ...])`.

### 2.4 Timelines

A **Timeline** is a temporal partition of event-sets into three positions:

$$\texttt{Timeline} = \{ \textit{past} : \mathcal{P}(\texttt{EventRef}),\ \textit{present} : \mathcal{P}(\texttt{EventRef}),\ \textit{future} : \mathcal{P}(\texttt{EventRef}) \}$$

This structure is adjacent to a **discrete-time Kripke frame** with three time-points ordered by `past < present < future`. The `run timeline T present` statement executes the present partition. `predict` performs forward projection from a timeline's structure.

Compiled form: `new EM.EventMathTimeline(name)` with layer events pushed into `.log`.

### 2.5 Actions

An **Action** is a first-class named procedure with typed inputs and a single return value:

$$\texttt{Action} = (\vec{x} : \overrightarrow{\texttt{Name}}) \rightarrow V$$

`door open` declares the parameter list; `door closed` supplies the return expression. Actions compile to JavaScript functions with positional parameters mapped from the `door open` input list. Actions support all statement types in their bodies, including `rain`, `when`, `walk`, `mark`, `set`, and nested action calls.

### 2.6 Chains

A **Chain** is a directed weighted graph $(G, w)$ where:

$$G = (V_G, E_G),\quad E_G \subseteq V_G \times V_G,\quad w : E_G \rightarrow \mathbb{R}^+$$

Each `leads to` statement adds a directed edge with a signal-strength value. The `chain` block is the primary input to `evaluate`, `satisfy`, `challenge`, `compare`, `conflict`, `weigh`, `why`, and `trace`.

---

## 3. The Reasoning Engine

### 3.1 Zoom Operations as Graph Morphisms

The `zoom` family of operations treats events and layers as nodes in a **relational graph** and defines morphisms over that graph:

| Statement                        | Formal semantics                                                                     |
|----------------------------------|--------------------------------------------------------------------------------------|
| `zoom in on A and B into C`      | **Projection**: C = direct transformation morphism between A and B                  |
| `zoom opposite on C into D`      | **Inverse projection**: D = resistance/complement path (anti-bridge)                |
| `zoom meta on A B C D into F`    | **Neighborhood expansion**: F = full relational field over the four-pole structure   |
| `zoom expand on E into N`        | **Panoramic expansion**: N = inventory of all matter keys, polarity, and connections |
| `zoom out from C into X`         | **Context reconstruction**: X = parent context of a prior zoom result               |

In category-theoretic terms: `zoom in` is a morphism $f : A \times B \rightarrow C$ in the category of event views; `zoom opposite` is the construction of $f^{-1}$; `zoom meta` completes the square to a commutative diagram over all four poles. `zoom expand` is the star-neighborhood functor applied to a single node.

**Polarity**: The `energy` matter field of the target event determines polarity from the set $\Pi = \{\texttt{high}, \texttt{low}, \texttt{against}, \texttt{suppressed}, \texttt{absent}, \texttt{present}\}$. Zoom operations propagate polarity into the result object's `.polarity` field.

### 3.2 Chain Analysis: DAG Model

The `chain` block models a **directed acyclic graph** (DAG) of causal signal flow. The language does not enforce acyclicity at parse time — it is a design invariant, not a structural constraint. Operations over chains:

- **`why D from C into R`** — backward inference: given desire D and chain C, find why D is not satisfied. Implements backward chaining over the DAG: starting at D's `satisfied when` target node, traverses incoming edges until the topological root is found.
- **`root of N in C into R`** — topological sort to find the zero-in-degree ancestor of node N in chain C.
- **`trace N back through C into R`** — full causal path from N to roots, returning the ordered list of ancestors.
- **`challenge A in R into S`** — sensitivity analysis: vary assumption A and measure impact on the evaluate report R.
- **`compare C1 and C2 for D into R`** — path comparison between two chains for a given desire.

The runtime implements these as depth-first traversals over the compiled chain object's `links` array: `{ from: string, to: string, value: number }[]`.

### 3.3 Weight Assignment and Probabilistic Inference

`weight NAME at N` populates the compiler-global `__weights` registry:

$$\texttt{weight}\ e\ \texttt{at}\ w \Rightarrow \texttt{\_\_weights}[e] = w,\quad w \in \mathbb{R}^+$$

Weights are used by:
- **`explain O from C into R`** — abductive inference: scores each candidate in layer C against observations in layer O using matter-field overlap, weighted by `__weights`. Returns the highest-scoring candidate.
- **`analogy A and B into R`** — structural similarity: computes a weighted Jaccard-style overlap score over the matter fields of events A and B.
- **`weighted_accuracy_of`** — builtin expression that computes $\hat{A}_w = \sum_{i \in \text{correct}} w_i \,/\, \sum_{i \in \text{resolved}} w_i$ over a layer.

The `predict` statement generates a Cartesian product over N dimension layers:

$$\texttt{predict}\ S\ \texttt{across}\ D_1 \ldots D_n \Rightarrow \text{result} = \bigtimes_{i=1}^{n} D_i.\text{events}$$

Each element of the product becomes a new prediction event in the result layer. The optional `through FRACTAL` clause routes dimensions through a three-tier fractal axis at depths D±13 (surface), D±26 (system), D±39 (root).

### 3.4 Conflict Detection

`conflict D1 and D2 for C into R` compares two desires against a chain and classifies the result:

$$\texttt{conflict}(d_1, d_2, C) \in \{\texttt{ALIGNED}, \texttt{COMPETITIVE}, \texttt{OPPOSED}\}$$

Classification is based on whether the desires' `direction` fields agree, conflict, or are orthogonal in the chain's signal space. `weigh R into W` then applies `priority` weights from the desire definitions to recommend a resolution trade-off.

`satisfy D against C into R` tests whether a chain satisfies a desire's `satisfied when` condition, returning a satisfaction record with pass/fail status and gap analysis.

---

## 4. Pattern System (v2.17–v2.18)

### 4.1 Formal Correspondence

A `pattern` declaration is a **typed subset of ECMA-262 `RegExp`** expressed in compositional natural language. Each named part compiles to a single named capture group:

$$\texttt{pattern}\ P\ \Rightarrow\ \texttt{RegExp}\left(\prod_{i=1}^{n} \texttt{(?<}p_i\texttt{>}\,\llbracket e_i \rrbracket\texttt{)},\ \texttt{"gm"}\right)$$

where $p_i$ is the part name, $e_i$ is the part expression, and $\llbracket \cdot \rrbracket$ is the denotation function.

### 4.2 Atom Denotation Table

| EventMath atom         | $\llbracket \cdot \rrbracket$   | Notes                         |
|------------------------|----------------------------------|-------------------------------|
| `letters`              | `[a-zA-Z]`                       |                               |
| `digits` / `digit`     | `[0-9]`                          |                               |
| `uppercase`            | `[A-Z]`                          |                               |
| `lowercase`            | `[a-z]`                          |                               |
| `hex digit`            | `[0-9a-fA-F]`                    |                               |
| `word`                 | `\w`                             | `[a-zA-Z0-9_]`               |
| `whitespace`           | `\s`                             |                               |
| `tab`                  | `\t`                             |                               |
| `newline`              | `\n`                             |                               |
| `any text`             | `[\s\S]`                         | Matches newlines              |
| `any character`        | `[\s\S]`                         | Alias of `any text`          |
| `boundary`             | `\b`                             | Zero-width assertion          |
| `start of line`        | `^`                              | Anchor                        |
| `end of line`          | `$`                              | Anchor                        |
| `optional whitespace`  | `\s*`                            | Pre-quantified               |
| `optional attributes`  | `[^>]*`                          | Pre-quantified               |
| `digit N through M`    | `[N-M]`                          | E.g. `digit 1 through 6` → `[1-6]` |
| `"literal"`            | escaped literal string           | `"@"` → `@`; `.` → `\.`     |

### 4.3 Quantifier Denotation

| EventMath quantifier  | $\llbracket \cdot \rrbracket$ |
|-----------------------|-------------------------------|
| `repeated`            | `+`                           |
| `repeated lazily`     | `+?`                          |
| `lazily`              | `*?`                          |
| `optional`            | `?`                           |
| `at least N`          | `{N,}`                        |
| `N through M`         | `{N,M}`                       |

### 4.4 Combinator Semantics

| EventMath combinator          | Semantics                                      | Output                    |
|-------------------------------|------------------------------------------------|---------------------------|
| `A then B`                    | Concatenation                                  | `⟦A⟧⟦B⟧`                 |
| `A or B`                      | Alternation                                    | `⟦A⟧\|⟦B⟧`               |
| `A and B and "C"`             | Character class union                          | `[⟦A⟧⟦B⟧C]`              |
| `not "chars"`                 | Negated character class                        | `[^chars]`                |
| `not digits`                  | Negated atom class                             | `[^0-9]`                  |
| `PARTNAME` (reference)        | Inline expansion of prior part's regex         | raw regex of that part    |
| `matches PARTNAME`            | Backreference to prior named group             | `\k<partname>`            |

### 4.5 Sequential Capture Groups and the Non-Nesting Invariant

Parts in a `pattern` block are **sequential and non-nesting**: each part $p_i$ wraps its expression in `(?<p_i>...)` and is concatenated with adjacent parts. No part may contain another named group syntactically. This is a deliberate restriction that preserves:

1. **Unambiguous group indexing**: every named group corresponds to exactly one part name.
2. **Compositional safety**: part-reference expansion inlines the raw regex without a wrapping group, preventing double-capture of the same content.

The inline-expansion rule (`PARTNAME` in an expression expands to the compiled regex of that part, without wrapping) is the mechanism that allows structural reuse without nesting. The backreference rule (`matches PARTNAME`) emits `\k<partname>`, which requires `PARTNAME` to have been declared as a prior named group in the same pattern.

### 4.6 scan, seek, and replace

| Statement     | Compiled form                                      | Return type                           |
|---------------|----------------------------------------------------|---------------------------------------|
| `scan T with P into R`       | `[...T.matchAll(P)].map(m => m.groups)` | `Array<Map<String, String>>`  |
| `seek T with P into R`       | non-global `P_ng.exec(T)?.groups ?? null` | `Map<String, String> \| null` |
| `replace in T with P using "TPL" into R` | `T.replace(P, "TPL")`       | `String`                      |

`scan` uses the pattern's `gm` flags and returns all matches. `seek` constructs a non-global copy of the pattern to avoid `lastIndex` side-effects. `replace` uses JS native named-group replacement syntax `$<name>` in the template string.

**Pattern completeness**: every atom in the atom table maps to a syntactically valid regex fragment. The compiler does not produce invalid regex from valid EventMath pattern syntax.

---

## 5. The Expression Engine

### 5.1 Grammar

The expression engine (`src/expression.js`) processes natural-language arithmetic and comparison expressions wherever a value is expected. The grammar is:

```
expr    ::= unary (binop unary)*
unary   ::= "not" unary | atom
binop   ::= "plus" | "minus" | "times" | "divided by"
          | "more than" | "less than" | "at least" | "at most"
          | "is" | "is not" | "and" | "or"
          | "joined with" | "in uppercase" | "in lowercase" | "length of"
atom    ::= NAME | NUMBER | BOOL | LITERAL | "now" | "void"
```

Operator precedence (lowest to highest):

$$\texttt{or} \prec \texttt{and} \prec \texttt{not} \prec \text{comparison} \prec \texttt{plus/minus} \prec \texttt{times/divided by}$$

### 5.2 Operator Denotation Table

| EventMath           | JavaScript        | Type constraint         |
|---------------------|-------------------|-------------------------|
| `A plus B`          | `A + B`           | Numeric or string       |
| `A minus B`         | `A - B`           | Numeric                 |
| `A times B`         | `A * B`           | Numeric                 |
| `A divided by B`    | `A / B`           | Numeric                 |
| `A joined with B`   | `String(A) + B`   | String concatenation    |
| `A in uppercase`    | `String(A).toUpperCase()` | String            |
| `A in lowercase`    | `String(A).toLowerCase()` | String            |
| `length of A`       | `String(A).length` | String → Number        |
| `A is B`            | `A === B`         | Strict equality         |
| `A is not B`        | `A !== B`         | Strict inequality       |
| `A more than B`     | `A > B`           | Ordered                 |
| `A less than B`     | `A < B`           | Ordered                 |
| `A at least B`      | `A >= B`          | Ordered                 |
| `A at most B`       | `A <= B`          | Ordered                 |
| `A and B`           | `A && B`          | Boolean                 |
| `A or B`            | `A \|\| B`        | Boolean                 |
| `not A`             | `!A`              | Boolean                 |
| `A is void`         | `A == null`       | Null-check (loose)      |
| `A is not void`     | `A != null`       | Null-check (loose)      |
| `now`               | `Date.now()`      | Timestamp (ms since epoch) |

**No implicit coercion**: `is` compiles to `===` (strict equality). The `is void` / `is not void` forms use loose equality deliberately to catch both `null` and `undefined`.

### 5.3 Reactive Expressions: `lens`

A `lens` is a **pure derived computation** over one or more `live rain` signals:

$$\texttt{lens}\ L\ \texttt{is}\ e \Rightarrow L = \lambda().\ \llbracket e \rrbracket$$

`lens` declarations compile to `EventMathSignal` computed cells that automatically recompute when any upstream `live rain` dependency changes. This is referential transparency in the reactive domain: the lens value is always exactly the result of applying the expression to the current upstream values, with no mutable internal state.

---

## 6. Reactive Signal Model

### 6.1 Live Rain as a Mutable Cell

A `live rain` declaration instantiates a reactive cell:

$$\texttt{Rain}\langle T \rangle = \{ \textit{value} : T,\ \textit{subscribers} : \mathcal{P}(\texttt{Unit} \rightarrow \texttt{Unit}) \}$$

Compiled form: `new EventMathSignal(initialValue)`. Mutation via `rain NAME is V` at runtime calls `.set(V)` on the signal, which notifies all subscribers synchronously.

### 6.2 Lens as a Computed Observable

$$\texttt{Lens}\langle T \rangle = \{ \textit{compute} : \texttt{Unit} \rightarrow T,\ \textit{deps} : \mathcal{P}(\texttt{Rain}) \}$$

The compiler does not perform static dependency analysis — it relies on the runtime to track which signals are read during the first execution of `compute` (the "tracking" phase of pull-based reactivity). On any upstream `.set()`, all dependent lenses are marked dirty and recomputed on next read.

### 6.3 Update Propagation Model

The propagation model is **synchronous push**: when a `live rain` value changes, all subscriber callbacks are called in registration order within the same microtask. There is no batching, debouncing, or async scheduling unless explicitly introduced via `every` (timer-based) or `earth` (fetch-based async). This gives EventMath reactive code the formal property of **glitch-freedom at the single-signal level** but does not guarantee glitch-freedom for multi-signal fan-in (a known trade-off in synchronous push models).

---

## 7. Web Layer Semantics

### 7.1 Cloud Components as Virtual DOM Nodes

A `cloud` or `expand cloud` declaration defines a **named component** whose body produces a virtual DOM description. `node TAG CONTENT` emits an HTML element descriptor. `reflect VALUE` exits the component and returns a value (equivalent to `return`). `slot NAME` inserts a children placeholder.

`cloud` compiles to a synchronous function; `expand cloud` compiles to an `async` function (for `earth`, `await`, or `draw` calls).

### 7.2 HTTP Layer

The `serve` block registers an HTTP server at a given port:

```
serve-stmt   ::= "serve" "port" NUMBER NEWLINE route-stmt* "end"
route-stmt   ::= "route" METHOD PATH NEWLINE statement* "end"
reply-stmt   ::= "reply" expr
```

`route` handlers compile to `node:http` request matchers (node target) or `Bun.serve()` route entries (bun target). `reply VALUE` serializes to JSON and sends with status 200.

### 7.3 Ground: SQLite-Backed Persistence

`ground NAME at "PATH"` opens a SQLite database (via `node:sqlite` or `bun:sqlite` depending on target). `draw QUERY from DB into RESULT` executes a parameterized SQL query and assigns the result array. `live draw` creates a reactive query that re-executes whenever any write occurs to the database — implemented via a subscriber on the database's write signal.

### 7.4 Manifest Mode: Declarative Schema Generation

`manifest` is a **code-generating meta-statement**: it parses a declarative schema and emits the equivalent of a complete `ground + draw + serve` program. The mapping:

| Manifest line                             | Generated code                                    |
|-------------------------------------------|---------------------------------------------------|
| `store TABLE in "FILE" with F1 and F2`    | `ground + CREATE TABLE IF NOT EXISTS ...`         |
| `serve on PORT`                           | `serve port PORT { ... }`                         |
| `show all TABLE at "/PATH"`               | `route get "/PATH" → draw "SELECT *" → reply`     |
| `accept TABLE at "/PATH"`                 | `route post "/PATH" → parse body → INSERT → reply`|
| `summarize TABLE as "PROMPT" with ai at "/PATH"` | `route get → draw → ask PROMPT with rows → reply` |

Manifest preserves the property that every EventMath program is self-describing: the manifest declaration is a complete specification from which all implementation details are deterministically derivable.

---

## 8. Compilation Pipeline

### Stage 1: Tokenizer

- **Input**: `String` (UTF-8 source)
- **Output**: `Token[]`
- **Key invariants**:
  - Every line produces a non-empty token sequence or is discarded (blank/comment).
  - Token types are drawn from the closed set `{KEYWORD, NAME, NUMBER, BOOL, LITERAL}` plus structured compound types.
  - `#` inline comments (outside quotes) are stripped before dispatch.
  - Multi-word `NAME` tokens preserve internal whitespace in `.value` — normalization deferred to codegen.
  - The `KEYWORDS` set is the complete discriminant between `NAME` and `KEYWORD` for any single word.

### Stage 2: Parser

- **Input**: `Token[]`
- **Output**: AST (`Program` node with `statements: ASTNode[]`)
- **Key invariants**:
  - Single-pass, recursive descent with explicit iteration guards (`MAX_ITERATIONS = 10000`) to prevent infinite loops on malformed input.
  - Block structure tracked by `end` keyword consumption — no stack of expected closers.
  - Errors are accumulated in `this.errors[]` and attached to the `Program` node; parsing continues after errors (error-recovery mode).
  - Every AST node is a plain object `{ type: string, ...fields }` — no class instances.
  - `_parseExprOrValue()` builds left-associative binary expression trees for arithmetic in `mark`/`set` bodies.

### Stage 3: Validator

- **Input**: AST
- **Output**: AST + `errors[]`
- **Key invariants**:
  - Collects all declared names (events, layers, timelines, actions) in a first pass.
  - Validates references in a second pass: every `NAME` reference must resolve to a declared name or an imported name.
  - Validator errors are non-fatal: the compiler will still attempt codegen on a program with validator errors.

### Stage 4: Codegen

- **Input**: AST
- **Output**: JavaScript `String`
- **Key invariants**:
  - **Two-pass**: first pass hoists `let` declarations for all `mark`/`set` variables to the top scope; second pass emits statement bodies.
  - **No ambient state between programs**: the `EventMathCodeGen` instance is reset at the start of each `generate()` call.
  - **Target-conditional emission**: `this.target ∈ {node, bun}` switches SQLite require, HTTP server, and body-parsing implementations.
  - **Determinism**: given the same AST, `generate()` always produces the same string. The only non-determinism source — `Date.now()` and `Math.random()` in prediction event IDs — appears in the *runtime* output, not in the compiled source.
  - **Escape discipline**: all user-supplied string values are passed through `_escape()` before interpolation into JS string literals, preventing code injection.

### Stage 5: Formatter

- **Input**: AST
- **Output**: canonical `.em` source string
- **Key invariants**:
  - **Idempotency**: `format(parse(s))` is a fixed point — applying the formatter twice yields the same output as applying it once.
  - `note` nodes are preserved exactly.
  - 2-space indentation inside all blocks.
  - Multi-word names preserved with spaces (not underscores).
  - String literals normalized to double quotes.

### Stage 6: Runtime

- **Input**: compiled `.js` + `eventmath-runtime.js`
- **Output**: execution
- **Key invariants**:
  - Runtime is < 10KB, zero external dependencies.
  - Exports `EventMathRuntime` (UMD) — usable as a CommonJS require or browser global.
  - Core constructors: `EventMathEvent`, `EventMathLayer`, `EventMathTimeline`, `EventMathSignal`.

---

## 9. Formal Properties

**Determinism**: The compiler carries no ambient state between compilations. `generate(parse(tokenize(s)))` is a pure function of `s`. Environmental non-determinism (timestamps, random IDs) lives exclusively in runtime execution, not in the compiled source text.

**Idempotent formatting**: Let $F = \texttt{format} \circ \texttt{parse}$. Then $F \circ F = F$ for all well-formed source strings — the formatter is a retraction onto the subset of canonical forms. This follows from: (1) the parser is deterministic on canonical-form input, and (2) the formatter visits every AST node type exactly once in a fixed order.

**Safe-name bijectivity**: `safeName : \texttt{EMName} \rightarrow \texttt{JSIdentifier}` is injective on the domain of EventMath names that do not contain the underscore character. Two distinct EventMath names $n_1 \neq n_2$ (where neither contains `_`) produce distinct JavaScript identifiers $\texttt{safeName}(n_1) \neq \texttt{safeName}(n_2)$, since the only transformation is space → underscore.

**Pattern completeness**: Every atom in the atom denotation table maps to a syntactically valid ECMA-262 `RegExp` fragment. The set of atoms is finite and closed. Therefore, every well-formed EventMath `pattern` declaration compiles to a syntactically valid `RegExp`. The compiled pattern is accepted by `new RegExp(...)` without throwing `SyntaxError`.

**No implicit coercion**: All type coercions in compiled output are explicit (`Number()`, `String()`, `Boolean()`). The `is` operator compiles to `===`. No JavaScript type coercion is introduced by the compiler's output — any coercions present in runtime output are explicitly authored by `cast` or by string operations.

**Closed keyword set**: The KEYWORDS set is a compile-time constant. The tokenizer never adds to it at runtime. This gives the keyword set the property of **decidability at tokenization time**: for any word w, membership in KEYWORDS is computable in O(1).

---

## 10. Relationship to Formal Systems

### 10.1 Events as Records in a Labeled Transition System

EventMath events correspond to states in a **labeled transition system** (LTS) $\mathcal{L} = (S, \Sigma, \rightarrow)$ where:
- $S$ = the set of all event records
- $\Sigma$ = the set of categories (event labels)
- $\rightarrow \subseteq S \times \Sigma \times S$ = transitions introduced by `leads to` (chain edges)

`chain` declarations define a sub-LTS over event-named nodes with numeric-weighted transitions.

### 10.2 Timelines as Discrete Temporal Models

The three-partition structure `{past, present, future}` is a **discrete linear temporal model** with three time-points $T = \{-1, 0, 1\}$ and total order $-1 < 0 < 1$. This is a model of **LTL** (Linear Temporal Logic) restricted to three steps, or equivalently a bounded fragment of **CTL** (Computation Tree Logic). The `predict` operation is a forward projection from $t=0$ into $t=1$ by enumerating a Cartesian product of dimension layers — a form of **bounded model checking**.

### 10.3 Zoom Operations as Morphisms

In a category $\mathcal{V}$ of "views" where objects are event/layer/timeline records and morphisms are structure-preserving maps:
- `zoom in` constructs a morphism $f : A \times B \rightarrow C$ (pairwise direct transformation)
- `zoom opposite` constructs $f^{\dagger}$ (adjoint/inverse path)
- `zoom meta` completes a commutative square over all four poles: $A, B, f(A,B), f^{\dagger}(A,B)$

This is structurally equivalent to a **2-cell** in a bicategory, where the four-pole structure is a coherence square.

### 10.4 Chain Analysis as DAG Reachability

`why`, `root of`, and `trace` are all instances of **reachability queries** over the chain DAG. Specifically:
- `root of N in C` = find all nodes in C with in-degree 0 that are ancestors of N (topological source ancestors)
- `trace N back through C` = find all ancestors of N in C (transitive closure of incoming edges)
- `why D from C` = find the first bottleneck edge on the path from root to D's satisfaction node where the signal value falls below the desire threshold

All three are computable in $O(|V| + |E|)$ time by DFS/BFS over the chain's link list.

### 10.5 Pattern Language as a Typed Subset of ECMA-262 RegExp

The EventMath pattern language is a **proper subset** of ECMA-262 `RegExp`:
- It generates only named-group patterns `(?<name>...)`.
- It disallows backreferences within a single part's expression (only `matches PARTNAME` is permitted, which references a prior group).
- It does not expose lookahead, lookbehind, atomic groups, or possessive quantifiers.
- All generated flags are fixed: `gm` for `scan`/`replace`, non-global for `seek`.

The subset is **type-safe** in the sense that every combinator application produces a valid regex fragment — there is no combinator that can produce a syntactically invalid regex when applied to valid atoms.

---

## 11. Complete Formal Example

The following 32-line EventMath program models a hiring decision pipeline. Each statement is annotated with its formal semantic denotation.

```eventmath
note ── Hiring Pipeline Example ──────────────────────────────

assume market rate is 95000
assume minimum years is 3

event strong candidate
category hiring
matter
  name is Avery Chen
  years experience is 7
  salary ask is 110000
  domain is ml
end
end

event weak candidate
category hiring
matter
  name is Ben Doe
  years experience is 1
  salary ask is 85000
  domain is frontend
end
end

layer candidates
  strong candidate
  weak candidate
end

desire hire ml engineer
category hiring goal
matter
  direction is more than
  satisfied when salary ask less than market rate
  priority is 5
end
end

chain hiring path
  sourcing leads to screening at value 8
  screening leads to interview at value 7
  interview leads to offer at value 9
end

weight years experience at 3
weight domain at 2

explain candidates from candidates into best pick
show best pick

satisfy hire ml engineer against hiring path into decision
show decision

why hire ml engineer from hiring path into gap report
show gap report
```

**Formal denotations by statement:**

| Line | Statement | Denotation |
|------|-----------|------------|
| 1 | `note ...` | $\texttt{Note}(\text{"Hiring Pipeline Example"}) \in \texttt{AST}$; preserved by formatter; no runtime effect |
| 3 | `assume market rate is 95000` | $\texttt{\_\_assumptions}.\texttt{push}(\{name: \text{"market rate"}, value: 95000\})$; $\texttt{market\_rate} \leftarrow 95000$ |
| 4 | `assume minimum years is 3` | $\texttt{minimum\_years} \leftarrow 3$ |
| 6–13 | `event strong candidate ...` | $\texttt{strong\_candidate} := \texttt{EventMathEvent}(\text{"strong candidate"}, \text{"hiring"}, \{name: \text{"Avery Chen"}, years\_experience: 7, salary\_ask: 110000, domain: \text{"ml"}\})$ |
| 15–22 | `event weak candidate ...` | $\texttt{weak\_candidate} := \texttt{EventMathEvent}(\text{"weak candidate"}, \text{"hiring"}, \{...\})$ |
| 24–27 | `layer candidates ...` | $\texttt{candidates} := \texttt{EventMathLayer}(\text{"candidates"}, [\texttt{strong\_candidate}, \texttt{weak\_candidate}])$; ordered list |
| 29–35 | `desire hire ml engineer ...` | $d := \{keyword: \text{"desire"}, name: \text{"hire ml engineer"}, matter: \{direction: \text{"more than"}, satisfied\_when: \text{"salary ask less than market rate"}, priority: 5\}\}$ |
| 37–41 | `chain hiring path ...` | $G = (\{sourcing, screening, interview, offer\}, \{(sourcing, screening, 8), (screening, interview, 7), (interview, offer, 9)\})$; compiled to `hiring_path = EM.runtime.chain(...)` |
| 43 | `weight years experience at 3` | $\texttt{\_\_weights}[\text{"years experience"}] \leftarrow 3$ |
| 44 | `weight domain at 2` | $\texttt{\_\_weights}[\text{"domain"}] \leftarrow 2$ |
| 46 | `explain candidates from candidates into best pick` | $\texttt{best\_pick} \leftarrow \arg\max_{c \in \texttt{candidates}} \texttt{score}(c, \texttt{candidates}, \texttt{\_\_weights})$; abductive best-explanation selection over matter-field overlap with weights |
| 47 | `show best pick` | $\texttt{console.log}(\texttt{best\_pick}.\texttt{render}())$ |
| 49 | `satisfy hire ml engineer against hiring path into decision` | $\texttt{decision} \leftarrow \texttt{satisfy}(d, G)$; evaluates $d.\textit{satisfied\_when}$ expression against chain signal values; returns $\{satisfied: \texttt{Boolean}, gap: \mathbb{R}, ...\}$ |
| 50 | `show decision` | $\texttt{console.log}(\texttt{decision}.\texttt{render}())$ |
| 52 | `why hire ml engineer from hiring path into gap report` | $\texttt{gap\_report} \leftarrow \texttt{diagnose}(d, G)$; backward traversal from $d$'s satisfaction node through $G$'s edges; locates first unsatisfied precondition; complexity $O(\lvert V \rvert + \lvert E \rvert)$ |
| 53 | `show gap report` | $\texttt{console.log}(\texttt{gap\_report}.\texttt{render}())$ |

**Compilation invariants demonstrated:**

1. `safeName("strong candidate")` = `strong_candidate`; `safeName("hire ml engineer")` = `hire_ml_engineer` — injective within this program since no names contain underscores.
2. The `weight` statements at lines 43–44 populate `__weights` **before** `explain` at line 46 — order-dependency is structural, not declared. The compiler emits statements in source order; correct use requires the programmer to place `weight` before `explain`.
3. `explain` and `satisfy` both access `__weights` and `__assumptions` as compiler-global mutable registries, making them the only sources of **cross-statement shared state** in a compiled program. All other values are local bindings.
4. The `why` backward inference at line 52 operates over the `hiring_path` chain's link list. With $|V|=4, |E|=3$, the DFS terminates in constant time.

---

*EventMath Compiler v2.18. Technical Reference authored 2026-06-14.*
