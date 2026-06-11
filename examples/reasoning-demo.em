note EventMath Reasoning Demo — v1.6
note Demonstrates probabilistic weights, abductive reasoning, and analogical reasoning

note ── Define candidate explanations ──

event high workload
category state
matter
  description is too many tasks assigned
  energy is low
  cause is workload
  stress is high
end
end

event unclear goals
category state
matter
  description is direction not established
  energy is low
  cause is communication
  stress is medium
end
end

event poor tooling
category state
matter
  description is tools create friction
  energy is medium
  cause is environment
  stress is low
end
end

note ── Observed pattern of resolved predictions ──

event observation one
category prediction
matter
  resolved is true
  correct is true
  cause is workload
  stress is high
end
end

event observation two
category prediction
matter
  resolved is true
  correct is true
  cause is workload
  stress is medium
end
end

event observation three
category prediction
matter
  resolved is true
  correct is false
  cause is environment
  stress is low
end
end

note ── Build layers ──

layer candidates
  high workload
  unclear goals
  poor tooling
end

layer observations
  observation one
  observation two
  observation three
end

note ── Assign probabilistic weights ──

weight workload at 3
weight communication at 1
weight environment at 0.5
weight stress at 1

note ── Abductive reasoning: find best explanation ──

explain observations from candidates into best explanation

show best explanation

note ── Analogical reasoning: compare high workload to unclear goals ──

analogy high workload and unclear goals into workload vs goals similarity

show workload vs goals similarity

note ── Analogical reasoning: compare similar events ──

analogy observation one and observation two into observation similarity

show observation similarity
