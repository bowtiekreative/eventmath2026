# Classroom Grades Tracker
# Calculate final grades using arithmetic and check validity

note Each student result is an event; grades are calculated with arithmetic

event alice result
category grade
matter
  student is Alice Chen
  quiz score is 85
  project score is 92
  participation is 8
end
end

event bob result
category grade
matter
  student is Bob Martinez
  quiz score is 78
  project score is 88
  participation is 9
end
end

layer class results
  alice result
  bob result
end

timeline semester grades

present
  class results
end

end

mark quiz weight as 40
mark project weight as 50
mark participation weight as 10
mark alice total as 85
mark bob total as 78
mark passing score as 60

set alice total to quiz weight plus project weight plus participation weight
set bob total to quiz weight plus project weight

check alice total is greater than passing score
check bob total is greater than passing score

when alice total is greater than bob total
  run event alice result
otherwise
  run event bob result
end

run semester grades present
