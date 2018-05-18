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

How the View Hierarchy Works
============================

View IDs may overlap with expression IDs. In that case, the view is
the root view representing that expression. However, an expression
might have multiple associated views. To distinguish between these,
``prepare`` and ``draw`` are passed both the expression ID and the
view ID.

JSON-Defined Views
==================

Reference
=========

Utility Functions
-----------------

.. autofunction:: gfx.constant
.. autofunction:: gfx.distance
.. autofunction:: gfx.absolutePos
.. autofunction:: gfx.absoluteSize
.. autofunction:: gfx.centerPos
