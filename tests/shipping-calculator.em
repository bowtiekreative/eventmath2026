# Shipping Cost Calculator
# Uses arithmetic to compute total shipping costs

note Shipping events record each leg of delivery; costs chain together

event base shipping
category shipping cost
matter
  carrier is Swift Deliver
  base rate is 12
  currency is USD
end
end

event fuel surcharge
category shipping cost
matter
  reason is Fuel price adjustment
  surcharge is 3
  currency is USD
end
end

event remote area fee
category shipping cost
matter
  reason is Rural delivery zone
  fee is 8
  currency is USD
end
end

event insurance
category shipping cost
matter
  coverage is standard package coverage
  premium is 5
  currency is USD
end
end

layer shipping fees
  base shipping
  fuel surcharge
  remote area fee
  insurance
end

timeline shipment

present
  shipping fees
end

end

mark base rate as 12
mark surcharge as 3
mark remote fee as 8
mark insurance as 5
mark minimum charge as 10
mark total cost as 0

set total cost to base rate plus surcharge plus remote fee plus insurance

check total cost is greater than minimum charge

when total cost is greater than 25
  run event base shipping
  run event fuel surcharge
  run event remote area fee
  run event insurance
end

run shipment present
