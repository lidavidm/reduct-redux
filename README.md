reduct-redux
============

Setup
-----

Install the necessary packages and run the bundler.

*Choose one of the two below:*

Yarn:

```
yarn install
mkdir dist
# Symlink resources into the folder that our bundler serves
ln -s $(pwd)/resources/ dist/resources
yarn serve
open http://localhost:1234/index.html
```

NPM:

```
npm install
mkdir dist
# Symlink resources into the folder that our bundler serves
ln -s $(pwd)/resources/ dist/resources
npm run serve
open http://localhost:1234/index.html
```

Distribution
------------

If you use Yarn: run `yarn dist`

If you use NPM: run `npm run dist`

The production version of Reduct will be in the `dist/` folder, like so:

```
$ ls dist
7a8f62b47d6afa44523f2b4bfacf0304.png  index.html
7d4e14db6c871b054b74a4c5b2bc2367.js   reduct-redux.js
a18342a55b8501c4686ae638f58cd800.js   reduct-redux.map
d004428b9d33a5c3a235b1f80a1a6641.png  resources
```

(Remember, `resources` is a symlink that you created above.)

Now you can copy the contents of this directory to a web server.

Debugging
---------

The password to skip levels in the production version is
`cornell`. You can enable this during development by appending
`?nodev` to the URL. Conversely, in production, appending `?dev` to
the URL will enable development mode.

If the build system gets confused and doesn't seem to pick up changes
to files, delete the `.cache` folder in the project directory and try
again.

Importing Levels
----------------

1. Go to the `chapterutil` directory. Make sure you have Python 3 and
   virtualenv installed.

   MacOS instructions:
   http://docs.python-guide.org/en/latest/starting/install3/osx/

   Then install virtualenv: `pip install virtualenv`

1. Set up chapterutil:

   ```
   # All of these must be run IN THE SAME TERMINAL
   virtualenv -p python3 venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

1. Download the sheet from Google Sheets as XSLX.
1. Create any JSON files for chapters that did not previously
   exist. (Just copy an existing JSON file and edit its title/name. To
   preserve continuity of what aliens appear, try to copy the chapter
   immediately preceding the new chapter.)
1. Run the following script: `bash automate.sh
   PATH/TO/XLSX/FILE.xlsx`. Again, this must be run from the same
   terminal as previously.

   If you're running this and have previously set it up, run `source
   venv/bin/activate` first.

   It might spit out warnings about not being able to import things -
   this is caused by the rows in the spreadsheet that just contain
   notes.

Generating Spritesheets
-----------------------

TODO: