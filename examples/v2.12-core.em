// EventMath v2.12 — Core Language Completion
// Every keyword here maps directly to the video-editor metaphor
// AND to a familiar web development concept.

// ── Modules: pull things in, emit things out ───────────────────────────
// Like loading assets onto your timeline before you can use them
pull format date and slugify from utils
pull User and Planet from universes

emit star version
emit cloud planet card

// ── void: intentional emptiness ──────────────────────────────────────
// Like a blank frame — nothing there, on purpose
rain deleted at is void
rain session token is void
rain current user is void

// ── guard: early exit if something's wrong ────────────────────────────
// Like a pre-roll check — abort the sequence if conditions aren't met
guard session token else reflect void
guard current user else reflect void

// ── match: clean pattern switching ───────────────────────────────────
// Like a routing decision on the timeline: which clip plays here?
rain status is loading

match status
  arm loading
    show loading screen
  arm ready
    show dashboard
  arm error
    show error state
  arm else
    show not found
end

// ── escape and skip: loop control ─────────────────────────────────────
// escape = cut the clip early (break)
// skip   = skip this frame (continue)
rain items is active list
orbit item in items
  when item deleted
    skip
  when item id is target id
    escape
  show item
end

// ── observe: watch a value and react ─────────────────────────────────
// Like a motion tracker — when this changes, do something
observe current user
  when current user
    ground set user cache is current user
  end
end

// ── Lifecycle: birth, shift, death ────────────────────────────────────
// Like the start, middle, and end of a clip's life on the timeline

on birth
  ground get session token into stored token
  rain session token is stored token
end

expand on birth
  earth get /api/user into current user
  trigger user loaded with current user
end

on shift
  show status bar
end

on death
  clear sync timer
  off data updated
  ground remove session token
end

// ── Events: listen, fire, remove ─────────────────────────────────────
// Like track automation — certain signals trigger certain responses

on data updated
  observe status
    show sync badge
  end
end

on app error
  match status
    arm loading
      show loading error
    arm else
      show general error
  end
end

off stale listener

trigger app ready
trigger page viewed with page data

// ── Timers: every and clear ───────────────────────────────────────────
// Like a click track — steady recurring pulses

every 30000 sync data into sync timer
every 5000 ping health into health timer
clear health timer

// ── ground: persistent storage ───────────────────────────────────────
// Like saving your project to disk — survives the session
ground set user name is ryan
ground set theme is dark
ground get user name into cached name
ground get theme into current theme
ground remove stale cache

// ── new: create an instance from a schema ────────────────────────────
// Like duplicating a clip template and filling in the details
new User into current user
new Planet into draft planet

// ── burst: spread one object into another ────────────────────────────
// Like merging two audio tracks into one stem
burst defaults and user config into final config
burst base styles and overrides into merged styles

// ── raindrop: form input fields ──────────────────────────────────────
// Like a control surface input — a knob, slider, or text field
cloud login form
  raindrop text username
  raindrop email contact
  raindrop password secret
  raindrop select role
  raindrop checkbox remember me
  raindrop textarea bio
end

// ── await: explicitly wait for an async result ───────────────────────
// Like waiting for a render to finish before playing the next clip
expand cloud load dashboard
  await fetch user data into user data
  await fetch planet list into planets
  reflect planets
end

// ── slot: children content placeholder ───────────────────────────────
// Like a gap in the timeline where you drop in content later
cloud modal wrapper
  node div header
  slot content
  node div footer
end

// ── guard chain: multi-step validation ───────────────────────────────
cloud process order
  guard current user else reflect void
  guard draft planet else reflect void
  trigger order submitted with draft planet
end

// ── Full example: authenticated dashboard ────────────────────────────
expand cloud dashboard
  on birth
    ground get session token into token
    guard token else reflect void
    await earth get /api/user into current user
    rain status is ready
  end

  match status
    arm ready
      show dashboard content
    arm else
      travel /login
  end

  every 60000 refresh session into session timer

  on death
    clear session timer
    trigger session ended
  end

  cloud content area
    slot main content
  end
end
