import { tween, Easing } from "../animate";

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

        tweens.push(tween(record, {
            x: pos.x + (rad * Math.cos(theta)),
            y: pos.y + (rad * Math.sin(theta)),
            r: 0,
        }, {
            duration: 400,
            easing: Easing.Cubic.Out,
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

export function blink(projection, opts) {
    const options = Object.assign({
        times: 1,
        color: "#F00",
    }, opts);

    projection.stroke = { color: options.color, lineWidth: 0 };
    return tween(projection.stroke, { lineWidth: 3 }, {
        reverse: true,
        repeat: options.times * 2,
        duration: 600,
    });
}
