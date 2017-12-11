import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import Loader from "../loader";

export default class Toolbox {
    constructor(stage) {
        this.stage = stage;
        this.bg = stage.allocate(gfx.layout.sticky(gfx.layout.hexpand(gfx.sprite({
            image: Loader.images["toolbox-bg"],
            size: { h: 90 },
        })), "bottom"));

        this._firstRender = true;
    }

    containsPoint(pos) {
        return pos.y >= this.stage.views[this.bg].pos.y;
    }

    get pos() {
        return this.stage.views[this.bg].pos;
    }

    getNodeAtPos(state, pos) {
        if (!this.containsPoint(pos)) return [ null, null ];

        for (const nodeId of state.get("toolbox")) {
            const projection = this.stage.views[nodeId];

            if (projection.containsPoint(pos)) {
                return [ nodeId, nodeId ];
            }
        }

        return [ null, null ];
    }

    drawImpl(state) {
        this.stage.views[this.bg].prepare(null, state, this.stage);
        this.stage.views[this.bg].draw(null, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });

        let x = 20;
        let y = this.stage.views[this.bg].pos.y;
        for (const nodeId of state.get("toolbox")) {
            const node = state.get("nodes").get(nodeId);
            const projection = this.stage.views[nodeId];
            projection.scale = { x: 1, y: 1 };
            const nodeY = y + (90 - projection.size.h) / 2;
            projection.prepare(nodeId, state, this.stage);
            if (nodeId === this.stage._selectedNode) {
                // Do nothing
            }
            else if (projection.pos.x !== x && !projection.animating && !this._firstRender) {
                projection.animating = true;
                animate
                    .tween(projection.pos, { x: x, y: nodeY })
                    .then(() => projection.animating = false);
            }
            else if (!projection.animating) {
                projection.pos.x = x;
                projection.pos.y = nodeY;
            }

            x += projection.size.w + 20;
            projection.draw(nodeId, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });
        }

        this._firstRender = false;
    }
}
