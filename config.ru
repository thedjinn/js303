require "bundler"
Bundler.require

require_relative "app"

run Sinatra::Application
