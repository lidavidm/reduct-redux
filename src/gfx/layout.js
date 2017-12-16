import { roundedRect } from "./core";
import * as util from "./util";

export function hexpand(projection) {
    const origPrepare = projection.prepare;
    projection.prepare = function(id, state, stage) {
        origPrepare(id, state, stage);
        projection.size.w = stage.width;
    };
    return projection;
}

export function sticky(projection, direction) {
    const origPrepare = projection.prepare;
    projection.prepare = function(id, state, stage) {
        origPrepare(id, state, stage);
        if (direction === "bottom") {
            projection.pos.y = stage.height - projection.size.h;
        }
        else if (direction === "top") {
            projection.pos.y = 0;
        }
    };
    return projection;
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
        const children = childrenFunc(id, state);
        let x = projection.padding.left;

        let maxY = 50;
        for (let childId of children) {
            const childProjection = stage.views[childId];

            childProjection.parent = projection;

            childProjection.pos.x = x;
            childProjection.anchor.x = childProjection.anchor.y = 0;
            childProjection.scale.x = projection.subexpScale;
            childProjection.scale.y = projection.subexpScale;

            childProjection.prepare(childId, state, stage);
            x += childProjection.size.w * childProjection.scale.x + projection.padding.inner;
            maxY = Math.max(maxY, childProjection.size.h);
        }
        projection.size.w = x;
        projection.size.h = maxY;
        for (let childId of children) {
            const childProjection = stage.views[childId];
            childProjection.pos.y = (projection.size.h * projection.scale.y - childProjection.size.h * childProjection.scale.y * projection.scale.y) / 2;
        }
    };
    projection.draw = function(id, state, stage, offset) {
        baseDraw(id, state, stage, offset);

        const [ sx, sy ] = util.absoluteScale(projection, offset);
        const { x, y } = util.topLeftPos(projection, offset);

        const subOffset = Object.assign({}, offset, {
            x: x,
            y: y,
            sx: offset.sx * projection.scale.x,
            sy: offset.sy * projection.scale.y,
        });
        for (let childId of childrenFunc(id, state)) {
            stage.views[childId].draw(childId, state, stage, subOffset);
        }
    };
    return projection;
}

export function vbox(childrenFunc, options={}, baseProjection=roundedRect) {
    const projection = baseProjection(options);
    const basePrepare = projection.prepare;
    const baseDraw = projection.draw;
    projection.padding = { top: 10, left: 0, inner: 10, right: 0, bottom: 10 };
    projection.subexpScale = 0.85;
    projection.type = "vbox";

    Object.assign(projection, options);

    projection.prepare = function(id, state, stage) {
        const children = childrenFunc(id, state);
        let maxX = 50;
        let y = projection.padding.top;

        for (let childId of children) {
            const childProjection = stage.views[childId];

            childProjection.parent = projection;

            childProjection.pos.y = y;
            childProjection.scale.x = projection.subexpScale;
            childProjection.scale.y = projection.subexpScale;

            childProjection.prepare(childId, state, stage);
            y += childProjection.size.h * childProjection.scale.y + projection.padding.inner;
            maxX = Math.max(maxX, childProjection.size.w);
        }
        projection.size.w = maxX + projection.padding.left + projection.padding.right;
        projection.size.h = y - projection.padding.inner + projection.padding.bottom;
        for (let childId of children) {
            const childProjection = stage.views[childId];
            childProjection.pos.x =
                (projection.size.w * projection.scale.x -
                 childProjection.size.w * childProjection.scale.x * projection.scale.x) / 2;
        }
    };
    projection.draw = function(id, state, stage, offset) {
        baseDraw(id, state, stage, offset);

        const [ sx, sy ] = util.absoluteScale(projection, offset);
        const { x, y } = util.topLeftPos(projection, offset);

        const subOffset = Object.assign({}, offset, {
            x: x,
            y: y,
            sx: offset.sx * projection.scale.x,
            sy: offset.sy * projection.scale.y,
        });
        for (let childId of childrenFunc(id, state)) {
            stage.views[childId].draw(childId, state, stage, subOffset);
        }
    };
    return projection;
}
