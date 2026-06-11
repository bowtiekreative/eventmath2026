# Hospital Patient Journey Tracker
# Each step in a patient's care is an event on their personal timeline
# Walk the care layer and check status at each step

note A patient journey from arrival through treatment to discharge

event patient arrives
category patient care
matter
  patient name is Alex Johnson
  arrival time is 9 am
  presenting condition is chest pain
end
end

event triage complete
category patient care
matter
  priority is urgent
  assigned nurse is Sam Reyes
  triage time is 9 fifteen am
end
end

event doctor assessment
category patient care
matter
  attending doctor is Dr Maria Chen
  preliminary diagnosis is stable angina
  assessment time is 10 am
end
end

event treatment begins
category patient care
matter
  treatment given is nitroglycerin administered
  treatment time is 10 fifteen am
  patient response is stable and improving
end
end

event patient discharged
category patient care
matter
  discharge time is 2 pm
  followup is cardiology appointment in 1 week
  discharge status is recovered
end
end

layer emergency care
  patient arrives
  triage complete
  doctor assessment
  treatment begins
  patient discharged
end

timeline patient journey

present
  emergency care
end

end

mark care complete as false
mark urgent steps as 0

walk emergency care as current step
  when current step priority is urgent
    set urgent steps to 1
  end
  run current step
end

when care complete is false
  run patient journey present
end

run patient journey present
