import * as image from "./image";
import * as primitive from "./primitive";
import * as util from "./util";

export { image };

let DEBUG = false;
const DEBUG_COLORS = {
    "hbox": "blue",
    "text": "green",
};

document.body.addEventListener("keyup", (e) => {
    if (e.key === "F2") DEBUG = !DEBUG;
});

export function baseProjection() {
    const projection = {
        pos: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        size: { w: 0, h: 0 },
        opacity: 1.0,
    };

    projection.draw = projection.prepare = function() {};

    projection.containsPoint = function(pos) {
        return pos.x >= projection.pos.x && pos.x <= projection.pos.x + projection.size.w &&
            pos.y >= projection.pos.y && pos.y <= projection.pos.y + projection.size.h;
    };

    return projection;
}

export function debugDraw(ctx, projection, offset) {
    if (DEBUG) {
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        ctx.save();
        ctx.strokeStyle = DEBUG_COLORS[projection.type] || "red";
        ctx.lineWidth = 1;
        ctx.strokeRect(offset.x + offset.sx * projection.pos.x,
                       offset.y + offset.sy * projection.pos.y,
                       projection.size.w * sx,
                       projection.size.h * sy);
        ctx.restore();
    }
}

export function hoverOutline(id, projection, stage, offset) {
    if (stage._hoverNode === id) {
        stage.ctx.strokeStyle = "yellow";
        stage.ctx.lineWidth = 2;
        primitive.roundRect(
            stage.ctx,
            offset.x + projection.pos.x * offset.sx,
            offset.y + projection.pos.y * offset.sy,
            offset.sx * projection.scale.x * projection.size.w,
            offset.sy * projection.scale.y * projection.size.h,
            projection.scale.x * offset.sx * (projection.radius || 15),
            false,
            true,
            projection.stroke ? projection.stroke.opacity : null);
    }
}

export function constant(...projections) {
    return () => projections;
}

export function absolutePos(projection) {
    let { x, y } = projection.pos;
    while (projection.parent) {
        projection = projection.parent;
        x *= projection.scale.x;
        y *= projection.scale.y;
        x += projection.pos.x;
        y += projection.pos.y;
    }
    return { x: x, y: y };
}

export function absoluteSize(projection) {
    let { w, h } = projection.size;
    w *= projection.scale.x;
    h *= projection.scale.y;
    while (projection.parent) {
        projection = projection.parent;
        w *= projection.scale.x;
        h *= projection.scale.y;
    }
    return { w: w, h: h };
}

export function roundedRect(options={}) {
    const projection = baseProjection();
    projection.size.w = projection.size.h = 50;
    Object.assign(projection, {
        color: "lightgray",
        radius: 20,
        shadowColor: "#000",
        shadowOffset: 2,
    }, options);
    projection.type = "roundedRect";

    projection.prepare = function(id, state, stage) {};
    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(projection, offset);

        const node = state.getIn([ "nodes", id ]);
        if (projection.shadow || (node && (!node.get("parent") || !node.get("locked")))) {
            ctx.fillStyle = projection.shadowColor;
            primitive.roundRect(
                ctx,
                offset.x + projection.pos.x * offset.sx,
                offset.y + (projection.pos.y + projection.shadowOffset) * offset.sy,
                offset.sx * projection.scale.x * projection.size.w,
                offset.sy * projection.scale.y * projection.size.h,
                sx * projection.radius,
                projection.color ? true : false,
                projection.stroke ? true : false,
                projection.stroke ? projection.stroke.opacity : null);
        }

        if (projection.color) ctx.fillStyle = projection.color;
        const shouldStroke = !!(node && node.get("parent") && node.get("locked"));
        if (shouldStroke) {
            // Stroke if we have a parent to make it clearer.
            ctx.strokeStyle = "gray";
            ctx.lineWidth = 1;
        }

        if (projection.opacity) ctx.globalAlpha = projection.opacity;

        primitive.roundRect(
            ctx,
            offset.x + projection.pos.x * offset.sx,
            offset.y + projection.pos.y * offset.sy,
            offset.sx * projection.scale.x * projection.size.w,
            offset.sy * projection.scale.y * projection.size.h,
            sx * projection.radius,
            projection.color ? true : false,
            shouldStroke,
            projection.stroke ? projection.stroke.opacity : null);

        hoverOutline(id, projection, stage, offset);

        debugDraw(ctx, projection, offset);

        ctx.restore();
    };
    return projection;
}

// TODO: make this part of the stage instead?
const TEXT_SIZE_CACHE = {};

export function text(text, options) {
    const projection = baseProjection();
    projection.text = text;
    projection.fontSize = 36;
    projection.font = "Consolas, Monaco, monospace";
    projection.color = "#000";
    projection.type = "text";

    projection.prepare = function(id, state, stage) {
        const cacheKey = `${projection.fontSize};${projection.font};${projection.text}`;
        if (TEXT_SIZE_CACHE[cacheKey] === undefined) {
            stage.ctx.font = `${projection.fontSize}px ${projection.font}`;
            TEXT_SIZE_CACHE[cacheKey] = stage.ctx.measureText(projection.text).width;
        }
        projection.size.h = 50;
        projection.size.w = TEXT_SIZE_CACHE[cacheKey];
    };
    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;

        const [ sx, sy ] = util.absoluteScale(projection, offset);

        ctx.save();

        debugDraw(ctx, projection, offset);

        ctx.scale(sx, sy);
        ctx.fillStyle = projection.color;
        ctx.textBaseline = "alphabetic";
        ctx.font = `${projection.fontSize}px ${projection.font}`;
        ctx.fillText(projection.text,
                     (offset.x + projection.pos.x * offset.sx) / sx,
                     (offset.y + projection.pos.y * offset.sy) / sy + 1.1 * projection.fontSize);
        ctx.restore();

        ctx.save();
        hoverOutline(id, projection, stage, offset);
        ctx.restore();
    };
    return projection;
}

import * as layout from "./layout";
import * as shapes from "./shapes";

export * from "./sprite";
export { layout, shapes };
