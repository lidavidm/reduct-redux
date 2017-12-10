import * as primitive from "./primitive";
import * as util from "./util";

let DEBUG = false;
const DEBUG_COLORS = {
    "hbox": "blue",
    "text": "green",
};

document.body.addEventListener("keyup", (e) => {
    if (e.key === "F2") DEBUG = !DEBUG;
});

function baseProjection() {
    const projection = {
        pos: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        size: { w: 0, h: 0 },
    };

    projection.containsPoint = function(pos) {
        return pos.x >= projection.pos.x && pos.x <= projection.pos.x + projection.size.w &&
            pos.y >= projection.pos.y && pos.y <= projection.pos.y + projection.size.h;
    };

    return projection;
}

function debugDraw(ctx, projection, offset) {
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

export function constant(...projections) {
    return () => projections;
}

export function hbox(childrenFunc, options={}, baseProjection=roundedRect) {
    const projection = baseProjection(options);
    const basePrepare = projection.prepare;
    const baseDraw = projection.draw;
    projection.padding = { left: 10, inner: 10, right: 10 };
    projection.subexpScale = 0.85;
    projection.type = "hbox";

    Object.assign(projection, options);

    projection.prepare = function(id, state, stage) {
        const children = childrenFunc(id, state.get("nodes"));
        let x = projection.padding.left;

        for (let childId of children) {
            const childProjection = stage.views[childId];

            childProjection.pos.x = x;
            childProjection.pos.y = 0;
            childProjection.scale.x = projection.subexpScale;
            childProjection.scale.y = projection.subexpScale;

            childProjection.prepare(childId, state, stage);
            x += childProjection.size.w * childProjection.scale.x + projection.padding.inner;
            childProjection.pos.y = (projection.size.h * projection.scale.y - childProjection.size.h * childProjection.scale.y * projection.scale.y) / 2;
        }
        projection.size.w = x;
        projection.size.y = 50;
    };
    projection.draw = function(id, state, stage, offset) {
        baseDraw(id, state, stage, offset);

        const [ sx, sy ] = util.absoluteScale(projection, offset);

        const subOffset = Object.assign({}, offset, {
            x: offset.x + projection.pos.x * offset.sx,
            y: offset.y + projection.pos.y * offset.sy,
            sx: offset.sx * projection.scale.x,
            sy: offset.sy * projection.scale.y,
        });
        for (let childId of childrenFunc(id, state.get("nodes"), stage, offset)) {
            stage.views[childId].draw(childId, state, stage, subOffset);
        }
    };
    return projection;
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
        if (projection.shadow || (node && !node.get("parent") || !node.get("locked"))) {
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
        const shouldStroke = node && node.get("parent") && node.get("locked");
        if (stage._hoverNode === id) {
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 2;
        }
        else if (shouldStroke) {
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
        }
        primitive.roundRect(
            ctx,
            offset.x + projection.pos.x * offset.sx,
            offset.y + projection.pos.y * offset.sy,
            offset.sx * projection.scale.x * projection.size.w,
            offset.sy * projection.scale.y * projection.size.h,
            sx * projection.radius,
            projection.color ? true : false,
            stage._hoverNode === id || shouldStroke,
            projection.stroke ? projection.stroke.opacity : null);

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
                     (offset.x + projection.pos.x) / sx,
                     (offset.y + projection.pos.y) / sy + 1.1 * projection.fontSize);
        ctx.restore();
    };
    return projection;
}
