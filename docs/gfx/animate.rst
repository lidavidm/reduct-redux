===========
gfx/animate
===========

The animation framework.

.. code-block:: js

   import * as animate from "./gfx/animate";

.. autofunction:: animate.after
.. autofunction:: animate.tween
.. autofunction:: animate.infinite
.. autofunction:: animate.addUpdateListener

.. autoclass:: animate.Easing
   :members: Projectile

   .. autoclass:: Quadratic
      :members:
   .. autoclass:: Cubic
      :members:
   .. autoclass:: Exponential
      :members:
   .. autofunction:: Color

      More explanation written in reST.

.. autoclass:: animate.Clock
   :members:

.. autoclass:: animate.Tween
   :members:

.. autoclass:: animate.InterpolateTween
   :members:

.. autoclass:: animate.InfiniteTween
   :members:

.. autoattribute:: animate.clock

----------------
Built-in Effects
----------------

This module ships with a number of handy effects, accessible through
``animate.fx``.

.. autofunction:: fx.splosion
