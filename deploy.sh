#!/bin/bash

if ([ $TRAVIS_BRANCH == "master" ] && [ $TRAVIS_PULL_REQUEST == "false" ])
then
  set -e # exit with nonzero exit code if anything fails

  # clear and re-create the out directory
  rm -rf out || exit 0;
  mkdir out;  

  # generate required files
  node generate-index.js  

  # copy over files to out folder
  cp -r public/* out/
  cp -r src out/
  cp -r indexes out/
  # go to the out directory and create a *new* Git repo
  cd out
  git init  

  # inside this git repo we'll pretend to be a new user
  git config user.name "Karthik Balakrishnan"
  git config user.email "karthikb3531@gmail.com"  

  # The first and only commit to this new Git repo contains all the
  # files present with the commit message "Deploy to GitHub Pages".
  git add .
  git commit -m "Deploy to GitHub Pages"  

  # Force push from the current repo's master branch to the remote
  # repo's gh-pages branch. (All previous history on the gh-pages branch
  # will be lost, since we are overwriting it.) We redirect any output to
  # /dev/null to hide any sensitive credential data that might otherwise be exposed.
  git push --force --quiet "https://${GH_TOKEN}@${GH_REF}" master:gh-pages > /dev/null 2>&1
  echo 'Build successful, deployed to gh-pages.'
else
  echo "Build successful, but not deploying!"
fi
