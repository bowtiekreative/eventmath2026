# EventMath — Friendly-Error Catalog v0.1

## Design rules (from the spec)
1. Every message uses EventMath vocabulary only (doors, matter, events — never JS internals).
2. Names the place: action or event name, plus line number.
3. Says what was expected and what actually happened, in complete plain sentences.
4. Offers exactly one suggested fix.
5. Banned words: `parameter`, `argument`, `callback`, `closure`, `undefined`, `null pointer`, `TypeError`, `instance`, `constructor`.

This catalog doubles as the Mender's fast-path table: each error class carries its typical cause and one suggested fix, so the simplest 80% of problems resolve in one exchange.

---

## Error classes

### E001 — Missing block name
**Template:** `I was looking for the name of a {block}, but I couldn't find one. Every {block} needs a name right after the word "{block}".`

| Context | Example |
|---|---|
| `event` followed by nothing | `event` → name missing |
| `layer` followed by another keyword | `layer end` → name is "end" (reserved) |
| `action` with no name | `action` on its own line |

**Typical cause:** Typing the keyword but forgetting the name.
**Suggested fix:** Add a name right after the keyword. For example: `event user signs in`

---

### E002 — Unknown word
**Template:** `Line {N}: I don't know the word "{word}". Did you mean "{suggestion}"?`

| Context | Example |
|---|---|
| Typo of a keyword | `variable` instead of `mark` |
| Reserved word used as name | `event event` |
| Non-EventMath word | `function`, `const`, `let` |

**Typical cause:** The word was typed but it's not part of EventMath's vocabulary.
**Suggested fix:** Check the spelling or use an EventMath word. `mark` is how EventMath remembers matter. `set` is how EventMath changes it.

**Suggestion table:**
| Unknown word | Suggest |
|---|---|
| `variable` / `var` / `let` / `const` | `mark` — marks are how EventMath remembers matter |
| `function` / `fun` / `method` | `action` — actions are reusable processes with a door |
| `if` / `else if` | `when` / `otherwise` — EventMath conditionals read as English |
| `for` / `foreach` / `each` | `walk` — walk a layer, one event at a time |
| `while` | `again until` — repeat until a condition is met |
| `do` | `again` — repeat a block |
| `return` | `door closed` — matter leaves when the door closes |
| `class` / `object` / `struct` | `event` — a named thing that happened, carrying matter |
| `array` / `list` | `layer` — an ordered container of events |
| `null` / `nil` / `undefined` / `None` | EventMath does not use these. If matter is missing, the door was blocked. |
| `try` / `catch` / `throw` | `broken event` — errors are events on the timeline, nothing to catch |
| `import` / `require` / `include` | EventMath has no module system yet. Put everything in one file. |

---

### E003 — Expected "end" but found something else
**Template:** `Line {N}: I was expecting "{end}" but found "{found}". Every {block} must close with "end".`

| Context | Example |
|---|---|
| Event missing `end` | `event t1 ... end` (for matter) but no `end` for event |
| Layer missing `end` | `layer myLayer ...` ends with next keyword instead of `end` |
| Nested block closes outer block too early | Extra `end` in action body closes action before `door closed` |

**Typical cause:** Count the `end` keywords. Events with matter need two: one for matter, one for event. Actions with door closed need one for the body, one for the action.
**Suggested fix:** Add the missing `end` on its own line. If you're inside a block, count backward: how many blocks are open?

---

### E004 — Door problem
**Template:** `Door problem in {action} (line {N}). The door asked for {input}, but no {input} entered. Try: {action} with {input} is ...`

| Context | Example |
|---|---|
| Action call missing an argument | `make requirement with title is ...` but door asked for `title` and `priority` |
| Action called with no arguments | `make requirement` when door expects `title priority` |
| Extra argument provided | `make requirement with title is ... and priority is ... and extra is ...` when door only expects 2 |

**Typical cause:** The action's door was declared with inputs that weren't all provided.
**Suggested fix:** Check the door open line in the action definition. Provide every input the door asks for.

---

### E005 — Matter line problem
**Template:** `Line {N}: After "{key}" I was expecting "is" (literal) or "from" (reference), but I found "{found}".`

| Context | Example |
|---|---|
| `title whatever` — missing `is` or `from` | Word after the key isn't a delimiter |
| `title is` (nothing after) | Key with `is` but no literal value |
| `title from` (nothing after) | Key with `from` but no reference value |

**Typical cause:** Matter lines must follow Law 1: `key is literal` or `key from reference`.
**Suggested fix:** Add `is` followed by the value, or `from` followed by the mark/door input name.

---

### E006 — Missing block end
**Template:** `I was expecting {end} but the program ended unexpectedly. The {block} starting at line {N} was never closed.`

| Context | Example |
|---|---|
| File ends inside an open block | Last line is `matter` or inside a when block with no `when ... end` |
| Mismatched nesting | Three `end` keywords for four open blocks |

**Typical cause:** Every `event`, `layer`, `timeline`, `action`, `matter`, `when`, `split`, `again`, and `walk` block needs its own `end`.
**Suggested fix:** Add the missing `end` line. Count open blocks and make sure each has a matching close.

---

### E007 — Missing matter keyword
**Template:** `Line {N}: I found "{found}" but I was expecting the beginning of a matter block. Did you mean to start with "matter"?`

| Context | Example |
|---|---|
| `title is value` directly after `event t1` without `matter` | Matter lines without the `matter` keyword |
| Nested matter | `matter` inside another `matter` |

**Typical cause:** Matter fields must be inside a matter block.
**Suggested fix:** Add a `matter` line before the fields, and an `end` after them.

---

### E008 — Condition problem
**Template:** `Line {N}: I was trying to read a condition but found "{found}". Conditions in EventMath look like: when {name} is {value}.`

| Context | Example |
|---|---|
| `when` without `is` | `when user logged in` missing `is` |
| `when title` (no value) | Incomplete condition |
| `status = done` | Using `=` instead of `is` |

**Typical cause:** EventMath conditions use `is` not `=`, and they always have both sides.
**Suggested fix:** Write conditions as `when {name} is {value}`. For negation, use `when {name} is not {value}`.

---

### E009 — Loop problem
**Template:** `Line {N}: I found "{found}" after "again". Loops in EventMath look like: again 5 times or again until {condition}.`

| Context | Example |
|---|---|
| `again` with no count or condition | `again` alone |
| `again 5` missing `times` | Counted loop missing the word `times` |
| `again until` with no condition | Incomplete until loop |

**Typical cause:** `again` needs either a number + `times`, or `until` + a condition.
**Suggested fix:** Use `again 5 times` for a fixed count, or `again until all done is true` for a conditional loop.

---

### E010 — Walk problem
**Template:** `Line {N}: I found "{found}" after "walk". Walks in EventMath look like: walk {layer} as {variable}.`

| Context | Example |
|---|---|
| `walk` with no layer name | `walk` alone |
| `walk myLayer` without `as variable` | Missing the iteration variable |
| `walk myLayer as` (no variable) | Incomplete |

**Typical cause:** `walk` needs a layer name, the word `as`, and a variable name to hold each event.
**Suggested fix:** Write `walk project tasks as current task`.

---

### E011 — Split problem
**Template:** `Line {N}: I found "{found}" after "split". Splits in EventMath look like: split {name} into path ... end end.`

| Context | Example |
|---|---|
| `split` with no name | `split` alone |
| `split result` missing `into` | Incomplete split |
| No paths defined | `split result into end` with no paths |

**Typical cause:** `split` needs a value to split on and at least one `path`.
**Suggested fix:** Write `split result into path success ... end path fail ... end end`.

---

### E012 — Door closed without opening
**Template:** `Line {N}: The action "{action}" closed its door but never opened it. A door can only close if it was opened first.`

| Context | Example |
|---|---|
| `door closed` in an action that has no `door open` | Action with only a close clause |

**Typical cause:** `door closed` tells the action what to return, but if no input was declared with `door open`, the action takes no input and may not need a door at all.
**Suggested fix:** Either add `door open` with the inputs, or remove the `door closed` line.

---

### E013 — Action never closes its door
**Template:** `Line {N}: The action "{action}" opened its door but never closed it. Nothing came back out.`

| Context | Example |
|---|---|
| Action has `door open` but no `door closed` | Input declared but nothing returned |
| Action creates matter but never sends it back | Event created inside action but door never closes |

**Typical cause:** A warning, not an error. The action might still do useful work by creating events.
**Suggested fix:** Add `door closed {event name}` to return matter through the door. If no return is needed, consider removing the `door open`.

---

### E014 — Blocked door (missing input)
**Template:** `Blocked door in {action} (line {N}). The door asked for {input}, but nothing entered.`

| Context | Example |
|---|---|
| Action parameter not provided in call | Missing argument |
| Action called with wrong number of arguments | Mismatched count |
| Mark referenced before being set | Using a mark that was never assigned |

**Typical cause:** What the action needed never arrived through the door.
**Suggested fix:** Check the door open line. Provide every input when calling the action.

---

### E015 — Reserved word used as name
**Template:** `Line {N}: The word "{word}" is reserved and cannot be used as a name for this {context}. Reserved words have one meaning in EventMath.`

| Context | Example |
|---|---|
| `event event` | Using a keyword as an event name |
| `layer end` | Using `end` as a layer name |
| `action is` | Using `is` as an action name |

**Typical cause:** Keywords are reserved and cannot appear inside names.
**Suggested fix:** Choose a different name. Reserved words include: `event, matter, category, cat, layer, timeline, action, door, open, closed, mark, set, run, when, otherwise, split, path, again, walk, end, is, from, as, to, by, with, into, times, past, present, future, stop, merge, break, add, remove, before, after, rewind, forward, and, not, until`.

---

### E016 — Timeline section problem
**Template:** `Line {N}: Timeline sections use "past", "present", and "future". I found "{found}" instead. Each section ends with "end".`

| Context | Example |
|---|---|
| `yesterday` used instead of `past` | Wrong section name |
| Section missing `end` | `past\nend` missing |
| Section with no name | Bare `end` inside timeline |

**Typical cause:** Sections in a timeline can only be `past`, `present`, or `future`.
**Suggested fix:** Replace with one of the three section names, each closed by `end`.

---

## Mender fast-path table

When the error is one of these classes and the typical cause is clear, the Mender can skip to Phase 5 (recommend the fix) without going through Phases 2–4:

| Error class | Fast-path condition | Fix |
|---|---|---|
| E001 — Missing name | Leading keyword present, no name follows | Add name after keyword |
| E005 — Matter line | `key` followed by non-delimiter | Add `is` or `from` after the key |
| E008 — Condition | `when` missing `is` | Add `is` between name and value |
| E009 — Loop | `again` without `times` or `until` | Add `times N` or `until condition` |
| E010 — Walk | `walk` without `as` | Add `as variable` |
| E015 — Reserved name | Name matches a keyword | Rename to a non-reserved word |

These account for approximately 80% of first-time EventMath user errors.