# EventMath for Young Explorers

Hello, friend! You found something special. This is a guide to **EventMath** — a language you can use to tell a computer a story. Let's learn it together, one little piece at a time.

---

## What Is EventMath?

EventMath is a way of writing down *what happens*. Like when you tell someone about your day — "First this happened, then that happened" — EventMath helps a computer understand those same kinds of stories.

---

## 1. Events — Things That Happen

An **event** is one thing that happens. Like "the sun came up" or "a bird sang."

```
event sun came up
end
```

- `event sun came up` — you are telling the computer: something happened, and its name is "sun came up."
- `end` — this means "I am done describing this thing." Every time you start something in EventMath, you finish it with `end`.

---

## 2. Matter — What We Know About an Event

**Matter** is like the color of your crayon. It tells us more about the event. Was the sun orange? Was it early in the morning?

```
event sun came up
  matter
    color is orange
    time is early morning
  end
end
```

- `matter` — "here comes some details!"
- `color is orange` — the color of this event is orange.
- `time is early morning` — it happened in the early morning.
- The second `end` closes the `matter` block. The third `end` closes the whole event.

---

## 3. Category — What Kind of Thing It Is

A **category** is like a sticker you put on the outside of a box. It says what kind of thing is inside. Is it a "weather" event? A "garden" event?

```
event sun came up
  category weather
  matter
    color is orange
  end
end
```

- `category weather` — this event belongs to the "weather" group.

---

## 4. Layers — A Toy Box Holding Events

A **layer** is like a toy box. You put events inside it so they stay together.

```
layer morning things
  sun came up
  birds sang
end
```

- `layer morning things` — make a toy box called "morning things."
- `sun came up` and `birds sang` — put these events inside the box.
- `end` — close the toy box.

---

## 5. Timelines — A Story From Start to Finish

A **timeline** is like a picture book with a beginning, a middle, and an end. It holds your layers in order: what already happened, what is happening now, and what will happen next.

```
timeline a plant grows

  past
    seed was planted
  end

  present
    sprout is growing
  end

  future
    flower will bloom
  end

end
```

- `timeline a plant grows` — start a story called "a plant grows."
- `past` — things that already happened.
- `present` — what is happening right now.
- `future` — things that have not happened yet.
- Each section closes with `end`. The whole timeline closes with `end` too.

---

## 6. Mark and Show — Writing Things Down and Reading Them

**Mark** is like writing something on a sticky note. **Show** is like reading that sticky note out loud.

```
mark flower color as yellow
show flower color
```

- `mark flower color as yellow` — write a note: "flower color = yellow."
- `show flower color` — read the note out loud (the computer will print it for you).

---

## 7. When / Otherwise — If This, Then That

**When** is like a guessing game. "When it is raining, put on your boots. Otherwise, wear your sandals."

```
when flower color is yellow
  show it is a sunny flower
otherwise
  show it is a mystery flower
end
```

- `when flower color is yellow` — if the flower color is yellow...
- `show it is a sunny flower` — ...then say "it is a sunny flower."
- `otherwise` — but if it is NOT yellow...
- `show it is a mystery flower` — ...then say "it is a mystery flower."
- `end` — done with this choice.

---

## 8. Actions — A Recipe You Can Run

An **action** is like a recipe. You write all the steps down once, and then you can use it again and again.

```
action say good morning
  show the sun is up
  show time to grow
end
```

- `action say good morning` — make a recipe called "say good morning."
- `show the sun is up` — step one of the recipe.
- `show time to grow` — step two.
- `end` — the recipe is finished.

---

## 9. Patterns — A Game Where You Find Matching Words

A **pattern** is like playing "I Spy." You tell the computer exactly what to look for, and it finds all the matching pieces.

```
pattern plant name
  first word is letters repeated
  space     is " "
  last word is letters repeated
end
```

- `pattern plant name` — make a game called "plant name."
- `first word is letters repeated` — look for a bunch of letters (like "sun" or "rose").
- `space is " "` — then look for a space.
- `last word is letters repeated` — then look for more letters.
- `end` — the game rules are done.

When you want to play the game on some words, you use `scan`:

```
mark garden as "sun flower moon vine"
scan garden with plant name into found names
show found names
```

- `scan garden with plant name into found names` — search through "garden" using your pattern, and put everything you find into "found names."

---

## 10. Zoom In and Out — Like a Camera on Your Tablet

**Zoom** is like pinching your tablet screen. You can zoom in to see something up close, or zoom out to see the big picture.

```
zoom in on tiny seed and tall flower into growing bridge
show growing bridge
```

- `zoom in on tiny seed and tall flower` — look closely at the difference between these two things.
- `into growing bridge` — put what you find into a box called "growing bridge."
- `show growing bridge` — show what you discovered.

---

## 11. Note — Leaving Yourself a Message

A **note** is like a little sticky note you leave for yourself (or a friend). It does not do anything — it just says something helpful.

```
note This is the story of a little plant
note It starts as a seed and becomes a flower
```

- `note This is the story...` — just a friendly reminder sitting in your code. The computer keeps it but does not run it.

---

## A Tiny Story — A Plant Growing

Now let us put it all together! Here is a whole little program that tells the story of a plant growing from a seed to a flower.

```
note The story of a plant that grows

event seed was planted
  category garden
  matter
    type is sunflower
    size is tiny
  end
end

event sprout appeared
  category garden
  matter
    color is green
    height is small
  end
end

event flower bloomed
  category garden
  matter
    color is yellow
    size is big
  end
end

layer plant journey
  seed was planted
  sprout appeared
  flower bloomed
end

timeline sunflower story

  past
    seed was planted
  end

  present
    sprout appeared
  end

  future
    flower bloomed
  end

end

mark plant name as sunflower
show plant name
```

Here is what each part does:

- Lines 1: A `note` so we remember what this story is about.
- Lines 3–8: The first event — a tiny seed goes in the ground.
- Lines 10–15: The second event — a little green sprout pokes up.
- Lines 17–22: The third event — a big yellow flower opens up.
- Lines 24–28: A `layer` called "plant journey" that holds all three events together in one toy box.
- Lines 30–42: A `timeline` that puts the seed in the past, the sprout in the present, and the flower in the future.
- Lines 44–45: We `mark` the plant's name and `show` it.

And that is it! You just wrote a story that a computer can read and understand. You are an EventMath explorer now. Keep going — the stories only get bigger from here.
