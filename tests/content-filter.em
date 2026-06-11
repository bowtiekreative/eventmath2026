# Content Filter
# Check messages for problems using string conditions and compound logic

note Every message is an event; compound conditions route to the right handler

event welcome message
category message
matter
  text is Welcome to EventMath
  sender is system
  type is info
end
end

event error report
category message
matter
  text is Error in action make requirement
  sender is compiler
  type is error
end
end

event user question
category message
matter
  text is How do I create a timeline
  sender is user
  type is question
end
end

layer inbox
  welcome message
  error report
  user question
end

timeline message feed

present
  inbox
end

end

mark filter active as true
mark error count as 0

walk inbox as current message
  when current message type is error and filter active is true
    set error count to error count plus 1
    run current message
  end
  when current message type is info or current message type is question
    run current message
  end
end

check error count is at most 5

run message feed present
