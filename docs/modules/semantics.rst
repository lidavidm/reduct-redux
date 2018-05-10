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

Defining Expressions
====================

New expressions are

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
