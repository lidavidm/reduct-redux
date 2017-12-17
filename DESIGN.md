# Design

## Redux Reducer/Store/Actions

The program state is stored in a Redux store, using Immutable.js data structures. Because Redux considers deeply nested structures (like an AST) unidiomatic, each node is assigned a unique ID. The ID is associated to the node itself in the `nodes` component of the store. Each node stores the ID of child nodes, instead of directly referencing the nodes. The store also contains `toolbox`, `board`, `goal`, which list IDs of the top-level nodes that make up each.

The reducer is wrapped by a helper function that adds undo/redo functionality. Each time an action is dispatched to the store, the board & toolbox are saved, and the positions of nodes are saved.

## Stage/Projections/gfx

Each node is associated with a "projection" which is a record of drawing state, plus layout and rendering functions. These are mutable and stored outside of Redux. The hope is that we can produce complex visuals by composing graphics primitives, instead of tying rendering into the expressions themselves. For instance, we have primitives for vertical and horizontal layout, for stretching content to the width of the stage (which the toolbox uses), and so on.

Nesting expressions is a little awkward; you provide a primitive like `hbox` a function that, given an expression, returns the IDs of any child projections. (The IDs can't be determined when the projection is constructed, as the expression might change over time.)

Each projection also receives an ID; if the projection is directly associated with a node, the node ID and projection ID should correspond.

## Semantics

A semantics module defines a bunch of helper functions currently, including evaluation and so on. It needs to be passed around to various other modules, as they need its helper functions.
