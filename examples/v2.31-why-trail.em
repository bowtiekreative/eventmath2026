note v2.31 — why over trails (the relocated memory explains itself)
note
note The bet of this language: the system should be able to explain itself back
note to you. v2.29–2.30 moved memory out of the agent and into the world. Now
note the world can answer "why is this trail strong?" — tracing the strength
note back to who laid what, and what decay wore away. The ground keeps the
note receipts, so the memory is not just stored, it is accountable.

world meadow

note A passing animal found food once and left the first mark — laid by hand.
trail food in meadow by 1

note The stateless scout reinforces the food trail on every visit.
forage scout on meadow
  sense food into strength
  when strength is more than 0
    trail food by 2
  end
end

step scout 4 times

note Ask the meadow to explain itself. No animal holds this answer — the world does.
why food in meadow

note Night falls; weak trails evaporate.
fade meadow by 5

note Ask again — now the trace also accounts for the decay.
why food in meadow

note You can also capture the trace and show it later.
why food in meadow into report
show report
