note Fractal Timeline — zoom reveals the gap between two events

event code merged
category development
matter
  author is ryan
  branch is feature slash payment
  files changed is 12
end
end

event deployed to production
category operations
matter
  version is 2 dot 4 dot 1
  servers updated is 3
  deploy time is 4 minutes
end
end

layer deployment events
  code merged
  deployed to production
end

timeline deployment history
past
  code merged
end
present
  deployed to production
end
future
end
end

note Zoom in — what lives between merge and deploy?
zoom in on code merged and deployed to production into deploy gap

note The gap has a zoom level one deeper than the surface
mark gap depth as zoom level of deploy gap

note Zoom in again — what lives inside the gap?
note This is the fractal principle — the gap contains more gaps

note Zoom out — what does the whole deployment look like from above?
zoom out on timeline deployment history as event deployment summary

note The summary is now a single event at a higher level
run deployment summary

check gap depth is greater than 1
