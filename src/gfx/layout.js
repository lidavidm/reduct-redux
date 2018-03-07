import * as animate from "./animate";
import { debugDraw, roundedRect } from "./core";
import * as util from "./util";

export function hexpand(projection) {
    return expand(projection, { horizontal: true });
}

export function expand(projection, options) {
    const origPrepare = projection.prepare;
    projection.expand = options;
    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
        if (this.expand.horizontal) {
            this.size.w = stage.width;
        }
        if (this.expand.vertical) {
            this.size.h = stage.height;
        }
    };
    return projection;
}

export function sticky(projection, direction, options) {
    const origPrepare = projection.prepare;
    projection.sticky = Object.assign({
        margin: 0,
        marginX: 0,
        marginY: 0,
        align: "left",
    }, options || {});
    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
        this.anchor.x = 0;
        this.anchor.y = 0;
        if (direction === "bottom") {
            this.pos.y = stage.height - this.size.h;
        }
        else if (direction === "top") {
            this.pos.y = this.sticky.margin;
        }
        else if (direction === "left") {
            this.pos.x = 0;
        }
        else if (direction === "center") {
            this.pos.x = ((stage.width - this.size.w) / 2) + this.sticky.marginX;
            this.pos.y = ((stage.height - this.size.h) / 2) + this.sticky.marginY;
        }

        if (direction === "top" || direction === "bottom") {
            if (this.sticky.align === "center") {
                this.pos.x = (stage.width - this.size.w) / 2;
            }
            else if (this.sticky.align === "right") {
                this.pos.x = stage.width - this.size.w;
            }
        }
    };
    return projection;
}

export function hbox(childrenFunc, options={}, baseProjection=roundedRect) {
    if (options && options.padding) {
        options.padding = Object.assign({
            left: 10, inner: 5, right: 10,
        }, options.padding);
    }

    const projection = baseProjection(Object.assign({}, {
        padding: { left: 10, inner: 5, right: 10 },
        subexpScale: 0.85,
    }, options));
    const baseDraw = projection.draw;
    projection.baseType = projection.type;
    projection.type = "hbox";

    projection.prepare = function(id, exprId, state, stage) {
        let x = this.padding.left;

        let maxY = 40;
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            if (!childProjection.animating) {
                childProjection.pos.x = x;
                childProjection.anchor.x = 0;
                childProjection.anchor.y = 0;
                childProjection.scale.x = this.subexpScale;
                childProjection.scale.y = this.subexpScale;
            }

            childProjection.prepare(childId, subexprId, state, stage);
            x += (childProjection.size.w * childProjection.scale.x) + this.padding.inner;
            maxY = Math.max(maxY, childProjection.size.h * childProjection.scale.y);
        }
        this.size.w = x - this.padding.inner + this.padding.right;
        this.size.h = maxY;
        for (const [ childId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];
            if (childProjection.animating) continue;

            childProjection.pos.y = (this.size.h * this.scale.y - childProjection.size.h * childProjection.scale.y * this.scale.y) / 2;
        }
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        baseDraw.call(this, id, exprId, state, stage, offset);

        const [ sx, sy ] = util.absoluteScale(this, offset);
        const { x, y } = util.topLeftPos(this, offset);

        const subOffset = Object.assign({}, offset, {
            x: x,
            y: y,
            sx: offset.sx * this.scale.x,
            sy: offset.sy * this.scale.y,
            opacity: this.opacity * offset.opacity,
        });

        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            stage.views[childId].draw(childId, subexprId, state, stage, subOffset);
        }

        debugDraw(stage.ctx, this, offset);
    };

    projection.children = util.genericChildrenFunc(childrenFunc);

    return projection;
}

export function vbox(childrenFunc, options={}, baseProjection=roundedRect) {
    if (options && options.padding) {
        options.padding = Object.assign({
            top: 5, left: 0, inner: 5, right: 0, bottom: 5,
        }, options.padding);
    }
    const projection = baseProjection(Object.assign({
        horizontalAlign: 0.5,
        padding: { top: 5, left: 0, inner: 5, right: 0, bottom: 5 },
        subexpScale: 0.85,
    }, options));
    const baseDraw = projection.draw;
    projection.type = "vbox";

    projection.prepare = function(id, exprId, state, stage) {
        let maxX = 50;
        let y = this.padding.top;

        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            childProjection.pos.y = y;
            childProjection.scale.x = this.subexpScale;
            childProjection.scale.y = this.subexpScale;

            childProjection.prepare(childId, subexprId, state, stage);
            y += childProjection.size.h * childProjection.scale.y + this.padding.inner;
            maxX = Math.max(maxX, childProjection.size.w * childProjection.scale.x);
        }
        this.size.w = maxX + this.padding.left + this.padding.right;
        this.size.h = y - this.padding.inner + this.padding.bottom;
        for (const [ childId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];
            childProjection.pos.x =
                this.scale.x * this.padding.left +
                this.horizontalAlign * (this.size.w * this.scale.x -
                 childProjection.size.w * childProjection.scale.x * this.scale.x);
        }
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        baseDraw.call(this, id, exprId, state, stage, offset);

        const [ sx, sy ] = util.absoluteScale(this, offset);
        const { x, y } = util.topLeftPos(this, offset);

        const subOffset = Object.assign({}, offset, {
            x: x,
            y: y,
            sx: offset.sx * this.scale.x,
            sy: offset.sy * this.scale.y,
            opacity: this.opacity * offset.opacity,
        });
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            stage.views[childId].draw(childId, subexprId, state, stage, subOffset);
        }
    };

    projection.children = util.genericChildrenFunc(childrenFunc);

    return projection;
}

export function previewer(projection) {
    const { prepare, draw } = projection;

    projection.prepare = function(id, exprId, state, stage) {
        if (this.preview && !this.prevPreview) {
            this.prevPreview = { x: 0.2, y: 0.2 };

            const duration = (this.previewOptions ? this.previewOptions.duration : 250) || 250;
            animate.tween(this.prevPreview, {
                x: 1.0,
                y: 1.0,
            }, {
                duration,
                easing: animate.Easing.Cubic.Out,
            });
        }
        else if (!this.preview) {
            delete this.prevPreview;
        }
        if (this.preview) {
            stage.views[this.preview].prepare(this.preview, this.preview, state, stage);
            return;
        }

        prepare.call(this, id, exprId, state, stage);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        if (this.preview) {
            const temp = Object.assign({}, stage.views[this.preview], {
                pos: {
                    x: this.pos.x + (0.5 * this.size.w),
                    y: this.pos.y,
                },
                shadow: false,
                scale: {
                    x: this.prevPreview.x * this.subexpScale,
                    y: this.prevPreview.y * this.subexpScale,
                },
                anchor: { x: 0.5, y: 0 },
                opacity: 1,
            });
            temp.draw(this.preview, this.preview, state, stage, offset);
            return;
        }

        draw.call(this, id, exprId, state, stage, offset);
    };

    return projection;
}
