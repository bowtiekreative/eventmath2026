note Geometric Composition — Stacking Squares, Not Polygons
note A square is 4 points. Stack another square, rotated = diamond.
note 8 points form an octagon without computing an octagon.
note This is the insight: squares are easy to remember and store.
note Polygons get exponentially harder with more sides. Squares stack.

note ── Level 1: The First Plane ──
note Triangle is the first plane in existence
note But without the opposite, it's not real — holds no tension

event first triangle
category plane
matter
  name is First Plane
  sides is 3
  stability is unstable without opposite
end
end

event opposite triangle
category plane
matter
  name is Opposite Plane
  sides is 3
  rotation is 180
end
end

note ── Triangle + Opposite = Square (the first stable structure) ──
note Two triangles stacked make a square — 4 stable points

event point a
category corner
matter
  name is Point A
  position is top left
end
end

event point b
category corner
matter
  name is Point B
  position is top right
end
end

event point c
category corner
matter
  name is Point C
  position is bottom right
end
end

event point d
category corner
matter
  name is Point D
  position is bottom left
end
end

layer first square
  point a
  point b
  point c
  point d
end

note ── Level 2: Stack another square, rotated 45 degrees ──
note Diamond is just a rotated square. Same 4 points, different orientation.

event point e
category corner
matter
  name is Point E
  position is top center
end
end

event point f
category corner
matter
  name is Point F
  position is right center
end
end

event point g
category corner
matter
  name is Point G
  position is bottom center
end
end

event point h
category corner
matter
  name is Point H
  position is left center
end
end

layer diamond square
  point e
  point f
  point g
  point h
end

note ── Level 3: Stack them = 8 points + 1 center = 9 ──
note The Fibonacci sequence governs how they come together:
note 1, 1, 2, 3, 5, 8, 13
note 1 = beginning (the first point)
note 8 = the outer ring (4 square + 4 diamond)
note 13 = completion (the full cycle closed)
note 1 + 8 = 9 points visible, but the 9th is the center
note which is the nucleus — it's the 1 that both begins and completes

layer stacked geometry
  first square
  diamond square
end

note ── Check the counts ──
mark square points as 4
mark diamond points as 4
mark outer points as square points + diamond points
mark total visible as outer points + 1
check outer points is 8
check total visible is 9

note ── The vibration: as you add layers, it radiates outward ──
note Each new stacked square creates another vibration
note The spin goes in different directions
note Everything follows wherever the spin goes

run layer stacked geometry