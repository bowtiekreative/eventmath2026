# Film Production Scheduler
# Scenes are clips, acts are tracks, the film is the timeline
# Overlap lets post-production run simultaneously

note A film project where every scene is an event on the timeline

event opening scene
category film scene
matter
  title is The city awakens at dawn
  mood is peaceful
  duration is 4 minutes
end
end

event hero introduction
category film scene
matter
  title is The detective arrives at the scene
  mood is tense
  duration is 6 minutes
end
end

event first clue discovered
category film scene
matter
  title is A note found beneath the door
  mood is mysterious
  duration is 3 minutes
end
end

layer act one
  opening scene
  hero introduction
  first clue discovered
end

event confrontation
category film scene
matter
  title is The hero meets the villain at last
  mood is dramatic
  duration is 8 minutes
end
end

event rooftop chase
category film scene
matter
  title is A pursuit across the city rooftops
  mood is thrilling
  duration is 7 minutes
end
end

layer act two
  confrontation
  rooftop chase
end

event resolution
category film scene
matter
  title is The case closes as the sun rises
  mood is bittersweet
  duration is 5 minutes
end
end

layer act three
  resolution
end

timeline film project

present
  act one
  act two
  act three
end

end

note Post-production runs all tracks at the same time

overlap
  run film project present
and
  mark color grade as complete
  mark sound mix as in progress
and
  mark visual effects as complete
end

run film project present
