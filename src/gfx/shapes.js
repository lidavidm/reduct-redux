import { baseProjection, hoverOutline, debugDraw } from "./core";
import * as primitive from "./primitive";
import * as util from "./util";

// TODO: use these helpers everywhere
function shadow(ctx, id, projection, state, f) {
    const node = state.getIn([ "nodes", id ]);
    if (projection.shadow || (node && (!node.get("parent") || !node.get("locked")))) {
        ctx.fillStyle = projection.shadowColor;
        f(projection.shadowOffset);
    }
}

function drawPrimitive(id, projection, state, stage, offset,
                       drawFunction, strokeFunction=null) {
    const ctx = stage.ctx;
    ctx.save();

    const node = state.getIn([ "nodes", id ]);
    const hasParent = node && Number.isInteger(node.get("parent"));
    const locked = !node || node.get("locked");

    shadow(ctx, id, projection, state, drawFunction);

    let stroke = false;
    if (hasParent && locked) {
        // Stroke if we have a parent to make it clearer.
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 1;
        stroke = true;
    }
    else if ((!hasParent || !locked) && stage._hoverNode === id) {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 2;
        stroke = true;
    }
    if (projection.opacity) ctx.globalAlpha = projection.opacity;

    if (projection.color) ctx.fillStyle = projection.color;
    drawFunction(0);
    if (stroke && strokeFunction) strokeFunction();
    else if (stroke) ctx.stroke();

    debugDraw(ctx, projection, offset);

    ctx.restore();
}

function shapeProjection(options) {
    return Object.assign(baseProjection(), {
        size: { w: 50, h: 50 },
        color: "gold",
        shadowColor: "#000",
        shadowOffset: 2,
    }, options);
}

export function triangle(options={}) {
    const projection = shapeProjection(options);
    projection.type = "triangle";

    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        drawPrimitive(id, projection, state, stage, offset, (dy) => {
            let w = offset.sx * projection.scale.x * projection.size.w;
            let h = offset.sy * projection.scale.y * projection.size.h;
            const x = offset.x + projection.pos.x * offset.sx + 0.15 * w;
            const y = offset.y + (projection.pos.y + projection.shadowOffset) * offset.sy + 0.15 * h;
            w *= 0.7;
            h *= 0.7;

            ctx.beginPath();
            ctx.moveTo(x, y + h + dy);
            ctx.lineTo(x + w, y + h + dy);
            ctx.lineTo(x + w/2.0, y + dy);
            ctx.closePath();
            ctx.fill();
        });
    };
    return projection;
}

export function circle(options={}) {
    const projection = shapeProjection(options);
    projection.type = "circle";

    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        drawPrimitive(id, projection, state, stage, offset, (dy) => {
            let w = offset.sx * projection.scale.x * projection.size.w;
            let h = offset.sy * projection.scale.y * projection.size.h;
            const x = offset.x + projection.pos.x * offset.sx + 0.15 * w;
            const y = offset.y + (projection.pos.y + projection.shadowOffset) * offset.sy + 0.15 * h;
            w *= 0.7;
            h *= 0.7;
            const rad = w / 2;

            ctx.beginPath();
            ctx.arc(x + rad, y + rad + dy, rad, 0, 2*Math.PI);
            ctx.fill();
        });
    };
    return projection;
}

export function rectangle(options={}) {
    const projection = shapeProjection(options);
    projection.type = "rectangle";

    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        let w = offset.sx * projection.scale.x * projection.size.w;
        let h = offset.sy * projection.scale.y * projection.size.h;
        const x = offset.x + projection.pos.x * offset.sx + 0.15 * w;
        const y = offset.y + (projection.pos.y + projection.shadowOffset) * offset.sy + 0.15 * h;
        w *= 0.7;
        h *= 0.7;

        drawPrimitive(id, projection, state, stage, offset, (dy) => {
            ctx.fillRect(x, y + dy, w, h);
        }, (dy) => {
            ctx.strokeRect(x, y, w, h);
        });
    };
    return projection;
}

export function star(options={}) {
    const projection = shapeProjection(options);
    projection.type = "star";

    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        let w = offset.sx * projection.scale.x * projection.size.w;
        let h = offset.sy * projection.scale.y * projection.size.h;
        const x = offset.x + projection.pos.x * offset.sx + 0.15 * w;
        const y = offset.y + (projection.pos.y + projection.shadowOffset) * offset.sy + 0.15 * h;
        w *= 0.7;
        h *= 0.7;

        drawPrimitive(id, projection, state, stage, offset, (dy) => {
            primitive.drawStar(ctx, x + w/2, y + h/2 + dy, 5, w/2, 0.5*w/2, true, false);
        });
    };
    return projection;
}
