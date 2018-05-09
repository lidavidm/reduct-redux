==========
Start Here
==========

First, let's get the game running.

*Choose one of the two below:*

Yarn::

  yarn install
  mkdir dist
  # Symlink resources into the folder that our bundler serves
  ln -s $(pwd)/resources/ dist/resources
  yarn serve

NPM::

  npm install
  mkdir dist
  # Symlink resources into the folder that our bundler serves
  ln -s $(pwd)/resources/ dist/resources
  npm run serve

Now open http://localhost:1234/index.html in your browser. (If you
have a Mac and it isn't set up right, you might instead have to visit
http://127.0.0.1:1234/index.html.)

Next Steps
==========

Read :doc:`architecture` to learn about the overall system design.