==========
Deployment
==========

Reduct-Redux does not need anything in particular server-side.

Build the production version as follows:

.. code-block:: bash

   yarn dist

If you have SSH access to a web server, you can simply copy the files
over:

.. code-block:: bash

   rsync -raP dist/* --exclude resources user@lidavidm.me:/var/www/html/
   rsync -raP resources/ user@lidavidm.me:/var/www/html/resources

If you want to use GitHub Pages, simply copy and commit the contents
of ``dist/``. Also commit a `.nojekyll`_ file. Make sure to copy the
contents of the resources folder into the GitHub Pages repository, and
not just the symbolic link, otherwise it won't work.

Administration
==============

For use in classroom:

- The password between levels is ``cornell``.
- :kbd:`Control-F6` and :kbd:`Control-F7` go to the previous/next
  level.
- :kbd:`Control-F8` will toggle the development toolbar.
- :kbd:`Shift-F9` will reset the game. (It doesn't ask for
  confirmation, which is why it's on a different key.)

Game is Slow
============

In Google Chrome:

1. Visit chrome://flags/
2. Find "Accelerated 2D canvas". Set this to "Disabled" and restart
   Chrome.

Logging
=======

Change ``src/version.js`` to change the reported game version. (Doing
so will also clear any saved progress when the game next loads.)
Levels are logged as quests, with the end-of-chapter screen logged
as quest -1 and the title screen as quest -2.

.. _`.nojekyll`: https://blog.github.com/2009-12-29-bypassing-jekyll-on-github-pages/
