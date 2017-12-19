import { tween } from "../animate";

export function splosion(stage, pos, color="gold", numOfParticles=20, explosionRadius=100) {
    const parts = [];
    const tweens = [];

    const minRadius = 2;
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
        }, {
            duration: 400,
        }));
    }

    const id = stage.addEffect({
        prepare: () => {},
        draw: () => {
            const { ctx } = stage;
            ctx.fillStyle = color;
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
        },
        containsPoint: () => false,
    });

    Promise.all(tweens).then(() => {
        stage.removeEffect(id);
    });
}
