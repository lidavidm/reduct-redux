==========
Start Here
==========

Let's get the game running.

If you are on MacOS, you will need to install Node, NPM, and
(optionally) Yarn through Homebrew. On Linux, use your distribution's
package manager. Windows has not been tested, but the Windows
Subsystem for Linux might work.

First, let's get the assets (sprites & audio) built.

.. code-block:: bash

   git clone https://github.coecis.cornell.edu/Reduct/reduct-assets.git
   npm install
   ./build.sh

Now, let's get the game running:

.. code-block:: bash

   git clone https://github.coecis.cornell.edu/Reduct/reduct-redux.git
   cd reduct-redux
   npm install
   mkdir dist
   # Copy assets
   cp ../reduct-assets/output/output.* resources/audio/
   cp ../reduct-assets/output/*assets.* resources/graphics
   # Symlink resources into the folder that our bundler serves
   ln -s $(pwd)/resources/ dist/resources
   npm run serve

Now open http://localhost:1234/index.html in your browser. (If you
have a Mac and it isn't set up right, you might instead have to visit
http://127.0.0.1:1234/index.html.)

Next Steps
==========

Read :doc:`architecture` to learn about the overall system design.
