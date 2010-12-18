Bundler.require

# Enable asset pipeline
require 'sinatra/asset_pipeline'
register Sinatra::AssetPipeline

# Add support for bower components
configure do
  settings.sprockets.append_path "./bower_components"
end

get "/" do
  slim :index
end
