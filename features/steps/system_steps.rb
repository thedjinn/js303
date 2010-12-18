When /^I submit the following song to the storage url:$/ do |table|
  post_params = {}
  table.hashes.each do |hash|
    post_params[hash["field"]] = hash["value"]
  end
  post "/store", post_params
end

Then /^I should get a six digit hash$/ do
  response.body.should match(/[0-9a-fA-F]{6}/)
end

Then /^I should get an "([^"]*)" error$/ do |message|
  response.body.should eq(message)
end

Given /^there is a song with hash (.*)$/ do |hash|
  redis = Redis.new
  song = "jsondata"
  redis.set("js303:#{hash}",song)
  redis.zincrby("js303:songs",0,hash)
end

Given /^there is no song with hash (.*)$/ do |hash|
  redis = Redis.new
  redis.del("js303:#{hash}")
  redis.del("js303:#{hash}:meta")
  redis.zrem("js303:songs",hash)
end

When /^I go to (.*)$/ do |location|
  case location
  when "the storage url"
    visit "/store"
  when "the front page"
    visit "/"
  when "the stylesheet"
    visit "/style.css"
  else
    if location.match(/^the page for the song with hash (.*)$/)
      visit "/s/#{$1}"
    else
      pending
    end
  end
end

Then /^I should( not)? see javascript for a song$/ do |negate|
  if negate
    response.should_not match(/var song=.*;/)
  else
    response.should match(/var song=.*;/)
  end
end

Then /^I should( not)? get a (\d+) error$/ do |negate, code|
  if negate
    response.status.should_not eq(code.to_i)
  else
    response.status.should eq(code.to_i)
  end
end
