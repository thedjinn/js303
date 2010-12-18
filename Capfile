load 'deploy' if respond_to?(:namespace)

set :ssh_options, { :forward_agent => true }

set :application, "js303"
set :user, "deploy"
set :use_sudo, false
set :stage, :production

set :scm, :git
set :scm_verbose, true
set :git_enable_submodules, 1
set :repository, "ssh://djinn@zooi.koffietijd.net:22223/home/djinn/git/js303"
set :branch, "master"
set :deploy_via, :remote_cache
set :deploy_to, "/home/#{user}/apps/#{application}"

set :vps, "vps1.koffietijd.net"
role :app, vps
role :web, vps
role :db,  vps, :primary => true

set :runner, user
set :admin_runner, user

set :current_path { fetch(:deploy_to) }
set(:latest_release)  { fetch(:current_path) }
set(:release_path)    { fetch(:current_path) }
set(:current_release) { fetch(:current_path) }

set(:current_revision)  { capture("cd #{current_path}; git rev-parse --short HEAD").strip }
set(:latest_revision)   { capture("cd #{current_path}; git rev-parse --short HEAD").strip }
set(:previous_revision) { capture("cd #{current_path}; git rev-parse --short HEAD@{1}").strip }

namespace :deploy do
  task :default do
    update
    restart
  end

  task :setup, :except => { :no_release => true } do
    dirs = [deploy_to, shared_path]
    dirs += shared_children.map { |d| File.join(shared_path, d) }
    run "#{try_sudo} mkdir -p #{dirs.join(' ')} && #{try_sudo} chmod g+w #{dirs.join(' ')}"
    run "git clone #{repository} #{current_path}"
  end
  
  task :update do
    transaction do
      update_code
    end
  end

  desc "Update the deployed code."
  task :update_code, :except => { :no_release => true } do
    run "cd #{current_path}; git fetch origin; git reset --hard #{branch}"
    #run "cd #{current_path}; rm public/stylesheets/*.css; rm -fr tmp/sass-cache"
    finalize_update
  end
  
  desc "Update the database (overwritten to avoid symlink)"
  task :migrations do
    update_code
    #migrate
    restart
  end
  
  namespace :rollback do
    desc "Moves the repo back to the previous version of HEAD"
    task :repo, :except => { :no_release => true } do
      set :branch, "HEAD@{1}"
      deploy.default
    end
  
    desc "Rewrite reflog so HEAD@{1} will continue to point to at the next previous release."
    task :cleanup, :except => { :no_release => true } do
      run "cd #{current_path}; git reflog delete --rewrite HEAD@{1}; git reflog delete --rewrite HEAD@{1}"
    end
    
    desc "Rolls back to the previously deployed version."
    task :default do
      rollback.repo
      rollback.cleanup
    end
  end

  [:start, :stop, :migrate].each do |t|
    task t do ; end
  end

  task :restart, :roles => :app, :except => { :no_release => true } do
    # Restart Passenger
    run "#{try_sudo} touch #{File.join(current_path, 'tmp', 'restart.txt')}"
  end
end
