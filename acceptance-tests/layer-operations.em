note Layer operations acceptance test

event task one
category work
matter
  priority is high
  status is todo
end
end

event task two
category work
matter
  priority is low
  status is done
end
end

event task three
category work
matter
  priority is high
  status is done
end
end

layer all tasks
  task one
  task two
  task three
end

filter layer all tasks where status is done into completed tasks
find in all tasks where priority is high into urgent task
count in all tasks where status is done into done count
