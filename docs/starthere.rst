==========
Start Here
==========

We will explain, at a broad level, how reduct-redux is structured,
then link to module pages that explain how individual subsystems
work.

You should be comfortable with the following:

- ECMAScript 6/2015+
- DOM APIs like HTML5 Canvas
- General Linux/Bash command line familiarity

MDN_ is the best resource for Web API/ECMAScript questions. (W3schools
might show up on Google, but isn't generally to be trusted.)

Set Up
======

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


Next Steps
==========

Read :doc:`architecture` to learn about the overall system design.

.. _MDN: https://developer.mozilla.org/en-US/docs/Web
