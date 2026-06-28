# EventMath: The Stigmergy Layer

**Versions 2.29 – 2.32** | Keywords: `world` `animal` `trail` `sense` `fade` `forage` `step` `why … in …` `colony` `march` | Runtime: `EventMathWorld`, `EventMathAnimal`, `EventMathTrailTrace`

---

## The idea that started it

An animal is a near-stateless computer. It carries almost nothing from one
moment to the next. It senses what is in front of it, applies a small fixed
rule, and changes the world a little. The *memory* — where the food is, which
path is worth taking — was never inside the animal. It lives in the world, as
marks left behind: a scent trail, a worn track, a turned stone.

So when the animal is gone, the computation does not reset. The state was never
in the animal. **The memory never disappears, it relocates** — out of the agent
and into the ground beneath it. And because a program is nothing more than *a
rule plus some persistent state*, this means the animal is running a program:
the rule is its reflex, and the variables are kept in the dirt.

This is the real mechanism behind how ant colonies find the shortest path, how
termites build a mound, how a slime mould solves a maze — none of which any
single individual could plan or remember. Biologists call it **stigmergy**:
coordination through traces left in a shared environment. The Stigmergy Layer
makes it a first-class part of EventMath, so you can write it down and run it.

The layer is built so the whole loop stays **visible**: where memory lives, who
put it there, how it decays, and how a decision emerges from it. That is the bet
of this language — systems you can see — applied to the oldest distributed
computer there is.

---

## The model in one picture

```
        sense                         lay a trail
   ┌──────────────┐               ┌──────────────────┐
   │              ▼               │                  ▼
 [ animal ] ── reads ── [ WORLD: trails ] ── written by ── [ animal ]
   (stateless)              (the memory)                     (stateless)
                               │
                               ├─ fade  (analog decay; never erased to nothing)
                               └─ why   (the world explains how it got this way)
```

- The **world** is the shared analog memory — the physical environment.
- A **trail** is a mark in it, with a strength. Trails are the relocated memory.
- An **animal** (or a **forager**, or a whole **colony**) is the stateless rule
  that reads trails and lays trails. It holds nothing of its own.
- **Time** is `step` / `march`: running the rule again and again, while the
  world keeps the running state and slowly forgets the unused parts (`fade`).

Nothing persists in the agent. Everything that persists is in the world, and the
world can be inspected (`show`) and interrogated (`why`).

---

## v2.29 — Relocating memory

The substrate. Five words.

```
world meadow                      # the shared analog memory (the physical world)
animal ant                        # a stateless agent — it holds no memory of its own

trail food in meadow by 1         # lay (deposit) onto a trail; deposits accumulate
sense food in meadow into here    # a stateless read — reconstruct a value from the world
fade meadow by 1                  # analog decay across every trail
```

Key semantics:

- **Deposits accumulate.** `trail food in meadow by 1` twice leaves strength `2`.
  Laying *reinforces*; it does not overwrite. This is how weak repeated signals
  add up into a strong shared memory.
- **Sensing is stateless.** `sense` reads the current strength into a local
  working value. After the step ends, that local is meaningless; only the world
  remains.
- **Fade never erases.** `fade` weakens every trail but floors at `0` and keeps
  the trail on the world's ledger. Strong trails stay dominant; the memory
  *relocates onto the strongest paths* rather than vanishing.

The thesis in three lines: two different animals, sharing no internal state,
can build a shared count — because the count lives in the world.

```
world meadow
sense food in meadow into here    # first animal
trail food in meadow by 1
sense food in meadow into here    # a different animal, later — no shared memory but the meadow
trail food in meadow by 1
show meadow                       # food: 2  — neither animal kept it; the meadow did
```

> Runtime: `EventMathWorld` (`lay` / `sense` / `fade` / `render`) and
> `EventMathAnimal` (a frozen, empty `state` — statelessness is an enforced
> invariant, not a convention).

---

## v2.30 — The stateless rule (`forage` / `step`)

A forager is the rule, not the memory. The body is the sense→act loop; the world
it forages on is implicit inside the block, so the animal never re-names the
ground it is standing on.

```
forage scout on meadow
  sense food into strength        # implicit world: the meadow it forages on
  when strength is more than 0
    trail food by 2               # reinforce what's already there
  end
end

step scout 4 times                # run the SAME stateless rule four times
```

Run the rule repeatedly and the memory accumulates **entirely in the world** —
the program is the rule, the state is the ground.

### The statelessness guarantee (enforced)

A forager *holds no memory of its own*. This is not just documentation — the
validator rejects the two constructs whose whole purpose is durable in-agent
memory:

```
forage hoarder on meadow
  live rain stash is 0       ✗  a forager holds no memory of its own
  remember stash as "s"      ✗  persist through the world with a trail instead
end
```

Working registers are fine (a `sense` target, an ephemeral `mark`) — they are
re-read from the world each step and reset between steps. What is forbidden is
*keeping* state across steps anywhere but the world. Persistence goes through
trails, or it does not happen.

> Runtime: a forager compiles to a plain function `__forage_<name>` that closes
> over the world only — no agent state in scope. `step` calls it (a loop for
> `N times`).

---

## v2.31 — The world explains itself (`why … in …`)

Moving memory into the world is only half the bet; the other half is that the
system can explain itself back to you. The world keeps the receipts: who laid
each deposit, and what decay wore away. Ask it.

```
why food in meadow                # prints a trace
why food in meadow into report    # or capture it, then `show report` later
```

```
── why is "food" strong in meadow? ──
  food now measures 9.
  It was laid 5 time(s), 9 deposited in all:
    hand laid 1 over 1 visit(s)
    scout laid 8 over 4 visit(s)
  No decay yet.
  The memory lives in the meadow, not in any animal.
```

**Attribution is automatic.** A trail laid inside a forager is credited to that
forager; a trail laid at the top level is credited to `hand`. After a `fade`,
the trace also accounts for what evaporated:

```
  Decay has worn away 5 since — what remains relocated onto this path.
```

`why` is the same keyword as the satisfaction diagnosis (`why DESIRE is not
satisfied in CHAIN into RESULT`) — one word, one meaning: *explain causation*.
The tokenizer disambiguates on the fixed `is not satisfied in` phrase and treats
everything else as a trail trace.

> Runtime: `EventMathWorld` now keeps a per-trail deposit ledger and a decay
> tally; `why()` returns an `EventMathTrailTrace` that groups deposits by
> contributor (first-seen order) and narrates strength, totals, and decay.

---

## v2.32 — A population decides (`colony` / `march`)

One forager is a rule. A **colony** is a population of that rule, sharing one
world, with evaporation between rounds. **March** it through time and a decision
emerges that no single forager makes.

```
world paths
trail short in paths by 2         # a scout marked the quicker route slightly stronger
trail long  in paths by 1

colony ants of 10 on paths fade 4 # 10 stateless foragers; the world evaporates by 4 each round
  sense short into s
  sense long  into l
  when s is more than l
    trail short by 6              # follow the stronger scent and reinforce it
  end
  when l is more than s
    trail long by 3
  end
end

march ants 3 rounds              # each round: all 10 ants act, then the world fades
```

```
── world: paths ──
  short: 170
  long: 0
```

The colony **converged on the short route**. Reinforcement piled onto the
stronger trail (positive feedback); evaporation erased the route nobody was
using. No ant chose this — the colony computed it, and the answer lives in the
world. `why short in paths` then explains the decision down to *ants laid 180
over 30 visits*.

This is the same positive-feedback-plus-evaporation mechanism that lets real ant
colonies select the shortest path: not a plan, but a consensus that precipitates
out of many stateless agents and a forgetful shared medium.

> A colony reuses the forager machinery: it compiles to the same
> `__forage_<name>` function, deposits are attributed to the colony, and the
> same statelessness guarantee is enforced inside its body. `march` is
> `for R rounds { run all N foragers; world.fade(F) }`.

---

## Vocabulary reference

| Statement | Meaning |
|-----------|---------|
| `world NAME` | Declare a shared analog memory (the physical world). |
| `animal NAME` | Declare a stateless agent (holds no memory of its own). |
| `trail NAME in WORLD by N` | Lay (deposit) `N` onto a trail; deposits accumulate. |
| `trail NAME by N` | Same, inside a `forage`/`colony` body (world implicit). |
| `sense NAME in WORLD into LOCAL` | Stateless read of a trail's strength. |
| `sense NAME into LOCAL` | Same, inside a `forage`/`colony` body (world implicit). |
| `fade WORLD by N` | Analog decay across all trails; floors at 0, never erased. |
| `forage NAME on WORLD … end` | A stateless rule run against a world. |
| `step NAME [N times]` | Run a forager once, or `N` times. |
| `why TRAIL in WORLD [into NAME]` | Trace a trail's strength to its deposits and decay. |
| `colony NAME of COUNT on WORLD [fade F] … end` | A population of `COUNT` foragers, evaporation `F`/round. |
| `march NAME [R rounds]` | Advance a colony `R` rounds (each round: all foragers act, then fade). |

### Runtime classes

| Class | Created by | Holds |
|-------|-----------|-------|
| `EventMathWorld` | `world NAME` | `trails` (strength), `ledger` (who laid what), `decay` (what fade wore away). Methods: `lay(trail, amount, by)`, `sense(trail)`, `fade(amount)`, `why(trail)`, `render()`. |
| `EventMathAnimal` | `animal NAME` | `state` — a frozen empty object. `isStateless()` is the invariant. |
| `EventMathTrailTrace` | `world.why(trail)` | `strength`, `deposits`, `byContributor`, `totalDeposit`, `decayed`. `render()` narrates the trace. |

---

## Design notes for contributors

Every statement in this layer was added end-to-end through the standard pipeline
(`tokenizer → parser → codegen → formatter → validator → runtime → tests →
example`); see **DEVELOPER-GUIDE.md** for the checklist. A few choices specific
to this layer:

- **The runtime is pure and in-core.** `EventMathWorld` / `EventMathAnimal` /
  `EventMathTrailTrace` live in `runtime/eventmath-runtime.js` and are referenced
  as `EM.EventMath…`. They have no I/O, no async, and no dependencies — the whole
  layer is deterministic, which is why the consensus demo has an exact, testable
  outcome.
- **Implicit world resolution.** Inside a `forage`/`colony` body, `sense`/`trail`
  omit `in WORLD`; codegen fills it from the enclosing block's world
  (`_forageWorld`). Outside a body, the world is required — the validator errors
  if it is missing.
- **Attribution.** Codegen tracks `_forageName` so every `lay` is emitted with a
  third argument naming who laid it. This is what makes `why` able to credit each
  contributor; it is invisible in the source.
- **The statelessness guarantee is a real pass.** `validator._validateStigmergy`
  walks `forage`/`colony` bodies and rejects `live` signals and `remember`. If
  you add a new way to persist agent state, decide whether it belongs in that
  rejection set.
- **`step` vs `march`.** `step` is for a single forager (run the rule `N` times,
  no evaporation). `march` is for a colony (run the population `R` rounds, fade
  between rounds). Keep them distinct: foragers step, colonies march.

### Test suites

```
node tests/stigmergy-test.js     # v2.29 — world/animal/trail/sense/fade (42)
node tests/forage-test.js        # v2.30 — forage/step + statelessness (32)
node tests/why-trail-test.js     # v2.31 — why over trails (27)
node tests/colony-test.js        # v2.32 — colony/march consensus (30)
```

### Examples

```
examples/v2.29-stigmergy.em      # memory relocates from animal to world
examples/v2.30-forage.em         # a stateless rule amplifies a trail across steps
examples/v2.31-why-trail.em      # the world explains how a trail got strong
examples/v2.32-colony.em         # a colony converges on a route no ant chose
```

---

## Where it is going

The substrate is in place; the frontier is richer structure and richer
explanation:

- **A real topology.** Trails over an actual small graph (`route` with
  lengths/costs), so the colony's consensus is over a map, not two named trails —
  true shortest-path, not just preferential attachment.
- **Contrastive `why`.** "Why *short* and not *long*?" as a single trace that
  names the round where the colony tipped.
- **Trail interaction.** Trails that suppress or amplify each other (alarm vs.
  food scent), so more than one kind of decision can share a world.

The through-line never changes: keep the memory in the world, keep the agent
stateless, and keep the whole loop legible — visible enough that you can watch a
colony think.
