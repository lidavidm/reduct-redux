reduct-redux
============

Setup
-----

First, create a `resources` folder with the following (you can copy this from a build of Reduct 1.0):

```
resources/:
graphics/  levels-progression/

resources/graphics:
assets.json*  assets.png  menu-assets.json  menu-assets.png

resources/levels-progression:
application.json  functions.json       recursion.json          weekdays.json
arithmetic.json   booleans-intro.json  define-challenges.json  definition.json
```

Then install the necessary packages and run the bundler.

Yarn:

```
yarn install
mkdir dist
# Symlink resources into the folder that our bundler serves
ln -s resources/ dist/resources
yarn serve
open http://localhost:1234/index.html
```

NPM:

```
npm install
mkdir dist
# Symlink resources into the folder that our bundler serves
ln -s resources/ dist/resources
npm run serve
open http://localhost:1234/index.html
```
