// TODO: this should probably go somewhere else
import { nextId } from "./reducer";

export const defaultView = {
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    // Nested objects won't get cloned properly using Object.assign
    sx: 1,
    sy: 1,
    radius: 5,
    color: "lightgray",
    shadow: true,
    shadowOffset: 4,
    shadowColor: "black",
};

export function initializeView(id, nodes, views) {
    const expr = nodes[id];
    switch (expr.type) {
    case "number":
        return Object.assign({}, defaultView, {
            projection: roundedRect(),
            color: "#FFF",
        });
    case "missing":
        return Object.assign({}, defaultView, {
            projection: roundedRect(),
            color: "#555555",
        });
    case "add": {
        const textId = nextId();
        views[textId] = textView("+");
        return Object.assign({}, defaultView, {
            projection: box("horizontal", function(id, nodes, views) {
                const expr = nodes[id];
                return [
                    expr.left,
                    textId,
                    expr.right,
                ];
            }, {}),
        });
    }
    default:
        console.error(`Undefined expr type ${expr.type}.`);
        return null;
    }
}

export function textView(text) {
    return Object.assign({}, defaultView, {
        text: text,
        projection: textProjection(),
        fontSize: 35,
        font: "Consolas, Monaco, monospace",
        color: "#000",
    });
}

export function draw(expr, nodes, views, stage) {
    const view = views[expr.id];
    view.projection.prepare(expr.id, nodes, views, stage);
    view.projection.draw(expr.id, {
        x: 0,
        y: 0,
        sx: 1,
        sy: 1,
    }, nodes, views, stage);
}

export function containsPoint(pos, expr, nodes, views, stage) {
    const view = views[expr.id];
    return pos.x >= view.x && pos.x <= view.x + view.w &&
        pos.y >= view.y && pos.y <= view.y + view.h;
}

function box(direction, childrenFunc, options={}) {
    options.subexpScale = options.subexpScale || 0.85;
    options.padding = options.padding || { left: 10, inner: 10, right: 10 };

    return {
        prepare: function(id, nodes, views, stage) {
            const children = childrenFunc(id, nodes, views);
            const view = views[id];
            let x = options.padding.left;
            for (let childId of children) {
                const childView = views[childId];
                childView.x = x;
                childView.y = 0;
                childView.sx = options.subexpScale;
                childView.sy = options.subexpScale;
                childView.shadow = false;
                childView.projection.prepare(childId, nodes, views, stage);
                x += childView.w * childView.sx + options.padding.inner;
                childView.y = (view.h * view.sy - childView.h * childView.sy) / 2;
            }
            view.w = x + options.padding.right;
        },
        draw: function(id, offset, nodes, views, stage) {
            const ctx = stage.ctx;
            const view = views[id];
            if (view.shadow) {
                ctx.fillStyle = view.shadowColor;
                roundRect(ctx,
                          offset.x + view.x, offset.y + view.y + view.shadowOffset,
                          offset.sx * view.sx * view.w,
                          offset.sy * view.sy * view.h,
                          offset.sx * view.radius,
                          view.color ? true : false,
                          view.stroke ? true : false,
                          view.stroke ? view.stroke.opacity : null);
            }

            if (view.color) ctx.fillStyle = view.color;
            roundRect(ctx,
                      offset.x + view.x, offset.y + view.y,
                      offset.sx * view.sx * view.w,
                      offset.sy * view.sy * view.h,
                      offset.sx * view.radius,
                      view.color ? true : false,
                      view.stroke ? true : false,
                      view.stroke ? view.stroke.opacity : null);

            const subOffset = Object.assign({}, offset, {
                x: offset.x + view.x,
                y: offset.y + view.y,
                sx: offset.sx * view.sx,
                sy: offset.sy * view.sy,
            });
            for (let childId of childrenFunc(id, nodes, views)) {
                views[childId].projection.draw(childId, subOffset, nodes, views, stage);
            }
        }
    };
}

function roundedRect(options={}) {
    return {
        prepare: function(id, nodes, views, stage) {
            views[id].w = views[id].h = 50;
        },
        draw: function(id, offset, nodes, views, stage) {
            const ctx = stage.ctx;
            const view = views[id];
            if (view.shadow) {
                ctx.fillStyle = view.shadowColor;
                roundRect(ctx,
                          offset.x + view.x, offset.y + view.y + view.shadowOffset,
                          offset.sx * view.sx * view.w,
                          offset.sy * view.sy * view.h,
                          offset.sx * view.radius,
                          view.color ? true : false,
                          view.stroke ? true : false,
                          view.stroke ? view.stroke.opacity : null);
            }

            if (view.color) ctx.fillStyle = view.color;
            roundRect(ctx,
                      offset.x + view.x, offset.y + view.y,
                      offset.sx * view.sx * view.w,
                      offset.sy * view.sy * view.h,
                      offset.sx * view.radius,
                      view.color ? true : false,
                      view.stroke ? true : false,
                      view.stroke ? view.stroke.opacity : null);
        }
    };
}

function textProjection(options={}) {
    return {
        prepare: function(id, nodes, views, stage) {
            views[id].w = views[id].h = 50;
        },
        draw: function(id, offset, nodes, views, stage) {
            const ctx = stage.ctx;
            const view = views[id];
            ctx.save();
            ctx.fillStyle = view.color;
            ctx.font = `${view.fontSize}px ${view.font}`;
            ctx.fillText(view.text, offset.x + view.x, offset.y + view.y);
            ctx.restore();
        }
    };
}

function drawDefault(stage, expr, nodes, views) {
    const ctx = stage.ctx;
    const view = views[expr.id];

    if (view.shadow) {
        ctx.fillStyle = view.shadowColor;
        roundRect(ctx,
                  view.x, view.y + view.shadowOffset,
                  view.w, view.h,
                  view.radius/* view.absoluteScale.x */,
                  view.color ? true : false,
                  view.stroke ? true : false,
                  view.stroke ? view.stroke.opacity : null);
    }

    if (view.color) ctx.fillStyle = view.color;
    roundRect(ctx,
              view.x, view.y,
              view.w, view.h,
              view.radius/* view.absoluteScale.x */,
              view.color ? true : false,
              view.stroke ? true : false,
              view.stroke ? view.stroke.opacity : null);
}

export function drawNumber(stage, expr, nodes, views) {
    drawDefault(stage, expr, nodes, views);
}

export function drawMissing(stage, expr, nodes, views) {
    views[expr.id].color = "#555555";
    drawDefault(stage, expr, nodes, views);

}

export function drawAdd(stage, expr, nodes, views) {
    drawDefault(stage, expr, nodes, views);
}

/**
 * THANKS TO Juan Mendes @ SO: http://stackoverflow.com/a/3368118
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 5] The corner radius; It can also be an object
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
function roundRect(ctx, x, y, width, height, radius, fill, stroke, strokeOpacity) {
    if (typeof stroke == 'undefined') stroke = true;
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') radius = {tl: radius, tr: radius, br: radius, bl: radius};
    else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }

    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) strokeWithOpacity(ctx, strokeOpacity);
}
