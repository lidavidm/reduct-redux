import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";

export default class FunctionDef {
    constructor(stage, name, nodeId, referenceID, pos) {
        this.stage = stage;
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
        const view = Object.assign({}, this.stage.views[this.id]);
        view.shadow = false;
        view.stroke = { lineWidth: 1, color: "gray" };
        view.opacity = 0;
        view.scale = { x: 0, y: 0 };
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
        this.view.draw(this.id, this.id, state, this.stage, offset);
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
