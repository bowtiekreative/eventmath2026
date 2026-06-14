note v2.21 — Intelligence Layer: Minority Report Edition

authorize intelligence audit
  scope is "local network and public data"
  target is "own network"
end

note ─ Story Collection ─────────────────────────────────────────
story washington landscape
  fetch news about "Washington DC events" into dc events
  fetch web about "fast food closures" into food news
  fetch signals about "political activity" into dc politics
  compose dc events and food news and dc politics
end

note ─ Behavioral Correlation (Emerge) ──────────────────────────
emerge trump correlations
  from washington landscape
  subject "Donald Trump"
  preference "McDonald's" and "golf" and "Twitter"
  trigger "criticism" and "routine disruption" and "business closure"
  reaction "public statement" and "Twitter post" and "media attack"
  threshold unusual
  into emergent findings
end

show emergent findings

note ─ Network Intelligence ──────────────────────────────────────
wifi map network into home devices
show home devices

note ─ OSINT Lookups ─────────────────────────────────────────────
lookup phone "202-456-1414" into whitehouse contact
lookup email "press@whitehouse.gov" into press account
show whitehouse contact
show press account

note ─ Public Feed Monitoring ────────────────────────────────────
watch cameras near "Washington DC" into dc camera list
show dc camera list

watch feed at "https://ddot.dc.gov/cams/traffic.mjpg" for 10 seconds into traffic sample
show traffic sample
