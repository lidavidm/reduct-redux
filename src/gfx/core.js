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

export function baseProjection(options) {
    const projection = Object.assign({
        pos: { x: 0, y: 0 },
        anchor: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        size: { w: 0, h: 0 },
        opacity: 1.0,
    }, options);

    projection.draw = projection.prepare = function() {};

    projection.containsPoint = function(pos, offset) {
        const { x, y } = util.topLeftPos(this, offset);
        return pos.x >= x &&
            pos.y >= y &&
            pos.x <= x + (this.size.w * offset.sx * this.scale.x) &&
            pos.y <= y + (this.size.h * offset.sy * this.scale.y);
    };

    return projection;
}

export function debugDraw(ctx, projection, offset) {
    if (DEBUG) {
        const [ sx, sy ] = util.absoluteScale(projection, offset);
        const { x, y } = util.topLeftPos(projection, offset);
        ctx.save();
        ctx.strokeStyle = DEBUG_COLORS[projection.type] || "red";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y,
                       projection.size.w * sx,
                       projection.size.h * sy);
        ctx.restore();
    }
}

export function hoverOutline(id, projection, stage, offset) {
    if (stage._hoverNode === id) {
        const { x, y } = util.topLeftPos(projection, offset);
        stage.ctx.strokeStyle = "yellow";
        stage.ctx.lineWidth = 2;
        primitive.roundRect(
            stage.ctx,
            x, y,
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
    x -= projection.anchor.x * projection.size.w * projection.scale.x;
    y -= projection.anchor.y * projection.size.h * projection.scale.y;

    while (projection.parent) {
        projection = projection.parent;
        x *= projection.scale.x;
        y *= projection.scale.y;
        x += projection.pos.x - projection.anchor.x * projection.size.w * projection.scale.x;
        y += projection.pos.y - projection.anchor.y * projection.size.h * projection.scale.y;
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

export function centerPos(projection) {
    const { x, y } = absolutePos(projection);
    const { w, h } = absoluteSize(projection);
    return {
        x: x + (w / 2),
        y: y + (h / 2),
    };
}

export function baseShape(name, defaults, draw) {
    return function(options) {
        const projection = Object.assign(baseProjection(), defaults, options);
        projection.size.w = projection.size.h = 50;
        projection.type = name;

        projection.prepare = function(id, state, stage) {};
        projection.draw = function(id, state, stage, offset) {
            const ctx = stage.ctx;
            ctx.save();

            const [ sx, sy ] = util.absoluteScale(this, offset);

            const { x, y } = util.topLeftPos(this, offset);

            const node = state.getIn([ "nodes", id ]);
            if (this.shadow || (node && (!node.get("parent") || !node.get("locked")))) {
                ctx.fillStyle = this.shadowColor;
                draw(ctx, this,
                     x, y + this.shadowOffset * offset.sy,
                     offset.sx * this.scale.x * this.size.w,
                     offset.sy * this.scale.y * this.size.h,
                     sx, sy,
                     this.stroke);
            }

            if (this.color) ctx.fillStyle = this.color;

            let shouldStroke = false;
            if (this.stroke) {
                shouldStroke = true;
                ctx.lineWidth = this.stroke.lineWidth;
                ctx.strokeStyle = this.stroke.color;
            }
            else if (!!(node && node.get("parent") && node.get("locked")) &&
                     this.strokeWhenChild) {
                // Stroke if we have a parent to make it clearer.
                ctx.strokeStyle = "gray";
                ctx.lineWidth = 1;
                shouldStroke = true;
            }
            else if (stage._hoverNode === id) {
                stage.ctx.strokeStyle = "yellow";
                stage.ctx.lineWidth = 2;
                shouldStroke = true;
            }
            else if (node && !node.get("parent") && stage.semantics.kind(node) === "expression") {
                if (node.get("complete")) {
                    stage.ctx.strokeStyle = "DeepPink";
                    stage.ctx.lineWidth = 4;
                    shouldStroke = true;
                }
            }

            if (this.opacity) ctx.globalAlpha = this.opacity;

            draw(ctx, this,
                 x, y,
                 offset.sx * this.scale.x * this.size.w,
                 offset.sy * this.scale.y * this.size.h,
                 sx, sy,
                 this.stroke || shouldStroke);
            debugDraw(ctx, this, offset);

            ctx.restore();
        };
        return projection;
    };
}

export const roundedRect = baseShape("roundedRect", {
    color: "lightgray",
    radius: 20,
    shadowColor: "#000",
    shadowOffset: 4,
    strokeWhenChild: true,  // Draw border when child of another expression
}, (ctx, projection, x, y, w, h, sx, sy, shouldStroke) => {
    primitive.roundRect(
        ctx,
        x, y, w, h,
        sx * projection.radius,
        projection.color ? true : false,
        shouldStroke,
        projection.stroke ? projection.stroke.opacity : null);
});

export const hexaRect = baseShape("hexaRect", {
    color: "lightgray",
    radius: 20,
    shadowColor: "#000",
    shadowOffset: 4,
    strokeWhenChild: true,  // Draw border when child of another expression
}, (ctx, projection, x, y, w, h, sx, sy, shouldStroke) => {
    primitive.hexaRect(
        ctx,
        x, y, w, h,
        projection.color ? true : false,
        shouldStroke,
        projection.stroke ? projection.stroke.opacity : null);
});

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
        const cacheKey = `${this.fontSize};${this.font};${this.text}`;
        if (TEXT_SIZE_CACHE[cacheKey] === undefined) {
            stage.ctx.font = `${this.fontSize}px ${this.font}`;
            TEXT_SIZE_CACHE[cacheKey] = stage.ctx.measureText(this.text).width;
        }
        this.size.h = 50;
        this.size.w = TEXT_SIZE_CACHE[cacheKey];
    };
    projection.draw = function(id, state, stage, offset) {
        const ctx = stage.ctx;

        const [ sx, sy ] = util.absoluteScale(this, offset);

        ctx.save();

        debugDraw(ctx, this, offset);

        ctx.scale(sx, sy);
        ctx.fillStyle = this.color;
        ctx.textBaseline = "alphabetic";
        ctx.font = `${this.fontSize}px ${this.font}`;
        ctx.fillText(this.text,
                     (offset.x + this.pos.x * offset.sx) / sx,
                     (offset.y + this.pos.y * offset.sy) / sy + 1.1 * this.fontSize);
        ctx.restore();

        ctx.save();
        hoverOutline(id, this, stage, offset);
        ctx.restore();
    };
    return projection;
}

/**
 * Create a projection that renders based on expression type.
 *
 * Note that all projections must have compatible fields.
 */
export function dynamicType(mapping, resetFieldsList) {
    let projection = {};
    for (const childProjection of Object.values(mapping)) {
        projection = Object.assign(projection, childProjection);
    }
    projection.type = "dynamicType";

    projection.prepare = function(id, state, stage) {
        const expr = state.getIn([ "nodes", id ]);
        const ty = expr.get("ty");

        let proj = mapping["__default__"];
        if (typeof mapping[ty] !== "undefined") {
            proj = mapping[ty];
        }

        for (const fieldName of resetFieldsList) {
            this[fieldName] = proj[fieldName];
        }
        proj.prepare.call(this, id, state, stage);
    };

    projection.draw = function(id, state, stage, offset) {
        const expr = state.getIn([ "nodes", id ]);
        const ty = expr.get("ty");
        if (typeof mapping[ty] !== "undefined") {
            mapping[ty].draw.call(this, id, state, stage, offset);
        }
        else {
            mapping["__default__"].draw.call(this, id, state, stage, offset);
        }
    };

    return projection;
}

import * as layout from "./layout";
import * as shapes from "./shapes";

export * from "./sprite";
export { layout, primitive, shapes };
