import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";

export default class FunctionDef {
    constructor(stage, name, nodeId, referenceId) {
        this.stage = stage;
        this.name = name;
        this.id = nodeId;
        this.referenceId = referenceId;
        this.view = this.project();
        animate.tween(this.view, { opacity: 0.8 }, {
            duration: 10,
            easing: animate.Easing.Cubic.In,
        }).delay(100);
        animate.tween(this.view, { scale: { x: 1.0, y: 1.0 } }, {
            duration: 2000,
            easing: animate.Easing.Quadratic.In,
        }).delay(100);
    }

    project() {
        const view = Object.assign({}, this.stage.views[this.id]);
        view.shadow = false;
        view.stroke = { lineWidth: 1, color: "gray" };
        view.opacity = 0;
        view.scale = { x: 0, y: 0 };
        view.pos = { x: 0, y: 0 };
        view.anchor = { x: 0.5, y: 0 };
        return view;
    }

    makeOffset() {
        const referenceView = this.stage.getView(this.referenceId);
        const centerPos = gfx.centerPos(referenceView);
        const absSize = gfx.absoluteSize(referenceView);
        return {
            x: centerPos.x,
            y: centerPos.y + (absSize.h / 2) + 5,
            sx: 1,
            sy: 1,
            opacity: 1,
        };
    }

    drawImpl(state) {
        this.view.draw(this.id, this.id, state, this.stage, this.makeOffset());
    }

    containsPoint(state, pos) {
        return this.view.containsPoint(pos, this.makeOffset());
    }
}
