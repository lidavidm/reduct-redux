import wordWrap from "word-wrap";

import { baseProjection, debugDraw } from "./core";
import * as primitive from "./primitive";
import * as util from "./util";

// TODO: make this part of the stage instead?
const TEXT_SIZE_CACHE = {};

export default function text(txt, options) {
    const projection = baseProjection(Object.assign({
        text: txt,
        fontSize: 28,
        font: text.mono,
        color: "#000",
        type: "text",
        wrapWidth: null,
    }, options));

    projection.prepare = function(id, exprId, state, stage) {
        let curText = typeof this.text === "function" ? this.text(state, exprId) : this.text;

        if (this.wrapWidth !== null) {
            curText = wordWrap(curText, this.wrapWidth).split("\n");
        }
        else {
            curText = [ curText ];
        }

        let h = 0;
        let w = 0;

        for (const line of curText) {
            const cacheKey = `${this.fontSize};${this.font};${line}`;
            if (TEXT_SIZE_CACHE[cacheKey] === undefined) {
                stage.ctx.font = `${this.fontSize}px ${this.font}`;
                TEXT_SIZE_CACHE[cacheKey] = stage.ctx.measureText(line).width;
            }
            h += this.fontSize * 1.35;
            w = Math.max(w, TEXT_SIZE_CACHE[cacheKey]);
        }

        this.size.w = w;
        this.size.h = h;

        this._wrappedText = curText;
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        const { ctx } = stage;

        const [ sx, sy ] = util.absoluteScale(this, offset);

        ctx.save();

        debugDraw(ctx, this, offset);

        util.setOpacity(ctx, this.opacity, offset);

        ctx.scale(sx, sy);
        ctx.fillStyle = this.color;
        ctx.textBaseline = "alphabetic";
        ctx.font = `${this.fontSize}px ${this.font}`;

        let dy = 0;
        for (const line of this._wrappedText) {
            ctx.fillText(
                line,
                (offset.x + (this.pos.x * offset.sx)) / sx,
                ((dy + offset.y + (this.pos.y * offset.sy)) / sy) + this.fontSize
            );
            if (this.stroke) {
                primitive.setStroke(ctx, this.stroke);
                ctx.strokeText(
                    line,
                    (offset.x + (this.pos.x * offset.sx)) / sx,
                    ((dy + offset.y + (this.pos.y * offset.sy)) / sy) + this.fontSize
                );
            }
            dy += this.fontSize * 1.35;
        }
        ctx.restore();

        if (stage.isHovered(id) || this.outerStroke) {
            ctx.save();
            const { x, y } = util.topLeftPos(this, offset);

            if (this.outerStroke) {
                primitive.setStroke(ctx, this.outerStroke);
            }
            else {
                primitive.setStroke(ctx, {
                    lineWidth: 2,
                    color: this.highlightColor || "yellow",
                });
            }

            primitive.roundRect(
                ctx,
                x, y,
                offset.sx * this.scale.x * this.size.w,
                offset.sy * this.scale.y * this.size.h,
                this.scale.x * offset.sx * (this.radius || 15),
                false,
                true,
                this.stroke
            );
            ctx.restore();
        }
    };
    return projection;
}

// Font family definitions
text.mono = "'Fira Mono', Consolas, Monaco, monospace";
text.sans = "'Fira Sans', Arial, sans-serif";
text.script = "'Nanum Pen Script', 'Comic Sans', cursive";
