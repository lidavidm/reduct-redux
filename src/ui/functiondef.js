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
        this.viewId = this.project();
    }

    project() {
        const nodes = this.state.get("nodes");
        this.stage.views[this.id] = this.stage.semantics.project(this.stage, nodes, nodes.get(this.id))
        this.stage.views[this.id].shadow = false;
        this.stage.views[this.id].stroke = { lineWidth: 1, color: "gray" };

        return this.stage.views[this.id];
    }

    drawImpl(state) {
        const offset = {
            x: this.pos.x - 100,
            y: this.pos.y + 20,
            sx: 1,
            sy: 1,
            opacity: 0.8,
        };
        this.stage.drawProjection(this.state, this.id, offset);
    }
}
