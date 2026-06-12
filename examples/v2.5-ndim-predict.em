note EventMath v2.5 — N-Dimensional Predict + Through FRACTAL
note
note RULE: condition dimensions are not structural tiers.
note       You can have any number of condition dimensions.
note       They must pass through the three structural tiers.
note
note Structural tiers (fixed, always 3):
note   Surface  D±13  — what is directly observable
note   System   D±26  — what chain logic reveals
note   Root     D±39  — what the fractal amplifies or suppresses
note
note Condition dimensions (variable, your axes of variation):
note   industry, price tier, awareness level, buying frequency, etc.
note
note To connect them: predict ... through FRACTAL
note Without "through": flat cartesian product (no tier scoring)
note With    "through": each combination is tagged with tier context

note ── Condition dimensions ──

event healthcare industry
matter
  name is Healthcare
  category is industry
end
end

event ecommerce industry
matter
  name is Ecommerce
  category is industry
end
end

event saas industry
matter
  name is SaaS
  category is industry
end
end

event high price tier
matter
  name is High
  range is 1000 to 10000
end
end

event mid price tier
matter
  name is Mid
  range is 100 to 999
end
end

event low price tier
matter
  name is Low
  range is 1 to 99
end
end

event problem aware
matter
  name is Problem Aware
  readiness is high
end
end

event solution aware
matter
  name is Solution Aware
  readiness is mid
end
end

event unaware
matter
  name is Unaware
  readiness is low
end
end

event high frequency buyer
matter
  name is High Frequency
  purchases per year is 12
end
end

event low frequency buyer
matter
  name is Low Frequency
  purchases per year is 1
end
end

layer industries
  healthcare industry
  ecommerce industry
  saas industry
end

layer price tiers
  high price tier
  mid price tier
  low price tier
end

layer awareness levels
  problem aware
  solution aware
  unaware
end

layer buying frequency
  high frequency buyer
  low frequency buyer
end

note ── 3-dim flat (old syntax, still works) ──
note predict funnel type across industries and price tiers and awareness levels into three dim predictions

note ── 4-dim flat: compiles and runs but no tier routing ──
note predict funnel type across industries and price tiers and awareness levels and buying frequency into four dim flat predictions
note Warning: 4 condition dimensions without "through FRACTAL" evaluates combinations
note          without dimensional scoring. Add "through FRACTAL" to enforce the three tiers.

note ── Fractal axis (structural tiers) ──

spin market signal into signal torus at dimension 39
spin market noise into noise torus at dimension -39
fractal signal torus and noise torus into market axis

note ── 4-dim through fractal: tier-routed predict ──
predict funnel blueprint
  across industries
  and price tiers
  and awareness levels
  and buying frequency
  through market axis
  into funnel predictions

show funnel predictions

note
note The predict statement now:
note   1. Generates 3×3×3×2 = 54 combinations
note   2. Tags each with tier context from market axis
note      { tier1: true (D±13 active), tier2: true (D±26 active), tier3: true (D±39 active) }
note   3. Preserves backward compat: direction/lens/quantity fields still present for 3-dim
note   4. Adds canonical: dimensions[] array for all N-dim access
note
note The three tiers are structural — they evaluate HOW the prediction holds.
note The condition dimensions are combinatorial — they determine WHAT is predicted.
note They are not the same thing. "through FRACTAL" is what connects them.
