=========
Semantics
=========

Reduct-Redux is theoretically (see :doc:`../improvements`) independent
of the actual language used. To accomplish this, the semantics of the
language are defined in a separate module and passed to the other
parts of Reduct.

The semantics of a language are defined as a giant object, with fields
specifying the different types of expressions and other miscellaneous
behavior. This object is run through ``transform``:

.. autofunction:: transform

The result is a full semantics module, whose methods are given in
:ref:`Semantics Functions`.

The object should have the following fields:

``name``
  Just a name for the language.

``parser``
  Specifies how to parse the language. See :ref:`Defining Parsing`.

``expressions``
  An object specifying all the expression types. See the next section,
  :ref:`Defining Expressions`.

Defining Expressions
====================

New expressions are defined as objects, with a number of required and
optional fields.

Required fields:

``kind``
  What kind of expression (``value``, ``expression``, ``statement``,
  ``syntax``, or ``placeholder``). This is important—only an
  ``expression`` can be clicked on, for instance, and reaching a
  ``value`` will stop evaluation!

``fields``
  A (possibly empty) list of fields the expression should have. For
  instance, a number expression would have a value field, or
  definition syntax might have a name field.

``subexpressions``
  A (possibly empty) list of additional fields that contain child
  expressions. For instance, definition syntax might have a
  subexpression for the body.

  Also see :ref:`Dynamic Subexpressions` below.

``projection``
  See :ref:`JSON-Defined Views`.

Optional fields:

``type``
  See :ref:`Type Checking` below.

``targetable``
  Defines whether an expression is selectable or hoverable. Should be
  a function whose signature is ``(semant, state, expr) => boolean``
  where ``semant`` is the generated semantics module, ``state`` is the
  :ref:`Redux state <The Redux State>`, and ``expr`` is the
  Immutable.js Map representing the expression. It should return
  ``true`` if and only if the expression in its current state should
  be selectable.

``alwaysTargetable``
  *Type:* Boolean

  Alternatively, you can specify that the expression must always be
  targetable. This is a simple Boolean field, and is used for holes.

``locked``
  *Type:* Boolean

  If specified, when created, the expression will be locked/unlocked
  by default (defaults to locked). Used for holes.

``smallStep``
  *Type:* function ``(semant, stage, state, expr) => [ NodeId,
  NodeId[], Node[] ] | MutableExpression | ImmutableExpression``

  This is what defines how an expression takes a small step. If
  called, and if ``validateStep`` is defined, you can assume that
  ``validateStep`` returned true.

  The result can be one of three things.

  If the result is a single expression that already exists (e.g. an
  ``if`` expression returning one of its branches—see
  ``src/semantics/es6/conditional.js``), you may simply return the
  immutable expression object. (You should remove any ``parent`` and
  ``parentField`` fields first.)

  If you are returning an entirely new expression, you can do so
  either by returning a mutable expression or an immutable
  expression. If returning a mutable expression, simply return the
  constructed object. (For an example, see
  ``src/semantics/es6/binop.js``.) If returning an immutable
  expression (e.g. ``src/semantics/es6/apply.js``), the result is a
  3-tuple:

  - the ID of the node that was changed (generally will be
    ``expr.get("id")``),
  - a list of node IDs that constitute the result (yes, you can step
    to multiple expressions, technically; this is an API artifact and
    most of the rest of the engine will break if you do this)
    [#stepmulti]_,
  - a list of immutable expressions that were created in the
    process. These should have IDs assigned already.

  The reason for the three modes is for convenience: building a new
  expression is easier when it's mutable, but some expressions, like
  apply, call out to existing infrastructure that work with immutable
  expressions and return such a 3-tuple, and others, like conditional,
  simply want to return a subexpression. Generally, you won't be
  constructing the 3-tuple manually; it'll be the result of calling
  into the evaluation engine for something else.

``betaReduce``
  *Type:* function ``(semant, stage, state, expr, argIds) => [ NodeId,
  NodeId[], Node[] ]``

  This is similar to ``smallStep``, except you now have an array of
  argument expression IDs. You should probably use
  :func:`core.genericBetaReduce`. Note that this should be defined
  both for the overall lambda expression, as well as the "parameter
  expressions", since the engine will look for a ``betaReduce``
  function for the expression that the argument was dropped
  over. (Both are needed since expressions like ``apply`` instead look
  at the overall lambda expression.)

``stepAnimation``
  *Type:* function ``(semant, stage, state, expr) => Promise``

  Define an animation for reducing this expression. Result should be a
  Promise_; evaluation will continue once it is resolved.

``stepSound``
  *Type:* string or function ``(semant, state, expr) => string``

  Define a sound to play when reducing this expression. Result should
  be either a string referring to a sound loaded, or a function that
  returns such a string.

``validateStep``

``reductionOrder``

``substepFilter``

``notches``
  See :ref:`Notches` below.

For working with expression objects, see :ref:`Expression Fields`.

.. [#stepmulti] Because we have replication, beta-reduction needs to
                be able to produce multiple result expressions. Most
                of the evaluation engine is built around the 3-tuple
                described, so while having multiple results doesn't
                really apply here, the signature still reflects it.

.. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

Concreteness Fading
-------------------

Dynamic Subexpressions
----------------------

Type Checking
-------------

.. warning:: Type checking is incomplete and mostly non-functional.

Notches
-------

.. warning:: Notches weren't used in the final summer 2018 edition,
             and weren't ever fully implemented.

Defining Parsing
================

Miscellaneous Hooks
===================

Semantics Functions
===================

Here ``module`` refers to the generated semantics module (the result
of :func:`transform`). You might also see this referred to as
``semant`` or ``semantics`` elsewhere.

.. autoattribute:: module.definition

.. autofunction:: module.subexpressions

There are also "core" semantics functions you can use outside of
having a semantics module:

.. code-block:: javascript

   import * as core from "./semantics/core";

.. autofunction:: core.genericBetaReduce

Interpreter
-----------
