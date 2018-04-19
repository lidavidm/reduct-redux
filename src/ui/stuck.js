import * as animate from "../gfx/animate";

export default class StuckEffect {
    constructor(stage) {
        this.stage = stage;
        this.opacity = 0.0;

        animate.tween(this, {
            opacity: 0.5,
        }, {
            duration: 1000,
            easing: animate.Easing.Cubic.Out,
        }).then(() => this.highlightMismatches());
    }

    highlightMismatches() {

    }

    prepare() {

    }

    draw() {
        const { ctx } = this.stage;

        ctx.fillStyle = "#000";
        ctx.globalAlpha = this.opacity;
        ctx.fillRect(0, 0, this.stage.width, this.stage.height);
    }
}
