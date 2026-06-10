# EventMath — Language Design & Build Prompt

## Mission

Design and build **EventMath**: a programming language where **time is a first-class part of the language itself**.

EventMath must be:

1. **Revolutionary** — the first mainstream-viable language where past, present, and future are native language constructs, not library features.
2. **Cheap** — compiles to plain JavaScript, runs anywhere JavaScript runs, zero paid infrastructure, zero heavy dependencies.
3. **Fast** — compiled output performs within striking distance of hand-written JavaScript (targets below).
4. **More readable than every alternative** — designed from the ground up for people with dyslexia, ADHD, autism, or anyone who finds dense symbolic syntax hostile. Plain words, one idea per line, code that reads aloud as English.

It must achieve all four **at the same time**. Readability is not a tradeoff we make for speed, and speed is not a tradeoff we make for readability. The design below shows they reinforce each other.

**Core design sentence:**
EventMath is a programming language where code is written as events moving through doors, layers, and timelines, carrying matter from past to present to future.

---

## The revolutionary claim: time as the foundation, not a feature

Every existing language treats time as an afterthought. Variables are overwritten and the past is destroyed. Debugging means guessing what the state *used to be*. Undo, audit logs, history, replay — every team rebuilds them by hand, badly.

EventMath inverts this. Its semantic foundation is **event sourcing**, proven at industrial scale (banking, git, Redux, Kafka) but never before given a language of its own:

- **State is never overwritten. State is derived.** Every change in an EventMath program is an event appended to a timeline. The current value of anything is the result of replaying its events.
- **Rewind is real, exact, and cheap.** Because state is derived from events, `rewind project by 5` is not magic — it is replaying five fewer events. Deterministic, mathematically well-defined, and efficient through structural sharing and periodic snapshots.
- **The past is always inspectable.** Time-travel debugging is not a devtool bolted on — it is what the language *is*. Any program can answer: what happened, what is happening, what will happen, and what matter moved through it.
- **The future is a plan, not a mystery.** The `future` section of a timeline holds scheduled and planned events that the runtime can execute, simulate, or display.

This is the moat. Python is readable. Rust is fast. Nothing else makes time native. EventMath does, and it does it with syntax a ten-year-old or a dyslexic adult can read aloud.

---

## Core metaphors and official vocabulary

| Concept | EventMath word | Meaning |
|---|---|---|
| Object / record | **event** | A named thing that happened or exists, carrying matter |
| Data / fields | **matter** | The information inside an event |
| Type / tag | **category** (alias: `cat`) | What kind of event this is |
| Array of events | **layer** | An ordered container of events |
| Program state / history | **timeline** | Holds layers across past, present, future |
| Function | **action** | A reusable process with a door |
| Parameters / input | **door open** | Matter enters when the door opens |
| Return / output | **door closed** | Matter leaves when the door closes; the action ends |
| Variable | **mark** | Named matter, remembered for later |
| Reassignment | **set** | Change a mark (recorded as an event on the timeline) |
| Print / show / execute | **run** | Show or execute an event, layer, or timeline section |
| if / else | **when / otherwise** and **split / path** | Checks and multi-way branching |
| Fixed-count loop | **again N times** | Repeat a block |
| Iteration | **walk** | Walk a layer, one event at a time |
| Error | **broken event** | A plainly described failure, itself an event on the timeline |
| Missing input | **blocked door** | Input that never arrived |

Banned surface vocabulary (must never appear in syntax or error messages): `parameter`, `argument`, `callback`, `closure`, `undefined`, `null pointer`, `TypeError`, `instance`, `constructor`.

---

## The Five Laws (decided rules — not open questions)

These resolve every ambiguity in the design. They are non-negotiable because each one protects both **readability** and **parser simplicity** at once.

### Law 1 — Bare words are literal. References are marked.
After a matter key, plain words are always literal text. To reference a mark or door input, say so explicitly with `from`:

```eventmath
matter
  title is User can log in        # literal text
  priority from priority          # value of the mark/door input named priority
  owner from current user         # reference, never ambiguous
```

`is` introduces a literal. `from` introduces a reference. A human reading aloud can always tell which is which. So can the parser, in one token of lookahead.

### Law 2 — Multi-word names are allowed. Keywords are reserved.
Names like `made requirement` and `login need` are the soul of the language and are permitted. The reserved keyword list (published as part of the spec) can never appear inside a name: `event, matter, category, cat, layer, timeline, action, door, open, closed, mark, set, run, when, otherwise, split, path, again, walk, end, is, from, as, to, by, with, into, times, past, present, future, stop, merge, break, add, remove, before, after`.

### Law 3 — One word, one meaning.
The **door** belongs to actions only: input enters when it opens, output leaves when it closes. Doors are not conditionals (no `gate`), not error states, not module imports. Errors are **broken events**. Conditionals are **when** and **split**. No word in EventMath is overloaded — this is accessibility rule and parser rule in one.

### Law 4 — Blocks end with `end`. Indentation is cosmetic.
Significant whitespace is an invisible symbol — the most hostile kind for dyslexic readers. Every block (`event`, `matter`, `layer`, `timeline`, `action`, `when`, `split`, `again`, `walk`) closes with `end` on its own line. The formatter indents automatically for visual scanning, but indentation never changes meaning.

### Law 5 — No silent autocorrect. Friendly precision instead.
The compiler never guesses what a misspelled word meant and never silently accepts typos — unpredictable behavior is anti-accessible. Instead, every unknown word produces a friendly suggestion:

```text
Line 12: I don't know the word "varible".
Did you mean "mark"? Marks are how EventMath remembers matter.
```

---

## Surface syntax specification (decided)

### Events and matter

```eventmath
event t1
category requirement

matter
  title is User can create account
  priority is high
  status is todo
end

end
```

`cat req` is an accepted alias for `category requirement`, but `category requirement` is the canonical form the formatter writes. Plain words beat abbreviations when they conflict; `cat` fails the read-aloud test (it is an animal).

### Marks (variables)

```eventmath
mark title as User can log in
mark count as 0
mark done as false

set count to 1
```

`mark ... as ...` creates. `set ... to ...` changes — and every `set` is recorded as an event on the program's timeline (Law of event sourcing). Marks compile to `const`; a mark that is ever `set` compiles to a timeline-tracked binding.

### Layers

```eventmath
layer A
  t1
  t2
end
```

Simple line listing. No `holds`, no `then` — extra words that carry no information are noise, not accessibility.

### Timelines

```eventmath
timeline project

past
end

present
  layer A
end

future
  layer planned work
end

end
```

`past`, `present`, and `future` sections are optional. Bare layers in a timeline default to `present`. Internally a timeline is an event log plus a pointer plus periodic snapshots — never a deep-copied history.

### Actions and doors

```eventmath
action make requirement
door open title priority

make event called made requirement
category requirement

matter
  title from title
  priority from priority
  status is todo
end

door closed made requirement
end
```

Rules:
- `door open` is required only when the action takes input. A doorless action is legal.
- `door closed` returns the named matter and ends the action immediately.
- A door can only close if it was opened (when input was declared).
- An action that produces matter but never closes its door is a **warning**, not an error: *"The action make requirement opened its door but never closed it. Nothing came back out."*

### Run

In v0.1, `run` means **show**: print a readable rendering of an event, layer, or timeline section.

```eventmath
run event t1
run layer A
run project present
run project past
```

Executing actions uses the action's name directly with `with`:

```eventmath
make requirement with title is User can log in and priority is high
```

### Conditionals

Two-way checks read as English:

```eventmath
when user is logged in
  run dashboard
otherwise
  run login screen
end
```

Multi-way branching uses split and paths:

```eventmath
split login result into

path success
  run dashboard
end

path fail
  run login error
end

end
```

(`split` as branching *timelines* — parallel possible futures — is deferred to v0.3; in v0.1–0.2 `split` is the multi-way conditional only.)

### Loops

Repetition and iteration are different ideas and get different words:

```eventmath
again 5 times
  run test
end

again until passed
  run test
end

walk layer A as current event
  run current event
end
```

### Friendly errors (specification)

Every compiler and runtime message must:
1. Use EventMath vocabulary only (doors, matter, events — never JS internals).
2. Name the place: action or event name, plus line number.
3. Say what was expected and what actually happened, in complete plain sentences.
4. Offer exactly one suggested fix.

```text
Door problem in action make requirement (line 8).
The door asked for title, but no title entered.
Try: make requirement with title is Your title here
```

Runtime failures become **broken events** appended to the timeline — which means errors themselves are rewindable, inspectable history. No other language does this.

---

## Time semantics (the technical foundation)

This section is what separates EventMath from a toy.

1. **Append-only core.** Every state change (`set`, event creation, layer mutation, action call) appends an entry to the program timeline. Nothing is destroyed.
2. **State is a fold.** Current state = replay(events[0..pointer]). The pointer is an integer.
3. **Rewind / forward move the pointer.** `rewind project by 5` decrements the pointer by 5 and re-derives state. `forward project by 3` advances it. `rewind project to event t1` searches the log for the named event. All exact, all deterministic.
4. **Snapshots keep it fast.** Every N events the runtime stores a structural-sharing snapshot, so rewind costs O(distance to nearest snapshot), not O(history).
5. **Structural sharing, not deep copies.** Events are immutable objects; layers and snapshots share unchanged events by reference. Memory cost is proportional to *changes*, not to *history length × state size*.
6. **`past` / `present` / `future` are pointer regions.** Past = entries behind the pointer, present = at the pointer, future = planned entries ahead of it. `run project past` replays and renders history; `run project future` lists or simulates the plan.

This gives EventMath, for free, what every serious application rebuilds by hand: undo/redo, audit logs, time-travel debugging, replay testing, and "how did we get into this state?" — as one-line language features.

---

## The Mender — debugging as time travel

EventMath ships with a built-in conversational debugging engine called **the Mender**. It exists because the people EventMath is for — the same readers dense syntax shuts out — are also the people stack traces shut out. The Mender finds and fixes broken events using plain, friendly language, one step at a time.

The Mender has one structural advantage no other debugger has: **the timeline already recorded what happened.** Other debugging assistants must reconstruct the past by interrogating the user. The Mender replays it. "What changed recently?" is not a question — it is a query against the event log. This is the fourth payoff of making time native.

### Standing rules (apply to every interaction)

1. Walk through the phases in order. Never skip a phase (except via the Fast Path).
2. Give the user **one action at a time**. Never a list of things to try.
3. Never reveal the internal mechanics — phases, hypotheses, scoring. The user sees only questions, plain explanations, and clear actions.
4. Label every piece of reasoning by its evidence class, and never state a guess as a fact:
   - **SEEN** — observed directly on the timeline. The strongest class, and unique to EventMath.
   - **TOLD** — reported by the user.
   - **GUESSED** — inferred by the Mender. Always presented as "it looks like" / "my best guess is."
5. When in doubt, ask. One more question is faster than a wrong diagnosis.
6. All vocabulary rules of the language apply: the banned-words list, the door/matter/event metaphors, complete plain sentences.

### Phase 0 — Fast path

If all three are true, skip everything else:
- The symptom is a single, clearly described behavior.
- The cause is *typical* for that symptom (matched against the friendly-error catalog), not merely plausible.
- One specific, safe, reversible fix will resolve it with confidence above 85%.

Then: state the problem in one sentence, the likely cause in one sentence, give one action, and ask: **"Did that fix it? (yes / no / partially)"**. If yes, stop. Otherwise continue below.

### Phase 1 — Context and mental model

Establish (asking only what the timeline and conversation have not already answered):
- What is this part of the program supposed to do when it works?
- What does it depend on — which marks, layers, doors, or actions feed it?
- What changed recently? **The Mender answers this one itself from the timeline whenever possible**, e.g. *"I can see that three events ago, the mark `count` was set to 0. Was that expected?"*

If the user's description of how their program works does not match how it actually works, gently correct it, restate the corrected understanding in one or two sentences, and get confirmation before proceeding. A corrected mental model sometimes resolves the problem with no further diagnosis. If the symptom is a platform/runtime limitation rather than something the user can fix, say so plainly and stop — never diagnose the unfixable.

Internally classify severity — **Critical** (program unusable), **Significant** (works but meaningfully affected), **Minor** (workaround exists). Severity governs urgency and tone only: critical problems get fewer clarifying questions and faster loops.

### Phase 2 — Trace the cause backwards

Build a Why chain, walking the timeline backwards from the broken event:

```text
Symptom: [what the user sees, in their words]
Why 1: [cause — SEEN / TOLD / GUESSED]
Why 2: [cause — SEEN / TOLD / GUESSED]
...
```

Continue up to five levels, or stop early when the cause is **irreducible**, **out of the user's control**, or **confirmed by direct testing** (rewinding to before the suspect event and replaying without it — which EventMath can do natively). A user saying they *think* something caused it is probable, not confirmed; observation is not isolation.

State the probable root cause in one sentence, labeled **CONFIRMED / PROBABLE / SPECULATIVE**, with a confidence tier: **HIGH** (>80%), **MEDIUM** (50–80%), **LOW** (<50%).

On any second or later pass: explicitly check for **compound causes** (a partial fix is the strongest signal that two independent causes exist — identify both, fix the likelier one first, never both at once). And apply **confidence decay**: a pass that finds the same root cause as last time drops confidence one tier and widens the search, so the engine cannot re-run the same analysis with the same blind spots.

### Phase 3 — Define the problem precisely

Restate and get the user's confirmation before fixing anything:

```text
When: [the trigger]
In: [the action, layer, or timeline section]
Result: [what actually happens]
Expected: [what should happen]
Started: [from the timeline: the first event where behavior diverged]
```

Note the `Started` line: in EventMath this is usually **SEEN**, found by bisecting the timeline (rewind halfway, check, repeat) — not asked.

### Phase 4 — Weigh the candidate fixes (internal, never shown)

For each candidate fix, score 1–3 on four dimensions: **Stability** (symptom-patch → structural fix, weighted ×2), **Confidence** in the diagnosis (speculative → confirmed, weighted ×2), **Likelihood** the diagnosis matches the symptom, and **Reversibility** (in EventMath almost everything scores 3 — the timeline makes any fix one `rewind` away, another payoff of the foundation).

Composite = Stability×2 + Confidence×2 + Likelihood + Reversibility (max 18). Exclude any candidate scoring 1 on both Confidence and Stability — a speculative patch is never worth recommending. Ties break by Stability, then Confidence, then Reversibility. Open the candidate search wide only at LOW confidence; at HIGH confidence the scoring exists to verify, not to discover.

### Phase 5 — Recommend exactly one fix

```text
Try this: [one clear action — single step, no sub-steps]
This should fix: [what the user will see when it works]
Because: [one sentence connecting fix to root cause, in plain language]
Before you do it: [only if there is real risk; omit when the fix is safe and reversible]
```

End with exactly: **"When you have tried this, tell me what happened and I will help you from there."**

### Phase 6 — Feedback gate

- **Fixed:** confirm in one sentence, ask if anything else looks off, close.
- **Partially fixed:** treat the partial result as new evidence; return to Phase 2 with the compound-cause check applied immediately.
- **Not fixed:** say *"That did not work, which actually tells us something useful. Let me look at this differently."* Discard the old Why chain, return to Phase 2 with confidence decayed one tier. Never recommend the same failed fix twice.
- **New problem appeared:** offer one `rewind` to undo, then treat the new problem as its own session, noting the connection.
- **Loop limit:** after three passes without resolution, ask the user to walk through exactly what happens step by step, and restart from Phase 1. After one more failed pass, stop diagnosing and produce a plain-language **escalation summary**: the problem, what was tried, what happened each time, what was ruled out, and where the evidence points.

### Tone

Speak like a knowledgeable person paying attention, not a form being filled out. Read stress from the user's messages — clipped sentences, "nothing works," escalating urgency — and when present, acknowledge it in exactly one sentence (*"This is a frustrating one — let's work through it carefully."*) before moving forward. When the user is calm, skip the acknowledgment and stay efficient. Never clinical, never gushing.

---

## Performance and cost requirements (hard targets)

1. **Compile to plain, readable JavaScript.** No VM, no interpreter in the hot path. EventMath actions become plain JS functions; `again` compiles to `for`/`while`; `walk` compiles to a plain loop.
2. **Zero runtime dependencies.** The runtime is one vanilla JS file, **under 10 KB minified**, running in any browser or Node ≥ 18.
3. **Speed target:** compiled hot-path code (loops, action calls, matter access) within **2× of equivalent hand-written JavaScript**; timeline-tracked operations within **5×**. Benchmarks are part of the deliverable, not an afterthought.
4. **Compile speed:** ≥ 50,000 lines of EventMath per second on commodity hardware. The line-oriented grammar (below) makes this easy.
5. **Memory:** timeline history uses structural sharing; storing 10,000 events of history must not require 10,000 copies of state.
6. **Cost:** the entire toolchain is free and self-hostable — compiler, runtime, formatter, and playground are static files.
7. **Escape hatch:** a clearly-marked `timeline off` mode compiles a block to raw mutable JS for hot loops where history is not wanted. Time is the default, never a tax you can't decline.

**Why this is achievable:** the "one idea per line" accessibility rule makes the grammar *line-oriented* — tokenize a line, the leading keyword decides the statement type, a stack tracks blocks until `end`. The accessibility constraint and the performance constraint are the same constraint. That alignment is the design's strongest property: the language is easy to read *because* it is easy to parse, and easy to parse means cheap and fast to compile.

---

## Internal model (users never see this)

```js
// Event
{ id: "t1", cat: "requirement", matter: { title: "...", status: "todo" } }

// Layer: array of event references
[ t1, t2 ]

// Timeline: append-only log + pointer + snapshots
{ log: [entry, entry, ...], pointer: 42, snapshots: Map<index, state>, future: [planned, ...] }

// Action: plain compiled function
function makeRequirement(title, priority) { ... return madeRequirement; }
```

---

## Roadmap

### v0.1 — the proof (build this first)
Events, matter blocks, `category`/`cat`, `mark`/`set`, layers, timelines with optional past/present/future, actions with door open/closed, `run` (as show), action calls with `with`, `when`/`otherwise`, `split`/`path` as conditional, `again N times`, `again until`, `walk`, friendly errors per the spec, compiler to plain JS, the <10 KB runtime, a formatter that writes canonical form, and the three acceptance programs below. **The Mender's fast path** ships here too: every error in the friendly-error catalog carries its typical cause and one suggested fix, so the simplest 80% of problems resolve in one exchange.

### v0.2 — time becomes visible
Timeline log + pointer + snapshots, `rewind`, `forward`, `stop`, `merge`, `break ... into`, `add layer` / `remove layer`, `add event ... before/after`, time-travel inspection (`run project past`), benchmark suite vs hand-written JS. **The Mender v1:** fast path + the full phase loop, with Why chains grounded in timeline evidence (SEEN beats TOLD beats GUESSED) and timeline bisection to find the first divergent event automatically.

### v0.3 — the frontier
`split` as branching parallel timelines, `overlap` as structured concurrency (compiling to async only where needed), `future` section execution/scheduling/simulation, browser playground with a visual timeline scrubber (the demo that sells the language: drag a slider, watch your program's state move through time). **The Mender v2:** integrated with the scrubber — when the Mender names the first broken event, the scrubber jumps to it.

### Explicitly out of scope until the foundation is proven
Static type system, module system, package manager, self-hosting.

---

## Acceptance tests (must run end-to-end in v0.1)

1. **Requirements tracker** — declare requirement events with matter, group into layers, organize into a project timeline, run an action that manufactures new requirements through its door, render the present.
2. **Story timeline** — scenes as events, acts as layers, the story as a timeline; `run story past` retells what has happened so far in plain rendered text.
3. **Workflow automation** — tasks as events; `walk` a layer checking each task's status with `when`; `again until` all tasks are done; broken events render as friendly messages.

Each acceptance program must also pass the **read-aloud test**: a person reading the source out loud produces grammatical English sentences, and a listener who has never seen code can say what the program does.

---

## Deliverables

1. Official vocabulary table and reserved keyword list (above, finalized).
2. Line-oriented grammar (EBNF or equivalent).
3. Tokenizer + parser + JS code generator (vanilla JS, no parser generator required).
4. The <10 KB runtime: event/layer/timeline structures, timeline log, render functions for `run`.
5. Formatter that rewrites any accepted aliases into canonical form.
6. Friendly-error catalog: every error class with its template sentence, typical cause, and suggested fix (this catalog doubles as the Mender's fast-path table).
7. The Mender specification: standing rules, the six phases, evidence classes (SEEN / TOLD / GUESSED), scoring weights, feedback-gate routes, loop limit, escalation summary format, and tone rules.
8. The three acceptance programs, with their compiled JS output committed alongside for inspection.
9. Benchmark harness (v0.2) comparing compiled EventMath to hand-written JS.
10. A one-page "Why EventMath" document making the case above: *Python made code readable. Git made history safe. EventMath makes time a language.*

---

## What "revolutionary" means here, concretely

Not adjectives — four falsifiable claims the project must be able to demonstrate:

1. **The accessibility claim:** a reader with no programming background, including readers with dyslexia, can read an EventMath program aloud and correctly say what it does. (Testable with real people.)
2. **The time claim:** undo, audit history, and time-travel debugging work in any EventMath program with zero extra code, demonstrated live with the timeline scrubber. (No mainstream language can do this today.)
3. **The cost/speed claim:** the whole toolchain is free static files, and the benchmark suite shows compiled output within the stated targets of hand-written JavaScript. (Numbers, not vibes.)
4. **The debugging claim:** a non-programmer with a broken EventMath program can fix it through a Mender conversation alone — no stack traces, no documentation, one plain-language action at a time — because the timeline lets the Mender *see* what happened instead of asking. (Testable with real people and seeded bugs.)

If all four demos work, EventMath is not a metaphor language. It is the first language where time is native — wearing syntax anyone can read, and mending itself in plain English when it breaks.
