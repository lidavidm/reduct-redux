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

Concreteness Fading
-------------------

Sprites & Audio
===============

Command-Line Tools
==================

Spritesheets
------------

Audio Sprites
-------------

chapterutil: Importing/Exporting Levels from/to CSV
---------------------------------------------------
