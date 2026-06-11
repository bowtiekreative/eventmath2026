note Supply chain disruption prediction
note Uses the prediction engine to explore all 216 ways a shortage could play out

use directions from ../prediction/directions.em
use lenses from ../prediction/lenses.em
use quantities from ../prediction/quantities.em

predict component shortage
across directions
and lenses
and quantities
into shortage predictions

note Count the non-obvious paths most companies miss
count in shortage predictions where direction is indirect other into hidden risk count
count in shortage predictions where direction is keep same into stable scenarios
count in shortage predictions where direction is direct into direct impact count

note Surface the hidden risk signals
check hidden risk count is greater than 0

note Resolve some known outcomes from recent history
resolve shortage predictions where direction is direct and lens is who as correct
resolve shortage predictions where direction is indirect other and lens is where as correct
resolve shortage predictions where direction is keep same and lens is why as incorrect

note Score accuracy after resolution
mark shortage accuracy as accuracy of shortage predictions where resolved is true

run shortage predictions
