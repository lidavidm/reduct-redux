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
            duration: 400,
            easing: animate.Easing.Cubic.Out,
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

    if (!projection.__origStroke) {
        projection.__origStroke = projection.stroke;
    }

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

    projection.stroke = { color: options.color, lineWidth: 0 };
    return animate.tween(projection.stroke, { lineWidth: options.lineWidth }, {
        reverse: true,
        repeat: options.times * 2,
        duration: options.speed,
    }).then(() => {
        projection.stroke = projection.__origStroke;
        delete projection.__origStroke;
        stage.drawImpl();
    });
}

export function shatter(stage, projection, onFullComplete=null) {
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
                duration: 400,
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
            { duration: 600, easing: animate.Easing.Cubic.Out }
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
