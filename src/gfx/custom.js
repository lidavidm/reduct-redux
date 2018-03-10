/**
 * Custom views for specific expressions.
 */

import * as gfx from "./core";
import * as primitive from "./primitive";
import * as util from "./util";

export function argumentBar() {
    const projection = gfx.baseProjection();

    const txt = gfx.text("", {
        color: "#888",
    });

    projection.prepare = function(id, exprId, state, stage) {
        this.names = [];
        this.size = { w: 0, h: 50 };

        const define = state.getIn([ "nodes", exprId ]);
        let body = state.getIn([ "nodes", define.get("body") ]);

        if (define.get("params") === "dynamic") {
            while (body.get("type") === "lambda") {
                const name = state.getIn([ "nodes", body.get("arg"), "name" ]);
                txt.text = name;
                txt.prepare(null, null, state, stage);
                const size = Math.max(txt.size.w, 40);
                this.names.push([ name, size + 10 ]);
                this.size.w += size + 20;
                body = state.getIn([ "nodes", body.get("body") ]);
            }
        }
        else {
            this.names = [];
            for (const name of define.get("params")) {
                txt.text = name;
                txt.prepare(null, null, state, stage);
                const size = Math.max(txt.size.w, 40);
                this.names.push([ name, size + 10 ]);
                this.size.w += size + 20;
            }
        }

        this.size.w = Math.max(0, this.size.w - 10);
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        const { ctx } = stage;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(this, offset);
        const { x, y } = util.topLeftPos(this, offset);

        util.setOpacity(ctx, this.opacity, offset);

        const h = sy * (this.size.h - 10);

        const dy = sy * 5;
        let dx = 0;
        for (const [ name, width ] of this.names) {
            const w = sx * width;
            ctx.fillStyle = "#000";
            primitive.roundRect(
                ctx,
                x + dx, y + (dy - 3), w, h,
                sx * 22,
                true,
                false,
                1.0,
                null
            );

            ctx.fillStyle = "#555";
            primitive.roundRect(
                ctx,
                x + dx, y + dy, w, h,
                sx * 22,
                true,
                false,
                1.0,
                null
            );

            txt.text = name;
            txt.draw(null, null, state, stage, Object.assign({}, offset, {
                x: x + dx + (5 * offset.sx),
                y: y + (5 * offset.sy),
                sx,
                sy,
            }));

            dx += sx * (width + 10);
        }

        ctx.restore();
    };
    return projection;
}
