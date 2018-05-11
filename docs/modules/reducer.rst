==================
Actions & Reducers
==================

The Redux State
===============

You'll see a ``state`` parameter a lot. This is the Redux state, which
stores all the game state, as described in :ref:`Architecture`. It is
an Immutable.js Map with fields ``nodes``, ``globals``, ``board``,
``toolbox``, and ``goal``.

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

Working with Immutable.js
=========================

We can't describe all of Immutable.js here, so please read the
documentation for that library. However, the key things are:

- Use ``get`` to get a field. Children are stored indirectly, so
  you'll need a reference to the overall state to get access to
  children.

  .. code-block:: js

     // expr is a plain old JavaScript object
     console.log(expr.id);
     console.log(expr.child.value);

     // expr is an Immutable.js Map stored in Redux
     // state is the Redux store's state
     console.log(expr.get("id"));
     console.log(state.getIn([ "nodes", expr.get("id"), "value" ]));
     // getIn is a convenience function; here the use roughly
     // translates to state["nodes"][expr["id"]]["value"] if these
     // were all plain old JavaScript objects

  Learn to use temporary variables and helpers like ``getIn``.

- Use ``set`` to change a field. This **does not modify the original
  object**, instead **you get a new copy of the object**! Thus, if
  you're modifying a nested object, you also have to re-set the field
  on the parent object.

  .. code-block:: js

     // Hypothetical example where node ID 5 has its value incremented
     const oldNode = nodes.get(5);
     nodes.set(5, oldNode.set("value", oldNode.get("value") + 1));

  If you're modifying a lot of fields on the same object, check out
  the ``withMutations`` method.

Expression Fields
=================

To work with expressions, you'll need to know what fields they have.

Every expression always has an ``id`` field, as well as a field for
each of the fields and subexpressions defined in the semantics (see
:ref:`Defining Expressions`). Additionally, if the expression is a
child of another, it should have a ``parent`` and ``parentField``. The
former is the ID of the parent expression, and the latter is the name
of the field in which this expression is stored on the parent.

Remember, fields storing child expressions always have numeric IDs,
not objects, as values.

Holes are simply expressions of type ``"missing"``. This assumption is
unfortunately hard-coded (see :doc:`../improvements`). When a hole is
filled with an expression, the original hole is placed in a field
whose name is the original field name with ``__hole``. For example, if
the ``argument`` field is a hole and is filled in, then the reducer
will add an ``argument__hole`` field that contains the ID of the
original hole expression. (This is because the reducer doesn't know
how to generate new expressions on the fly; consequently, you can't
make a hole where there wasn't one before, either.)

Notches are stored in fields named ``notch<n>`` where ``<n>`` is the
index of the notch. The expression stored in the notch will have its
``parent`` and ``parentField`` set as normal.

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
