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
export function roundRect(ctx, x, y, width, height, radius, fill, stroke, strokeOpacity) {
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

/** Thanks to markE @ SO: http://stackoverflow.com/a/25840319 */
export function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fill, stroke, strokeOpacity) {
     var rot = Math.PI / 2 * 3;
     var x = cx;
     var y = cy;
     var step = Math.PI / spikes;
     ctx.beginPath();
     ctx.moveTo(cx, cy - outerRadius);
     for (var i = 0; i < spikes; i++) {
         x = cx + Math.cos(rot) * outerRadius;
         y = cy + Math.sin(rot) * outerRadius;
         ctx.lineTo(x, y);
         rot += step;

         x = cx + Math.cos(rot) * innerRadius;
         y = cy + Math.sin(rot) * innerRadius;
         ctx.lineTo(x, y);
         rot += step;
     }
     ctx.lineTo(cx, cy - outerRadius);
     ctx.closePath();
     if (stroke) {
         strokeWithOpacity(ctx, strokeOpacity);
     }
     if (fill) {
         ctx.fill();
     }
}

export function strokeWithOpacity(ctx, opacity) {
    if (!opacity || opacity >= 1.0) ctx.stroke();
    else {
        let a = ctx.globalAlpha;
        ctx.globalAlpha = a * opacity;
        ctx.stroke();
        ctx.globalAlpha = a;
    }
}