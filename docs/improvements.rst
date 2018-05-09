====================
Areas of Improvement
====================

If somehow Erik, François, and Andrew don't have enough work for you,
you can try to tackle these improvements:

- HTML5 canvas performance

  Rendering performance is rather unsatisfactory, particularly because
  Reduct-Redux scales to fit the screen. I've done some limited
  profiling, and these things could be improved:

  - Static backgrounds

    Currently, everything is redrawn on every frame. However, some
    things rarely change, like the goal, toolbox, background, and so
    on. They could be drawn to a separate canvas or done in HTML, and
    layered under the main canvas. They would need to be re-rendered
    in some cases, like when the window is resized.

- Animation & tweening system conveniences
- More flexible semantics
- Stage refactoring
- Mobile support
