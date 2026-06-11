# E-Commerce Order Fulfillment
# An order moves through stages as events on a timeline
# Split on status routes the order to the right handler

note An order lifecycle from placement through delivery

event order placed
category order
matter
  order id is ORD-2026-001
  customer name is Jordan Lee
  item count is 3
  order total is 299.99
end
end

event payment verified
category payment
matter
  payment method is credit card
  amount charged is 299.99
  payment status is approved
end
end

event items packed
category fulfillment
matter
  packed by is Riley Chen
  pack time is 8 minutes
  package weight is 2.4 kg
end
end

event handed to courier
category shipping
matter
  courier is Swift Deliver
  tracking number is SD-88271-XK
  estimated days is 2
end
end

layer order lifecycle
  order placed
  payment verified
  items packed
  handed to courier
end

timeline order journey

present
  order lifecycle
end

end

mark order status as new
mark fulfilled as false

split order status into

path new
  set order status to payment pending
  run event order placed
end

path payment pending
  set order status to packing
  run event payment verified
end

path packing
  set order status to shipped
  run event items packed
  run event handed to courier
  set fulfilled to true
end

end

when fulfilled is true
  run order journey present
otherwise
  run event order placed
end
