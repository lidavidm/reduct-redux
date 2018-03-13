import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import projector from "../gfx/projector";

import Loader from "../loader";

export default class FunctionDef {
    constructor(stage, state, name, nodeId, pos) {
        this.stage = stage;
        this.state = state;
        this.name = name;
        this.id = nodeId;
        this.pos = pos;
        this.view = this.project();
        animate.tween(this.view, { opacity: 0.8 }, {
            duration: 10,
            easing: animate.Easing.Cubic.In,
        }).delay(1000);
        animate.tween(this.view, { scale: { x: 1.0, y: 1.0 } }, {
            duration: 1000,
            easing: animate.Easing.Cubic.In,
        }).delay(1000);

    }

    project() {
        const nodes = this.state.get("nodes");
        console.log(this.stage.views[this.id]);
        const view = Object.assign({}, this.stage.views[this.id]);
        // this.stage.views[this.id] = this.stage.semantics.project(this.stage, nodes, nodes.get(this.nodeID))
        view.shadow = false;
        view.stroke = { lineWidth: 1, color: "gray" };
        view.opacity = 0;
        view.scale = {x: 0.1, y: 0.1}
        return view;
    }

    drawImpl(state) {
        const offset = {
            x: this.pos.x - 100,
            y: this.pos.y + 20,
            sx: this.stage.views[this.id].scale.x,
            sy: this.stage.views[this.id].scale.y,
            opacity: 0.8,
        };
        this.view.draw(this.id, this.id, this.state, this.stage, offset);
    }
}
