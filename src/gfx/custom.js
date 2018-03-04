/**
 * Custom views for specific expressions.
 */

import * as gfx from "./core";
import * as primitive from "./primitive";
import * as util from "./util";

export function argumentBar() {
    const projection = gfx.baseProjection();


    projection.prepare = function(id, exprId, state, stage) {
        this.count = 0;
        this.size = { w: 0, h: 50 };

        const define = state.getIn([ "nodes", exprId ]);
        let body = state.getIn([ "nodes", define.get("body") ]);

        while (body.get("type") === "lambda") {
            this.count += 1;
            this.size.w += 60;
            body = state.getIn([ "nodes", body.get("body") ]);
        }

        this.size.w = Math.max(0, this.size.w - 10);
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        const { ctx } = stage;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(this, offset);
        const { x, y } = util.topLeftPos(this, offset);

        util.setOpacity(ctx, this.opacity, offset);

        const w = sx * 50;
        const h = sy * this.size.h;

        ctx.fillStyle = "#555";

        for (let i = 0; i < this.count; i++) {
            const dx = sx * (60 * i);
            primitive.roundRect(
                ctx,
                x + dx, y, w, h,
                sx * 22,
                true,
                false,
                1.0,
                null
            );
        }

        ctx.scale(sx, sy);
        ctx.textBaseline = "alphabetic";
        ctx.font = `28px ${gfx.text.mono}`;
        for (let i = 1; i < this.count; i++) {
            const dx = sx * (60 * i);
            ctx.fillText(
                ",",
                (offset.x + ((this.pos.x + (dx - 5)) * offset.sx)) / sx,
                ((offset.y + (this.pos.y * offset.sy)) / sy) + 40
            );
        }

        ctx.restore();
    };
    return projection;
}
