# Reading Progress Tracker
# For learners who track books and reading goals

note A reading tracker where every book finished is an event to celebrate

event book one finished
category reading milestone
matter
  title is The Hobbit
  pages is 310
  rating is loved it
end
end

event book two finished
category reading milestone
matter
  title is A Wrinkle in Time
  pages is 218
  rating is really good
end
end

event book three finished
category reading milestone
matter
  title is The Giver
  pages is 179
  rating is important and moving
end
end

layer reading list
  book one finished
  book two finished
  book three finished
end

timeline reading year

present
  reading list
end

end

mark pages read as 0
mark goal pages as 500
mark books finished as 3
mark minimum books as 2

set pages read to 310
set pages read to pages read plus 218
set pages read to pages read plus 179

check books finished is greater than minimum books
check pages read is greater than goal pages

when pages read is greater than goal pages
  run reading year present
otherwise
  broken event reading goal not yet reached
  matter
    pages so far is 707
    pages needed is 500
    message is You have already exceeded your goal this year
  end
  end
end

run reading year present
