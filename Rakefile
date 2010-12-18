ROOT = File.dirname(__FILE__)

task :default do
  chdir ROOT
  sh "sass --scss src/style.scss site/css/style.css"
  cp "vendor/jquery-ui-dial/jquery.ui.dial.js", "site/js/jquery.ui.dial.js"
end

task :sass do
  chdir ROOT
  sh "sass --scss --watch src/style.scss:site/css/style.css"
end
