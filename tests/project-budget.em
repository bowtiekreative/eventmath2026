# Project Budget Tracker
# Uses arithmetic to track spending against budget

note This tracker shows how matter flows through financial events

event initial budget
category finance
matter
  name is Q1 Development Budget
  total is 50000
  currency is USD
end
end

event design phase
category expense
matter
  description is UI and UX design work
  cost is 12000
  status is approved
end
end

event development phase
category expense
matter
  description is Backend and frontend development
  cost is 28000
  status is approved
end
end

event testing phase
category expense
matter
  description is QA and user testing
  cost is 8000
  status is approved
end
end

layer budget events
  initial budget
  design phase
  development phase
  testing phase
end

timeline q1 budget

present
  budget events
end

end

mark total spent as 12000
mark remaining as 50000
mark over budget as false

set remaining to remaining minus 12000
set remaining to remaining minus 28000
set remaining to remaining minus 8000

when remaining is less than 0
  broken event budget exceeded
  matter
    reason is Spending has gone over the approved budget
    suggested fix is Review and reduce expenses or request additional funding
  end
  end
  set over budget to true
end

when over budget is false
  run q1 budget present
end
