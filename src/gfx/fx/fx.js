import Loader from "../../loader";
import Audio from "../../resource/audio";
import * as gfx from "../core";
import * as animate from "../animate";

export function splosion(stage, pos, color="gold", numOfParticles=20, explosionRadius=100) {
    const parts = [];
    const tweens = [];

    const minRadius = 1;
    const maxRadius = 12;

    for (let i = 0; i < numOfParticles; i++) {
        const record = {
            x: pos.x,
            y: pos.y,
            r: Math.floor(minRadius + ((maxRadius - minRadius) * Math.random())),
        };
        parts.push(record);

        const theta = Math.random() * Math.PI * 2;
        const rad = explosionRadius * ((Math.random() / 2.0) + 0.5);

        tweens.push(animate.tween(record, {
            x: pos.x + (rad * Math.cos(theta)),
            y: pos.y + (rad * Math.sin(theta)),
            r: 0,
        }, {
            duration: 600,
            easing: animate.Easing.Exponential.Out,
        }));
    }

    const id = stage.addEffect({
        prepare: () => {},
        draw: () => {
            const { ctx } = stage;
            ctx.fillStyle = color;
            ctx.save();
            for (const record of parts) {
                ctx.beginPath();
                ctx.arc(
                    record.x + record.r,
                    record.y + record.r,
                    record.r,
                    0, 2 * Math.PI
                );
                ctx.fill();
            }
            ctx.restore();
        },
        containsPoint: () => false,
    });

    return Promise.all(tweens).then(() => {
        stage.removeEffect(id);
    });
}

export function blink(stage, projection, opts) {
    const options = Object.assign({
        times: 1,
        color: "#F00",
        speed: 600,
        lineWidth: 3,
        background: false,
    }, opts);

    if (options.background) {
        if (!projection.__origColor) {
            projection.__origColor = projection.color;
        }

        const bgColor = typeof options.background === "string" ? options.background : options.color;

        animate.tween(projection, { color: null }, {
            reverse: true,
            repeat: options.times * 2,
            duration: options.speed,
            easing: animate.Easing.Color(animate.Easing.Linear, projection.color, bgColor),
        }).then(() => {
            projection.color = projection.__origColor;
        });
    }

    // TODO: refactor this into a helper

    let updatedStroke = projection.stroke;
    const tempStroke = { color: options.color, lineWidth: 0 };
    const descriptor = Object.getOwnPropertyDescriptor(projection, "stroke");
    // Don't blink if fx already in progress
    if (!descriptor || !descriptor.get) {
        Object.defineProperty(projection, "stroke", {
            configurable: true,
            get() {
                return tempStroke;
            },
            set(newValue) {
                updatedStroke = newValue;
            },
        });
        return animate.tween(tempStroke, { lineWidth: options.lineWidth }, {
            reverse: true,
            repeat: options.times * 2,
            duration: options.speed,
        }).then(() => {
            delete projection.stroke;
            projection.stroke = updatedStroke;
            stage.drawImpl();
        });
    }
    return Promise.resolve();
}

export function shatter(stage, projection, options) {
    const { onFullComplete } = options;

    const size = gfx.absoluteSize(projection);
    const pos = gfx.absolutePos(projection);
    const status = {
        x: pos.x,
        y: pos.y,
        w: size.w,
        h: size.h,
        a: 0,
    };

    const { ctx } = stage;
    let primitive = (offset) => {
        gfx.primitive.roundRect(
            ctx,
            status.x, status.y + offset,
            status.w, status.h,
            projection.radius,
            true,
            true
        );
    };
    if (projection.baseType === "hexaRect") {
        primitive = (offset) => {
            gfx.primitive.hexaRect(
                ctx,
                status.x, status.y + offset,
                status.w, status.h,
                true,
                true
            );
        };
    }

    const id = stage.addEffect({
        prepare: () => {},
        draw: () => {
            ctx.save();
            ctx.globalAlpha = status.a;
            ctx.strokeStyle = "white";
            ctx.lineWidth = 3;
            ctx.fillStyle = "black";
            primitive(4);
            ctx.fillStyle = "white";
            primitive(0);
            ctx.restore();
        },
    });

    return new Promise((resolve, _reject) => {
        animate.chain(
            status,
            { a: 1 },
            {
                duration: options.introDuration || 500,
                easing: animate.Easing.Cubic.In,
                callback: () => {
                    resolve();
                },
            },
            {
                a: 0,
                w: 1.2 * size.w,
                h: 1.4 * size.h,
                x: pos.x - (0.1 * size.w),
                y: pos.y - (0.2 * size.h),
            },
            { duration: options.outroDuration || 800, easing: animate.Easing.Cubic.Out }
        ).then(() => {
            stage.removeEffect(id);
            if (onFullComplete) {
                onFullComplete();
            }
        });
    });
}

export function poof(stage, projection) {
    const pos = gfx.centerPos(projection);
    const status = { t: 0.0 };
    const images = [ "poof0", "poof1", "poof2", "poof3", "poof4" ]
          .map(key => Loader.images[key]);

    const { ctx } = stage;
    const id = stage.addEffect({
        prepare: () => {},
        draw: () => {
            ctx.save();
            const idx = Math.min(Math.floor(status.t * images.length), images.length - 1);
            images[idx].draw(
                ctx,
                pos.x - 45, pos.y - 45,
                90, 90
            );
            ctx.restore();
        },
    });

    return animate.tween(status, { t: 1.0 }, {
        duration: 500,
    }).then(() => {
        stage.removeEffect(id);
    });
}

export function error(stage, projection) {
    Audio.play("negative_2");
    return blink(stage, projection, {
        times: 3,
        speed: 200,
        color: "#F00",
        lineWidth: 5,
        background: "orange",
    });
}

export function emerge(stage, state, bodyView, resultIds) {
    const spacing = 10;
    const emergeDistance = 50;
    let totalHeight = 0;
    let maxWidth = 50;

    for (const resultId of resultIds) {
        const resultView = stage.views[resultId];
        resultView.prepare(resultId, resultId, state, stage);
        const sz = gfx.absoluteSize(resultView);
        totalHeight += sz.h + spacing;
        maxWidth = Math.max(sz.w, maxWidth);
    }
    totalHeight -= spacing;

    const ap = gfx.absolutePos(bodyView);
    const as = gfx.absoluteSize(bodyView);
    let y = (ap.y + (as.h / 2)) - (totalHeight / 2);

    const { x: safeX, y: safeY } = stage.findSafePosition(
        (ap.x + (as.w / 2)) - (maxWidth / 2),
        y,
        maxWidth,
        totalHeight
    );

    y = safeY + (emergeDistance / 2);

    const tweens = [];
    for (const resultId of resultIds) {
        const resultView = stage.views[resultId];
        const sz = gfx.absoluteSize(resultView);
        resultView.pos.x = safeX + (maxWidth / 2);
        resultView.pos.y = y + (sz.h / 2);
        resultView.anchor.x = 0.5;
        resultView.anchor.y = 0.5;
        animate.tween(resultView.pos, {
            y: resultView.pos.y - emergeDistance,
        }, {
            duration: 250,
            easing: animate.Easing.Cubic.In,
        });
        y += sz.h + spacing;
        resultView.scale.x = 0.0;
        resultView.scale.y = 0.0;
        tweens.push(animate.tween(resultView.scale, { x: 1, y: 1 }, {
            duration: 250,
            easing: animate.Easing.Cubic.In,
        }));
    }

    const id = stage.addEffect({
        prepare: () => {
            for (const resultId of resultIds) {
                const resultView = stage.views[resultId];
                resultView.prepare(resultId, resultId, state, stage);
            }
        },
        draw: () => {
            for (const resultId of resultIds) {
                const resultView = stage.views[resultId];
                resultView.draw(resultId, resultId, state, stage, {
                    x: 0, y: 0, sx: 1, sy: 1,
                });
            }
        },
    });

    return Promise.all(tweens).then(() => {
        stage.removeEffect(id);
    });
}
