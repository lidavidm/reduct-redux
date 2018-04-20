import { baseProjection, debugDraw } from "./core";
import * as primitive from "./primitive";
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

        util.setOpacity(ctx, this.opacity, offset);
        const width = sx * this.size.w;
        const height = sy * this.size.h;
        options.image.draw(
            ctx,
            offset.x + ((this.pos.x * offset.sx) - (this.anchor.x * width)),
            offset.y + ((this.pos.y * offset.sy) - (this.anchor.y * height)),
            width,
            height
        );

        debugDraw(ctx, this, offset);

        ctx.restore();
    };
    return projection;
}

export function exprify(projection) {
    const { draw } = projection;

    projection.draw = function(id, exprId, state, stage, offset) {
        let glowColor = null;

        const { ctx } = stage;
        ctx.save();

        const node = state.getIn([ "nodes", exprId ]);
        const hasParent = node && Number.isInteger(node.get("parent"));
        const locked = !node || node.get("locked");

        const { x, y } = util.topLeftPos(this, offset);
        const w = offset.sx * this.scale.x * this.size.w;
        const h = offset.sy * this.scale.y * this.size.h;

        if (this.stroke) {
            glowColor = this.stroke.color;
            primitive.setStroke(ctx, this);
        }
        else if (hasParent && !locked) {
            const [ sx, sy ] = util.absoluteScale(this, offset);
            ctx.fillStyle = "#000";
            primitive.setStroke(ctx, {
                lineWidth: 2,
                color: this.highlightColor || "yellow",
            });
            primitive.roundRect(
                ctx,
                x, y,
                w, h,
                sx * 22,
                true, stage.isHovered(exprId), null
            );
            ctx.fillStyle = "#555";
            primitive.roundRect(
                ctx,
                x, y,
                w, h,
                sx * 22,
                true, stage.isHovered(exprId), null
            );
        }
        else if ((!hasParent || !locked) && stage.isHovered(exprId)) {
            glowColor = this.highlightColor || "yellow";
            primitive.setStroke(ctx, {
                lineWidth: 2,
                color: glowColor,
            });
        }

        if (glowColor) {
            const cx = x + (w / 2);
            const cy = y + (h / 2);

            const tw = 1.1 * w;
            const th = 1.1 * h;

            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(tw, th) / 2);
            gradient.addColorStop(0, glowColor);
            gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");
            ctx.fillStyle = gradient;

            // ctx.fillRect(tx, ty, Math.max(tw, th), Math.max(tw, th));
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(tw, th) / 2, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();

        draw.call(this, id, exprId, state, stage, offset);
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

        this.imageScale = 1.4 * (childProjection.size.h / options.middle.naturalHeight);
        this.middleSegments = Math.ceil(childProjection.size.w /
                                        (options.middle.naturalWidth * this.imageScale));
        const middleWidth = this.middleSegments * this.imageScale * options.middle.naturalWidth;
        childProjection.pos.x = (options.left.naturalWidth * this.imageScale) +
            ((middleWidth - childProjection.size.w) / 2);
        childProjection.pos.y =
            ((options.middle.naturalHeight * this.imageScale) - childProjection.size.h) / 2;
        childProjection.parent = this;

        this.size.w = middleWidth +
            ((options.left.naturalWidth + options.right.naturalWidth) * this.imageScale);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        const { ctx } = stage;
        ctx.save();

        let [ sx, sy ] = util.absoluteScale(this, offset);
        sx *= this.imageScale;
        sy *= this.imageScale;

        util.setOpacity(ctx, this.opacity, offset);

        const topY = offset.y + (this.pos.y * offset.sy);

        options.left.draw(
            ctx,
            offset.x + (this.pos.x * offset.sx),
            topY,
            sx * options.left.naturalWidth,
            sy * options.left.naturalHeight
        );

        let x = offset.x + (this.pos.x * offset.sx) + (sx * options.left.naturalWidth);

        for (let i = 0; i < this.middleSegments; i++) {
            const w = sx * options.middle.naturalWidth;
            options.middle.draw(ctx, x, topY, w, sy * options.middle.naturalHeight);
            x += w;
        }

        options.right.draw(
            ctx, x, topY,
            sx * options.right.naturalWidth,
            sy * options.right.naturalHeight
        );

        const childId = childFunc(id, state);
        const subOffset = Object.assign({}, offset, {
            x: offset.x + (this.pos.x * offset.sx),
            y: offset.y + (this.pos.y * offset.sy),
            sx: offset.sx * this.scale.x,
            sy: offset.sy * this.scale.y,
            opacity: this.opacity,
        });
        stage.views[childId].draw(childId, exprId, state, stage, subOffset);

        debugDraw(ctx, this, offset);

        ctx.restore();
    };

    projection.children = function(exprId, state) {
        return childFunc(exprId, state);
    };

    return projection;
}
