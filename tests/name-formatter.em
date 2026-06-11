# Name Formatter
# Format names using string operations

note String operations keep text transformation readable and accessible

event raw name entry
category user data
matter
  first name is alice
  last name is JOHNSON
  display name is alice JOHNSON
end
end

layer name entries
  raw name entry
end

timeline user names

present
  name entries
end

end

mark first name as alice
mark last name as JOHNSON
mark proper first as alice in uppercase
mark proper last as JOHNSON in lowercase
mark full name as alice joined with johnson
mark name length as length of full name

check name length is greater than 0

run event raw name entry
run user names present
