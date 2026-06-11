note Prediction Engine — uses all three dimension files

use directions from directions.em
use lenses from lenses.em
use quantities from quantities.em

note Subject: override this mark in your own program
mark prediction subject as unknown

note Generate all 216 combinations
predict prediction subject
across directions
and lenses
and quantities
into all predictions

mark total predictions as 0
mark correct predictions tally as 0
mark engine accuracy as 0

action score predictions
door open
  count in all predictions where resolved is yes into resolved total
  count in all predictions where correct is yes into correct total
  set total predictions to resolved total
  set correct predictions tally to correct total
  when resolved total is greater than 0
    mark new accuracy as accuracy of all predictions where resolved is yes
    set engine accuracy to new accuracy
  end
door closed
end
