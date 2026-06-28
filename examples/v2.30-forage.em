note v2.30 — The forage block (a stateless rule) + step
note
note A forager is the rule, not the memory. It senses the world, lays a trail,
note and keeps nothing. Run the SAME stateless forager many times and watch the
note memory accumulate — entirely in the world. That is the program: the rule is
note the forager, the state is the ground. This is how a colony computes a path
note no single animal holds. Animals can code.

note The shared analog memory.
world meadow

note One animal stumbled on food once and left the first mark.
trail food in meadow by 1

note The scout is stateless. Inside forage the world is implicit — it forages
note on the meadow, so it never names it again. It senses, and where it smells
note food it reinforces the trail. It holds no memory of its own.
forage scout on meadow
  sense food into strength
  when strength is more than 0
    trail food by 2
  end
end

note Run the stateless scout four times. Nothing persists in the scout —
note yet the food trail grows, because the memory lives in the meadow.
step scout 4 times
show meadow

note Night falls. Weak trails evaporate; the strong food memory survives —
note it relocated onto the path worth keeping.
fade meadow by 5
show meadow
