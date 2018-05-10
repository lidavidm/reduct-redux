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

Read More: :doc:`modules/reducer` (in particular, :ref:`Mutable vs
Immutable Expressions`).

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
searching them, and so on. (In some sense, this is like an OCaml
functor, where you provide a base module and the functor augments it.)

Here's an example of an expression definition:

.. code-block:: javascript

   // Application block
   {
       kind: "expression",
       fields: [],
       subexpressions: ["callee", "argument"],
       reductionOrder: ["argument", "callee"],
       projection: {
           type: "decal",
           content: {
               type: "default",
               shape: "()",
               fields: ["callee", "'('", "argument", "')'"],
           },
       },
       stepAnimation: (semant, stage, state, expr) => {
           // …snip…
       },
       stepSound: "heatup",
       validateStep: (semant, state, expr) => {
           const callee = state.getIn([ "nodes", expr.get("callee") ]);
           const kind = semant.kind(callee);
           if (kind === "value" && callee.get("type") !== "lambda") {
               return [ expr.get("callee"), "We can only apply functions!" ];
           }
           return null;
       },
       smallStep: (semant, stage, state, expr) => {
           const [ topNodeId, newNodeIds, addedNodes ] = semant.interpreter.betaReduce(
               stage,
               state, expr.get("callee"),
               [ expr.get("argument") ]
           );
           return [ expr.get("id"), newNodeIds, addedNodes ];
       },
   },

In particular, note the ``projection`` field, which is the convenient
interface to the graphics abstraction described below.

gfx: Graphics Abstraction
=========================

*Relevant source files:* ``src/gfx``

:doc:`modules/gfx` is our ad-hoc graphics & layout library.

A *view* (also *projection*) is an object with two methods:
``prepare(viewId, exprId, state, stage)`` and
``draw(viewId, exprId, state, stage, offset)``. The former is used to
do any layout calculations or update any state, and the latter
actually draws to the canvas context.

First, note that views aren't directly coupled to a particular node:
it's passed when drawing. Views can't keep direct references to nodes,
because if the store were to change, the view would have a reference
to the old copy of the node (since they're immutable). Consequently,
views can't even directly have child views: *view hierarchy is
implicit*. A view that represents an expression and its children
doesn't know what the expression is until it draws; thus, it can't
know what the child views are either!

Thus, we give views a unique numeric ID as well. This comes from the
same pool as expression IDs; an expression, if drawn, has a top-level
view with the same ID. However, an expression might have multiple
views associated. (TODO: add gfx docs and explain how this happens).

*Projecting* (verb) is what creates the associated views for an
expression. This is what takes the JSON representation above and
builds the view hierarchy.

Stages
======

Stages tie the previous three systems together: given a store and a
semantics module, it creates and renders views. They are a relatively
minimal abstraction; they don't even provide a scene graph, and need
to manually specify everything to be rendered. Most helper code lives
here; for instance, when an expression is clicked, the stage calls out
to the semantics module, registering callbacks to update its store
whenever a step is taken, and updates the views after each step.

.. _MDN: https://developer.mozilla.org/en-US/docs/Web
.. _Redux: https://redux.js.org/
.. _`Immutable.js`: https://facebook.github.io/immutable-js/
