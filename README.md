# EventMath

**A language built so that people can understand systems, and systems can understand people.**

Most languages are one-way. You write precise instructions, the machine understands you, and the living system you described disappears into output you can no longer see. TypeScript makes your intent legible *to the compiler*. It never makes the system legible *back to you* — you rebuild the moving machine in your head from a thousand lines of static text, and you lose it the moment you look away.

EventMath is an attempt to close that gap in **both directions at once**:

- **People understand systems.** The code reads like the thing it describes. A reactive value, a gate, a lifecycle, a flow of data — each maps to a word from the physical world (`rain`, `ground`, `guard`, `orbit`, `lens`). You don't decode syntax; you read the system.
- **Systems understand people.** The compiler knows the structure you described — what flows into what, what reacts to what, what gates what. That structure can be surfaced, mapped, and explained back in the same human terms you wrote it in.

It compiles to plain, readable JavaScript. It runs anywhere JS runs. The runtime is under 10KB with zero dependencies.

---

## What EventMath is *not*

It is **not** a "simple language for non-programmers" that hands the real work to a grown-up tool. That framing sells it short and misses the point.

The goal is not *less* power. It's a *different axis* of power: keeping the system **visible and legible** as it grows, instead of trading legibility away for density the way most languages do. A 7-year-old can read it — but that's a *consequence* of the design, not the ceiling of it. The ceiling is: real workflows, real rules, real reactive state, real automation — expressed so the system never goes dark.

---

## See it

The same greenhouse rule, two languages.

**TypeScript** — every line serves the compiler. Precise, fast, safe. But the *system* is buried in type algebra and the reader has to reassemble it:

```ts
interface SensorReading { sensorId: string; timestamp: number; value: number; }

class GreenhouseController {
  private sensors: Map<string, SensorReading[]> = new Map();
  private rules: Map<string, { maxDryDays: number }> = new Map();

  needsWatering(plantId: string): boolean {
    const reading = this.sensors.get(plantId)?.at(-1);
    if (!reading) return true;
    const rule = this.rules.get(plantId);
    const daysSince = (Date.now() - reading.timestamp) / 86400000;
    return daysSince > (rule?.maxDryDays ?? 3);
  }
}
```

**EventMath** — the same logic, but the system stays on the surface:

```
action does a plant need water
  door open
    input plant id
  ground get plant id last watered into last time
  when last time is void
    door closed true
  end
  rain days since is now minus last time
  when days since is more than 3
    door closed true
  end
  door closed false
end
```

No types, no imports, no null-check ceremony, no `86400000`. "Check the ground for the last time. When it's empty, it needs water. Days since is now minus last time. When that's more than three, it needs water." You read the rule once and you have it.

Both are correct. The difference is **where the system lives** — in TypeScript you reconstruct it; in EventMath you see it.

---

## The part nobody else has: a system that moves

This is the live edge of the project. Watch what happens when you describe reactive state:

```
live rain price is 10
live rain quantity is 1
lens total is price times quantity
```

`live rain` declares a value that *moves* — when it changes, everything downstream reacts. `lens total` is derived: the compiler detects that it depends on two live values and wires it to recompute automatically whenever either one changes. That's a real dependency graph, alive in three lines:

```
price ─┐
       ├──▶ total
quantity ─┘
```

**Built today:** the reactive graph is real. `live rain` compiles to a signal primitive (`EventMathSignal` with `.watch()`); dependent `lens` values compile to watcher functions that fire on change. The system genuinely moves at runtime.

**Where it's going (the thesis, made concrete):**

- **System maps.** Emit the dependency graph *alongside* the JavaScript — what flows into what, what reacts to what, where the motion goes — so the moving system you hold in your head comes out of the machine where anyone can see it.
- **`why` queries.** Ask the compiler "why did this happen?" and have it trace and narrate the answer in EventMath's own vocabulary: *"total changed because price flows into it through multiplication; total is gated by the guard on cart items."* The early `why` / `trace` / `explain` keywords are the seed of this.

That is the whole bet: **the text is just one way to touch the system. The map is another. The running, self-explaining machine is a third. Same system, three views.**

---

## Who it's built for

EventMath is designed around a cognitive style that perceives **systems as motion** rather than as text to decode — the way many dyslexic and spatial thinkers naturally work. For that mind, dense static text is the hostile medium and the moving system is the native one. Most languages force you to encode what you already see directly into the format that fights you hardest. EventMath treats that perception as the **design spec, not an accommodation**: make the system visible, keep the text local and plain, and let the structure carry the weight.

---

## Quickstart

```bash
# compile .em → .em.js
./bin/em compile examples/v2.14-collections.em

# compile and run
./bin/em run tests/reading-tracker.em

# format in place (canonical style)
./bin/em format myfile.em

# parse only, report friendly errors
./bin/em check myfile.em
```

---

## The Five Laws

Every design decision answers to these. They are why the language stays legible.

1. **Bare words are literal.** Names and text are taken as written.
2. **Multi-word names are allowed.** `waiting chain`, `fair payment`, `last watered` — any phrase is a name.
3. **One word, one meaning.** A keyword means the same thing everywhere. No overloading.
4. **Blocks end with `end`.** No curly braces. The shape is the indentation; the close is explicit.
5. **No silent autocorrect.** If something is wrong, say so plainly. Never guess and proceed.

Full details and the contributor checklist are in **[DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md)**.

---

## Architecture

One source file flows through one pipeline. Every statement type is added end-to-end across all six stages.

```
source.em
   │
   ▼
src/tokenizer.js    Line-oriented. The first word picks the statement type.
   ▼
src/parser.js       Flat tokens → AST (plain JS objects). One _parseXxx() per type.
   ▼
src/expression.js   Natural-language expression compiler. Operators (plus, times,
   │                more than, is not, and/or, now…) → JavaScript. Shared by codegen.
   ▼
src/codegen.js      AST → JavaScript. Two passes: hoist declarations, then emit.
   ▼
src/formatter.js    AST → canonical .em source (round-trips for auto-formatting).
   ▼
src/validator.js    Semantic checks: collect declarations, then validate references.
   ▼
runtime/eventmath-runtime.js   <10KB UMD runtime. All EventMath classes. Zero deps.
```

---

## Two layers, one language

EventMath grew in two arcs that share a compiler:

- **The reasoning layer** (`event`, `layer`, `timeline`, `action`, `door`, `walk`, `predict`, `chain`, `desire`, `satisfy`, `why`, `trace`…) — models data as **events with matter**, organizes them on **timelines**, and reasons about cause, prediction, and satisfaction. This is where "time as a first-class construct" lives.
- **The web layer** (`rain`, `star`, `lens`, `live rain`, `cloud`, `node`, `ground`, `earth`, `guard`, `match`, `orbit`, `filter`, `find`, `sort`, `pipe`, `cast`…) — reactive state, components, storage, routing, and collection operations, all under the same readable metaphor.

Both compile through the same pipeline to the same runtime.

---

## Status

- **Compiler:** tokenizer · parser · expression engine · codegen · formatter · validator — all live.
- **Runtime:** `EventMathSignal`, `EventMathGround` (storage), `EventMathCloud`, `EventMathEarth` (HTTP), `EventMathRouter`, events/layers/timelines, and more — UMD, <10KB, no dependencies.
- **Tests:** 628 assertions across the v2.11–v2.15 suites, all green; the earlier reasoning-layer suites (v2.7–v2.9, prediction, dimensional, zoom, diagnosis, integration) pass as well.
- **CLI:** `compile`, `run`, `format`, `check`, `debug`.

---

## Repository map

```
bin/em                       CLI entry point
src/                         Compiler (tokenizer, parser, expression, codegen, formatter, validator)
runtime/eventmath-runtime.js The <10KB runtime
examples/                    Working .em programs (v2.x feature demos + real scenarios)
tests/                       Per-feature test suites and .em acceptance programs
spec/                        Language spec, friendly-errors catalog
mender/                      The Mender debugger
playground/                  Browser playground (index.html + browser build)
DEVELOPER-GUIDE.md           Architecture + step-by-step "how to add a statement"
```

---

## A note to AI agents and contributors

If you are an AI agent landing in this repo, **recalibrate before you pattern-match.** EventMath is easy to mistake for "a cute beginner DSL" because it reads simply. That mistake will make you propose the wrong things.

What this project actually values:

- **Legibility is the product**, not a nice-to-have. A feature that makes the system harder to *see* is a regression even if it compiles. When in doubt, optimize for "read it once and understand it," not for cleverness or brevity.
- **The metaphor is load-bearing.** Vocabulary should feel like the physical/film-editing world it borrows from. Don't drift into mathematics or framework jargon. If a word disconnects a reader from the picture, it's wrong.
- **The Five Laws are non-negotiable.** Especially: bare words are literal, one word means one thing, and never silently autocorrect.
- **Don't just grow the vocabulary.** The language is already deep. The frontier is not more keywords — it's making the *system itself* visible and self-explaining (system maps, `why` queries). That is where real effort belongs.
- **Every statement goes end-to-end.** Tokenizer → parser → codegen → formatter → validator → runtime → tests → example. Follow the checklist in DEVELOPER-GUIDE.md; don't half-wire a feature.

The bet of this language is bidirectional legibility: people understanding systems *and* systems understanding people. Hold that, and your contributions will fit.
