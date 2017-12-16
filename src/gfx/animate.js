export const Easing = {
    Linear: (start, stop, t) => {
        return start + t * (stop - start);
    },

    Quadratic: {
        In: (start, stop, t) => {
            return start + t*t*(stop-start);
        },
    },

    Cubic: {
        In: (start, stop, t) => {
            return start + t*t*t*(stop-start);
        },
    },
};


export class Tween {
    constructor(clock, target, properties, duration) {
        this.clock = clock;
        this.target = target;
        this.properties = properties;
        this.duration = duration;
        this.remaining = duration;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

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
        this.resolve();
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
        let dt = t - this.lastTimestamp;
        let completed = [];
        let running = false;
        for (let tween of this.tweens) {
            if (tween.status !== "running") continue;

            running = true;
            tween.remaining -= dt;
            if (tween.remaining <= 0) {
                tween.completed();
                completed.push(tween);
            }
            else {
                tween.update(Math.max(0, 1 - tween.remaining / tween.duration));
            }
        }

        for (let tween of completed) {
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

        for (let listener of this.listeners) {
            listener();
        }
    }

    tween(target, properties, options) {
        let duration = options.duration || 300;
        let props = {};
        let easing = options.easing || Easing.Linear;
        for (let [prop, final] of Object.entries(properties)) {
            props[prop] = { start: target[prop], end: final, easing: easing };
        }

        let tween = new Tween(this, target, props, duration);
        this.tweens.push(tween);

        if (!this.running) {
            this.start();
        }

        return tween;
    }

    start() {
        this.running = true;
        this.lastTimestamp = window.performance.now();
        window.requestAnimationFrame(this.tick.bind(this));
    }
}

let clock = new Clock();

export function addUpdateListener(f) {
    clock.addUpdateListener(f);
}

export function tween(target, properties, options={}) {
    return clock.tween(target, properties, options);
}
