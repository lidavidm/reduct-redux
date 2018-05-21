=====
Stage
=====

The stage is what ties all the separate systems together. Subclasses
of a base stage are used for different scenes in the game (title
screen, levels, inter-chapter screen). Roughly, the structure is as
follows:

1. The stage specifies input handlers (via ``TouchRecord``, see
   below).
2. Input handlers call helper methods on the stage.
3. Helper methods use semantics functions to decide what to change/how
   to change expressions, and may provide callbacks to these semantics
   functions.
4. Helper methods dispatch Redux actions to the store to update the
   game state, or modify views to update the UI state.

Rendering
=========

Reduct-Redux does not have a scenegraph, and so you need to explicitly
specify what to render. This should be done by overriding
``drawContents``. There are helper functions to render a view for a
given expression, like ``drawProjection``.

The rendering lifecycle is as follows:

1. Redux store/animation is updated
2. ``stage.draw()`` is called
3. ``stage.draw`` uses ``requestAnimationFrame``
4. ``requestAnimationFrame`` callback fires, calling
   ``stage.drawImpl``
5. ``stage.drawImpl`` calls ``stage.drawContents``

This allows Redux to avoid re-rendering when nothing is happening,
saving CPU.

Effects
-------

Input Handling: TouchRecord
===========================

Unlike most UI/GUI frameworks, where events are processed by handler
functions attached to particular UI widgets, Reduct-Redux handles most
events in a centralized location, the ``TouchRecord``. This is a class
with callbacks for when a touch/mouse is pressed, moved, or released,
and keeps track of related state. Based on this state, it dispatches
lower-level callbacks or changes as appropriate (reducing expressions,
dragging them around, activating buttons, etc.). You specify the
desired ``TouchRecord`` to use by overriding the ``touchRecordClass``
property getter of ``BaseStage``.

Stages Reference
================

.. code-block:: js

   import BaseStage from "./stage/basestage";
   import BaseTouchRecord from "./stage/touchrecord";

.. autoclass:: module:BaseStage
   :members:

   There's a lot more stuff here, but I'm too lazy to document it all.

.. autoclass:: module:BaseTouchRecord
   :members:
