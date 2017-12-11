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

export function patch3(childFunc, options={}) {
    const projection = baseProjection();
    projection.type = "3patch";

    projection.prepare = function(id, state, stage) {
        const childId = childFunc(id, state);
        const childProjection = stage.views[childId];
        childProjection.prepare(childId, state, stage);
        projection.middleSegments = Math.ceil(childProjection.size.w / options.middle.naturalWidth);
        projection.imageScale = 1.4 * childProjection.size.h / options.middle.naturalHeight;
        const middleWidth = projection.middleSegments * projection.imageScale * options.middle.naturalWidth;
        childProjection.pos.x = options.left.naturalWidth * projection.imageScale + (middleWidth - childProjection.size.w) / 2;
        childProjection.pos.y = (options.middle.naturalHeight * projection.imageScale - childProjection.size.h) / 2;
    };
    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        ctx.save();

        let [ sx, sy ] = util.absoluteScale(projection, offset);
        sx *= projection.imageScale;
        sy *= projection.imageScale;

        if (projection.opacity) ctx.globalAlpha = projection.opacity;

        const topY = offset.y + projection.pos.y * offset.sy;

        options.left.draw(ctx,
                          offset.x + projection.pos.x * offset.sx,
                          topY,
                          sx * options.left.naturalWidth,
                          sy * options.left.naturalHeight);

        let x = offset.x + projection.pos.x * offset.sx + sx * options.left.naturalWidth;
        let subX = x;

        for (let i = 0; i < projection.middleSegments; i++) {
            const w = sx * options.middle.naturalWidth;
            options.middle.draw(ctx, x, topY, w, sy * options.middle.naturalHeight);
            x += w;
        }

        options.right.draw(ctx, x, topY,
                           sx * options.right.naturalWidth,
                           sy * options.right.naturalHeight);

        const childId = childFunc(id, state);
        const subOffset = Object.assign({}, offset, {
            x: offset.x + projection.pos.x * offset.sx,
            y: offset.y + projection.pos.y * offset.sy,
            sx: offset.sx * projection.scale.x,
            sy: offset.sy * projection.scale.y,
        });
        stage.views[childId].draw(childId, state, stage, subOffset);

        debugDraw(ctx, projection, offset);

        ctx.restore();
    };
    return projection;
}
