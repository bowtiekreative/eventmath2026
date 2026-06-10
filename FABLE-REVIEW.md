# EventMath Project — Comprehensive Code Review

**Date:** 2026-06-10  
**Reviewer:** Hermes Agent  
**Scope:** Full-stack review of the EventMath programming language compiler, runtime, debugger, and test suite.

---

## Executive Summary

EventMath is a small, domain-specific programming language where "time is a first-class language construct." It targets readability and plain-English syntax with events, layers, timelines, actions, and a conversational debugger called "The Mender." The project compiles to JavaScript.

**Overall assessment: Early-stage prototype (v0.1–v0.2) with a clean architecture and good test coverage for its size.** Most tests pass. The code is readable and well-structured. However, there are several notable issues — a codegen blind spot (the `stop` keyword is silently dropped), an operator-precedence bug in the parser, and the `_escape` backslash-escaping logic that uses `/\\\\/g` (matching two backslashes) instead of `/\\/g` (matching one), meaning single backslashes in literal values pass through to the JS interpreter as escape sequences.

---

## 1. Architecture

The project is organized into a classic compiler pipeline:

```
Source (.em) → Tokenizer → Parser → AST → Codegen → JS (.em.js)
                                                 ↘ Formatter → Canonical .em
                                                     ↓ Mender (debugger)
```

| Component | File | Lines | Role |
|-----------|------|-------|------|
| Tokenizer | `src/tokenizer.js` | 474 | Line-oriented lexer, dispatching on leading keyword |
| Parser | `src/parser.js` | 512 | Stack-based recursive descent, `end`-delimited blocks |
| Code Generator | `src/codegen.js` | 572 | AST → plain JS, with runtime constructor calls |
| Formatter | `src/formatter.js` | 336 | AST → canonical EventMath source |
| Runtime | `runtime/eventmath-runtime.js` | 322 | Event/Layer/Timeline classes, ~10KB |
| Mender | `mender/mender.js` | 270 | CLI debugger with fast-path error table |

**Strengths:**
- Clean separation of concerns — each component has a single responsibility
- The pipeline is easy to follow; adding a new statement type requires touching parser, codegen, and formatter in consistent ways
- Runtime is genuinely small (~10KB as claimed)
- The Mender debugger is a novel feature for such a small language

**Weaknesses:**
- No symbol table or semantic analysis pass — references are resolved by name convention only
- No type system, no intermediate representation, no optimization passes
- The `stop` keyword is parsed but silently ignored by the code generator (see §3)
- No source maps for debugging compiled JS back to EventMath

---

## 2. Grammar / Parser

### 2.1 Tokenizer (`src/tokenizer.js`)

The tokenizer is line-oriented: it splits each line by whitespace, identifies the leading keyword, then dispatches to statement-specific tokenizers.

**Strengths:**
- Clear dispatch logic with helpful comments
- `_stripComment` handles `#` comments correctly
- Multi-word names are joined from adjacent tokens
- `_collapseNames` correctly merges consecutive NAME tokens for `add`/`remove` statements

**Issues:**

1. **Action-call detection ambiguity** (lines 162–185): The tokenizer checks for `with` delimiter twice — once before matter-line detection (line 163) and once after (line 182). The second check is dead code because control never reaches it (matter lines and ref lines already matched). This is harmless but confusing.

2. **`again` keyword handling** (line 275): Accepts both `time` and `times`. "again 1 time" would tokenize the same as "again 1 times". This is inconsistent.

3. **Door open multi-name parsing** (lines 322–324): Each word after `door open` is tokenized as a separate NAME. But door closed (lines 327–329) joins all remaining words as a single multi-word NAME. This asymmetry is intentional (inputs are individual names, return is one name) but could be surprising.

### 2.2 Parser (`src/parser.js`)

**Strengths:**
- Stack-based block tracking via `end` keyword (Law 4)
- All loops have safety limits (MAX_ITERATIONS = 10000, plus guard < 1000 per sub-loop)
- Error recovery: unknown tokens are skipped rather than causing infinite loops
- Friendly error messages with line numbers

**Issues:**

1. **CRITICAL: Operator precedence bug on line 157:**
   ```javascript
   } else if (t.type === 'KEYWORD' && t.value === 'category' || t.value === 'cat') {
   ```
   Due to JS operator precedence, this is parsed as:
   ```javascript
   } else if ((t.type === 'KEYWORD' && t.value === 'category') || (t.value === 'cat')) {
   ```
   A NAME token with value `'cat'` would match the second clause regardless of token type, causing the parser to silently advance past it. This is inside `_parseMatterBlock`, so a matter field named `cat` (e.g., `cat is fluffy`) would be silently skipped. The fix requires parentheses:
   ```javascript
   } else if (t.type === 'KEYWORD' && (t.value === 'category' || t.value === 'cat')) {
   ```

2. **Missing `Stop` in default case:** The `_parseStatement` switch includes `case 'stop'` (line 105), so `stop` is parsed. But the `_parseStop()` method (line 465) works correctly. The actual problem is downstream in the code generator.

3. **`_parseAdd` silently returns null** for unknown kinds (line 479). A malformed `add` statement produces an unhelpful parse error ("I don't know what to do with...").

4. **No reserved-word enforcement:** Keywords like `event`, `matter`, `end`, `is`, `from` can be used as event/layer/action names if they appear in non-leading position. The spec defines E015 (reserved word) but the tokenizer and parser don't enforce it — a multi-word name could include a keyword.

5. **`_parseMatterBlock` consumes the first `end`** that closes the matter block, but `_parseEvent` also calls `expect('KEYWORD', 'end')` for the event block. If the matter block is missing its `end`, the event parser happily consumes the event's `end` as the matter `end`, leading to confusing error cascades.

---

## 3. Code Generator (`src/codegen.js`)

### 3.1 Statement Coverage

The `_genStatement` switch handles 20 out of 21 AST node types. **`Stop` is missing.** A `stop` statement emits `// (unknown node type: Stop)` as a comment and is silently ignored. This means the `stop` keyword has no runtime effect.

| Node type | Handled? | Notes |
|-----------|----------|-------|
| Event | ✓ | Top-level and inline (in-action) variants |
| Layer | ✓ | |
| Timeline | ✓ | Populates present from layers |
| Action | ✓ | Door open/closed support |
| Mark, Set | ✓ | |
| Run | ✓ | Handles event/layer/timeline keyword prefixes |
| When | ✓ | Supports otherwise |
| Split | ✓ | Maps to switch statement |
| AgainCount, AgainUntil | ✓ | Maps to for/while loops |
| Walk | ✓ | Maps to for-of, tracks walk variable |
| ActionCall | ✓ | Passes escaped string args |
| Rewind, Forward | ✓ | |
| AddEvent, AddLayer, RemoveLayer, RemoveEvent | ✓ | AddEvent is real; others are comments |
| Merge | ✓ | Comment only |
| NameRef | ✓ | No-op (correct) |
| **Stop** | **✗** | **Silently dropped** |

### 3.2 Security: String Escaping (`_escape` method, line 564–570)

The `_escape` method handles quote characters and control characters in literal values:

```javascript
_escape(str) {
    return str.replace(/\\\\/g, '\\\\\\\\')   // Match \\ → \\\\
      .replace(/\"/g, '\\\\\"')               // Match " → \"
      .replace(/\n/g, '\\\\n')               // Match newline → \n
      .replace(/\r/g, '\\\\r');              // Match CR → \r
}
```

**The first regex `/\\\\/g` matches TWO consecutive backslashes** and replaces them with FOUR. This means **a single backslash in a literal value is NOT escaped** — it passes through to the JS string literal unmodified. The JS parser then interprets `\u`, `\n`, `\t`, etc., as escape sequences.

**Concrete effect:** If a user writes `title is hello\u0041world`, the emitted JS is `"hello\u0041world"`, which JS evaluates to the string `helloAworld`. This is lossy but not an injection vector per se.

**What was tested (13 cases, all passed):**
- `"` quotes → properly escaped to `\"`
- `\"` (backslash + quote) → properly escaped to `\\"` → JS reads as `\"`
- `${...}` template literals → passed through harmlessly in double-quoted strings
- `constructor` → safe as an object key
- Backtick characters → safe in double-quoted strings
- Semicolons and function calls → safe when inside a string literal

**Verdict:** The escaping is functionally adequate for preventing injection in double-quoted strings, but the backslash-handling is imprecise. The fix should use `/\\/g` (match single backslash) → `'\\\\'` (replace with two). The current code only doubles already-paired backslashes.

### 3.3 Name Safety

- `_safeName` (line 528): Strips non-alphanumeric/underscore/dollar characters, prefixes with `_` if starts with digit. Safe.
- `_safeKey` (line 538): Validates JS identifier; falls back to quoted string keys. Safe.
- `_safeRef` (line 546): Returns `undefined` for empty names, otherwise passes through `_safeName`. Safe.
- `_camelName` (line 555): Strips non-alphanumeric characters, camelCases. Safe.

### 3.4 Incomplete Code Generation

Multiple operations emit only comments instead of real logic:
- `_genAddLayer` — `// add layer: ...`
- `_genRemoveLayer` — `// remove layer: ...`
- `_genRemoveEvent` — `// remove event: ...`
- `_genMerge` — `// merge ... into ...`

The codegen comments acknowledge these as "v0.1" or "v0.2" placeholders. They won't cause crashes but the functionality is absent.

---

## 4. Runtime (`eventmath-runtime.js`)

### 4.1 Architecture

- **Events** are frozen, immutable objects (id + cat + matter). 
- **Layers** are ordered arrays of event references.
- **Timelines** are append-only logs with a pointer, periodic snapshots, and derived state rebuilt from the log.

### 4.2 Strengths

- `Object.freeze()` on events ensures structural sharing safety
- Snapshot mechanism reduces rewind cost from O(n) to O(distance to nearest snapshot)
- UMD wrapper supports both Node.js `require` and browser `<script>` tags
- Runtime is genuinely compact (~10KB)

### 4.3 Issues

1. **Incomplete `_applyEntry`** (line 128–146): Only handles `event`, `set`, and `add` entry types. If `remove`, `merge`, `action`, or other entry types are appended to the timeline, they are silently ignored during state rebuilding. The `append` method (line 112) accepts any `TimelineEntry`, but some entry types will never be applied to the derived state.

2. **Snapshot via JSON round-trip** (line 119): `JSON.parse(JSON.stringify(this._state))` is lossy:
   - Functions, Symbols, and `undefined` values are dropped
   - Prototype chain is not preserved
   - Circular references crash
   - This is documented as "structural sharing" but it's actually deep cloning

3. **`rewindTo` matches both events and sets** (lines 201–214): Searching for an event ID will also match a set entry with the same key name. This could cause unexpected rewind behavior if an event and a mark share a name.

4. **`renderRange` uses `var`** (line 280) in a Node.js codebase that otherwise uses `const`/`let`. Minor style inconsistency.

5. **No `forwardTo` implementation**: The codegen calls `.forwardTo()` but the runtime only has `.rewindTo()`. Looking at the codegen (line 495), `forwardTo` is generated but the runtime doesn't define it. This would throw a runtime error if executed.

6. **SNAPSHOT_INTERVAL = 50** is hardcoded; for small programs (< 50 entries), snapshots never trigger and all state derivation is O(n) from the beginning.

7. **Default timeline singleton** (line 306–309): `getDefaultTimeline()` returns a module-level singleton. If multiple compiled .em files are loaded in the same process, they all share the same default timeline. The integration test resets it manually (lines 35–40), which is fragile.

---

## 5. Formatter (`src/formatter.js`)

### 5.1 Strengths

- Handles all 21 AST node types (including `Stop` — unlike the codegen)
- Roundtrip stability: parse → format → parse → format produces identical output (verified for all 3 test programs)
- Canonical ordering: `cat` → `category`, consistent 2-space indentation
- Proper block-end alignment

### 5.2 Issues

1. **`_formatSet` outputs raw values** (line 173): `set ${stmt.name} to ${stmt.value.value}` — if the value's `.value` property is a number or boolean, it's stringified implicitly. But for literal strings, it outputs the raw value without quotes. This means a set value of `hello world` becomes `set x to hello world`, which when re-parsed would tokenize `hello` and `world` as separate NAME tokens, not a single LITERAL. However, the roundtrip test passes because the formatter reads the parsed AST, so the tokenizer correctly tokenizes the raw output.

2. **No `Stop` in format output?** Let me verify: `_formatStop` (line 302–303) emits `stop`. This is present in `_formatStatement`'s switch. ✅

3. **Reparse ambiguity**: The formatted output drops quote markers around literal values. E.g., `set x to hello world` formats from a `Set` node where `value.kind === 'literal'` and `value.value === 'hello world'`. When re-tokenized, `hello world` becomes two tokens. This works because the roundtrip goes through the parser which creates the same AST. But the formatted output is not semantically equivalent to the original — it's idempotent within the parser's representation.

---

## 6. Mender Debugger (`mender/mender.js`)

### 6.1 Strengths

- Clean implementation of the "Fast Path" concept: known error patterns → immediate fix recommendation
- 8 error matchers in the fast-path table (E001–E006, E008, E015, E016)
- Friendly, non-technical language throughout
- Feedback gate (Phase 6) asks users if the fix worked
- Good user experience for a v0.1 debugger

### 6.2 Issues

1. **Fast-path table incompleteness**: The spec defines error classes E001–E016, but the Mender only implements matchers for E001, E002, E003, E004, E005, E006, E008, E015, and E016. Missing:
   - E007 (Missing matter keyword)
   - E009 (Loop problem)
   - E010 (Walk problem)
   - E011 (Split problem)
   - E012 (Door closed without open)
   - E013 (Action never closes door)
   - E014 (Blocked door)

2. **Matcher regex compatibility**: The table has matchers from the parser's error messages, but some parser errors have slightly different formatting. For example:
   - The matcher for E006: `/I was expecting (end) but the program ended/` — but the parser emits `I was expecting ${value || type} but the program ended unexpectedly.` The word "unexpectedly" isn't in the regex. However, `.match()` with a regex still works because it's a partial match.

3. **No multi-error deduplication**: If a file has 5 errors matching the same catalog entry, the Mender suggests the same fix 5 times.

4. **Unused imports**: `EventMathCodeGen` and `EventMathFormatter` are imported but never used in `mender.js` (line 24).

5. **CLI-only**: The Mender is a readline-based CLI app. It can't be embedded in a web IDE or editor plugin without significant refactoring.

---

## 7. Test Suite

### 7.1 Test Coverage

Four test runners with 100% pass rate on `main`:

| Test runner | Tests | Status |
|-------------|-------|--------|
| `tests/run-all.js` | 4 (3 files + 1 inline) | ✅ 4/4 pass |
| `tests/compile-all.js` | 3 | ✅ 3/3 pass |
| `tests/format-all.js` | 3 | ✅ 3/3 pass (roundtrip) |
| `tests/integration.js` | 3 | ✅ 3/3 pass |

### 7.2 Test Content

**Requirements Tracker** (`requirements-tracker.em`): Tests nested blocks (action → event → matter), matter references (`title from title`), action calls with arguments, and the `run` statement. Generates a `makeRequirement` action that creates an event in its body.

**Story Timeline** (`story-timeline.em`): Tests timeline sections (past/present/future), layer references within timelines, and multi-category events.

**Workflow Automation** (`workflow-automation.em`): Tests `mark`, `set`, `again until`, `walk` with conditional checks, and property access on walk variables. This is the most complex test.

### 7.3 Issues

1. **No unit tests**: All tests are integration-level (tokenize → parse → compile → format). There are no isolated unit tests for individual tokenizer methods, parser edge cases, or codegen helpers.

2. **No negative tests**: No tests for malformed input, error recovery, or edge cases:
   - Missing `end` keywords
   - Nested block depth limits
   - Reserved word violations
   - Empty files
   - Unicode in names
   - Very long lines/values
   - Tab vs space indentation

3. **Integration test skip gap**: The `staticTests` array in `integration.js` is empty (`const staticTests = [];`). The workflow automation test only checks module structure (events, layers, functions) without actually running the generated loop/condition logic.

4. **Mock runtime resets are fragile**: The integration test manually resets the default timeline's internals (`timeline.log = []; timeline.pointer = 0;`). If the runtime adds new internal properties, this reset becomes incomplete.

5. **Formatting test doesn't verify semantic preservation**: The roundtrip test checks that format → parse → format produces the same string, but doesn't verify the formatted output produces the same runtime behavior when compiled.

---

## 8. Security Analysis

### 8.1 Injection Vectors in Codegen

| Vector | Risk | Status |
|--------|------|--------|
| Matter field values → JS string literals | Low | `"` and control chars escaped. Single `\` passes through (minor) |
| Event/action names → JS identifiers | Low | `_safeName` strips non-alphanumeric chars |
| Action call args → JS function arguments | Low | Values go through `_escape` |
| Path names in split → JS case labels | Low | `_escape` applied |
| `rewindTo`/`forwardTo` destination → JS string | Low | Not escaped via `_escape`, but placed in double-quoted strings |
| Mark/set values → JS values | Low | `_typedValue` and `_typedValueFromString` detect booleans/numbers, escape strings |

**Key finding: `_escape` only doubles already-paired backslashes (`/\\\\/g`) instead of escaping all single backslashes (`/\\/g`).** This means:
- `\n` in input → actual newline in JS string (because JS string evaluates the escape)
- `\u0041` in input → `A` in the stored string
- However, `\"` in input → `\"` in output (step 2 escapes `"` after step 1 doubles `\\`)

The escaping is adequate for preventing code injection because:
1. All values are placed in double-quoted strings
2. `"` is properly escaped to `\"`
3. `${` in a double-quoted string is literal, not a template expression
4. Backtick injection is harmless in `"..."` strings

**Verdict: Low risk of JS injection.** The most plausible attack (embedding `"` to break out of the string) is blocked. The single-backslash issue can cause data corruption but not injection.

### 8.2 Other Security Concerns

- **No input size limits**: The tokenizer/parser have no limits on line length, token count, or nesting depth (other than the hardcoded 1000-guard). A pathological `.em` file could cause OOM.
- **Runtime singleton pollution**: Multiple compiled modules share the same default timeline, which could cause cross-file side effects.
- **`new Function()` is not used** by EventMath itself, but compiled output runs in the same process as any other JS — no sandboxing.

---

## 9. Overall Assessment

### What's Good

1. **Clean, readable code** throughout the project. Comments explain design intent well.
2. **Excellent test pass rate** — all 13 integration tests pass.
3. **Novel language design** with time as a first-class concept is coherent and well-executed for a v0.1.
4. **Formatting roundtrip stability** is verified and working correctly.
5. **Mender debugger** is a genuinely innovative feature for a small language, with good UX principles.
6. **Runtime is genuinely small** (~10KB) and correctly implements event/layer/timeline semantics.

### What Needs Attention

| Priority | Issue | Component |
|----------|-------|-----------|
| **High** | `stop` statement silently dropped by codegen | `codegen.js` |
| **High** | Operator precedence bug in `_parseMatterBlock` line 157 | `parser.js` |
| **Medium** | `_escape` uses `/\\\\/g` matching 2 backslashes instead of `/\\/g` matching 1 | `codegen.js` |
| **Medium** | `forwardTo` is generated but runtime doesn't define it | `codegen.js` / `runtime` |
| **Medium** | Incomplete `_applyEntry` — remove/merge/action entries silently ignored | `runtime` |
| **Medium** | No negative/error-path tests | `tests/` |
| **Low** | `_parseAdd` returns null silently for unknown kinds | `parser.js` |
| **Low** | No reserved-word enforcement in tokenizer/parser | `tokenizer.js`, `parser.js` |
| **Low** | Fast-path table is missing 7 of 16 error classes | `mender.js` |
| **Low** | Multiple operations emit only comments (AddLayer, Remove*, Merge) | `codegen.js` |
| **Low** | Time-travel destination strings not escaped | `codegen.js` |

### Recommendations

1. **Add `Stop` handling to `_genStatement`** in codegen.js (emit `return;` or `break;` depending on context)
2. **Fix the operator precedence** bug by adding parentheses around the `||` clause in parser.js line 157
3. **Fix `_escape`** to use `/\\/g` (single backslash → double) for accurate escaping
4. **Implement `forwardTo`** in the runtime to match `rewindTo`
5. **Add negative/error-path tests** — malformed input, boundary conditions, reserved word violations
6. **Complete the codegen** for AddLayer, RemoveLayer, RemoveEvent, and Merge with real implementations
7. **Add reserved-word validation** in the parser's `_parseStatement` dispatch
8. **Expand the Mender's fast-path table** to cover all 16 error classes defined in the spec
9. **Add input size limits** to the tokenizer/parser to prevent OOM on pathological inputs