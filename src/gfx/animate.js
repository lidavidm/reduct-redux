/**
 * The animation & tweening library.
 */

import chroma from "chroma-js";

/**
 * A set of easing functions.
 *
 * @example
 * animate.tween(view, { pos: { x: 0 } }, {
 *     duration: 500,
 *     easing: animate.Easing.Linear,
 * });
 */
export const Easing = {
    /**
     * A linear tween.
     */
    Linear: (start, stop, t) => start + (t * (stop - start)),

    /**
     * Quadratic tweens.
     */
    Quadratic: {
        /**
         * An ease-in tween.
         */
        In: (start, stop, t) => start + (t * t * (stop - start)),
        Out: (start, stop, t) => start - (t * (t - 2) * (stop - start)),
        InOut: (start, stop, t) => {
            t *= 2;
            if (t < 1) {
                return start + (((stop - start) * t * t) / 2);
            }
            t -= 1;
            return start - (((stop - start) * ((t * (t - 2)) - 1)) / 2);
        },
    },

    /**
     * Cubic tweens.
     */
    Cubic: {
        In: (start, stop, t) => start + (t * t * t * (stop - start)),
        Out: (start, stop, t) => {
            t -= 1;
            return start + (((t * t * t) + 1) * (stop - start));
        },
        InOut: (start, stop, t) => {
            t *= 2;
            if (t < 1) {
                return start + (((stop - start) * t * t * t) / 2);
            }
            t -= 2;
            return start + (((stop - start) * ((t * t * t) + 2)) / 2);
        },
    },

    /**
     * Exponential tweens.
     */
    Exponential: {
        Out: (start, stop, t) => {
            return ((stop - start) * (1 - (2 ** (-10 * t)))) + start;
        },
    },

    /**
     * Interpolate between colors in the CIELAB color space (so it
     * looks more natural than directly tweening RGB values).
     *
     * Right now this easing is not automatically applied. To tween a
     * color, pass the final color as the target value and
     * additionally specify the source and target colors to this
     * easing function, passing the return value as the easing option.
     *
     * @param {Function} easing - The underlying easing function to use.
     * @param {String} src - The start color.
     * @param {String} dst - The final color.
     *
     * @example
     * // Use linear interpolation underneath
     * animate.tween(view, { color: "#000" }, {
     *     duration: 500,
     *     easing: animate.Easing.Color(animate.Easing.Linear, view.color, "#000"),
     * });
     * @example
     * // Use cubic interpolation underneath
     * animate.tween(view, { color: "#000" }, {
     *     duration: 500,
     *     easing: animate.Easing.Color(animate.Easing.Cubic.In, view.color, "#000"),
     * });
     *
     * @returns {Function} The easing function.
     */
    Color: (easing, src, dst) => {
        const scale = chroma.scale([ src, dst ]).mode("lch");
        return (start, stop, t) => scale(easing(0.0, 1.0, t));
    },

    /**
     * Parabolic projectile trajectory tween. Used similarly to
     * :func:`Color`.
     */
    Projectile: (easing) => (start, stop, t) => {
        const dy = stop - start;
        // console.log(start, stop, t, start + (-4 * dy * t * t) + (4 * dy * t));
        t = easing(0.0, 1.0, t);
        return start + (-4 * dy * t * t) + (4 * dy * t);
    },
};

/**
 * The base class for a tween.
 */
export class Tween {
    constructor(clock, options) {
        this.clock = clock;
        this.options = options;
        /**
         * The underlying Promise object of this tween, which is
         * resolved when the tween finishes.
         */
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        this.status = "running";
    }

    update(dt) {
        return false;
    }

    /**
     * A convenience function to register a callback for when the
     * tween finishes.
     * @returns {Promise}
     */
    then(cb1, cb2) {
        return this.promise.then(cb1, cb2);
    }

    /**
     * Pause this tween and resume execution after a specified delay.
     * @param {number} ms
     * @returns The tween itself.
     */
    delay(ms) {
        // TODO: respect Clock.scale
        this.status = "paused";
        setTimeout(() => {
            this.status = "running";
            this.clock.start();
        }, ms);
        return this;
    }

    /**
     * Force this tween to mark itself as completed.
     */
    completed() {
        this.status = "completed";
        this.resolve();
        if (this.options.callback) {
            this.options.callback();
        }
    }
}


/**
 * A tween that interpolates from a start value to an end value.
 *
 * @augments animate.Tween
 */
export class InterpolateTween extends Tween {
    constructor(clock, properties, duration, options) {
        super(clock, options);

        this.properties = properties;
        this.duration = duration;
        this.remaining = duration;
        this.reverse = false;
        this.repeat = 1;
        this.reversing = false;

        if ("reverse" in options) {
            this.reverse = options.reverse;
        }
        if ("repeat" in options) {
            this.repeat = options.repeat;
        }
    }

    update(dt) {
        if (this.status !== "running") {
            return false;
        }

        // Guard against very long time steps (e.g. when paused by a
        // debugger)
        dt = dt % this.duration;

        if (this.reversing) {
            this.remaining += dt;
        }
        else {
            this.remaining -= dt;
        }

        let t = Math.max(0, 1 - (this.remaining / this.duration));
        let completed = false;

        if ((!this.reversing && this.remaining <= 0) ||
            (this.reversing && this.remaining >= this.duration)) {
            this.repeat -= 1;
            if (this.repeat <= 0) {
                completed = true;
                t = 1.0;
            }
            else {
                if (this.reverse) {
                    this.reversing = !this.reversing;
                }
                else {
                    this.remaining = this.duration;
                }
                t = Math.max(0, 1 - (this.remaining / this.duration));
            }
        }

        for (const attr of this.properties) {
            const { target, property, start, end, easing } = attr;
            target[property] = easing(start, end, t);
        }

        if (completed) {
            this.completed();
            return false;
        }
        return true;
    }

    /** Resets properties affected back to their initial value. */
    undo(animated=false) {
        if (animated) {
            const tween = this.makeUndo();
            this.clock.addTween(tween);
            return tween;
        }

        for (const attr of this.properties) {
            const { target, property, start } = attr;
            target[property] = start;
        }
    }

    makeUndo() {
        const properties = [];
        for (const attr of this.properties) {
            properties.push({
                ...attr,
                start: attr.end,
                end: attr.start,
            });
        }
        return new InterpolateTween(this.clock, properties, this.duration, this.options);
    }

    cancel() {
        this.status = "completed";
    }

    completed() {
        for (const attr of this.properties) {
            const { target, property, start, end, easing } = attr;
            target[property] = easing(start, end, 1);
        }
        super.completed();
    }
}

/**
 * A tween that continues running until explicitly stopped.
 *
 * @param clock
 * @param {Function} updater - A function that is called on every tick
 * with the delta-time value. It can return ``true`` to stop running.
 */
export class InfiniteTween extends Tween {
    constructor(clock, updater, options) {
        super(clock, options);

        this.updater = updater;
        this.stopped = false;
    }

    update(dt) {
        if (this.status !== "running") {
            return false;
        }

        const finished = this.stopped || this.updater(dt);
        if (finished) {
            this.completed();
            return false;
        }

        return true;
    }

    /**
     * Stop running this infinite tween.
     */
    stop() {
        this.stopped = true;
    }
}

/**
 * An animation loop and tween manager.
 */
export class Clock {
    constructor() {
        this.listeners = [];
        this.tweens = [];
        this.running = false;
        this.lastTimestamp = null;
        /**
         * A global scale factor applied to tween durations. This is
         * dynamic, i.e. instead of statically changing the durations
         * of new tweens, this value is multiplied by the delta time
         * used to update tweens. Thus, changing this affects
         * animations in progress. However, it will not dynamically
         * affect :func:`animate.after`, which does scale its duration
         * according to this, but does not readjust its duration
         * afterwards.
         */
        this.scale = null;
        this.tick = this.tick.bind(this);
    }

    get scale() {
        if (this._scale) {
            return this._scale;
        }
        const el = document.querySelector("#animation-speed-slider");
        if (el) {
            return el.value;
        }
        return 1;
    }

    set scale(s) {
        this._scale = s;
    }

    addUpdateListener(f) {
        this.listeners.push(f);
    }

    /**
     * Update all tweens by the given delta time. If any tweens are
     * still running, automatically requests a new animation frame,
     * otherwise pauses the clock. This helps save CPU cycles and
     * battery power when no animations are running.
     */
    tick(t) {
        const dt = this.scale * (t - this.lastTimestamp);
        const completed = [];
        let running = false;
        for (const tween of this.tweens) {
            running = tween.update(dt) || running;
            if (tween.status === "completed") {
                completed.push(tween);
            }
        }

        for (const tween of completed) {
            this.tweens.splice(this.tweens.indexOf(tween), 1);
        }

        this.running = this.tweens.length > 0 && running;

        if (this.running) {
            this.lastTimestamp = t;
            window.requestAnimationFrame(this.tick);
        }
        else {
            this.lastTimestamp = null;
        }

        for (const listener of this.listeners) {
            listener();
        }
    }

    /**
     * Add a :class:`InterpolateTween` tween to this clock.
     *
     * @param {Object} target - The object whose properties should be tweened.
     * @param {Object} properties - A dictionary of property values to
     * be tweened. The RHS should be the final value of the
     * property. It can also be a list, where in order, the list
     * (optionally) contains the start value, the final value, and an
     * easing function to use for just that property. Properties can
     * be nested, e.g. passing ``{ pos: { x: 0 }}`` will tween
     * ``target.pos.x`` to 0.
     * @param {Object} options - Various options for the tween. Any
     * options not described here are passed to the tween
     * constructor—see :class:`animate.InterpolateTween`.
     * @param {number} [options.duration=300] - The duration of the tween.
     * @param {Function} [options.easing=animate.Easing.Linear] - The
     * default easing function to use.
     * @param {number} [options.restTime] - If given, an amount of
     * time to wait before decrementing the ``animating`` counter on
     * ``target``. Some views use this counter to avoid performing
     * layout on children that are being animated, so that the
     * animation is not overridden by the view.
     * @param {boolean} [options.setAnimatingFlag] - Don't set the
     * ``animating`` counter.
     * @returns {animate.InterpolateTween} The tween object.
     */
    tween(target, properties, options) {
        const duration = options.duration || 300;
        const props = [];
        const defaultEasing = options.easing || Easing.Linear;
        const setAnimatingFlag = typeof options.setAnimatingFlag === "undefined" ? true :
              options.setAnimatingFlag;

        const buildProps = (subTarget, subProps, easing) => {
            for (let [ prop, final ] of Object.entries(subProps)) {
                let start = null;

                if (Array.isArray(final)) {
                    if (final.length === 2 && typeof final[1] === "function") {
                        [ final, easing ] = final;
                    }
                    else if (final.length === 2) {
                        [ start, final ] = final;
                    }
                    else if (final.length === 3) {
                        [ start, final, easing ] = final;
                    }
                    else {
                        throw "Tween target can only be array if array is length 2 or 3";
                    }
                }

                if (typeof final === "number" || typeof final === "string") {
                    props.push({
                        target: subTarget,
                        property: prop,
                        start: start || subTarget[prop],
                        end: final,
                        easing,
                    });
                }
                else if (final) {
                    buildProps(subTarget[prop], final, easing);
                }
            }
        };

        buildProps(target, properties, defaultEasing);
        // Set flag so that layout functions know to skip this view,
        // if it is a child. Use counter to allow overlapping tweens.
        if (setAnimatingFlag) {
            if (typeof target.animating === "number") {
                target.animating += 1;
            }
            else {
                target.animating = 1;
            }
        }

        const decrementAnimatingCount = () => {
            if (typeof target.animating === "number") {
                target.animating -= 1;
            }
            else {
                target.animating = 0;
            }
        };

        const result = this.addTween(new InterpolateTween(this, props, duration, options));
        if (setAnimatingFlag) {
            result.then(() => {
                if (options.restTime) {
                    return after(options.restTime);
                }
                return null;
            }).then(() => decrementAnimatingCount());
        }
        return result;
    }

    /**
     * Directly add a tween to this clock.
     *
     * Starts the clock if paused.
     *
     * @param {animate.Tween} tween
     */
    addTween(tween) {
        this.tweens.push(tween);
        if (!this.running) {
            this.start();
        }

        return tween;
    }

    /**
     * Start the clock, if paused.
     */
    start() {
        if (!this.running) {
            this.running = true;
            this.lastTimestamp = window.performance.now();
            window.requestAnimationFrame(this.tick);
        }
    }

    /**
     * Cancel all tweens on this clock and stop the clock.
     */
    cancelAll() {
        this.running = false;
        this.lastTimestamp = null;
        while (this.tweens.length > 0) {
            this.tweens.pop();
        }
    }
}

/**
 * The default clock.
 *
 * @example
 * // clock example
 */
export const clock = new Clock();

/**
 * Add a callback that is fired every animation tick.
 *
 * Useful to trigger a re-render whenever an animation updates.
 *
 * @param {Function} f - The function to be called.
 */
export function addUpdateListener(f) {
    clock.addUpdateListener(f);
}

/**
 * Add a tween to the default clock (and start the clock if
 * applicable).
 *
 * @param {Object} target - The object whose properties to tween.
 * @param {Object} properties - A (nested) dictionary of property
 * values to tween to.
 * @param {Object} options - Other options for the tween. See
 * :js:func:`~animate.Clock.tween`.
 */
export function tween(target, properties, options={}) {
    return clock.tween(target, properties, options);
}

/**
 * Add an infinite tween to the default clock.
 *
 * @param {Function} updater - The update function. See
 * :class:`~animate.InfiniteTween`.
 * @param {Object} options
 */
export function infinite(updater, options={}) {
    return clock.addTween(new InfiniteTween(clock, updater, options));
}

export function chain(target, ...properties) {
    if (properties.length % 2 !== 0) {
        throw "animate.chain: Must provide an even number of properties.";
    }
    let base = null;
    for (let i = 0; i < properties.length; i += 2) {
        if (base === null) {
            base = tween(target, properties[i], properties[i + 1]);
        }
        else {
            base = base.then(() => tween(target, properties[i], properties[i + 1]));
        }
    }

    return base;
}

/**
 * A helper function to resolve a Promise after a specified delay.
 *
 * @param ms {number} The delay in milliseconds.
 * @returns {Promise}
 */
export function after(ms) {
    return new Promise((resolve) => {
        window.setTimeout(function() {
            resolve();
        }, ms / clock.scale);
    });
}

let scales = {};

/**
 * Set the duration scale factor for a given category.
 *
 * @param {String} category
 * @param {number} factor
 */
export function setDurationScale(category, factor) {
    scales[category] = factor;
}

export function replaceDurationScales(_scales) {
    scales = Object.assign({}, _scales);
}

/**
 * Scale a duration by the given categories' scale factors.
 *
 * @param {number} duration
 * @param {...String} categories
 *
 * @example
 * animate.tween(view, { opacity: 0 }, {
 *     duration: animate.scaleDuration(300, "expr-add", "global-scale"),
 * });
 */
export function scaleDuration(ms, ...categories) {
    for (const category of categories) {
        ms *= (typeof scales[category] === "undefined" ? 1.0 : scales[category]);
    }
    return ms;
}

import * as fx from "./fx/fx";
export { fx };
