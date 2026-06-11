note Trump 2026 — EventMath Prediction Model v2
note Next pass: feedback loops, pulse oscillation, populated zoom timelines
note June 11, 2026. Iran ceasefire collapsing. Inflation 4.2%.
note Midterms 5 months out. Trump at 80. World Cup incoming.
note
note Five forces → causal chains → oscillating controls → prediction

note ═════════════════════════════════════════════════
note  FORCE 1: IRAN WAR
note ═════════════════════════════════════════════════

event iran ceasefire holds
category iran trajectory
matter
  name is Ceasefire Holds
  description is Deal closed within 2 weeks. Strait reopens.
  probability is low
  effect on oil is drops
  effect on trump is boost
end
end

event iran ceasefire collapses
category iran trajectory
matter
  name is Ceasefire Collapses
  description is Full war. Kharg seized. Hormuz closed.
  probability is medium
  effect on oil is catastrophic
  effect on trump is crisis rally
end
end

event iran stalemate
category iran trajectory
matter
  name is Stalemate
  description is Strikes continue. No deal. No collapse.
  probability is high
  duration is indefinite
  effect on oil is slow bleed
  effect on trump is erosion
end
end

note ═════════════════════════════════════════════════
note  FORCE 2: INFLATION / ECONOMY
note ═════════════════════════════════════════════════

event inflation eases
category economy trajectory
matter
  name is Inflation Eases
  description is Iran war ends. Oil drops. Prices cool.
  probability is low
  effect on voters is relief
  effect on midterms is neutral
  fed action is hold
end
end

event inflation worsens
category economy trajectory
matter
  name is Inflation Worsens
  description is 5%+ by October. Fed forced to hike.
  probability is medium
  effect on voters is anger
  effect on midterms is anti incumbent
  fed action is rate hike
end
end

event stagflation
category economy trajectory
matter
  name is Stagflation
  description is Inflation stays high. Growth stalls.
  probability is medium
  effect on voters is despair
  effect on midterms is landslide against
  political cost to GOP is severe
end
end

note ═════════════════════════════════════════════════
note  FORCE 3: MIDTERM ELECTIONS
note ═════════════════════════════════════════════════

event gop holds house
category midterm outcome
matter
  name is GOP Holds House
  description is Republicans keep narrow majority
  probability is medium
  effect on trump is protected
  gerrymander factor is strong
  turnout driver is base
end
end

event democrats win house
category midterm outcome
matter
  name is Democrats Flip House
  description is Iran war + inflation swing voters
  probability is medium
  effect on trump is investigations restart
  turnout driver is anger
end
end

event gop expands majority
category midterm outcome
matter
  name is GOP Expands Majority
  description is Iran deal success + economy improves
  probability is low
  effect on trump is unchecked
  turnout driver is enthusiasm
end
end

note ═════════════════════════════════════════════════
note  FORCE 4: TRUMP POLITICAL POSITION
note ═════════════════════════════════════════════════

event trump strengthens
category political trajectory
matter
  name is Trump Strengthens
  description is Iran deal. Economy rallies. Approval up.
  probability is low
  approval rating is 48
  midterm effect is coat tails
end
end

event trump weakens
category political trajectory
matter
  name is Trump Weakens
  description is War drags. Inflation hurts. Approval drops.
  probability is medium
  approval rating is 38
  midterm effect is liability
end
end

event trump steady
category political trajectory
matter
  name is Trump Steady
  description is Base holds. Independents drift.
  probability is high
  approval rating is 42
  midterm effect is neutral
end
end

note ═════════════════════════════════════════════════
note  FORCE 5: WORLD CUP / SOFT POWER (July 2026)
note ═════════════════════════════════════════════════

event world cup opens
category world cup phase
matter
  name is World Cup Opens
  description is July 2026. 48 nations. US hosts.
  timing is July 2026
  media focus is sports
  trump spotlight is high
end
end

event world cup distraction
category world cup phase
matter
  name is World Cup Distraction
  description is Iran war fades from headlines during games
  timing is mid July 2026
  media focus is sports
  trump spotlight is managed
end
end

event world cup finals
category world cup phase
matter
  name is World Cup Finals
  description is Championship game. Global audience billions.
  timing is late July 2026
  media focus is climax
  trump spotlight is ceremonial
end
end

event world cup boost
category soft power
matter
  name is World Cup Boost
  description is Successful WC improves global standing
  probability is medium
  effect on trump is positive coverage
end
end

event world cup backlash
category soft power
matter
  name is World Cup Backlash
  description is Iran war overshadows WC. Protests.
  probability is medium
  effect on trump is negative coverage
end
end

note ═════════════════════════════════════════════════
note  FEEDBACK LOOP EVENTS — causal chains
note ═════════════════════════════════════════════════

event oil price spike
category feedback
matter
  name is Oil Price Spike
  cause is iran stalemate
  effect on gas is 5 dollars plus
  effect on inflation is upward pressure
end
end

event voter anger
category feedback
matter
  name is Voter Anger
  cause is inflation
  effect on midterms is anti incumbent
  intensity is rising
end
end

event war fatigue
category feedback
matter
  name is War Fatigue
  cause is iran stalemate
  effect on approval is erosion
  effect on turnout is depressed
end
end

event elite panic
category feedback
matter
  name is Elite Panic
  cause is war plus inflation
  effect on gop is donors withhold
  effect on dems is fundraising spike
end
end

note ═════════════════════════════════════════════════
note  LAYERS
note ═════════════════════════════════════════════════

layer iran scenarios
  iran ceasefire holds
  iran ceasefire collapses
  iran stalemate
end

layer economy scenarios
  inflation eases
  inflation worsens
  stagflation
end

layer midterm outcomes
  gop holds house
  democrats win house
  gop expands majority
end

layer trump positions
  trump strengthens
  trump weakens
  trump steady
end

layer world cup phases
  world cup opens
  world cup distraction
  world cup finals
end

layer world cup results
  world cup boost
  world cup backlash
end

layer feedback loops
  oil price spike
  voter anger
  war fatigue
  elite panic
end

layer all forces
  iran scenarios
  economy scenarios
  midterm outcomes
  trump positions
  world cup phases
  feedback loops
end

note ═════════════════════════════════════════════════
note  TIMELINES
note ═════════════════════════════════════════════════

timeline iran war
past
end
present
  iran scenarios
end
future
end
end

timeline economy
past
end
present
  economy scenarios
end
future
end
end

timeline midterms
past
end
present
  midterm outcomes
end
future
end
end

timeline world cup
past
end
present
end
future
  world cup phases
end
end

note ═════════════════════════════════════════════════
note  PULSE — Oscillating controls (the Switch)
note ═════════════════════════════════════════════════

pulse fatigue oscillation every 1 tick

note when fatigue oscillation state is true, the public is tired of the war
note when it is false, the shock of each new strike resets attention

pulse news cycle every 2 tick

note media spotlight oscillates between Iran coverage and World Cup
note every 2 ticks the focus alternates

note ═════════════════════════════════════════════════
note  FEEDBACK CAUSAL CHAIN
note  Iran stalemate → oil spike → inflation worsens → voter anger
note ═════════════════════════════════════════════════

mark oil pressure from iran stalemate as 1
mark inflation pressure from oil spike as oil pressure
mark voter sentiment from inflation pressure as voter anger
mark donor confidence from elite panic as dropping

note ═════════════════════════════════════════════════
note  PREDICTION MODEL
note  4 predictions × 216 combos = 864 scenarios
note ═════════════════════════════════════════════════

use directions from ../prediction/directions.em
use lenses from ../prediction/lenses.em
use quantities from ../prediction/quantities.em

predict iran war
across directions
and lenses
and quantities
into all iran predictions

predict economy
across directions
and lenses
and quantities
into all economy predictions

predict midterms
across directions
and lenses
and quantities
into all midterm predictions

predict trump
across directions
and lenses
and quantities
into all trump predictions

note ═════════════════════════════════════════════════
note  RESOLVE — Granular per lens/quantity/direction
note  This is the fix: resolve by multiple dimensions
note  to get nuanced accuracy scores instead of all or nothing
note ═════════════════════════════════════════════════

note Iran: stalemate path validated via indirect other + when lens
resolve all iran predictions where direction is indirect other and lens is when as correct
resolve all iran predictions where direction is indirect other and lens is why as correct
resolve all iran predictions where direction is direct and quantity is small as correct
resolve all iran predictions where direction is keep same and lens is who as incorrect
resolve all iran predictions where lens is what and quantity is large as incorrect

note Economy: inflation path validated via more same + what lens
resolve all economy predictions where direction is more same and lens is what as correct
resolve all economy predictions where direction is indirect opposite and lens is when as correct
resolve all economy predictions where direction is indirect opposite and lens is why as correct
resolve all economy predictions where direction is keep same and lens is who as incorrect
resolve all economy predictions where direction is direct and quantity is small as incorrect

note Midterms: GOP hold resolved by lens (structural/who)
resolve all midterm predictions where lens is who as correct
resolve all midterm predictions where lens is what as incorrect
resolve all midterm predictions where lens is where as correct
resolve all midterm predictions where direction is indirect other and lens is why as correct
resolve all midterm predictions where direction is keep same as correct

note Trump: weakening validated by indirect opposite + who lens
resolve all trump predictions where direction is indirect opposite and lens is who as correct
resolve all trump predictions where direction is indirect opposite and lens is why as correct
resolve all trump predictions where direction is keep same as incorrect
resolve all trump predictions where direction is direct and quantity is small as incorrect

note ═════════════════════════════════════════════════
note  SCORE
note ═════════════════════════════════════════════════

mark iran deal chance as accuracy of all iran predictions where direction is keep same
mark iran collapse chance as accuracy of all iran predictions where direction is direct
mark iran stalemate chance as accuracy of all iran predictions where direction is indirect other

mark inflation eases chance as accuracy of all economy predictions where direction is keep same
mark inflation worsens chance as accuracy of all economy predictions where direction is more same
mark recession risk score as accuracy of all economy predictions where direction is indirect opposite

mark gop hold chance as accuracy of all midterm predictions where direction is keep same
mark dem flip chance as accuracy of all midterm predictions where direction is direct
mark gop expand chance as accuracy of all midterm predictions where direction is more same

mark trump strong score as accuracy of all trump predictions where direction is direct
mark trump weak score as accuracy of all trump predictions where direction is indirect opposite
mark trump steady score as accuracy of all trump predictions where direction is keep same

note ═════════════════════════════════════════════════
note  ZOOM — Populated with feedback loop events
note ═════════════════════════════════════════════════

zoom in on iran stalemate and inflation worsens into election tipping point

zoom out on timeline midterms as event november summary

note ═════════════════════════════════════════════════
note  EQUAL AND OPPOSITE CONTROLS
note ═════════════════════════════════════════════════

zoom opposite on iran stalemate into iran breakthrough path
zoom opposite on inflation worsens into inflation cools
zoom opposite on democrats win house into gop hold path
zoom opposite on trump weakens into trump strong path

zoom meta on iran stalemate and inflation worsens and election tipping point and feedback loops into governing conditions

note ═════════════════════════════════════════════════
note  WORLD CUP INTERFERENCE PATTERN
note  World Cup timeline is parallel to Iran timeline
note  They overlap — zoom between them shows the interference
note ═════════════════════════════════════════════════

zoom in on timeline iran war and timeline world cup into media battle ground

note ═════════════════════════════════════════════════
note  VERDICT
note ═════════════════════════════════════════════════

mark iran forecast as iran stalemate
mark economy forecast as inflation worsens
mark midterm forecast as gop holds house
mark trump forecast as trump weakens

note ── Display all prediction scores ──
show iran deal chance
show iran collapse chance
show iran stalemate chance
show inflation eases chance
show inflation worsens chance
show recession risk score
show gop hold chance
show dem flip chance
show gop expand chance
show trump strong score
show trump weak score
show trump steady score

run iran war present
run economy present
run world cup future
run election tipping point present
run media battle ground present
run governing conditions present
run november summary