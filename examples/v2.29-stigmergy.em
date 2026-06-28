note v2.29 — The Stigmergy Layer (relocating memory)
note
note The idea: an animal is a near-stateless agent. It holds no memory of its
note own. Its memory lives in a shared analog medium — the physical world — as
note trails. When the animal is gone, the trail remains: the memory never
note disappears, it relocates. Computation is the loop between sense and trail.
note This is why animals can code: the program is the rule, the state is the ground.

note The shared analog memory — the physical world.
world meadow

note Two stateless agents. Neither carries anything between steps.
animal ant
animal beetle

note The ant arrives, senses the world, then lays a trail. It keeps nothing.
sense food in meadow into here
trail food in meadow by 1

note The beetle arrives later. It shares NO internal state with the ant —
note only the meadow. It reads what the ant left, and adds to it.
sense food in meadow into here
trail food in meadow by 1

note The count lives in the meadow, not in any animal. Read it back from the world.
sense food in meadow into total
show meadow

note Analog decay. Memory weakens but never disappears — strength relocates
note onto the strongest paths, so the colony remembers where the food was.
fade meadow by 1
show meadow

note Even after both animals are gone, the meadow still holds the memory.
show meadow
