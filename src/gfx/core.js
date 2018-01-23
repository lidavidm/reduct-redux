import * as image from "./image";
import * as notch from "./notch";
import * as primitive from "./primitive";
import * as util from "./util";

export { image, util };

let DEBUG = false;
const DEBUG_COLORS = {
    "hbox": "blue",
    "vbox": "blue",
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

    if (options && options.notches) {
        projection.notches = notch.parseDescriptions(options.notches);
    }

    projection.prepare = function(id, exprId, state, stage) {};
    projection.draw = function(id, exprId, state, stage, offset) {};

    projection.children = function(exprId, state) {
        return [];
    };

    projection.containsPoint = function(pos, offset) {
        const { x, y } = util.topLeftPos(this, offset);
        return pos.x >= x &&
            pos.y >= y &&
            pos.x <= x + (this.size.w * offset.sx * this.scale.x) &&
            pos.y <= y + (this.size.h * offset.sy * this.scale.y);
    };

    projection.notchPos = function(id, exprId, notch) {};

    return projection;
}

export function notchProjection(options) {
    const projection = baseProjection(options);
    projection.type = "notch";

    projection.prepare = function(id, exprId, state, stage) {};
    projection.draw = function(id, exprId, state, stage, offset) {
        if (this.notches) {
            const { x, y } = util.topLeftPos(this, offset);
            const { ctx } = stage;
            const draw = (yOffset) => {
                ctx.beginPath();
                ctx.moveTo(x, y + yOffset);
                this.notches.drawSequence(ctx, "right", x, y + yOffset, this.size.h);
                ctx.lineTo(x, y + this.size.h + yOffset);
                ctx.closePath();
                ctx.fill();
                if (this.highlighted) ctx.stroke();
            };
            ctx.save();
            if (this.highlighted) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "yellow";
            }
            else {
                ctx.lineWidth = 0;
            }
            if (this.shadow) ctx.fillStyle = this.shadowColor;
            draw(this.shadowOffset);
            if (this.color) ctx.fillStyle = this.color;
            draw(0);
            ctx.restore();

            const node = state.getIn([ "nodes", exprId ]);
            if (node.has("notch0")) {
                const childId = node.get("notch0");
                stage.views[childId].anchor.x = 0.0;
                stage.views[childId].anchor.y = 0.0;
                stage.views[childId].pos.x = this.pos.x;
                stage.views[childId].pos.y = this.pos.y;

                stage.views[childId].draw(childId, childId, state, stage, offset);
            }
        }
    };
    projection.notchPos = function(id, exprId, notch) {
        return this.pos;
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

export function distance(proj1, proj2) {
    return Math.sqrt((proj1.pos.x - proj2.pos.x)**2 + (proj1.pos.y - proj2.pos.y)**2);
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

export function baseShape(name, defaults, draw, notchPos=null) {
    return function(options) {
        const projection = Object.assign(baseProjection(), defaults, options);
        projection.size.w = projection.size.h = 50;
        projection.type = name;

        if (options.notches) {
            projection.notches = notch.parseDescriptions(options.notches);
        }

        projection.prepare = function(id, exprId, state, stage) {};
        projection.draw = function(id, exprId, state, stage, offset) {
            const ctx = stage.ctx;
            ctx.save();

            const [ sx, sy ] = util.absoluteScale(this, offset);
            const { x, y } = util.topLeftPos(this, offset);

            const node = state.getIn([ "nodes", exprId ]);
            if (this.shadow || (node && (!node.get("parent") || !node.get("locked")))) {
                ctx.fillStyle = this.shadowColor;
                draw(ctx, this,
                     x, y + this.shadowOffset * offset.sy,
                     offset.sx * this.scale.x * this.size.w,
                     offset.sy * this.scale.y * this.size.h,
                     sx, sy,
                     this.stroke,
                     this.notches);
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
                 this.stroke || shouldStroke,
                 this.notches);
            debugDraw(ctx, this, offset);

            ctx.restore();
        };

        if (notchPos) projection.notchPos = notchPos;

        return projection;
    };
}

export const roundedRect = baseShape("roundedRect", {
    color: "lightgray",
    radius: 20,
    shadowColor: "#000",
    shadowOffset: 4,
    strokeWhenChild: true,  // Draw border when child of another expression
}, (ctx, projection, x, y, w, h, sx, sy, shouldStroke, notches) => {
    primitive.roundRect(
        ctx,
        x, y, w, h,
        sx * projection.radius,
        projection.color ? true : false,
        shouldStroke,
        projection.stroke ? projection.stroke.opacity : null,
        notches
    );
}, function(id, exprId, notchIdx) {
    const pos = util.topLeftPos(this, {
        x: 0,
        y: 0,
        sx: 1,
        sy: 1,
    }); // Assume we are a top level expression
    const notch = this.notches.get(notchIdx);
    switch (notch.side) {
    case "left":
        return {
            x: pos.x,
            y: pos.y + this.radius +
                ((this.size.h - this.radius) * (1 - notch.relpos) * this.scale.y),
        };
    case "right":
        return {
            x: pos.x + (this.size.w * this.scale.x),
            y: pos.y + ((this.radius + ((this.size.h - (this.radius * 2)) * notch.relpos)) * this.scale.y),
        };
    case "top":
        return {
            x: pos.x + this.radius + ((this.size.w - (this.radius * 2)) * notch.relpos),
            y: pos.y,
        };
    case "bottom":
        return {
            x: pos.x + this.radius + ((this.size.w - (this.radius * 2)) * (1 - notch.relpos)),
            y: pos.y + this.size.h,
        };
    default:
        throw `roundedRect#notchPos: unrecognized side ${notch.side}`;
    }
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
    const projection = baseProjection(Object.assign({
        text,
        fontSize: 36,
        font: "Consolas, Monaco, monospace",
        color: "#000",
        type: "text",
    }, options));

    projection.prepare = function(id, exprId, state, stage) {
        const cacheKey = `${this.fontSize};${this.font};${this.text}`;
        if (TEXT_SIZE_CACHE[cacheKey] === undefined) {
            stage.ctx.font = `${this.fontSize}px ${this.font}`;
            TEXT_SIZE_CACHE[cacheKey] = stage.ctx.measureText(this.text).width;
        }
        this.size.h = 50;
        this.size.w = TEXT_SIZE_CACHE[cacheKey];
    };
    projection.draw = function(id, exprId, state, stage, offset) {
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
 * Create a projection that renders based on an expression field or function.
 *
 * Note that all projections must have compatible fields.
 */
export function dynamic(mapping, keyFunc, resetFieldsList=[]) {
    let projection = {};
    for (const childProjection of Object.values(mapping)) {
        projection = Object.assign(projection, childProjection);
    }
    projection.type = "dynamic";

    if (typeof keyFunc === "string") {
        const field = keyFunc;
        keyFunc = function(state, exprId) {
            const expr = state.getIn([ "nodes", exprId ]);
            return expr.get(field);
        };
    }

    projection.prepare = function(id, exprId, state, stage) {
        const fieldVal = keyFunc(state, exprId);

        let proj = mapping["__default__"];
        if (typeof mapping[fieldVal] !== "undefined") {
            proj = mapping[fieldVal];
        }
        this.children = proj.children;

        for (const fieldName of resetFieldsList) {
            this[fieldName] = proj[fieldName];
        }
        proj.prepare.call(this, id, exprId, state, stage);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        const fieldVal = keyFunc(state, exprId);

        if (typeof mapping[fieldVal] !== "undefined") {
            this.children = mapping[fieldVal].children;
            mapping[fieldVal].draw.call(this, id, exprId, state, stage, offset);
        }
        else {
            this.children = mapping["__default__"].children;
            mapping["__default__"].draw.call(this, id, exprId, state, stage, offset);
        }
    };

    return projection;
}

import * as layout from "./layout";
import * as shapes from "./shapes";

export * from "./sprite";
export { layout, primitive, shapes };
