# EventMath: A Guide for People Who Actually Want to Understand It

---

## 1. The Pitch

EventMath is a programming language where the code reads like English sentences — not dumbed-down English, but precise, unambiguous English that says exactly what's happening. You model things that *happen* (events), group them into *layers*, line them up on *timelines*, and run logic on all of it. Unlike Python or JavaScript, where you're constantly translating your idea into syntax soup (`{`, `=>`, `?.`, `&&`), EventMath lets you write what you mean and mean what you write. It compiles down to real JavaScript so it actually runs — you're not in a toy environment. The goal: read the code once and understand the system. No guessing.

---

## 2. The Five Rules

Every feature in EventMath obeys five laws. Break one and the compiler stops and tells you — it never guesses and keeps going.

**1. Bare words are literal.** `song title` is the variable named "song title". `"song title"` in quotes is the string "song title". They are not the same thing. Ever.

**2. Multi-word names are allowed.** You can name anything with spaces. `high score`, `last played track`, `user display name` — all valid. No underscores, no camelCase required.

```eventmath
rain high score is 0
rain last played track is "Blinding Lights"
```

**3. One word, one meaning.** `is` means assignment or equality everywhere. `end` closes every block. `rain` always means a mutable variable. No word does two different jobs.

**4. Blocks end with `end`.** No curly braces. Not `endif` or `endfor`. Just `end`.

```eventmath
when score more than 100
  show "You win"
end
```

**5. No silent autocorrect.** If something is wrong, EventMath says so and stops. It does not quietly do something you didn't ask for.

---

## 3. Events

An event is something that happened — or could happen. A concert. A post going viral. A game starting. You define it with the word `event`, give it a name, and optionally tag it with a `category` and describe it with a `matter` block.

```eventmath
event post went viral
category social
matter
  platform is "YouTube"
  views    is 4200000
  date     is "2026-06-14"
end
end
```

That's the full picture of one moment in time, described in plain words. In Python you'd write a dict or a class. Here you just describe it.

---

## 4. Matter and Category

`category` is a one-word tag for grouping events by type. `matter` is where you put the actual details — any key/value pairs you want.

```eventmath
event world cup goal
category sports
matter
  scorer    is "Mbappe"
  minute    is 73
  game      is "France vs Brazil"
  score     is "2-1"
end
end
```

Keys are bare words (no quotes). Values can be strings, numbers, or booleans. You access them later with the same names you gave them.

---

## 5. Layers

A layer is a named collection of events — think of it as a playlist, but for things that happened.

```eventmath
layer top plays this week
  post went viral
  world cup goal
  concert sold out
end
```

Layers keep related events together so you can loop over them, run logic on them, or put them in a timeline. Like a playlist, the order matters.

---

## 6. Timelines

A timeline puts layers and events into a `past`, `present`, and `future`. Think of it as the story arc of your app or system.

```eventmath
timeline music chart

past
  top plays last month
end

present
  top plays this week
end

future
  predicted hits
end

end
```

You can run the present events with `run timeline music chart present`. It's a clean way to say "here's what's happening right now" vs. "here's history" vs. "here's what we expect."

---

## 7. mark and set

`mark` declares a variable. `set` updates it. This is the simple, imperative way to store values — like `let` in JavaScript, but split into two clear steps.

```eventmath
mark total score as 0
mark player name as "Alex"

set total score to total score plus 500
set player name to "AlexGG"
```

In JavaScript: `let totalScore = 0; totalScore = totalScore + 500;`

The rule: `mark` before `set`. You have to declare it before you can update it. If you're in a reactive web context, use `rain` instead — it handles both in one line.

---

## 8. show

`show` prints a value. That's it.

```eventmath
show total score
show player name
show "Game over"
```

Compiles to `console.log`. Use it everywhere while you're building. It works on variables, event objects, computed results — anything.

---

## 9. when / otherwise / split

`when` is your if-statement. `otherwise` is else. No parentheses, no curly braces.

```eventmath
when total score more than 1000
  show "High scorer"
otherwise
  show "Keep going"
end
```

You can chain conditions. Note that multiple `when` blocks run sequentially — they're not else-if chains. For that, use `match` and `arm`:

```eventmath
match game status
  arm "playing"
    show "Game on"
  arm "paused"
    show "Paused"
  arm "over"
    show "Final score"
  arm else
    show "Unknown state"
end
```

`arm else` is the default. This is cleaner than a pile of `else if` blocks.

---

## 10. walk / again

`walk` loops over a layer. You name the current item with `as`.

```eventmath
walk top plays this week as current play
  show current play
end
```

Compare to Python: `for play in top_plays_this_week: print(play)` — same idea, different look.

Use `skip` to skip an item (like `continue`) and `escape` to break out of the loop entirely.

```eventmath
walk top plays this week as current play
  when current play views less than 100000
    skip
  end
  show current play
end
```

`again until` is your while loop — it repeats until a condition becomes true:

```eventmath
mark found as false

again until found is true
  note check something here
  set found to true
end
```

---

## 11. Actions

An action is a reusable block of code that takes inputs and returns an output. Like a function, but the syntax is different.

```eventmath
action calculate rank score
  door open
    input raw plays
    input days active
  end
  rain adjusted is raw plays divided by days active
  door closed adjusted
end
```

`door open` declares the inputs. `door closed VALUE` returns the result — like `return` in JavaScript. Call it by name anywhere you need it.

In JS this would be: `function calculateRankScore(rawPlays, daysActive) { return rawPlays / daysActive; }`

---

## 12. Patterns (v2.17)

This is one of the best things in EventMath. Writing regex — regular expressions for matching text — is notoriously painful. This is what a phone number regex looks like normally:

```
^\(\d{3}\)\s?\d{3}-\d{4}$
```

Good luck reading that six months from now. In EventMath, you write a `pattern` block and give every piece a name:

```eventmath
pattern us phone
  area     is "(" then digits 3 through 3 then ")"
  spacer   is whitespace optional
  prefix   is digits 3 through 3
  dash     is "-"
  number   is digits 4 through 4
end
```

Done. That compiles to the exact same regex, but you can read it. Here's an email pattern:

```eventmath
pattern email address
  user      is letters and digits and "._%-+" repeated
  at        is "@"
  domain    is letters and digits and "." and "-" repeated
  extension is "." then letters at least 2
end
```

And a hex color (useful for design tools, themes, anything with CSS colors):

```eventmath
pattern hex color
  hash    is "#"
  red     is hex digit 2 through 2
  green   is hex digit 2 through 2
  blue    is hex digit 2 through 2
end
```

The pattern vocabulary covers everything: `letters`, `digits`, `whitespace`, `uppercase`, `lowercase`, `hex digit`, `any text`, `repeated`, `optional`, `at least N`, `N through M`, `then` (sequence), `or` (alternation), `and` (character class).

---

## 13. scan / seek / replace

Once you have a pattern, you use it with three operations.

`scan` finds all matches and gives you an array — each item is an object with named properties for each part:

```eventmath
mark post as "DM alex@example.com or sam@music.io for collabs"

scan post with email address into found emails
show found emails
note → [{ user: "alex", at: "@", domain: "example", extension: ".com" }, ...]
```

`seek` finds just the first match (or `void` if none):

```eventmath
seek post with email address into first email
show first email
note → { user: "alex", at: "@", domain: "example", extension: ".com" }
```

`replace in` swaps all matches using a template. Reference each named part with `$<name>`:

```eventmath
replace in post with email address using "$<user> [at] $<domain>$<extension>" into safe post
show safe post
note → "DM alex [at] example.com or sam [at] music.io for collabs"
```

---

## 14. zoom in / zoom out from / zoom expand

The `zoom` family lets you analyze the relationship between events — what's the gap between two states, and what would it take to cross it?

`zoom in` maps the transformation between two events:

```eventmath
event no income
category state
matter
  energy is low
  signal is absent
end
end

event consistent income
category state
matter
  energy is high
  signal is present
end
end

zoom in on no income and consistent income into revenue bridge
show revenue bridge
```

`zoom out from` reconstructs the broader context around a zoom result — what environment produced it, what's above it:

```eventmath
zoom out from revenue bridge into bridge context
show bridge context
```

`zoom expand` starts from one event and maps all the matter fields outward — their polarity, their connections, the surface area of the whole thing:

```eventmath
zoom expand on market suppression into suppression field
show suppression field
```

You can also zoom expand from a layer or timeline to aggregate across multiple events at once.

---

## 15. Predictions and Weights

EventMath has tools for probabilistic reasoning — figuring out which explanation fits best, or how likely something is.

`weight` tells the system how much to care about a particular field when scoring:

```eventmath
weight engagement at 3
weight recency at 2
weight followers at 1
```

`explain` finds the best explanation for a set of observations from a list of candidates:

```eventmath
explain observations from candidates into best explanation
show best explanation
```

`analogy` scores how structurally similar two events are:

```eventmath
analogy high workload and unclear goals into similarity score
show similarity score
```

These are most useful when you're building something that has to reason about uncertain data — a recommendation engine, a content ranking system, anything where you have multiple possible answers and need to pick the best one.

---

## 16. Reactive Signals: live rain and lens

This is where EventMath gets interesting for UI work. A `live rain` is a variable that notifies anything depending on it whenever it changes. A `lens` is a computed value that automatically updates when its inputs change.

```eventmath
live rain play count is 0
live rain track name is "Unknown"

lens display label is track name then " (" then play count then " plays)"
```

Every time `play count` or `track name` changes, `display label` recomputes instantly. No event listeners, no `useState`, no `useEffect`. You just describe what things depend on and EventMath wires it up.

Compare to React:
```js
const [playCount, setPlayCount] = useState(0);
const displayLabel = `${trackName} (${playCount} plays)`;
```

EventMath's version is one line per value. The reactive graph is implicit in the expressions.

---

## 17. Manifest

`manifest` is the shortcut that generates an entire working API from six lines. Need a database, an HTTP server, endpoints for reading and writing data? This does it:

```eventmath
manifest music chart app
  store tracks in "tracks.db" with title and artist and plays
  serve on 3000
  show all tracks at "/api/tracks"
  accept tracks at "/api/tracks"
end
```

That generates: a SQLite database, a server on port 3000, a GET endpoint that returns all tracks, and a POST endpoint that accepts new ones. Real, runnable Node.js code. If you added an AI summary line, you'd get an Ollama-powered endpoint too. You do not write the `ground`, `draw`, `serve`, or `route` lines manually — `manifest` generates all of that.

---

## 18. A Complete Project: Music Chart Tracker

Here's a ~25-line EventMath program that tracks songs, scores them by plays and recency, and shows the top result.

```eventmath
note ── Music Chart Tracker ─────────────────────────────────

event blinding lights
category track
matter
  artist  is "The Weeknd"
  plays   is 4200000
  days    is 12
end
end

event industry baby
category track
matter
  artist  is "Lil Nas X"
  plays   is 3800000
  days    is 8
end
end

layer chart tracks
  blinding lights
  industry baby
end

action score track
  door open
    input track plays
    input track days
  end
  rain points is track plays divided by track days
  door closed points
end

weight plays at 3
weight days at 1

mark best score as 0
mark best track as void

walk chart tracks as current track
  mark raw score as score track
  when raw score more than best score
    set best score to raw score
    set best track to current track
  end
end

show best track
show best score
```

Walk through what this does: two events describe tracks with play counts and age in days. A layer groups them. An action calculates a freshness-adjusted score (plays per day). Then a `walk` loop compares each track and keeps the winner. Run it with:

```bash
node bin/em run chart.em
```

That's the full loop — events, layers, actions, loops, conditionals, output — in under 30 lines of code that reads like a document.

---

## Where to Go Next

- Run the examples in `/examples/` to see every feature live.
- Use `node bin/em check FILE.em` to validate before running.
- Use `node bin/em format FILE.em` to auto-format your code to canonical style.
- The `manifest` form is the fastest path to a working API — start there for backend projects.
- For text parsing, `pattern` + `scan` replaces 90% of the regex you'd otherwise write.

EventMath is not a toy language. It compiles to real JavaScript, handles SQLite, runs HTTP servers, and has a reactive UI layer. The readable syntax is the point — not a limitation.
