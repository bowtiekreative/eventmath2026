note Web Development Promotion — Prediction Model
note Finding the innovative approach nobody else is using

use directions from ../prediction/directions.em
use lenses from ../prediction/lenses.em
use quantities from ../prediction/quantities.em

event google search ads
category promotion channel
matter
  name is google search ads
  direction is direct
  lens is where
  cost is high
  competition is very high
  saturation is yes
end
end

event portfolio website
category promotion channel
matter
  name is portfolio website
  direction is direct
  lens is what
  cost is low
  competition is very high
  saturation is yes
end
end

event linkedin cold outreach
category promotion channel
matter
  name is linkedin cold outreach
  direction is direct
  lens is who
  cost is medium
  competition is high
  saturation is yes
end
end

event cold email campaign
category promotion channel
matter
  name is cold email campaign
  direction is direct
  lens is who
  cost is low
  competition is high
  saturation is yes
end
end

event new business trigger
category innovative channel
matter
  name is new business registration targeting
  direction is indirect other
  lens is when
  cost is low
  competition is very low
  saturation is no
  why it works is caught before they made any decisions
end
end

event bad review trigger
category innovative channel
matter
  name is post bad review outreach
  direction is indirect other
  lens is why
  cost is very low
  competition is none
  saturation is no
  why it works is speaking to the wound at the exact moment of pain
end
end

event competitor launched trigger
category innovative channel
matter
  name is competitor site launch targeting
  direction is indirect other
  lens is when
  cost is low
  competition is none
  saturation is no
  why it works is fear of falling behind is stronger than desire to improve
end
end

event prediction offer lead
category innovative channel
matter
  name is free prediction audit offer
  direction is indirect other
  lens is what
  cost is very low
  competition is none
  saturation is no
  why it works is gives value first filters serious buyers positions as strategist
end
end

event hiring signal trigger
category innovative channel
matter
  name is growing company job posting trigger
  direction is indirect other
  lens is when
  cost is low
  competition is very low
  saturation is no
  why it works is growing companies always need better web presence
end
end

event embarrassment angle
category innovative channel
matter
  name is embarrassment trigger ad
  direction is indirect other
  lens is why
  cost is medium
  competition is very low
  saturation is no
  why it works is taps the real reason people hire web developers
end
end

layer saturated channels
  google search ads
  portfolio website
  linkedin cold outreach
  cold email campaign
end

layer innovative channels
  new business trigger
  bad review trigger
  competitor launched trigger
  prediction offer lead
  hiring signal trigger
  embarrassment angle
end

timeline promotion history
past
  saturated channels
end
present
  saturated channels
end
future
  innovative channels
end
end

predict promotion approach for web development
across directions
and lenses
and quantities
into all promotion predictions

resolve all promotion predictions where direction is direct and lens is where as correct
resolve all promotion predictions where direction is direct and lens is who as correct
resolve all promotion predictions where direction is direct and lens is what as correct
resolve all promotion predictions where direction is more same and lens is where as correct
resolve all promotion predictions where direction is keep same and lens is who as incorrect
resolve all promotion predictions where direction is indirect opposite and lens is why as correct
resolve all promotion predictions where direction is indirect other and lens is when as correct
resolve all promotion predictions where direction is indirect other and lens is why as correct

mark direct accuracy as accuracy of all promotion predictions where direction is direct
mark indirect other accuracy as accuracy of all promotion predictions where direction is indirect other
mark indirect opposite accuracy as accuracy of all promotion predictions where direction is indirect opposite
mark keep same accuracy as accuracy of all promotion predictions where direction is keep same

mark who accuracy as accuracy of all promotion predictions where lens is who
mark what accuracy as accuracy of all promotion predictions where lens is what
mark timing accuracy as accuracy of all promotion predictions where lens is when
mark why accuracy as accuracy of all promotion predictions where lens is why

count in innovative channels where saturation is no into untapped count
count in innovative channels where competition is none into zero competition count

zoom in on new business trigger and prediction offer lead into innovation gap

zoom out on timeline promotion history as event current strategy summary

check untapped count is greater than 0
check zero competition count is greater than 0

note ── Prediction Results ──
show direct accuracy
show indirect other accuracy
show indirect opposite accuracy
show keep same accuracy

note ── Lens Scores ──
show who accuracy
show what accuracy
show timing accuracy
show why accuracy

note ── Channel Counts ──
show untapped count
show zero competition count

run promotion history past
run promotion history future
run innovation gap present
run current strategy summary
