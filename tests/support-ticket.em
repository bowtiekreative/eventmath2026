# Support Ticket System
# Routes tickets based on compound conditions

note A support system where every ticket is a timeline event

event ticket one
category support ticket
matter
  title is Cannot log in to account
  priority is high
  status is open
  category is account
end
end

event ticket two
category support ticket
matter
  title is Feature request for dark mode
  priority is low
  status is open
  category is feature
end
end

event ticket three
category support ticket
matter
  title is Error when saving document
  priority is high
  status is open
  category is bug
end
end

layer open tickets
  ticket one
  ticket two
  ticket three
end

timeline support queue

present
  open tickets
end

end

mark urgent count as 0
mark feature count as 0

walk open tickets as current ticket
  when current ticket priority is high and current ticket status is open
    set urgent count to urgent count plus 1
    run current ticket
  end
  when current ticket category is feature or current ticket priority is low
    set feature count to feature count plus 1
  end
end

check urgent count is at most 10

when urgent count is greater than 0 and feature count is greater than 0
  run support queue present
end
