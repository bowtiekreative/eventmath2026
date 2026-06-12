# EventMath Developer Guide

**For any developer continuing this work — read this first.**

EventMath is a time-native programming language that compiles to JavaScript. It was built incrementally in passes. Each pass added new language features end-to-end: tokenizer → parser → codegen → formatter → validator → runtime → tests → example. This document explains the full architecture so you can continue without losing momentum.

---

## Five Laws (never break these)

1. **Bare words are literal.** `title is User can log in` → the text after `is` is taken literally.
2. **Multi-word names are allowed.** `waiting chain`, `fair payment`, `leverage axis` — any phrase can be a name.
3. **One word, one meaning.** A keyword means one thing everywhere. You cannot reuse `assume` for something else.
4. **Blocks end with `end`.** Every block statement closes with `end`. No curly braces.
5. **No silent autocorrect.** If something is wrong, emit an error. Never guess and proceed silently.

---

## Architecture

Every new statement follows the same pipeline. In order:

```
Source .em file
    │
    ▼
src/tokenizer.js     — Splits lines into Token arrays. FIRST word on each line determines the type.
    │                   Multi-line statements emit bare KEYWORD tokens that the parser assembles.
    ▼
src/parser.js        — Consumes the flat Token stream and builds an AST (plain JS objects).
    │                   Each statement type has a _parseXxx() method.
    ▼
src/codegen.js       — Walks the AST and emits JavaScript strings.
    │                   Two passes: first collects all variable declarations, second emits code.
    ▼
src/formatter.js     — Round-trips AST → canonical .em source. Used for auto-formatting.
    │
    ▼
src/validator.js     — Post-parse semantic checks. Two passes: collect declarations, validate refs.
    │
    ▼
runtime/eventmath-runtime.js  — <10KB UMD runtime. All EventMath classes live here.
    │                            No external dependencies.
    ▼
tests/               — One test file per major feature. Run with: node tests/Xtest.js
examples/            — Working .em files demonstrating each version's features.
```

---

## How to Add a New Statement (step-by-step)

Follow this checklist every time. Don't skip steps.

### 1. Tokenizer (`src/tokenizer.js`)

Add the new keyword(s) to the `KEYWORDS` set at the top.

If your statement uses a compound token (multiple parsed parts bundled into one token), create a new token type string (e.g., `'MY_STMT'`) and emit it from a `_tokenizeMyStmt(words, lineNum)` method:

```js
_tokenizeMyStmt(words, lineNum) {
  const xIdx    = this._indexOf(words, 'x');
  const intoIdx = this._indexOf(words, 'into');
  if (xIdx < 0 || intoIdx < 0) return [new Token('KEYWORD', 'myword', lineNum)];
  const namePart  = words.slice(1, xIdx).join(' ');
  const intoPart  = words.slice(intoIdx + 1).join(' ');
  return [new Token('MY_STMT', { name: namePart, intoName: intoPart }, lineNum)];
}
```

Add a dispatch line in the main `_tokenizeLine()` method:

```js
if (lead === 'myword') return this._tokenizeMyStmt(words, lineNum);
```

If your statement spans multiple lines, add bare keyword handlers:

```js
if (lead === 'continuation_keyword') {
  const tokens = [new Token('KEYWORD', 'continuation_keyword', lineNum)];
  if (words.length > 1) tokens.push(new Token('NAME', words.slice(1).join(' '), lineNum));
  return tokens;
}
```

### 2. Parser (`src/parser.js`)

Add a dispatch line in `_parseStatement()`:

```js
if (t.type === 'MY_STMT') return this._parseMyStmt();
```

Add the parse method. For compound tokens (pre-parsed by tokenizer):

```js
_parseMyStmt() {
  const t = this.advance();
  if (!t || !t.value) return null;
  return ast('MyStmt', {
    name:    t.value.name,
    intoName: t.value.intoName,
  });
}
```

For keyword-by-keyword parsing (multi-line style):

```js
_parseMyStmt() {
  this.expect('KEYWORD', 'myword');
  const nameTok = this.expect('NAME');
  this.expect('KEYWORD', 'into');
  const intoTok = this.expect('NAME');
  return ast('MyStmt', {
    name:    nameTok ? nameTok.value : '',
    intoName: intoTok ? intoTok.value : '',
  });
}
```

### 3. Codegen (`src/codegen.js`)

**First pass** — register the output variable so it's declared at the top of the generated file:

```js
case 'MyStmt':
  if (stmt.intoName && !this._vars.has(stmt.intoName)) {
    this._vars.add(stmt.intoName);
    this._varDecls.push({ name: this._safeName(stmt.intoName), value: 'null' });
  }
  break;
```

**Second pass** — add dispatch and emit method:

```js
case 'MyStmt': return this._genMyStmt(stmt);

_genMyStmt(stmt) {
  const intoVar = this._safeName(stmt.intoName);
  const intoEsc = this._escape(stmt.intoName);
  this._line(`// myword: "${this._escape(stmt.name)}" into "${intoEsc}"`);
  this._line(`${intoVar} = new EM.EventMathMyClass('${intoEsc}', ${this._safeName(stmt.name)}, __assumptions);`);
  this._line('');
}
```

### 4. Formatter (`src/formatter.js`)

Add dispatch and format method:

```js
case 'MyStmt': return this._formatMyStmt(stmt);

_formatMyStmt(stmt) {
  this._line(`myword ${stmt.name} into ${stmt.intoName}`);
}
```

### 5. Validator (`src/validator.js`)

In `_collectDeclarations()`, register any output names:

```js
case 'MyStmt':
  if (stmt.intoName) this.marks.set(stmt.intoName, true);
  break;
```

Add reference validation in `_validateReferences()` if your statement references existing symbols:

```js
case 'MyStmt':
  if (stmt.name && !this.marks.has(stmt.name)) {
    this.errors.push(`"myword ${stmt.name}" refers to something not yet declared.`);
  }
  break;
```

### 6. Runtime (`runtime/eventmath-runtime.js`)

Add your class before the `// ── Default Timeline ─────────────────────────────────────` comment. The runtime is a self-contained UMD module with no external dependencies.

```js
function EventMathMyClass(name, source, assumptions) {
  if (!(this instanceof EventMathMyClass)) {
    return new EventMathMyClass(name, source, assumptions);
  }
  this.name = name || '';
  // ... logic ...
}

EventMathMyClass.prototype.render = function () {
  return '── ' + this.name + ' ──\n  ...';
};
```

Add it to the exports object at the bottom:

```js
EventMathMyClass: EventMathMyClass,
```

### 7. Tests (`tests/`)

Create `tests/myfeature-test.js`. Test every layer of the pipeline in order:

```
Runtime unit tests → Tokenizer → Parser → Codegen → Formatter → Validator → End-to-end
```

End-to-end tests compile and run actual EventMath source. Use this pattern:

```js
function runCode(src) {
  const js = new EventMathCodeGen().generate(new EventMathParser(new EventMathTokenizer().tokenize(src)).parse());
  const fn = new Function('require', 'console', 'module', js + '\nreturn myOutputVar;');
  let out = '';
  const result = fn(require, { log: s => { out += s + '\n'; } }, { exports: {} });
  return { out, result };
}
```

### 8. Example

Create `examples/vX.Y-feature-name.em` with comments explaining what the feature demonstrates.

---

## Version History

Each version is a complete, committed, tested increment.

| Version | Statement(s) Added | What it does |
|---------|-------------------|--------------|
| v2.0 | `actor`, `asymmetry`, `chain...leads to`, `detect fallacies`, `assume`, `fractal` | Innovation framework. Causal chains. 25 fallacy patterns. Assumptions. |
| v2.1 | Fractal tier 3 | Extended fractal from D±26 to D±39. Triacontaenneagon (39-sided polygon). |
| v2.2 | `desire...matter`, `satisfy`, `evaluate` | Desire→outcome satisfaction engine. Evaluates chains against desires. |
| v2.3 | `leads to X at value N` | Numeric chain values. Quantitative scoring (0–100%). Assumption resolution. |
| v2.4 | `evaluate...across fractal...into` | Dimensional scoring. Connects fractal axis to satisfaction across 3 tiers (surface/system/root). |
| v2.5 | N-dim `predict`, `through FRACTAL` | Any number of condition dimensions. Routes through fractal's 3 structural tiers. |
| v2.6 | `why DESIRE is not satisfied in CHAIN into RESULT` | Backward satisfaction tracing. Finds the minimum intervention point. Tier-aware failure localization. |

---

## The Fractal Tier System

This is fundamental. Never let anyone bypass it.

```
Tier 1 — Surface D±13 — What is directly observable
Tier 2 — System  D±26 — What chain logic and structure reveals  
Tier 3 — Root    D±39 — What the fractal axis amplifies or suppresses
```

These three tiers are **structural** — they are the evaluation framework. They are fixed. You cannot add more of them (yet — D±52 is the planned next tier).

**Condition dimensions** (industry, price, awareness, etc.) are **combinatorial** — they are what you evaluate across. You can have any number of them. But they pass **through** the three structural tiers, not around them.

The `through FRACTAL` clause in `predict` enforces this. The `DimensionalReport` enforces this for `evaluate`. The `DiagnoseStmt` reports which tier a failure lives in.

**Current torus dimensions**: `spinFrom` accepts D2 through D39. Polygon names go from `digon` (D2) through `triacontaenneagon` (D39).

**Next tier**: D±52 — add 13 more polygon names (D40–D52) to `SHAPE_NAMES`, extend `spinFrom` clamp from 39 to 52, add tier 4 logic to `EventMathFractalAxis`.

---

## Key Runtime Classes

| Class | Created by | Purpose |
|-------|-----------|---------|
| `EventMathChain` | `chain NAME ... end` | Causal graph. Links have optional numeric values. |
| `EventMathDesire` | `desire NAME ... end` | Subjective want → typed condition. |
| `EventMathAssumption` | `assume NAME is VALUE` | Named value. `active` flag for future `challenge` operator. |
| `EventMathSatisfactionEngine` | `satisfy`/`evaluate` | Evaluates desires against chain states. Score 0–100%. |
| `EventMathDimensionalReport` | `evaluate...across fractal` | 3-tier scoring: surface × system × root. Gradient label. |
| `EventMathDiagnosis` | `why...is not satisfied in` | Backward trace. Finds blocking link and minimum intervention. |
| `EventMathFractalAxis` | `fractal A and B into C` | Multi-tier fractal. Auto-builds tiers from input dimension. |
| `EventMathFallacyDetector` | `detect fallacies in CHAIN` | 25 fallacy patterns. Used by DimensionalReport and Diagnosis. |
| `EventMathRootTrace` | `root of STATE in CHAIN` | Backward causation. Finds root cause of an observed state. |

---

## The `__assumptions` Global

Every compiled EventMath file includes:

```js
var __assumptions = [];
```

Every `assume` statement pushes to this array. Every satisfaction engine, dimensional report, and diagnosis receives `__assumptions` as its last argument. This is how named assumptions (like `market rate`) are resolved at evaluation time.

When implementing new statements that do satisfaction-style checks, always pass `__assumptions` as the last argument.

---

## Adding a `challenge` Operator (Next Pass — v2.7)

The `active` flag on `EventMathAssumption` is already in place. The planned syntax:

```
challenge market rate
show leverage report
```

This would:
1. Set `market_rate.active = false`
2. Re-run `leverage_report` with the assumption deactivated
3. Show how the tier scores shift
4. Report whether the model is sensitive to this assumption

Implementation: `challenge NAME` → `ChallengeStmt { assumptionName }` → codegen sets `.active = false`, re-runs the nearest upstream `SatisfyStmt`/`EvaluateStmt`/`DiagnoseStmt`, emits a delta report.

---

## Running Tests

No test runner needed — each file is self-contained:

```bash
node tests/v2-innovation-test.js    # 50 tests — v2.0 innovation framework
node tests/satisfaction-test.js     # 29 tests — v2.2 satisfaction engine
node tests/quantitative-test.js     # 29 tests — v2.3 numeric values
node tests/dimensional-test.js      # 41 tests — v2.4 dimensional scoring
node tests/ndim-predict-test.js     # 57 tests — v2.5 N-dim predict + through
node tests/diagnosis-test.js        # 45 tests — v2.6 why/diagnosis
# Total: 251 tests
```

All 251 tests must pass before committing. If you add a feature, add a test file.

---

## Schema Generator Tool

See `tools/eventmath-schema-gen.js`. This tool uses the Claude API (claude-sonnet-4-6 or later) to:
1. Take a domain description as input
2. Generate an EventMath `.em` schema for that domain using AI
3. Compile the schema and capture insights
4. Generate an OpenAPI-compatible JSON schema from the compiled output
5. Save all outputs to `./generated/`

```bash
ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "human body proteins"
ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "racism systemic framework"
ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "supply chain resilience"
```

The tool teaches the AI assistant the full EventMath syntax and asks it to model the domain as a chain of causation with desires, assumptions, and fractal structure. The output can be used directly as an API schema.

---

## File Map

```
eventmath2026/
├── DEVELOPER-GUIDE.md          ← you are here
├── README.md                   ← public readme
├── package.json
│
├── src/                        ← compiler (edit these to add language features)
│   ├── tokenizer.js            ← line → Token[]
│   ├── parser.js               ← Token[] → AST
│   ├── codegen.js              ← AST → JS string
│   ├── formatter.js            ← AST → .em string (round-trip)
│   └── validator.js            ← AST semantic checks
│
├── runtime/
│   └── eventmath-runtime.js    ← all runtime classes, UMD, no deps
│
├── tests/                      ← one file per version
│   ├── v2-innovation-test.js
│   ├── satisfaction-test.js
│   ├── quantitative-test.js
│   ├── dimensional-test.js
│   ├── ndim-predict-test.js
│   └── diagnosis-test.js
│
├── examples/                   ← working .em files
│   ├── v2.0-innovation-framework.em
│   ├── v2.1-fractal-tier3.em
│   ├── v2.2-satisfaction-engine.em
│   ├── v2.3-quantitative.em
│   ├── v2.4-dimensional-scoring.em
│   ├── v2.5-ndim-predict.em
│   └── v2.6-diagnosis.em
│
├── tools/
│   └── eventmath-schema-gen.js ← Claude API schema generator
│
└── bin/em                      ← CLI entry point
```

---

## Branch

All v2.x development is on `claude/repo-review-5yropa`. The `main` branch has the original v1 foundation (tokenizer, parser, codegen, formatter, runtime, mender debugger).

---

## Contact / Credits

Ryan Bowtie — project lead and domain architect  
Claude Code (Anthropic) — language implementation partner

If you're picking this up and credits ran out: read this guide top to bottom, run all 251 tests, read the examples in order (v2.0 → v2.6), then pick up from v2.7 (the `challenge` operator). The architecture is clean and each pass is isolated — you will not break old behavior if you follow the 8-step checklist above.
