# Story Timeline — Acceptance Test 2
# Scenes as events, acts as layers, the story as a timeline
# `run story past` retells what has happened so far

event scene 1
category story scene
matter
  title is The hero leaves home
  mood is hopeful
end

event scene 2
category story scene
matter
  title is The hero meets a stranger
  mood is curious
end

event scene 3
category story scene
matter
  title is The hero faces a challenge
  mood is tense
end

layer act 1
  scene 1
  scene 2
  scene 3
end

timeline story
  past
  end
  present
    act 1
  end
  future
  end
end

run story present