import * as gfx from "../gfx/core";
import Loader from "../loader";

export default class Goal {
    constructor(stage) {
        this.stage = stage;
        const container = stage.allocate(gfx.layout.hbox((_id, state) => {
            return state.get("goal");
        }, {
            subexpScale: 1,
        }, gfx.baseProjection));
        this.container = stage.allocate(gfx.patch3(gfx.constant(container), {
            left: Loader.images["caption-long-left"],
            middle: Loader.images["caption-long-mid"],
            right: Loader.images["caption-long-right"],
        }));
    }

    drawImpl(state) {
        this.stage.views[this.container].prepare(null, null, state, this.stage);
        this.stage.views[this.container].draw(null, null, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });
    }
}
