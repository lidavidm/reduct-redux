import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import projector from "../gfx/projector";

import Loader from "../loader";

export default class FunctionDef {
    constructor(stage, state, name, nodeId, referenceID, pos) {
        this.stage = stage;
        this.state = state;
        this.name = name;
        this.id = nodeId;
        this.referenceID = referenceID;
        this.pos = pos;
        this.view = this.project();
        animate.tween(this.view, { opacity: 0.8 }, {
            duration: 10,
            easing: animate.Easing.Cubic.In,
        }).delay(50);
        animate.tween(this.view, { scale: { x: 1.0, y: 1.0 } }, {
            duration: 2000,
            easing: animate.Easing.Cubic.In,
        }).delay(50);

    }

    project() {
        const nodes = this.state.get("nodes");
        const view = Object.assign({}, this.stage.views[this.id]);
        view.shadow = false;
        view.stroke = { lineWidth: 1, color: "gray" };
        view.opacity = 0.1;
        view.scale = {x: 0.1, y: 0.1}
        return view;
    }

    drawImpl(state) {
        const offset = {
            x: this.pos.x - 100,
            y: this.pos.y + 20,
            sx: this.stage.views[this.id].scale.x,
            sy: this.stage.views[this.id].scale.y,
            opacity: 1,
        };
        this.view.draw(this.id, this.id, this.state, this.stage, offset);
    }

    containsPoint(state, pos) {
        const offset = {
            x: this.pos.x - 100,
            y: this.pos.y + 20,
            sx: this.stage.views[this.id].scale.x,
            sy: this.stage.views[this.id].scale.y,
            opacity: 1,
        };
        return this.view.containsPoint(pos, offset);
    }
}
