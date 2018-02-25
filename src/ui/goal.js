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

        this.textGoal = null;
    }

    startLevel(textGoal) {
        if (textGoal) {
            this.text = this.stage.allocate(gfx.text(textGoal));
            this.textGoal = this.stage.allocate(gfx.patch3(gfx.constant(this.text), {
                left: Loader.images["caption-long-left"],
                middle: Loader.images["caption-long-mid"],
                right: Loader.images["caption-long-right"],
            }));
        }
    }

    drawImpl(state) {
        const view = this.stage.views[this.textGoal ? this.textGoal : this.container];
        view.prepare(null, null, state, this.stage);
        view.draw(null, null, state, this.stage, {
            x: 0, y: 0, sx: 1, sy: 1,
        });
    }

    animatedNodes() {
        if (this.textGoal) {
            return [this.text];
        }
        return [];
    }

    victory() {
        if (this.text) {
            this.stage.views[this.text].text = "";
        }
    }
}
