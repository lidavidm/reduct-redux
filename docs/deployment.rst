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

.. _`.nojekyll`: https://blog.github.com/2009-12-29-bypassing-jekyll-on-github-pages/
