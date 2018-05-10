=======
reducer
=======

Mutable vs Immutable Expressions
================================

Two "types" of expressions exist in Reduct-Redux. Most of the time,
you will work with immutable expressions, which are Immutable.js Map
data structures, and are manipulated through methods like ``get``,
``set``, and ``withMutations``. However, it's a lot easier to build up
an AST as plain old JavaScript objects during parsing. Thus, there is
a conversion step needed, and some semantics functions have to work
with both types. (This should be mostly transparent to you.)
:func:`action.startLevel` handles the conversion.

Actions
=======

.. code-block:: js

   import * as action from "./reducer/action";
   import * as undo from "./reducer/undo";

.. autofunction:: action.startLevel
.. autofunction:: action.victory

.. autofunction:: action.smallStep
.. autofunction:: action.betaReduce

.. autofunction:: action.detach
.. autofunction:: action.fillHole
.. autofunction:: action.attachNotch
.. autofunction:: action.define
.. autofunction:: action.useToolbox

.. autofunction:: action.raise

.. autofunction:: action.unfold
.. autofunction:: action.unfade
.. autofunction:: action.fade

.. autofunction:: undo.undo
.. autofunction:: undo.redo
.. autofunction:: undo.undoable

Reducers
========

.. code-block:: js

   import * as reducer from "./reducer/reducer";

.. autofunction:: reducer.nextId
.. autofunction:: reducer.reduct
