note The Switch — the nucleus that appears and disappears
note Square + Diamond = 8 points, 9th is the nucleus
note The pulse oscillates: present → absent → present

note ── The geometry of the switch ──

event square
category geometry
matter
  name is Square
  points is 4
  order is 1
end
end

event diamond
category geometry
matter
  name is Diamond
  points is 4
  order is 2
end
end

event nucleus
category switch
matter
  name is The Nucleus
  presence is toggles
  description is The point that is there and then is not there
end
end

note ── The four corners of the square ──

event north
category point
matter
  name is North
  x is 0
  y is 1
end
end

event east
category point
matter
  name is East
  x is 1
  y is 0
end
end

event south
category point
matter
  name is South
  x is 0
  y is -1
end
end

event west
category point
matter
  name is West
  x is -1
  y is 0
end
end

note ── The four corners of the diamond (rotated square) ──

event northeast
category point
matter
  name is NorthEast
  x is 0.707
  y is 0.707
end
end

event southeast
category point
matter
  name is SouthEast
  x is 0.707
  y is -0.707
end
end

event southwest
category point
matter
  name is SouthWest
  x is -0.707
  y is -0.707
end
end

event northwest
category point
matter
  name is NorthWest
  x is -0.707
  y is 0.707
end
end

note ── Stack the square and diamond into one layer ──
note 8 points total — 4 from square, 4 from diamond
note The 9th point is the nucleus, controlled by the pulse

layer square
  north
  east
  south
  west
end

layer diamond
  northeast
  southeast
  southwest
  northwest
end

layer full geometry
  square
  diamond
end

note ── The switch: oscillates the nucleus into existence ──
pulse nucleus presence every 2 tick

note ── Now show the system ──
run layer full geometry

note ── Fibonacci relationship: the 8 outer points form a cycle ──
note 1 (beginning) → 2 → 3 → 5 → 8 → 13 (completion)
note 8 outer points + 1 nucleus = 9 points
note When you stack, the square+square creates diamonds
note You keep stacking — each layer is a new vibration