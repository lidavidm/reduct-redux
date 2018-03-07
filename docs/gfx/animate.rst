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
   :members: Color, Projectile

   .. autoclass:: animate.Easing.Quadratic
      :members:
   .. autoclass:: animate.Easing.Cubic
      :members:
   .. autoclass:: animate.Easing.Exponential
      :members:

.. autoclass:: animate.InfiniteTween

.. autoclass:: animate.Clock
   :members:

.. autoattribute:: animate.clock
