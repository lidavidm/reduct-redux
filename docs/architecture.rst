============
Architecture
============

We will explain, at a broad level, how reduct-redux is structured,
then link to module pages that explain how individual subsystems
work.

You should be comfortable with the following:

- ECMAScript 6/2015+
- DOM APIs like HTML5 Canvas
- General Linux/Bash command line familiarity

MDN_ is the best resource for Web API/ECMAScript questions. (W3schools
might show up on Google, but isn't generally to be trusted.)

Reduct-Redux consists of four main components:

- an immutable representation of the core game state (expressions,
  globals, etc.), stored in Redux_,
- a syntax & semantics module that defines core expressions, parsing,
  evaluation, and other utilities,
- a graphics abstraction to draw to the screen,
- and the Stage which ties all these together.

``index.js`` loads resources, sets up the game state, loads a
semantics module, and creates the stage.

Game State
==========

*Relevant source files:* ``src/reducer``

State consists of the following:

- nodes, which are individual nodes in an abstract syntax tree;
- globals, which are mappings of global names to nodes;
- the board, which is a list of top-level nodes in the main game area;
- the toolbox, which is a list of top-level nodes in the toolbox;
- the goal, which is a list of top-level nodes in the goal.

These are all stored in an *immutable* store. This sounds odd, but
it's because we're using Redux_ to manage this state. Broadly
speaking, Redux follows this workflow:

1. An immutable store represents current game state.
2. In response to something the user does, the game dispatches an
   *action* to the Redux store.
3. A Redux *reducer* function interprets the action and generates a
   new store, which replaces the old one.

Dealing with immutability in plain ECMAScript isn't fun, so instead,
we use `Immutable.js`_, a library that provides a set of immutable
data structures and ways to easily manipulate them. Because we can't
override operators, we have to use methods like ``node.get("id")``
instead of being able to just request ``node.id``, unfortunately.

A further complication is that generally, Redux doesn't recommend
directly storing deeply nested data, like our abstract syntax
trees. Thus, we assign each node a unique numeric ID, and store nodes
in an Immutable.js Map (hashtable) from node ID to node object (which
is itself another Immutable.js Map). Nodes don't directly reference
other nodes, but instead store the IDs of parent or child
nodes. Similarly, the board, goal, and toolbox are lists of node IDs,
and the globals are a Map from name to node ID. These IDs are assigned
by a monotonically increasing counter.

Syntax & Semantics
==================

*Relevant source files:* ``src/semantics``, ``src/syntax``

The game needs to be able to parse expressions, and it needs to be
able to manipulate them. Originally, the dream behind Reduct was to be
able to support any number of different languages, and so in
Reduct-Redux, the game is written to be independent of the underlying
language presented. (In practice, there are lots of things hard-coded,
though most could be easily abstracted out.)

At a high level, expression types in Reduct-Redux are defined by
specifying JavaScript objects containing details like:

- what fields the expression has (e.g. a number has a value field),
- how many child expressions there are (a binop has a left and a right
  child),
- how to small-step reduce this expression (a binop adds the left and
  right children, assuming both are numbers),
- and so on

These are then combined by the engine with a set of general helper
functions for performing substitutions, evaluating expressions,
searching them, and so on.

gfx: Graphics Abstraction
=========================

*Relevant source files:* ``src/gfx``

:doc:`modules/gfx` is our ad-hoc graphics & layout library. It has several
quirks, which will become apparent as we explain its structure.

Stages
======

Areas of Improvement
====================

If somehow Erik, François, and Andrew don't have enough work for you,
you can try to tackle these improvements:

- HTML5 canvas performance

  Rendering performance is rather unsatisfactory, particularly because
  Reduct-Redux scales to fit the screen. I've done some limited
  profiling, and these things could be improved:

  - Static backgrounds

    Currently, everything is redrawn on every frame. However, some
    things rarely change, like the goal, toolbox, background, and so
    on. They could be drawn to a separate canvas or done in HTML, and
    layered under the main canvas. They would need to be re-rendered
    in some cases, like when the window is resized.

- Animation & tweening system conveniences
- More flexible semantics
- Stage refactoring
- Mobile support

.. _MDN: https://developer.mozilla.org/en-US/docs/Web
.. _Redux: https://redux.js.org/
.. _`Immutable.js`: https://facebook.github.io/immutable-js/
