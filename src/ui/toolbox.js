import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import Loader from "../loader";

const TOOLBOX_ROW_HEIGHT = 90;
const TOOLBOX_LEFT_MARGIN = 40;
const TOOLBOX_RIGHT_MARGIN = 90;
const TOOLBOX_INNER_MARGIN = 20;

export default class Toolbox {
    constructor(stage) {
        this.stage = stage;
        this.bg = stage.allocateInternal(gfx.layout.sticky(gfx.layout.hexpand(gfx.sprite({
            image: Loader.images["toolbox-bg"],
            size: { h: TOOLBOX_ROW_HEIGHT },
        })), "bottom"));

        this.infBg = stage.allocateInternal(gfx.shapes.circle({
            size: { w: 40, h: 40 },
            color: "#0D0",
        }));
        this.inf = stage.allocateInternal(gfx.sprite({
            image: Loader.images["infinity-symbol"],
            size: { h: 12, w: 25 },
        }));

        const syntaxJournal = gfx.layout.sticky(gfx.ui.imageButton({
            normal: Loader.images["journal-default"],
            hover: Loader.images["journal-hover"],
            active: Loader.images["journal-mousedown"],
        }, {
            click: () => this.stage.syntaxJournal.toggle(),
        }), "bottom", {
            align: "right",
        });
        syntaxJournal.size = { w: 79, h: 78 };
        this.syntaxJournal = stage.allocateInternal(syntaxJournal);

        this._firstRender = true;
        this.rows = 1;
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

        const journal = this.stage.internalViews[this.syntaxJournal];
        if (journal.containsPoint(pos, { x: 0, y: 0, sx: 1, sy: 1 })) {
            return [ this.syntaxJournal, this.syntaxJournal ];
        }

        for (const nodeId of state.get("toolbox")) {
            if (!this.stage.semantics.targetable(state, state.get("nodes").get(nodeId))) {
                continue;
            }
            const projection = this.stage.views[nodeId];

            if (projection.containsPoint(pos, { x: 0, y: 0, sx: 1, sy: 1 })) {
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
        this.stage.internalViews[this.bg].draw(null, null, state, this.stage, {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
        });

        this.stage.internalViews[this.syntaxJournal].prepare(null, null, state, this.stage);
        this.stage.internalViews[this.syntaxJournal].draw(null, null, state, this.stage, {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
        });
    }

    drawImpl(state) {
        let x = TOOLBOX_LEFT_MARGIN;
        const y = this.stage.internalViews[this.bg].pos.y;

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

            const nodeY = y + (curRow * this.rowHeight) + ((this.rowHeight - projection.size.h) / 2);

            if (this.stage.isSelected(nodeId)) {
                // Do nothing - don't override position
            }
            else if (this._firstRender) {
                projection.pos.x = x + this.stage.width;
                projection.pos.y = nodeY;
                animate
                    .tween(projection, { pos: { x } }, {
                        easing: animate.Easing.Cubic.Out,
                        duration: 400,
                    })
                    .delay(400 * Math.log(2 + i));
            }
            else if (projection.pos.x !== x && !projection.animating && !this._firstRender) {
                animate
                    .tween(projection, { pos: { x, y: nodeY } }, {
                        duration: 250,
                        easing: animate.Easing.Cubic.Out,
                    });
            }
            else if (!projection.animating) {
                projection.pos.x = x;
                projection.pos.y = nodeY;
            }

            x += projection.size.w + TOOLBOX_INNER_MARGIN;
            projection.prepare(nodeId, nodeId, state, this.stage);
            projection.draw(nodeId, nodeId, state, this.stage, {
                x: 0,
                y: 0,
                sx: 1,
                sy: 1,
            });

            const node = state.get("nodes").get(nodeId);
            if (node.has("__meta") && node.get("__meta").toolbox.unlimited) {
                this.stage.internalViews[this.infBg].draw(-1, nodeId, state, this.stage, {
                    x: projection.pos.x + projection.size.w - 33,
                    y: projection.pos.y - 20,
                    sx: 1,
                    sy: 1,
                });
                this.stage.internalViews[this.inf].draw(null, null, state, this.stage, {
                    x: projection.pos.x + projection.size.w - 25,
                    y: projection.pos.y - 5,
                    sx: 1,
                    sy: 1,
                });
            }

            i++;
        }

        this._firstRender = false;
    }
}
