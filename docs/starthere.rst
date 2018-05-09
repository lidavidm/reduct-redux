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

Architecture
============

Reduct-Redux consists of five main components:

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

State consists of the following:

These are all stored in an *immutable* store. This sounds odd, but
it's because we're using Redux_ to manage this state. Broadly
speaking, Redux follows this workflow:

1. An immutable store represents current game state.
2. In response to something the user does, the game dispatches an
   *action* to the Redux store.
3. A Redux *reducer* function interprets the action and generates a
   new store, which replaces the old one.

Syntax & Semantics
==================

gfx: Graphics Abstraction
=========================

:doc:`gfx` is our ad-hoc graphics & layout library. It has several
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
