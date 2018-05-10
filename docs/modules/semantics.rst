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
  *Type:* string or function ``(semant, state, expr) => { }``

  See :ref:`Type Checking` below.

``targetable``

``smallStep``

``betaReduce``

``stepAnimation``

``stepSound``
  *Type:* string or function ``(semant, state, expr) => string``

``validateStep``

``reductionOrder``

``substepFilter``

``notches``
  See :ref:`Notches` below.

For working with expression objects, see :ref:`Expression Fields`.

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

Interpreter
-----------
