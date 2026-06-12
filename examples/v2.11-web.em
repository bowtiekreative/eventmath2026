// EventMath v2.11 — Web Layer Example
// The video editor metaphor extends to the web:
//   rain/star = tracks on the timeline (data that flows)
//   universe  = a clip template (structure for content)
//   orbit     = looping through the timeline
//   cloud     = a render view (like a clip in the timeline)
//   atmosphere = color grade on the timeline (visual style)
//   earth     = the network feed (bringing in data from outside)
//   map       = the routing table (which view plays at which path)

// ── Data Layer ─────────────────────────────────────────────────────────

// rain: a mutable data value — changes during playback
rain page title is EventMath Studio

// star: a fixed constant — set once at the start of the session
star max results is 20
star api base is /api/v1

// zone: a computed slice of data — derived from a collection
zone visible products is products filtered by active

// sky: a live context value — title, meta, env
sky document title is EventMath — Build With Time

// lens: a safe read — wraps a risky value in a try/catch
lens safe title is page title

// ── Data Structures ────────────────────────────────────────────────────

// universe: a blueprint for a data object (like a clip format)
universe Product
  field id is string
  field name is string
  field price is number
  field active is boolean
end

universe User
  field id is string
  field name is string
  field role is string
end

// ── Loops ──────────────────────────────────────────────────────────────

// orbit: loop through a collection — like scrubbing through clips
orbit product in visible products
  show product
end

// ── Error Handling ─────────────────────────────────────────────────────

// attempt: a try/collapse/always block — graceful error recovery
attempt
  earth get /api/v1/products into products
  earth get /api/v1/user into current user
collapse network error
  rain page title is Offline Mode
  show network error
always
  show loading complete
end

// ── Web Rendering ──────────────────────────────────────────────────────

// atmosphere: the style grade applied to a view (like a color grade on a clip)
atmosphere card style
  style background is white
  style border-radius is 8px
  style padding is 16px
  style box-shadow is 0 2px 4px rgba(0,0,0,0.1)
end

atmosphere hero style
  style background is linear-gradient(135deg, #1a1a2e, #16213e)
  style color is white
  style padding is 64px 32px
end

// cloud: a render view — synchronous
cloud product card
  node h2 Product Details
  node p Use orbit to loop through products
  reflect rendered content
end

// expand cloud: an async render view — fetches before rendering
expand cloud user dashboard
  earth get /api/v1/user/profile into profile
  node h1 Welcome
  node p Dashboard
  reflect profile
end

// node: a single HTML element in a view
cloud header bar
  node header Navigation
  node nav Menu
  node a Home
end

// reflect: return a value from a cloud (like outputting a clip to the timeline)
cloud greeting card
  node h2 Hello
  reflect safe title
end

// ── Network ────────────────────────────────────────────────────────────

// earth: HTTP calls — bringing in the outside world
earth get /api/v1/products into products
earth get /api/v1/user into current user
earth post /api/v1/products with new product into created product
earth put /api/v1/products/1 with updated product into saved product
earth delete /api/v1/products/1 into delete result

// travel: navigate to a path — like jumping to a timecode
travel /dashboard

// ── Routing ────────────────────────────────────────────────────────────

// map: the routing table — which view plays at which path
map
  route home / as product card
  route dashboard /dashboard as user dashboard
  route header nav /nav as header bar
end
