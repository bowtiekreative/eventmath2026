note Business strategy prediction
note Full cycle: generate predictions, resolve outcomes, score accuracy, find best lens

use directions from ../prediction/directions.em
use lenses from ../prediction/lenses.em
use quantities from ../prediction/quantities.em

note Generate all 216 market entry predictions
predict market entry decision
across directions
and lenses
and quantities
into strategy predictions

note Count predictions by lens to understand coverage
count in strategy predictions where lens is who into people factors
count in strategy predictions where lens is where into location factors
count in strategy predictions where lens is when into timing factors

note Simulate resolution from past market entries
resolve strategy predictions where direction is direct and lens is what as correct
resolve strategy predictions where direction is direct and lens is where as correct
resolve strategy predictions where direction is indirect other and lens is who as correct
resolve strategy predictions where direction is more same and lens is when as incorrect
resolve strategy predictions where direction is keep same and lens is why as incorrect
resolve strategy predictions where direction is indirect opposite and lens is how as correct

note Score accuracy by lens to find which lens is most predictive
mark what lens accuracy as accuracy of strategy predictions where lens is what
mark location lens accuracy as accuracy of strategy predictions where lens is where
mark who lens accuracy as accuracy of strategy predictions where lens is who

note Score accuracy by direction
mark direct accuracy as accuracy of strategy predictions where direction is direct
mark indirect other accuracy as accuracy of strategy predictions where direction is indirect other

note Overall resolved accuracy
mark total accuracy as accuracy of strategy predictions where resolved is true

run strategy predictions
