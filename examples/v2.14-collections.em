// EventMath v2.14 — Collection Intelligence + Pipeline
// The edit suite: filter, find, sort, count, pipe, cast, log
// Video metaphor: these are the cutting-room tools.

// ── filter: cut the bad takes ─────────────────────────────────────────────
// Keep only the items that meet a condition.

rain products is void

filter product from products where product active into active products
filter product from products where product price more than 100 into premium products
filter item from cart items where item quantity more than 0 into valid items

// Expression conditions work the same as anywhere else:
filter user from users where user role is "admin" into admins
filter order from orders where order total at least 50 into qualifying orders

// ── find: scrub to a frame ────────────────────────────────────────────────
// Find the first item matching a condition, or null.

find product in products where product id is selected id into current product
find user in users where user email is login email into matched user
find item in cart items where item id is removed id into item to remove

// ── sort: reorder the timeline ────────────────────────────────────────────
// Ascending by default. descending flips it.

sort products by name into alphabetical
sort products by price into cheapest first
sort products by price descending into most expensive first
sort orders by created at descending into recent orders
sort users by last name into by last name

// ── count: frame count ────────────────────────────────────────────────────
// Count all items, or count only those matching a condition.

count products into product count
count orders into order count

count item in cart items where item quantity more than 0 into items in cart
count product from products where product active into active count
count order from orders where order status is "pending" into pending count

// ── pipe: run through effects ─────────────────────────────────────────────
// Chain a value through a sequence of transforms.
// Each transform is a function name.

rain raw email is void
pipe raw email through trim and lowercase into normalized email
pipe user input through sanitize and validate and encode into safe input
pipe image data through resize and compress and watermark into final image

// ── cast: format conversion ───────────────────────────────────────────────
// Convert a value to number, text, or boolean.

rain raw count is void
cast raw count as number into count
cast count as text into count label
cast count as boolean into has items

// ── log: timeline markers ─────────────────────────────────────────────────
// Debug output with source line reference baked in.

log count
log active count
log "Product count:" with product count
log "Pending orders:" with pending count
log a plus b

// ── Reactive lens + collections ───────────────────────────────────────────
// live rain signals flow into lenses that auto-recompute.

live rain price is 0
live rain quantity is 0
live rain discount is 0

lens subtotal is price times quantity
lens after discount is subtotal minus discount
lens tax is after discount times 0.09
lens total is after discount plus tax
lens free shipping is after discount at least 50
lens order valid is quantity more than 0 and price more than 0

// ── Full example: product catalog ─────────────────────────────────────────
expand cloud catalog
  on birth
    earth get /api/products into products
    earth get /api/categories into categories
  end

  rain search term is void
  rain selected category is void
  live rain cart count is 0

  filter product from products where product active into visible products

  match selected category
    arm void
      rain filtered is visible products
    arm else
      filter product from visible products where product category is selected category into filtered
  end

  sort filtered by name into display products

  count item in cart items where item quantity more than 0 into cart count
  lens cart count is cart count

  find product in display products where product id is featured id into featured

  log "Products shown:" with display products
  log "Cart count:" with cart count

  show catalog view
end

// ── Data processing pipeline ──────────────────────────────────────────────
expand cloud process upload
  await fetch raw data into raw data
  cast raw data as text into text data
  pipe text data through trim and parse json and validate schema into clean data
  guard clean data is not void else reflect void
  rain processed is clean data
  log "Processed:" with processed
  reflect processed
end
