# Game Score Tracker
# Events track each scoring moment; marks track the running total

note A score tracker where every point earned is an event on the timeline

event level one complete
category achievement
matter
  description is Player completed the first level
  points earned is 100
end
end

event bonus collected
category achievement
matter
  description is Player found the hidden bonus
  points earned is 50
end
end

event enemy defeated
category achievement
matter
  description is Player defeated the main boss
  points earned is 250
end
end

layer player achievements
  level one complete
  bonus collected
  enemy defeated
end

timeline game session

present
  player achievements
end

end

mark player score as 0
mark bonus points as 50
mark base score as 400

set player score to base score plus bonus points

when player score is greater than 300
  run game session present
end

when player score is at least 400
  run event level one complete
  run event enemy defeated
end

run game session present
