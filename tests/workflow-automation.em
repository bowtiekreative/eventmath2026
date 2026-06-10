# Workflow Automation — Acceptance Test 3
# Tasks as events; walk a layer checking each task's status
# again until all tasks are done

event task 1
category task
matter
  name is Design homepage
  status is done
end

event task 2
category task
matter
  name is Build API
  status is in progress
end

event task 3
category task
matter
  name is Write tests
  status is todo
end

event task 4
category task
matter
  name is Deploy
  status is todo
end

layer project tasks
  task 1
  task 2
  task 3
  task 4
end

mark all done as false

again until all done is true
  mark all done as true
  walk project tasks as current task
    when current task status is not done
      set all done to false
    end
  end
end

run event task 1
run event task 2
run event task 3
run event task 4