====================
Areas of Improvement
====================

If somehow Erik, François, and Andrew don't have enough work for you,
you can try to tackle these improvements:

- HTML5 canvas performance

  Rendering performance is rather unsatisfactory, particularly because
  Reduct-Redux scales to fit the screen. I've done some limited
  profiling, and these things could be improved, though not all are
  guaranteed to help.

  Also see https://github.com/lidavidm/reduct-redux/issues/148.

  - Static backgrounds

    Currently, everything is redrawn on every frame. However, some
    things rarely change, like the goal, toolbox, background, and so
    on. They could be drawn to a separate canvas or done in HTML, and
    layered under the main canvas. They would need to be re-rendered
    in some cases, like when the window is resized.

  - Lower rendering resolution

    We could gain some performance by rendering to a lower-resolution
    canvas and scaling the game to fit the window. We already do
    something like this for mobile devices. It would make the game
    blurrier, though.

  - ``Path2D``

    This lets us pre-specify a path (e.g. the shape of a lambda, the
    arrrow of an application block) and render it in one call.
    Assuming we can find a way to detect when the path actually needs
    to be rebuilt, and depending on how the browser handles it, this
    could help.

  - Cached rendering

    For things that aren't likely to change, pre-rendering them to a
    separate canvas and simply drawing them as bitmaps could speed
    things up. For instance, primitives aren't likely to change
    (though, those are mostly already either sprites or easily cached
    via the ``Path2D`` improvement above). It might also help to
    render and cache the object at a few different resolutions for
    different scales (essentially "mipmapping").

  - General performance guides: `on MDN
    <https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas>`_,
    `at HTML5Rocks
    <https://www.html5rocks.com/en/tutorials/canvas/performance/>`_.

  - Rendering images via the new CSS Paint APIs:
    https://developers.google.com/web/updates/2018/04/nic66#css-paint-api

  - An especially crazy change would be to use or build an WebGL
    library to replace the canvas, taking advantage of the view
    hierarchy to serve as the scene graph. I'm not sure how compatible
    this would be with our rendering model, though.

- Animation & tweening system conveniences

  This is mostly to make your & future developers' lives easier. The
  animation system for Reduct-Redux is a custom library, and could use
  a few more conveniences. In particular, a better way to specify
  sequences of animations and complex animations would help. Libaries
  like Greensock have the concept of "timelines". I've also thought
  about a way to specify animations in JSON. In general, any way to
  reduce the crazy nested callbacks would be
  helpful. (``async``/``await`` might also help; I haven't tried those
  yet, but that might solve the problem without any changes.)

  Two minor easy improvements would be changing tweens to work with a
  list of objects to be tweened, and allowing tweens to specify
  different tween functions per property.

  The animation system has a set of built-in tweening functions, but
  this could be expanded—I've added some "anticipatory" tweens that
  wind up in the beginning or overshoot the target, and adding other
  similar tweens could help with the feel of the game.

  Overall, though, I'm pretty happy with this part of the system.

- More flexible semantics

  Currently a lot of things are hard-coded, and a lot of invariants
  are left unstated. (See :ref:`Expression Fields` for some of the
  core invariants.) It would be nice to use Immutable.js Records to
  make the fields than an object has explicit. Also, it would be nice
  to not hard-code expression types in the codebase (outside of
  semantics definitions). This refers to how the stage and the
  "generic" semantics functions hard-code what expressions are
  lambdas, arguments, expression holes, etc. in order to manipulate
  them—instead, they should arguably defer this decision to the
  definition of the language's semantics, and use helper functions
  instead. This should be an easy but tedious refactoring.

- Stage refactoring

  Without an explicit scene graph, there's a lot of duplicated code in
  handling drawing. There's also a lot of redundancy in handling input
  events. The stage could be refactored and split into smaller parts,
  and a more uniform way of specifying the "contents" of a stage would
  be helpful.

  Input handling code could be refactored so that each stage doesn't
  have to re-implement code to crawl the view hierarchy.

- Mobile support

  There's some support for this, but using pixel coordinates was a
  clear mistake, in hindsight. We can and have hacked around this by
  rendering at one resolution and scaling it.

- Immutable.js

  This library enables features like easy and reliable
  undo-redo. However, it also hurts performance (particularly in
  big-step reduction) and makes development more annoying. One thing
  that would help slightly is using Immutable.js Records to represent
  nodes and the overall state, instead of Maps; that way, we wouldn't
  need calls to ``get`` everywhere.

  For performance, most of the issues come during evaluation. It might
  be possible to "JIT" Reduct expressions to JavaScript and just
  ``eval`` them (safety/security issues notwithstanding).
