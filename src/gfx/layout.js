import { roundedRect } from "./core";
import * as util from "./util";

export function hexpand(projection) {
    const origPrepare = projection.prepare;
    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
        this.size.w = stage.width;
    };
    return projection;
}

export function sticky(projection, direction) {
    const origPrepare = projection.prepare;
    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
        if (direction === "bottom") {
            this.pos.y = stage.height - this.size.h;
        }
        else if (direction === "top") {
            this.pos.y = 0;
        }
    };
    return projection;
}

export function hbox(childrenFunc, options={}, baseProjection=roundedRect) {
    const projection = baseProjection(Object.assign({}, {
        padding: { left: 10, inner: 10, right: 10 },
        subexpScale: 0.85,
    }, options));
    const baseDraw = projection.draw;
    projection.baseType = projection.type;
    projection.type = "hbox";

    projection.prepare = function(id, exprId, state, stage) {
        const children = childrenFunc(exprId, state);
        let x = this.padding.left;

        let maxY = 50;
        for (const childId of children) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            childProjection.pos.x = x;
            childProjection.anchor.x = 0;
            childProjection.anchor.y = 0;
            childProjection.scale.x = this.subexpScale;
            childProjection.scale.y = this.subexpScale;

            childProjection.prepare(childId, exprId, state, stage);
            x += (childProjection.size.w * childProjection.scale.x) + this.padding.inner;
            maxY = Math.max(maxY, childProjection.size.h);
        }
        this.size.w = x - this.padding.inner + this.padding.right;
        this.size.h = maxY;
        for (let childId of children) {
            const childProjection = stage.views[childId];
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
        });
        for (let childId of childrenFunc(exprId, state)) {
            stage.views[childId].draw(childId, childId, state, stage, subOffset);
        }
    };
    return projection;
}

export function vbox(childrenFunc, options={}, baseProjection=roundedRect) {
    const projection = baseProjection(options);
    const baseDraw = projection.draw;
    projection.padding = { top: 10, left: 0, inner: 10, right: 0, bottom: 10 };
    projection.subexpScale = 0.85;
    projection.type = "vbox";

    Object.assign(projection, options);

    projection.prepare = function(id, exprId, state, stage) {
        const children = childrenFunc(exprId, state);
        let maxX = 50;
        let y = this.padding.top;

        for (let childId of children) {
            const childProjection = stage.views[childId];

            childProjection.parent = this;

            childProjection.pos.y = y;
            childProjection.scale.x = this.subexpScale;
            childProjection.scale.y = this.subexpScale;

            childProjection.prepare(childId, exprId, state, stage);
            y += childProjection.size.h * childProjection.scale.y + this.padding.inner;
            maxX = Math.max(maxX, childProjection.size.w);
        }
        this.size.w = maxX + this.padding.left + this.padding.right;
        this.size.h = y - this.padding.inner + this.padding.bottom;
        for (let childId of children) {
            const childProjection = stage.views[childId];
            childProjection.pos.x =
                (this.size.w * this.scale.x -
                 childProjection.size.w * childProjection.scale.x * this.scale.x) / 2;
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
        });
        for (let childId of childrenFunc(id, state)) {
            stage.views[childId].draw(childId, childId, state, stage, subOffset);
        }
    };
    return projection;
}
