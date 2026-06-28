note v2.32 — colony + march (consensus no single forager chose)
note
note One forager is a rule. A colony is a population of that rule, sharing one
note world, with evaporation between rounds. Run it and watch a decision emerge:
note the colony converges on one route through positive feedback and decay —
note reinforcement piles onto the stronger trail, evaporation erases the rest.
note No ant decides. The colony computes it, and the answer lives in the world.

world paths

note Two routes to the food. A scout marked the quicker one slightly stronger.
trail short in paths by 2
trail long in paths by 1

note Ten stateless ants. Each follows the stronger scent and reinforces it.
note Between rounds the world evaporates by 4 — weak trails cannot survive.
colony ants of 10 on paths fade 4
  sense short into s
  sense long into l
  when s is more than l
    trail short by 6
  end
  when l is more than s
    trail long by 3
  end
end

note March the colony for three rounds.
march ants 3 rounds

note The world now holds the colony's decision.
show paths

note Ask why — the colony's choice explains itself, down to who laid what.
why short in paths
why long in paths
