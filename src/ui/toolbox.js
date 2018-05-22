import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import Loader from "../loader";

const TOOLBOX_ROW_HEIGHT = 90;
const TOOLBOX_LEFT_MARGIN = 40;
const TOOLBOX_RIGHT_MARGIN = 40;
const TOOLBOX_INNER_MARGIN = 20;

/**
 * Renders the toolbox at the bottom of the screen.
 * @module Toolbox
 */
export default class Toolbox {
    constructor(stage) {
        this.stage = stage;
        // TODO: leftover stuff - we used to use a sprite for the
        // background, now it's drawn in canvas, but I never ported
        // over stuff that assumed we had a sprite view
        this.bg = stage.allocateInternal(gfx.layout.sticky(gfx.layout.hexpand(gfx.sprite({
            image: Loader.images["toolbox-bg"],
            size: { h: TOOLBOX_ROW_HEIGHT },
        })), "bottom"));

        this._firstRender = true;
        this.rows = 1;
        this._size = { w: 0, h: 0 };
        this._pos = { x: 0, y: 0 };
    }

    containsPoint(pos) {
        return pos.y >= this.stage.internalViews[this.bg].pos.y;
    }

    get size() {
        return {
            w: this.stage.internalViews[this.bg].size.w,
            h: this.stage.internalViews[this.bg].size.h,
        };
    }

    get pos() {
        return this.stage.internalViews[this.bg].pos;
    }

    getNodeAtPos(state, pos) {
        if (!this.containsPoint(pos)) return [ null, null ];

        for (const nodeId of state.get("toolbox")) {
            if (!this.stage.semantics.targetable(state, state.get("nodes").get(nodeId))) {
                continue;
            }
            const projection = this.stage.views[nodeId];

            if (projection.containsPoint(pos, this.stage.makeBaseOffset())) {
                return [ nodeId, nodeId ];
            }
        }

        return [ null, null ];
    }

    reset() {
    }

    startLevel(state) {
        this._firstRender = true;
        this.resizeRows(state);
    }

    resizeRows(state) {
        // Figure out how many rows to use
        let x = TOOLBOX_LEFT_MARGIN;
        let rows = 1;
        for (const nodeId of state.get("toolbox")) {
            const projection = this.stage.views[nodeId];
            projection.scale = { x: 1, y: 1 };
            projection.prepare(nodeId, nodeId, state, this.stage);

            if (x + projection.size.w >= this.stage.width - TOOLBOX_RIGHT_MARGIN) {
                rows += 1;
                x = TOOLBOX_LEFT_MARGIN;
            }
            x += projection.size.w + TOOLBOX_INNER_MARGIN;
        }

        this.rows = rows;
        this.stage.internalViews[this.bg].size.h = this.rowHeight * this.rows;
    }

    get rowHeight() {
        return this.rows <= 1 ? TOOLBOX_ROW_HEIGHT : 70;
    }

    drawBase(state) {
        this.stage.internalViews[this.bg].prepare(null, null, state, this.stage);
        const { ctx } = this.stage;
        ctx.fillStyle = "#1a3849";
        gfx.primitive.roundRect(
            ctx,
            25,
            this.stage.internalViews[this.bg].pos.y,
            this.stage.internalViews[this.bg].size.w - 50,
            this.stage.internalViews[this.bg].size.h - 10,
            25,
            true, false
        );
    }

    drawImpl(state) {
        let x = TOOLBOX_LEFT_MARGIN;
        const y = this.stage.internalViews[this.bg].pos.y - 5;

        let curRow = 0;
        x = TOOLBOX_LEFT_MARGIN;
        let i = 0;
        for (const nodeId of state.get("toolbox")) {
            const projection = this.stage.views[nodeId];
            if (x + projection.size.w >= this.stage.width - TOOLBOX_RIGHT_MARGIN) {
                curRow += 1;
                x = TOOLBOX_LEFT_MARGIN;
                i = 0;
            }

            const nodeY = y + (curRow * this.rowHeight) + ((this.rowHeight) / 2);

            if (this.stage.isSelected(nodeId)) {
                // Do nothing - don't override position
            }
            else if (this._firstRender) {
                projection.pos.x = x + (this.stage.width / 3);
                projection.pos.y = nodeY;
                projection.scale.x = 0;
                projection.scale.y = 0;
                projection.anchor = { x: 0, y: 0.5 };
                animate
                    .tween(projection, {
                        pos: { x },
                        scale: { x: 1, y: 1 },
                    }, {
                        easing: animate.Easing.Cubic.Out,
                        duration: 400,
                    })
                    .delay(200 * Math.log(2 + i));
            }
            else if (projection.pos.x !== x && !projection.animating && !this._firstRender) {
                animate
                    .tween(projection, { pos: { x, y: nodeY }, anchor: { x: 0, y: 0.5 } }, {
                        duration: 400,
                        easing: animate.Easing.Cubic.Out,
                    });
            }
            else if (!projection.animating) {
                projection.pos.x = x;
                projection.pos.y = nodeY;
                projection.anchor = { x: 0, y: 0.5 };
            }

            x += projection.size.w + TOOLBOX_INNER_MARGIN;

            projection.prepare(nodeId, nodeId, state, this.stage);

            const node = state.get("nodes").get(nodeId);
            if (node.has("__meta") && node.get("__meta").toolbox.unlimited) {
                projection.draw(nodeId, nodeId, state, this.stage, this.stage.makeBaseOffset({
                    x: 2,
                    y: 6,
                }));
            }

            projection.draw(nodeId, nodeId, state, this.stage, this.stage.makeBaseOffset());

            if (node.has("__meta") && node.get("__meta").toolbox.unlimited) {
                projection.draw(nodeId, nodeId, state, this.stage, this.stage.makeBaseOffset({
                    x: -2,
                    y: -6,
                }));
            }

            i++;
        }

        this._firstRender = false;
    }
}
