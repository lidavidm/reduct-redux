export function linearEase() {
    return function(start, stop, t) {
        return start + t * (stop - start);
    };
}

export class Tween {
    constructor(target, property, start, stop, duration, easing) {
        this.target = target;
        this.property = property;
        this.start = start;
        this.stop = stop;
        this.duration = duration;
        this.remaining = duration;
        this.easing = easing;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    update(t) {
        this.target[this.property] = this.easing(this.start, this.stop, t);
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
        for (let tween of this.tweens) {
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

        this.running = this.tweens.length > 0;

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
        let promises = [];

        for (let [prop, final] of Object.entries(properties)) {
            let tween = new Tween(target, prop, target[prop], final, duration, linearEase());
            this.tweens.push(tween);
            promises.push(tween.promise);
        }

        if (!this.running) {
            this.running = true;
            this.lastTimestamp = window.performance.now();
            window.requestAnimationFrame(this.tick.bind(this));
        }

        return Promise.all(promises);
    }
}

let clock = new Clock();

export function addUpdateListener(f) {
    clock.addUpdateListener(f);
}

export function tween(target, properties, options={}) {
    return clock.tween(target, properties, options);
}
