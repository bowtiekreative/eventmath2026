# Requirements Tracker — Acceptance Test 1
# Declare requirements as events, organize into layers,
# run an action that manufactures new requirements through its door

action make requirement
door open title priority

event made requirement
category requirement
matter
  title from title
  priority from priority
  status is todo
end
end

door closed made requirement
end

layer current sprint
end

event t1
category requirement
matter
  title is User can create account
  priority is high
end
end

event t2
category requirement
matter
  title is User can log in
  priority is high
end
end

make requirement with title is User can reset password and priority is medium

run layer current sprint