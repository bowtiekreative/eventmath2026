# Inventory Check System
# When stock runs low a broken event records the problem on the timeline

note Inventory events track every stock change as an auditable record

event restock received
category inventory
matter
  item is Mechanical keyboards
  quantity added is 50
  supplier is TechParts Co
end
end

event sale completed
category inventory
matter
  item is Mechanical keyboards
  quantity sold is 45
  customer is Northside Office Supplies
end
end

event stock check
category inventory
matter
  item is Mechanical keyboards
  current stock is 5
  minimum threshold is 10
end
end

layer keyboard inventory
  restock received
  sale completed
  stock check
end

timeline warehouse

present
  keyboard inventory
end

end

mark current stock as 5
mark minimum stock as 10
mark reorder needed as false

when current stock is less than minimum stock
  broken event low stock alert
  matter
    item is Mechanical keyboards
    current level is 5 units
    minimum level is 10 units
    next step is Place reorder with TechParts Co immediately
  end
  end
  set reorder needed to true
end

when reorder needed is true
  run warehouse present
end
