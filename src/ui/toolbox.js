import * as gfx from "../gfx/core";
import Loader from "../loader";

export default class Toolbox {
    constructor(stage) {
        this.stage = stage;
        this.bg = stage.allocate(gfx.layout.sticky(gfx.layout.hexpand(gfx.sprite({
            image: Loader.images["toolbox-bg"],
            size: { h: 90 },
        })), "bottom"));
    }

    drawImpl(state) {
        this.stage.views[this.bg].prepare(null, state, this.stage);
        this.stage.views[this.bg].draw(null, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });

        let x = 20;
        let y = this.stage.views[this.bg].pos.y;
        for (const nodeId of state.get("toolbox")) {
            const node = state.get("nodes").get(nodeId);
            const projection = this.stage.views[nodeId];
            projection.prepare(nodeId, state, this.stage);
            projection.pos.x = x;
            projection.pos.y = y + (90 - projection.size.h) / 2;
            x += projection.size.w + 20;
            projection.draw(nodeId, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });
        }
    }
}
