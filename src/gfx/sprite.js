import { baseProjection, debugDraw } from "./core";
import * as util from "./util";

export function sprite(options={}) {
    const projection = baseProjection();
    projection.type = "sprite";
    projection.size.w = (options.size && options.size.w) ? options.size.w : 50;
    projection.size.h = (options.size && options.size.h) ? options.size.h : 50;

    projection.prepare = function(id, exprId, state, stage) {};
    projection.draw = function(id, exprId, state, stage, offset) {
        const ctx = stage.ctx;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(this, offset);

        if (this.opacity) ctx.globalAlpha = this.opacity;
        options.image.draw(ctx,
                offset.x + this.pos.x * offset.sx,
                offset.y + this.pos.y * offset.sy,
                offset.sx * this.scale.x * this.size.w,
                offset.sy * this.scale.y * this.size.h);

        debugDraw(ctx, this, offset);

        ctx.restore();
    };
    return projection;
}

export function patch3(childFunc, options={}) {
    const projection = baseProjection();
    projection.type = "3patch";

    projection.prepare = function(id, exprId, state, stage) {
        const childId = childFunc(id, state);
        const childProjection = stage.views[childId];
        childProjection.prepare(childId, exprId, state, stage);
        this.middleSegments = Math.ceil(childProjection.size.w / options.middle.naturalWidth);
        this.imageScale = 1.4 * childProjection.size.h / options.middle.naturalHeight;
        const middleWidth = this.middleSegments * this.imageScale * options.middle.naturalWidth;
        childProjection.pos.x = options.left.naturalWidth * this.imageScale + (middleWidth - childProjection.size.w) / 2;
        childProjection.pos.y = (options.middle.naturalHeight * this.imageScale - childProjection.size.h) / 2;
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        const ctx = stage.ctx;
        ctx.save();

        let [ sx, sy ] = util.absoluteScale(this, offset);
        sx *= this.imageScale;
        sy *= this.imageScale;

        if (this.opacity) ctx.globalAlpha = this.opacity;

        const topY = offset.y + this.pos.y * offset.sy;

        options.left.draw(ctx,
                          offset.x + this.pos.x * offset.sx,
                          topY,
                          sx * options.left.naturalWidth,
                          sy * options.left.naturalHeight);

        let x = offset.x + this.pos.x * offset.sx + sx * options.left.naturalWidth;
        let subX = x;

        for (let i = 0; i < this.middleSegments; i++) {
            const w = sx * options.middle.naturalWidth;
            options.middle.draw(ctx, x, topY, w, sy * options.middle.naturalHeight);
            x += w;
        }

        options.right.draw(ctx, x, topY,
                           sx * options.right.naturalWidth,
                           sy * options.right.naturalHeight);

        const childId = childFunc(id, state);
        const subOffset = Object.assign({}, offset, {
            x: offset.x + this.pos.x * offset.sx,
            y: offset.y + this.pos.y * offset.sy,
            sx: offset.sx * this.scale.x,
            sy: offset.sy * this.scale.y,
        });
        stage.views[childId].draw(childId, exprId, state, stage, subOffset);

        debugDraw(ctx, this, offset);

        ctx.restore();
    };
    return projection;
}
