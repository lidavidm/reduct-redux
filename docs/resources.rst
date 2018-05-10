======================================
Resources: Levels, Graphics, and Audio
======================================

Apart from code, Reduct-Redux has to load quite a few assets, many of
which are bundled for efficiency. They also aren't handled by the
build system, so you'll have to manage them manually.

Level Definition Format
=======================

Levels are simply JSON objects, defined as follows:

.. code-block:: javascript

   {
       "board": [
           // List of strings of code
           "(x => x)(1)"
       ],
       "goal": [
           // List of strings of code
           "1"
       ],
       "textgoal": "This is the textual goal (optional)",
       "globals": {
           // Map of names to strings of code
           "twice": "function twice(f) { return (x) => f(f(x)); }"
       },
       "toolbox": [
           // List of strings of code
       ],
       // Currently disabled
       // List of syntax JSON files
       "syntax": [],
       "animationScales": {
           // Map of animation scale names to scale values
           "expr-apply": 1.5
       },
       "fade": {
           // Map of expression types to fade indices
           "reference": 1
       }
   }

The only required fields are ``board``, ``goal``, and
``toolbox``. (Any of these can be an empty list, though.) Notes on
special fields:

``animationScales``
  Animations can be sped up or slowed down in particular levels. These
  settings persist in future levels until overridden. The engine
  generates a scale for each expression type, e.g. if an expression
  ``conditional`` is defined, then there will be a scale called
  ``expr-conditional``. There is also a scale called ``multi-step``
  that controls the duration of the pause between steps in a
  reduction.

``fade``
  Expressions can have different variants at different points in the
  game. This is an application of *concreteness fading*, the focus of
  the first version of Reduct. This property allows you to control
  which variant of the specified expression is used, and is also
  persistent in future levels.

``syntax``
  There is a (commented-out) feature called the syntax journal, which
  gives a reference manual of constructs that the player has learned
  so far. This field adds a new page to the manual. Values should be
  the filename (without extension) of a syntax JSON file (look at
  ``levels-progression/syntax-add.json`` for an example).

``textgoal``
  In addition to the goal, you can specify some text to serve as a
  hint or description. The text will automatically wrap.

  A templating system allows you to refer to primitives (like
  circles/hamburgers) without having to hardcode their names. For
  instance, ``{star}`` and ``{a star}`` will change to "burger" and "a
  burger" if the junk food theme is chosen.

  For more on customizing this, see :ref:`Miscellaneous Hooks`.

``showConcreteGoal``
  If ``textgoal`` is specified, set this to ``false`` to prevent the
  regular goal from showing. Defaults to ``true``.

Levels are arranged into chapters, which are JSON files:

.. code-block:: javascript

   {
       "chapterName": "Application",
       "description": "Introduction to function application",
       // Unused, I think?
       "language": "JavaScript",
       // For the summer 2018 study
       "password": "aardvark",
       "levels": [
           // …list of level objects…
       ],
       "resources": {
           "aliens": [
               // List of alien sprites to use
               "alien-bag-1",
               "alien-function-1",
               "alien-bag-2",
               "alien-function-2",
               "alien-bag-3",
               "alien-function-3"
           ]
       }
   }

Chapters are organized within the code (``src/game/progression.js``):

.. code-block:: javascript

   export const PROGRESSIONS = {
       "Elementary": {
           dir: "levels-progression/",
           digraph: {
               "functions": ["replication"],
               "replication": ["multiargument"],
               "multiargument": ["functions-challenge"],
               "functions-challenge": ["application"],
               "application": ["definition"],
               "definition": ["testing"],
               "testing": ["higher-order-functions"],
               "higher-order-functions": ["define-challenges"],
               "define-challenges": ["booleans-intro"],
               "booleans-intro": ["booleans-definition"],
               "booleans-definition": ["weekdays"],
               "weekdays": ["recursion-basics"],
               "recursion-basics": ["recursion-higher-order"],
               "recursion-higher-order": [],
           },
       },
   };

Technically, this specifies a directed graph of chapter dependencies,
where each key in the map specifies a list of chapters that depend on it.

Sprites & Audio
===============

To make loading faster, Reduct-Redux doesn't load individual sprites
or audio files. Instead, it expects them to have been combined into
spritesheets or audio sprites, and loads them all at once. (You can
see this at the start of ``src/index.js``.) However, these have to be
generated from the original sprites. There are some Bash scripts to
somewhat automate this process, detailed below.

As of right now, most of the original assets are not present in this
repository, and will have to be pulled from the original Reduct. Some
new sprites not present in the original Reduct are loaded in a
separate spritesheet and can be generated from this repository.

Command-Line Tools
==================

Spritesheets
------------

Audio Sprites
-------------

These must be generated from the original Reduct.

chapterutil
===========

This is a tool that can convert levels between the JSON representation
and a CSV representation, allowing people to collaboratively edit the
progression. It is not round-trippable, as it is fairly loose in the
kinds of CSV files it accepts, but also does not preserve all columns
in the CSV when converting to JSON. The best approach is to export
levels from JSON to CSV once, then only ever edit the levels in CSV
format.

Requirements:

- Python 3.6
- virtualenv
- Bash

Setup:

.. code-block:: bash

   cd chapterutil/
   virtualenv venv
   source venv/bin/activate
   pip install -r requirements.txt

If you download the file from Google Docs as XSLX, this script will
automatically import all sheets in the XSLX:

.. code-blocK:: bash

   source venv/bin/activate
   ./automate.sh path/to/progression.xslx
