# Sprint Events — shared event definitions for a development sprint

note These events describe a software development sprint

event user can log in
category feature
matter
  title is User can authenticate with email and password
  priority is high
  status is todo
end

event user can sign up
category feature
matter
  title is User can create a new account
  priority is high
  status is todo
end

event user can reset password
category feature
matter
  title is User can recover access to their account
  priority is medium
  status is todo
end

layer auth features
  user can log in
  user can sign up
  user can reset password
end
