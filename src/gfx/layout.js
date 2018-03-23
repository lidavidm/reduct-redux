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
            this.pos.y = stage.height - this.size.h - this.sticky.margin;
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
            left: 10, inner: 5, right: 10, top: 0, bottom: 0,
        }, options.padding);
    }

    const projection = baseProjection(Object.assign({}, {
        padding: { left: 10, inner: 5, right: 10, top: 0, bottom: 0 },
        subexpScale: 0.85,
    }, options));
    const baseDraw = projection.draw;
    const basePrepare = projection.prepare;

    projection.baseType = projection.type;
    projection.type = "hbox";

    projection.prepare = function(id, exprId, state, stage) {
        basePrepare.call(this, id, exprId, state, stage);
        let x = this.padding.left;

        let maxY = 40;
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            if (typeof childProjection.animating !== "number" || childProjection.animating === 0) {
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
        this.size.h = maxY + this.padding.top + this.padding.bottom;
        for (const [ childId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];
            if (typeof childProjection.animating === "number" && childProjection.animating > 0) continue;

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
        ellipsize: false,
    }, options));
    const baseDraw = projection.draw;
    const basePrepare = projection.prepare;
    projection.type = "vbox";

    projection.isEllipsized = function(id, exprId, state) {
        const parent = state.getIn([ "nodes", exprId, "parent" ]);
        const parent2 = state.getIn([ "nodes", parent, "parent" ]);
        return this.ellipsize &&
            (id === exprId) && // Are we the top-level projection for this expression?
            parent && parent2 &&
            state.getIn([ "nodes", exprId, "type" ]) === state.getIn([ "nodes", parent, "type"]) &&
            state.getIn([ "nodes", parent, "type" ]) === state.getIn([ "nodes", parent2, "type"]);
    };

    projection.prepare = function(id, exprId, state, stage) {
        if (this.isEllipsized(id, exprId, state)) {
            this.size.w = 50;
            this.size.h = 50;
            return;
        }

        basePrepare.call(id, exprId, state, stage);

        let maxX = 50;
        let y = this.padding.top;

        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            if (!childProjection.animating) {
                childProjection.pos.y = y;
                childProjection.scale.x = this.subexpScale;
                childProjection.scale.y = this.subexpScale;
            }

            childProjection.prepare(childId, subexprId, state, stage);
            y += childProjection.size.h * childProjection.scale.y + this.padding.inner;
            maxX = Math.max(maxX, childProjection.size.w * childProjection.scale.x);
        }
        this.size.w = maxX + this.padding.left + this.padding.right;
        this.size.h = y - this.padding.inner + this.padding.bottom;
        for (const [ childId ] of this.children(exprId, state)) {
            const childProjection = stage.views[childId];
            if (childProjection.animating) continue;

            childProjection.pos.x =
                this.scale.x * this.padding.left +
                this.horizontalAlign * (this.size.w * this.scale.x -
                 childProjection.size.w * childProjection.scale.x * this.scale.x);
        }
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        baseDraw.call(this, id, exprId, state, stage, offset);

        const { x, y } = util.topLeftPos(this, offset);

        if (this.isEllipsized(id, exprId, state)) {
            const [ sx, sy ] = util.absoluteScale(this, offset);
            const { ctx } = stage;

            ctx.save();
            ctx.fillStyle = "gray";
            const r = 5 * Math.min(sx, sy);
            const w = offset.sx * this.scale.x * (this.size.w - (4 * r));
            const h = offset.sy * this.scale.y * this.size.h;
            ctx.beginPath();
            ctx.arc(x + (2 * r), y + (h / 2), r, 0, 2 * Math.PI, false);
            ctx.arc(x + (2 * r) + (w / 2), y + (h / 2), r, 0, 2 * Math.PI, false);
            ctx.arc(x + (2 * r) + w, y + (h / 2), r, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.restore();

            return;
        }

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
            this.prevPreview = Object.assign({}, stage.getView(this.preview), {
                pos: {
                    x: this.pos.x,
                    y: this.pos.y,
                },
                scale: {
                    x: this.scale.x,
                    y: this.scale.y,
                },
                shadow: false,
                anchor: { x: 0, y: 0 },
                opacity: 1,
            });
        }
        else if (!this.preview) {
            delete this.prevPreview;
        }
        if (this.preview) {
            this.prevPreview.prepare(this.preview, this.preview, state, stage);
            this.size = {
                w: this.scale.x * stage.views[this.preview].size.w,
                h: this.scale.y * stage.views[this.preview].size.h,
            };
            return;
        }

        prepare.call(this, id, exprId, state, stage);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        if (this.preview) {
            this.prevPreview.draw(this.preview, this.preview, state, stage, Object.assign({}, offset, {
                sx: offset.sx * this.scale.x,
                sy: offset.sy * this.scale.y,
            }));
            return;
        }

        draw.call(this, id, exprId, state, stage, offset);
    };

    return projection;
}
