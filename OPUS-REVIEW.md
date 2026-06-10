# EventMath — Independent Code Review (OPUS-REVIEW)

**Date:** 2026-06-10
**Reviewer:** Hermes Agent (Opus)
**Method:** Read every source file, then **empirically verified** every claim with probe scripts executed against the actual compiler/runtime. Command output is quoted inline. A prior review (`FABLE-REVIEW.md`) was read *after* forming these findings; §11 documents where it is wrong or incomplete.

---

## 0. TL;DR / Verdict

EventMath is a clean, readable v0.1 prototype with a coherent pipeline and a 100%-passing happy-path test suite. **It is not production-ready**, and the single most important reason is one the prior review missed entirely:

> **Declaration names (event/category/layer/timeline names) are emitted into JS string literals WITHOUT escaping, yielding arbitrary code execution at compile-output-run time.** Empirically confirmed: a crafted event name runs injected code (`__PWNED: true`).

The prior review's headline security claim — that `_escape` is buggy and uses `/\\\\/g` — is **factually false**; the real code is correct and all backslash/unicode cases roundtrip. The real injection hole is elsewhere (names, not values).

Confirmed-with-output bug count: **8 functional/security bugs** + several design gaps. Details and prioritization in §9.

---

## 1. Architecture & Pipeline

```
Source (.em) → Tokenizer → Parser → AST → Codegen → JS (.em.js)
                                       └──→ Formatter → canonical .em
                                       └──→ Mender (fast-path debugger over parser errors)
```

| Component | File | Role |
|---|---|---|
| Tokenizer | `src/tokenizer.js` (475 ln) | Line-oriented; first word selects a per-statement tokenizer |
| Parser | `src/parser.js` (513 ln) | Recursive descent, `end`-delimited blocks, iteration guards |
| Codegen | `src/codegen.js` (573 ln) | AST → plain JS using runtime constructors |
| Formatter | `src/formatter.js` (337 ln) | AST → canonical EventMath |
| Runtime | `runtime/eventmath-runtime.js` (323 ln) | Event/Layer/Timeline, UMD, ~9.8 KB |
| Mender | `mender/mender.js` (271 ln) | CLI debugger, regex fast-path table |

**Strengths.** Genuine separation of concerns; each statement type is touched consistently across parser/codegen/formatter. The line-oriented tokenizer is an unusual but defensible design that keeps "one idea per line" simple. Runtime is honestly small. Iteration guards (`MAX_ITERATIONS`, per-loop `guard < 1000`) make the parser hang-resistant.

**Architectural weaknesses (root causes of many bugs below).**
- **No semantic analysis / symbol table.** References are resolved by string-munging name conventions (`_safeName`) at codegen time. There is no validation that a referenced mark/layer/event exists, no scope model, and no type info. This is why the `set`-in-loop scope bug (§4) and duplicate-mark loss (§2) exist.
- **Names flow untrusted into both identifiers (sanitized) and string literals (NOT sanitized).** The dual treatment is the source of the injection vulnerability (§3).
- **No reserved-word enforcement** despite spec E015 defining it in detail.
- Compile pipeline emits output even when `ast.errors` is non-empty in several code paths (the parser returns a partial AST + errors, and codegen will happily process it — see §2 unclosed-block probe).

---

## 2. Tokenizer & Parser Correctness

### 2.1 Confirmed bug — matter field named `cat` (and `category`) is swallowed by the tokenizer

The prior review attributed this to a parser operator-precedence bug at `parser.js:157`. That precedence bug **is** real:

```js
// parser.js:157
} else if (t.type === 'KEYWORD' && t.value === 'category' || t.value === 'cat') {
// parses as ((KEYWORD && ==='category') || (==='cat'))
```

But that's not even the first failure. The **tokenizer** dispatches any line whose first word is `cat`/`category` to `_keywordName` (`tokenizer.js:82`), so a matter line `cat is fluffy` never reaches the parser as a field at all:

```
$ node /tmp/probe11.js   (cat field tokenization)
[ 'KEYWORD:cat', 'NAME:is fluffy' ]      # "is fluffy" consumed as a category NAME
```

And the full event probe shows the field is silently lost and a misleading cascade error is produced:

```
$ node /tmp/probe3_catfield.js
=== MATTER FIELDS PARSED ===
[ { "key": "name", "kind": "literal", "value": "Rex" } ]    # cat + color both gone
=== errors: [ 'Line 4: After "is fluffy" I expected "is" (literal) or "from" (reference), not "color".' ]
```

So `cat`/`category` are unusable as matter keys, *and* the parser precedence bug at :157 means even if a `cat` NAME token reached the matter loop it would be skipped. **Two independent defects, same symptom.** Fix both: don't treat `cat`/`category` as a leading dispatch inside matter context, and parenthesize the `||` at :157.

### 2.2 Confirmed bug — duplicate `mark` silently drops the second value

`codegen.js:282` guards on `this._vars.has(name)` and emits nothing the second time:

```
$ node /tmp/probe11.js  (duplicate mark)
let x = 1;        # `mark x as 2` produced NO output; value 2 lost silently
```

No error, no warning. A re-`mark` is a no-op rather than a redefinition or an error.

### 2.3 Confirmed — no reserved-word enforcement (spec E015 unimplemented in compiler)

Reserved words are accepted as declaration names and emitted as JS keywords/identifiers:

```
$ node /tmp/probe5_misc.js
=== reserved word event name ===   ->  const end = new EM.EventMathEvent("end", ...)
=== reserved word as layer name === ->  const is = new EM.EventMathLayer("is", [])
```

`const is = ...` is a **JS syntax error** in the compiled output (`is` is fine actually, but `const end`/`const new`/`const this` etc. will break). `end` as an identifier is legal JS but semantically wrong. The spec devotes an entire error class (E015) plus a Mender fast-path to this; the compiler enforces none of it. The Mender can only *react* to a parser error that the parser never raises.

### 2.4 Confirmed — codegen runs on error-laden ASTs

Unclosed block yields an error but codegen still emits a module:

```
$ node /tmp/probe5_misc.js  (unclosed event block)
errors: [ 'I was expecting end but the program ended unexpectedly.' ] | stmts: 1
JS:  // Event: "foo"  const foo = new EM.EventMathEvent( ... )   # emitted anyway
```

`compile-all.js` *does* gate on `ast.errors`, but the codegen API itself does not, so any embedder calling `generate()` on a partial AST gets silently-wrong output. The empty-file and whitespace-only cases are handled gracefully (0 statements, no crash) — good.

### 2.5 Other tokenizer/parser notes (read-confirmed)
- **Dead code:** `tokenizer.js:182-185` (`with` check) is unreachable; matter/ref lines already matched above. Harmless, confirmed by control-flow reading.
- **`again 1 time` vs `1 times`:** `tokenizer.js:275` accepts both `time`/`times`; the spec only blesses `times`. Lenient, not a bug.
- **`_parseAdd`/`_parseRemove` return `null` for unknown kinds** (`parser.js:479,491`) producing a generic "I don't know what to do with" error rather than the catalog's E-class messages.
- **Comment stripping is value-safe:** `#` only starts a comment when preceded by whitespace/BOL, so `tag is C# is great` keeps `C#`. Confirmed:
  ```
  $ node /tmp/probe11.js (hash in value) -> ["C# is great"]
  ```

---

## 3. Codegen Correctness & JS Injection (most serious section)

### 3.1 CONFIRMED CRITICAL — arbitrary code execution via declaration names

`_escape` is applied to matter **values** (`codegen.js:164,192`) but the event **name**, **category**, layer name and timeline name are interpolated raw into string literals:

```js
// codegen.js:157   (and :185, :212, :231 similarly)
this._line(`"${stmt.name}",`);            // NO _escape
this._line(`"${stmt.category || 'event'}",`);   // NO _escape
```

`_safeName` sanitizes the *identifier* form, but the human-readable name kept as a string argument is not escaped. A name with no spaces is a single NAME token, so a quote in it breaks out of the string. I built a payload that calls an injected sink and **it executed**:

```
$ node /tmp/probe6b.js
--- generated ---
const a__SINKb = new EM.EventMathEvent(
  "a"+(__SINK())+"b",        <-- attacker expression spliced into source
  "event",
  __PWNED: true              <-- the injected __SINK() actually RAN
```

Source: `event a"+(__SINK())+"b`. This is full arbitrary-JS execution in whatever context the compiled module runs. Category names are the same sink (`codegen.js:185`), as are layer/timeline names. **Severity: Critical.** Fix: route every interpolated name/category/destination through `_escape`.

### 3.2 CONFIRMED HIGH — split path names and time-travel destinations are unescaped

`_genRewind`/`_genForward` interpolate `stmt.destination` raw (`codegen.js:486,495`):

```
$ node /tmp/probe4_injection.js  (rewind destination injection)
t.rewindTo("evil") ; process.exit(1); //");    # statement injection
```

Split path names go into `case "...":` and *are* run through `_escape` (`codegen.js:415`), so the quote is neutralized — confirmed safe:

```
$ node /tmp/probe4_injection.js (split path)
case "a\" : process.exit(1); case \"b":   # escaped — inert
```

So: **path names safe; rewind/forward destinations and all declaration names unsafe.**

### 3.3 CONFIRMED — `_escape` itself is CORRECT (prior review is wrong here)

The real source is `codegen.js:566`:

```js
return str.replace(/\\/g, '\\\\')   // single backslash -> double  (CORRECT)
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
```

Empirically, every adversarial value roundtrips, including the exact `\u0041` case FABLE claimed would corrupt to `A`:

```
$ node /tmp/probe1_escape.js
--- backslash-u sequence
  input chars   : "hello\u0041world"   (literal backslash-u-0-0-4-1)
  emitted JS    : "hello\\u0041world"
  eval result   : "hello\u0041world"
  roundtrips?   : YES
--- injection try via quote+semicolon : roundtrips? YES   (inert string)
... all 8 cases: roundtrips? YES
```

FABLE quoted the regex as `/\\\\/g` (two backslashes). The file does not contain that. **Its entire §3.2 / §8 backslash thesis is incorrect** (see §11).

### 3.4 CONFIRMED — `stop` is silently dropped

`_genStatement` has no `Stop` case; it falls to the default comment (`codegen.js:139`):

```
$ node /tmp/probe5_misc.js  (stop keyword)
function a( x ) {
  // (unknown node type: Stop)     # no break/return/throw emitted
  return x;
}
```

Parser and formatter both handle `Stop`; only codegen omits it. Agrees with FABLE.

### 3.5 CONFIRMED HIGH — action-call arguments are positional by source order, keys ignored

`_genActionCall` (`codegen.js:475`) emits `args.map(a => value)` in the order written, never matching `a.key` against the door's declared input order:

```
$ node /tmp/probe9.js  (action call arg ordering)
function greet( first, last ) { ... a: first, b: last ... }
greet("Smith", "John");      # called as: first="Smith", last="John"
```

Source said `greet with last is Smith and first is John` — the user clearly intended `first=John, last=Smith`. The compiler **swaps them** because it ignores the keys. This is a silent correctness bug for any call whose argument order differs from the door declaration. FABLE missed this entirely.

### 3.6 Incomplete codegen (read-confirmed, acknowledged as v0.1)
`_genAddLayer`, `_genRemoveLayer`, `_genRemoveEvent`, `_genMerge` emit only comments (`codegen.js:509-524`). Timeline `past`/`future` sections are dropped — only `present` layers are pushed into `.log` (`codegen.js:235`):

```
$ node /tmp/probe10.js (timeline past/future)
const T = new EM.EventMathTimeline("T");
T.log.push(...L2.events);     # L1 (past) silently omitted
```

---

## 4. Confirmed bug — `set`/`mark` first-seen inside a block leaks a block-scoped `let`

`_genSet`/`_genMark` emit the `let` declaration at the point of first use (`codegen.js:282,299`). If that point is inside a loop/when/walk, the `let` is block-scoped, but later top-level references compile to the bare name → **ReferenceError at runtime**:

```
$ node /tmp/probe9.js
for (let __i = 0; __i < 3; __i++) {
  let counter;            # scoped to the for-block
  counter = 5;
}
console.log(JSON.stringify(counter, null, 2));   # counter not in scope
```

Executing it:

```
$ node /tmp/probe10.js (scope bug execution)
CRASH: ReferenceError - counter is not defined
```

This is a real, runnable miscompilation, not theoretical. Root cause is the absence of a declaration/hoisting pass (declarations should be lifted to function/module top). FABLE missed this.

---

## 5. Runtime Correctness — snapshots, structural sharing, time travel

### 5.1 CONFIRMED — `forwardTo` is generated but undefined in the runtime → TypeError

The task flagged this; I confirmed it both ways. Codegen emits `forwardTo` for `forward X to E` (`codegen.js:495`), but the runtime defines only `rewindTo`, `rewind`, `forward` (`eventmath-runtime.js:201,221`) — **no `forwardTo`**:

```
$ node /tmp/probe2b.js
rewindTo works: function
forwardTo CRASH: TypeError - story.forwardTo is not a function
```

```
$ node /tmp/probe2_forwardto.js
=== runtime has forwardTo?  undefined
=== runtime has rewindTo?  function
```

Any program using `forward ... to ...` compiles cleanly and then throws at runtime. Agrees with FABLE (one of its few correct catches).

### 5.2 Time-travel semantics that DO work (verified)
- Pointer-based `rewind(n)` + `state()` rebuild is correct:
  ```
  $ node /tmp/probe7_timetravel.js
  state x: 3 ; after rewind(2) pointer: 1 ; state x: 1     # rebuild respects pointer
  ```
- Snapshots fire exactly at multiples of 50 and rebuild-from-nearest-snapshot is correct at an arbitrary pointer:
  ```
  snapshots keys: [ '50', '100' ]
  rebuild at pointer 75: has k74? 74  has k75? undefined    # correct fold boundary
  ```
- **Structural-sharing/snapshot aliasing is safe.** The JSON deep-clone at `:119` means later mutation of `_state` does not corrupt a stored snapshot:
  ```
  snapshot@50 a = 49 ; after 51st append, snapshot@50 a still = 49   # no aliasing
  ```
  (The clone is "deep copy," not true structural sharing as the comment claims, but it is *correct*. FABLE's "lossy JSON round-trip" point is valid in principle — functions/undefined/cycles would be dropped — but state only ever holds plain data here, so it's not currently exploitable.)

### 5.3 Confirmed runtime gaps
- **`_applyEntry` ignores `remove`/`merge`/`action` entry types** (`:128-146`). `append` accepts them but they never affect derived state. Since codegen never emits those entry types yet, it's latent, not currently triggered.
- **`rewindTo` conflates events and marks** (`:204-211`): a search key matches either an `event.id` *or* a `set.key`. An event and a mark sharing a name cause ambiguous rewinds. Read-confirmed.
- **Default-timeline singleton** (`:306`) is shared process-wide; the integration test must manually reset internals (`integration.js:36-40`). Fragile but works.

---

## 6. Formatter Roundtrip Soundness

Roundtrip (`parse→format→parse→format`) is idempotent for all three acceptance programs:

```
$ node tests/format-all.js  ->  3 passed, 0 failed (all "identical")
```

**But idempotence ≠ semantic soundness.** Confirmed subtlety: `_formatSet` (`formatter.js:173`) emits the value unquoted, and multi-word literals survive only because the tokenizer re-globs them:

```
$ node /tmp/probe10.js (formatter set multi-word value)
formatted: "set greeting to hello world\n"
reparsed set value: {"kind":"literal","value":"hello world"}   # ok by luck of re-tokenization
```

This is fine for plain words but would mis-handle a value that *contains a delimiter keyword* (e.g. a value containing ` to ` or ` is `) — the formatter has no quoting mechanism, so such values are not generally roundtrip-safe. The acceptance set never exercises this. The formatter also faithfully reproduces `Stop` (`:302`), unlike codegen.

---

## 7. Mender Debugger — Error Coverage

- Fast-path table covers **E001, E002, E003, E004, E005, E006, E008, E015, E016** — i.e. it is **missing E007, E009, E010, E011, E012, E013, E014** (7 of 16 classes). Read-confirmed (`mender.js:29-123`).
- **Matcher drift:** the E005 matcher is `/After "(\w+)" I was expecting "is" or "from"/` but the parser now emits `After "${key}" I expected "is" (literal) or "from" (reference)` (`parser.js:154`). The verb is `expected`, not `was expecting`, and word order differs → **this matcher never fires.** I confirmed the parser wording in §2.1 output (`After "is fluffy" I expected "is" (literal) or "from"...`). FABLE claimed E005 works via partial match; it does **not** — the regex requires the literal substring `was expecting "is" or "from"` which the parser never produces.
- E006 matcher `/I was expecting (end) but the program ended/` does partial-match the parser's `...program ended unexpectedly.` (the trailing word is outside the regex) — this one works.
- `\w+` matchers can't capture EventMath's multi-word names (e.g. `make requirement`); E001/E004 fixes will show a truncated block/action name.
- Unused imports `EventMathFormatter`, `EM` (`mender.js:24-25`); `EventMathCodeGen` is not even imported (FABLE wrongly said it was).
- No de-duplication: N identical errors → N identical suggestions.

---

## 8. Test Suite Gaps

All four runners pass:

```
$ node tests/run-all.js      -> 4 passed, 0 failed
$ node tests/compile-all.js  -> 3 compiled, 0 failed
$ node tests/format-all.js   -> 3 passed, 0 failed
$ node tests/integration.js  -> 3 passed, 0 failed
```

Gaps (all confirmed by inspection):
- **Zero negative tests.** No malformed input, no reserved-word, no unclosed-block, no injection, no unicode. Every bug in this review is invisible to the suite.
- **`integration.js` never executes generated control flow.** `staticTests` is empty (`integration.js:20`); the workflow loop/walk/condition are only *string-matched* in dead code, never run. The most complex program is the least exercised at runtime.
- **No test runs `forward ... to`,** which is why the §5.1 TypeError shipped undetected.
- **No test calls an action with out-of-order args,** hiding §3.5.
- **No test marks/sets a variable inside a loop and reads it after,** hiding §4.
- Manual singleton reset in integration is fragile (any new runtime field breaks isolation).
- Roundtrip test asserts string idempotence, not compiled-behavior equivalence.

---

## 9. Prioritized Bug List (file:line, all CONFIRMED unless marked)

| # | Sev | Bug | Location | Evidence |
|---|-----|-----|----------|----------|
| 1 | **CRITICAL** | Arbitrary code execution: event/category/layer/timeline names emitted to string literals without `_escape` | `codegen.js:157,185,186,204,212,231` | probe6b → `__PWNED: true` |
| 2 | **HIGH** | `forward X to E` calls `forwardTo`, undefined in runtime → TypeError | gen `codegen.js:495`; missing `eventmath-runtime.js:~225` | probe2b TypeError |
| 3 | **HIGH** | Action-call args are positional in source order; keys ignored → silent arg swap | `codegen.js:475` | probe9 swap |
| 4 | **HIGH** | `set`/`mark` first-used in a block emits block-scoped `let`; later use → ReferenceError | `codegen.js:282,299` | probe10 ReferenceError |
| 5 | **HIGH** | Statement injection via unescaped `rewind/forward ... to <dest>` | `codegen.js:486,495` | probe4 |
| 6 | **MED** | `cat`/`category` cannot be matter keys (tokenizer dispatch + parser `||` precedence) | `tokenizer.js:82`, `parser.js:157` | probe3 / probe11 |
| 7 | **MED** | Duplicate `mark x` silently drops later value | `codegen.js:282` | probe11 |
| 8 | **MED** | `stop` silently dropped (no codegen case) | `codegen.js:139` | probe5 |
| 9 | **MED** | No reserved-word enforcement; can emit invalid/wrong JS identifiers (spec E015) | `parser.js` dispatch | probe5 |
| 10 | **MED** | Mender E005 matcher never fires (regex/parser wording mismatch) | `mender.js:89` vs `parser.js:154` | §2.1 wording |
| 11 | LOW | Timeline `past`/`future` sections dropped in codegen | `codegen.js:235` | probe10 |
| 12 | LOW | `_applyEntry` ignores remove/merge/action entries | `eventmath-runtime.js:128` | read |
| 13 | LOW | `rewindTo` conflates event id and mark key | `eventmath-runtime.js:204-211` | read |
| 14 | LOW | codegen emits output on error-laden AST (no internal gate) | `codegen.js:41` | probe5 |
| 15 | LOW | AddLayer/RemoveLayer/RemoveEvent/Merge are comment-only stubs | `codegen.js:509-524` | read |
| 16 | LOW | Mender missing 7/16 error classes; unused imports; no dedup | `mender.js` | read |

---

## 10. Production-Readiness Verdict

**Not production-ready.** It is a competent v0.1 prototype suitable for demos and further development, blocked by:

1. **A critical injection-to-RCE hole (#1, #5)** — disqualifying for any setting where `.em` source is untrusted.
2. **Two silent miscompilations (#3 arg-swap, #4 scope leak)** that produce wrong programs without any error — the worst failure mode for a compiler.
3. **A shipped runtime crash (#2 forwardTo)** for an advertised first-class feature (time travel forward).
4. **A test suite that exercises only the happy path** and never runs the generated control flow, so none of the above is caught.

Minimum bar to call it "alpha-usable": escape all interpolated names/destinations (#1/#5), implement `forwardTo` (#2), match action args by key (#3), hoist declarations (#4), and add negative + execution tests. The architecture is clean enough that these are localized fixes, not rewrites.

---

## 11. Where FABLE-REVIEW.md Is Wrong or Incomplete

**Wrong / false:**
- **Its headline security finding is fabricated.** FABLE claims `_escape` uses `/\\\\/g` (matches two backslashes) and that `\u0041` corrupts to `A` (its §3.2, §8.1, recommendation #3). The actual code (`codegen.js:566`) uses `/\\/g` and **all cases roundtrip**, including `\u0041` (probe1). It reviewed code that isn't there.
- **It rates JS injection "Low risk" across the board (§8.1 table, "Verdict: Low risk").** The real, *critical* RCE via unescaped **names** (probe6b) is completely absent. It only examined value-escaping (which is fine) and never tested names/destinations.
- **It says the Mender E005 matcher "still works because `.match()` does partial match."** It does not — the parser emits `expected`, the regex needs `was expecting "is" or "from"` (§7).
- **It says `EventMathCodeGen` is imported-but-unused in mender.js (§6.2.4).** `mender.js` never imports `EventMathCodeGen` at all; the unused imports are `EventMathFormatter` and `EM`.

**Missed entirely:**
- Action-call argument order bug (#3) — a silent correctness defect.
- `set`/`mark`-in-loop block-scope ReferenceError (#4) — a runnable miscompilation.
- Duplicate-`mark` value loss (#7).
- The `cat`/`category` failure originates in the **tokenizer**, not just the parser `||` (FABLE saw only the parser half).
- Codegen emits modules from error-laden ASTs (#14).
- Names with unicode collapse via `_safeName` (e.g. `café señor → caf_seor`), a collision risk.

**Correct (credit where due):** `stop` dropped by codegen; `forwardTo` undefined in runtime; incomplete `_applyEntry`; comment-only Add/Remove/Merge; lossy-in-principle JSON snapshot clone; parser `:157` precedence bug; missing Mender error classes; absence of negative tests. These overlap with my findings and are accurate.

---

### Appendix — probe scripts (in `/tmp`, all executed)
`probe1_escape.js` (escaping), `probe2_forwardto.js`/`probe2b.js` (forwardTo crash), `probe3_catfield.js` (cat field), `probe4_injection.js` (name/path/dest injection), `probe5_misc.js` (empty/stop/reserved/unclosed), `probe6b.js` (**RCE proof**), `probe7_timetravel.js` (snapshots/rewind), `probe8_loops.js` (loops/walks), `probe9.js` (arg order + scope), `probe10.js` (scope crash, formatter, timeline), `probe11.js` (hash/cat/unicode/dup-mark). Every quoted result above is real stdout.
