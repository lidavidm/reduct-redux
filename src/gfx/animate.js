export const Easing = {
    Linear: (start, stop, t) => start + (t * (stop - start)),

    Quadratic: {
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
};


export class Tween {
    constructor(clock, target, properties, duration, options) {
        this.clock = clock;
        this.target = target;
        this.properties = properties;
        this.duration = duration;
        this.remaining = duration;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        this.reverse = false;
        this.repeat = 1;
        this.reversing = false;
        this.options = options;

        if ("reverse" in options) {
            this.reverse = options.reverse;
        }
        if ("repeat" in options) {
            this.repeat = options.repeat;
        }

        this.status = "running";
    }

    update(t) {
        for (const property in this.properties) {
            const { start, end, easing } = this.properties[property];
            this.target[property] = easing(start, end, t);
        }
    }

    then(cb1, cb2) { return this.promise.then(cb1, cb2); }

    delay(ms) {
        this.status = "paused";
        setTimeout(() => {
            this.status = "running";
            this.clock.start();
        }, ms);
        return this;
    }

    completed() {
        this.update(1.0);
        this.status = "completed";
        this.resolve();
        if (this.options.callback) {
            this.options.callback();
        }
    }
}

export class Clock {
    constructor() {
        this.listeners = [];
        this.tweens = [];
        this.running = false;
        this.lastTimestamp = null;
    }

    addUpdateListener(f) {
        this.listeners.push(f);
    }

    tick(t) {
        const dt = t - this.lastTimestamp;
        const completed = [];
        let running = false;
        for (const tween of this.tweens) {
            if (tween.status !== "running") continue;

            running = true;
            if (tween.reversing) {
                tween.remaining += dt;
            }
            else {
                tween.remaining -= dt;
            }

            if ((!tween.reversing && tween.remaining <= 0) ||
                (tween.reversing && tween.remaining >= tween.duration)) {
                tween.repeat -= 1;
                if (tween.repeat <= 0) {
                    tween.completed();
                    completed.push(tween);
                }
                else {
                    // TODO: should update the tween on this frame too
                    if (tween.reverse) {
                        tween.reversing = !tween.reversing;
                    }
                    else {
                        tween.remaining = tween.duration;
                    }
                }
            }
            else {
                tween.update(Math.max(0, 1 - (tween.remaining / tween.duration)));
            }
        }

        for (const tween of completed) {
            this.tweens.splice(this.tweens.indexOf(tween), 1);
        }

        this.running = this.tweens.length > 0 && running;

        if (this.running) {
            this.lastTimestamp = t;
            window.requestAnimationFrame(this.tick.bind(this));
        }
        else {
            this.lastTimestamp = null;
        }

        for (const listener of this.listeners) {
            listener();
        }
    }

    tween(target, properties, options) {
        const duration = options.duration || 300;
        const props = {};
        const easing = options.easing || Easing.Linear;
        for (const [ prop, final ] of Object.entries(properties)) {
            props[prop] = { start: target[prop], end: final, easing };
        }

        const tween = new Tween(this, target, props, duration, options);
        this.tweens.push(tween);

        if (!this.running) {
            this.start();
        }

        return tween;
    }

    start() {
        if (!this.running) {
            this.running = true;
            this.lastTimestamp = window.performance.now();
            window.requestAnimationFrame(this.tick.bind(this));
        }
    }
}

const clock = new Clock();

export function addUpdateListener(f) {
    clock.addUpdateListener(f);
}

export function tween(target, properties, options={}) {
    return clock.tween(target, properties, options);
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

export function after(ms) {
    return new Promise((resolve) => {
        window.setTimeout(function() {
            resolve();
        }, ms);
    });
}

import * as fx from "./fx/fx";
export { fx };
