export const defaultView = {
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    radius: 5,
    color: "lightgray",
    shadow: true,
    shadowOffset: 4,
    shadowColor: "black",
};

export function draw(expr, nodes, views, stage) {
    if (!views[expr.id]) views[expr.id] = Object.assign({}, defaultView);

    switch (expr.type) {
    case "number":
        drawNumber(stage, expr, nodes, views);
        break;
    case "missing":
        drawMissing(stage, expr, nodes, views);
        break;
    case "add":
        drawAdd(stage, expr, nodes, views);
        break;
    default:
        console.error(`Undefined expr type ${expr.type}.`);
    }
}

export function containsPoint(pos, expr, nodes, views, stage) {
    const view = views[expr.id] || defaultView;
    return pos.x >= view.x && pos.x <= view.x + view.w &&
        pos.y >= view.y && pos.y <= view.y + view.h;
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
