# EventMath v2.20 Demo — Minority Report Predictive Story Layer
#
# This example demonstrates the four new keywords:
#   story     — scan data sources for events
#   narrative — create a perspective-filtered view
#   scope     — multi-dimensional alternative mapping
#   scenario  — describe possible future states with likelihood
#
# The "Minority Report" name comes from the idea of seeing
# multiple possible futures through different lenses.

# ── Story: Scan a data source ─────────────────────────────────────
# Scan Twitter for mentions of a topic, store results in a layer

story climate_debate from twitter about "climate change" into climate_events

# Scan news outlets for the same topic

story news_coverage from news about "climate policy" into news_events

# Scan RSS feeds for tech industry news

story tech_industry from rss about "AI regulation" into tech_events

# ── Narrative: See through a specific lens ────────────────────────
# Create filtered views of the same events

narrative scientific_view of climate_debate from scientific
  mark bias_weight as 0.3
end

narrative conservative_view of climate_debate from conservative
  mark bias_weight as 0.5
end

narrative skeptical_view of news_coverage from skeptical
  mark filter_strength as 0.7
end

narrative optimistic_view of tech_industry from optimistic
  mark optimism_bias as 0.8
end

# ── Scope: Multi-dimensional alternative mapping ──────────────────
# Map alternative futures across dimensions

scope climate_risk through economic and environmental and political into climate_alternatives

scope tech_growth through regulation and innovation and market into growth_scenarios

scope political_landscape through domestic and foreign and economic into political_outcomes

# ── Scenario: Describe possible future states ─────────────────────
# Each scenario has a condition and likelihood

scenario green_revolution when carbon tax passes likely high
  mark emission_reduction as 0.4
  mark economic_impact as "positive for renewables"
end

scenario policy_stalemate when no agreement reached likely medium
  mark delay_years as 3
  mark impact as "continued uncertainty"
end

scenario tech_bubble when AI investment overheats likely low
  mark crash_severity as "moderate"
  mark affected_sectors as "tech stocks"
end

scenario global_cooperation when major powers agree likely low
  mark treaty_year as 2030
  mark expected_outcome as "binding emissions targets"
end

# ── Combine: See the full picture ─────────────────────────────────
# Use marks to store key insights from our analysis

mark total_scenarios as 4
mark primary_perspective as "scientific_view"
mark most_likely as "green_revolution"
mark risk_factors as "economic uncertainty and political division"

set climate_awareness to "high"
