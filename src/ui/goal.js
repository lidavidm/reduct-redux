import * as gfx from "../gfx/core";
import Loader from "../loader";

export default class Goal {
    constructor(stage) {
        this.stage = stage;
        this.container = stage.allocate(gfx.layout.hbox((_id, state) => {
            return state.get("goal");
        }, {
            subexpScale: 1,
        }, gfx.baseProjection));
    }

    drawImpl(state) {
        this.stage.views[this.container].prepare(null, state, this.stage);
        this.stage.views[this.container].draw(null, state, this.stage, { x: 0, y: 0, sx: 1, sy: 1 });
    }
}
