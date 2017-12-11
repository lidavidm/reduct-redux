import { baseProjection, debugDraw } from "./core";
import * as util from "./util";

export function sprite(options={}) {
    const projection = baseProjection();
    projection.type = "sprite";
    projection.size.w = (options.size && options.size.w) ? options.size.w : 50;
    projection.size.h = (options.size && options.size.h) ? options.size.h : 50;

    projection.prepare = function(id, state, stage) {};
    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(projection, offset);

        if (projection.opacity) ctx.globalAlpha = projection.opacity;
        options.image.draw(ctx,
                offset.x + projection.pos.x * offset.sx,
                offset.y + projection.pos.y * offset.sy,
                offset.sx * projection.scale.x * projection.size.w,
                offset.sy * projection.scale.y * projection.size.h);

        debugDraw(ctx, projection, offset);

        ctx.restore();
    };
    return projection;
}
