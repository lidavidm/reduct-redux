import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";

export default class FunctionDef {
    constructor(stage, name, nodeId, referenceId) {
        this.stage = stage;
        this.name = name;
        this.id = nodeId;
        this.referenceId = referenceId;
        this.view = this.project();
        const referenceView = this.stage.getView(this.referenceId);
        const centerPos = gfx.centerPos(referenceView);
        const absSize = gfx.absoluteSize(referenceView);
        animate.tween(this.view, {
            pos: {
                x: centerPos.x,
                y: centerPos.y + (absSize.h / 2) + 5,
            },
            scale: { x: 1.0, y: 1.0 },
            opacity: 0.8,
        }, {
            duration: 2000,
            easing: animate.Easing.Cubic.InOut,
        }).delay(100);
    }

    project() {
        const view = Object.assign({}, this.stage.views[this.id]);
        view.shadow = false;
        view.stroke = { lineWidth: 1, color: "gray" };
        view.opacity = 0.5;
        view.scale = { x: 0.5, y: 0.5 };
        view.pos = gfx.centerPos(this.stage.getView(this.id));
        view.pos.x -= this.stage.sidebarWidth;
        view.anchor = { x: 0.5, y: 0 };
        return view;
    }

    makeOffset() {
        return {
            x: 0,
            y: 0,
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
