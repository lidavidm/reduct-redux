===
gfx
===

``gfx`` is our graphics library, built on top of `HTML5 Canvas`_. It
is structred as an indirectly built tree of views, each of which has a
unique numeric ID. Views are objects:

.. autoclass:: gfx.baseProjection
   :members:

.. _`HTML5 Canvas`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D

Allocating IDs
==============

Use :func:`module:BaseStage.allocate`. (You'll also see
``allocateInternal``, but this should be considered deprecated.) Note
that allocating an ID for a view does not mean it will be
automatically drawn for you. Also note that this shouldn't be used for
views associated with a particular expression; use
:func:`module.project` instead.

How the View Hierarchy Works
============================

View IDs may overlap with expression IDs. In that case, the view is
the root view representing that expression. However, an expression
might have multiple associated views. To distinguish between these,
``prepare`` and ``draw`` are passed both the expression ID and the
view ID.

To give views children views, as with something like
:class:`gfx.layout.hbox`, views take a function that returns a list of
children. This function is passed an expression ID and the current
state, and should return a list of either child expression IDs, or
pairs of ``[ childViewId, childExprId ]``. (There is a utility
function that normalizes these two cases.) This allows the children of
a layout to change based on the state (e.g. so a ``+`` block can use
an ``hbox`` to position its children). In case you don't need this
dynamism, there is :func:`gfx.constant`.

Most of the time, you will be using JSON-defined views, and won't have
to deal with this.

This diagram might help::

  Store                           Stage
  ==============================  =======================

  ID     Expression               ID     View
  --     -----------------------  --     ----------------
   0 --> { type: "number", ... }   0 --> { ... }
   1 --> { type: "number", ... }   1 --> { ... }
   2 --> { type: "binop",          2 --> { childrenFunc }
           left: 0,
           right: 1 }

  childrenFunc:

  for (const id of childrenFunc(2, state)) {
      console.log(id);
  }
  // Prints:
  // 0
  // 1

JSON-Defined Views
==================

The semantics definition system includes a system for defining how
expressions are displayed in JSON (well, "JSON" since we embed
functions). The best reference is to look at other expressions and
modify them to suit your purposes.

.. code-block:: js

   import projector from "./gfx/projector";

.. autofunction:: gfx.projector.projector

   This is your interface to the JSON-defined view system; you
   shouldn't need to call any of the other projectors listed below
   directly. (Indeed, you shouldn't need to use this directly,
   either.)

.. autofunction:: gfx.projector.defaultProjector
.. autofunction:: gfx.projector.textProjector

There are many more projectors, just undocumented. Look at
``src/gfx/projector.js``.

gfx Reference
=============

Utility Functions
-----------------

.. autofunction:: gfx.constant
.. autofunction:: gfx.distance
.. autofunction:: gfx.absolutePos
.. autofunction:: gfx.absoluteSize
.. autofunction:: gfx.centerPos

Built-In Views
--------------

.. autoclass:: gfx.rect
.. autoclass:: gfx.roundedRect
.. autoclass:: gfx.hexaRect
.. autoclass:: gfx.dynamic
.. autoclass:: gfx.dynamicProperty
.. autoclass:: gfx.text
.. autoclass:: gfx.layout.expand
.. autoclass:: gfx.layout.hexpand
.. autoclass:: gfx.layout.sticky
.. autoclass:: gfx.layout.hbox
.. autoclass:: gfx.layout.vbox
.. autoclass:: gfx.layout.ratioSizer
.. autoclass:: gfx.layout.ratioPlacer
.. autoclass:: gfx.shapes.circle
.. autoclass:: gfx.shapes.rectangle
.. autoclass:: gfx.shapes.star
.. autoclass:: gfx.shapes.triangle
.. autoclass:: gfx.sprite
.. autoclass:: gfx.patch3
.. autoclass:: gfx.exprify
.. autoclass:: gfx.ui.button
.. autoclass:: gfx.ui.imageButton

.. autoattribute:: gfx.viewport.IS_PHONE
.. autoattribute:: gfx.viewport.IS_TABLET
.. autoattribute:: gfx.viewport.IS_MOBILE
