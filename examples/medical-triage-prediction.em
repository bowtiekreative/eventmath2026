note Medical triage prediction
note Shows how the who lens separates demographic factors from universal patterns

use directions from ../prediction/directions.em
use lenses from ../prediction/lenses.em
use quantities from ../prediction/quantities.em

predict symptom presentation
across directions
and lenses
and quantities
into triage predictions

note How many predictions involve the who lens — demographic factors
count in triage predictions where lens is who into demographic predictions
count in triage predictions where lens is why into causal predictions
count in triage predictions where direction is indirect opposite into inverse responses

note Resolve outcomes from clinical observations
resolve triage predictions where direction is direct and lens is what as correct
resolve triage predictions where direction is more same and lens is who as correct
resolve triage predictions where direction is indirect opposite and lens is how as incorrect

note Accuracy across the who dimension specifically
mark demographic accuracy as accuracy of triage predictions where lens is who

note Accuracy across causal reasoning
mark causal accuracy as accuracy of triage predictions where lens is why

run triage predictions
