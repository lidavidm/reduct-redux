import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";

import Stage from "./stage";

/**
 * The level stage with a tutorial overlay.
 */
export default class TutorialStage extends Stage {
    constructor(...args) {
        super(...args);

        this.tutorialState = new GoalTutorial(this);
        this.tutorialState.enter();
    }

    drawContents() {
        super.drawContents();

        if (this.tutorialState) {
            this.tutorialState.drawContents();
        }
    }
}

class TutorialState {
    constructor(stage) {
        this.stage = stage;
    }

    enter() {}

    transition() {}
}

class GoalTutorial extends TutorialState {
    enter() {
        this.r = 0;
        this.x = 0;
        this.y = 0;
        this.opacity = 0;

        this.started = false;
    }

    drawContents() {
        const { ctx, width, height } = this.stage;
        const { x, y, r, opacity } = this;

        if (!this.started) {
            this.started = true;
            const goalContainer = this.stage.getView(this.stage.goal.container);
            const alienView = this.stage.getView(this.stage.goal.alien);
            const targetR = gfx.absoluteSize(goalContainer).w + alienView.size.w;

            animate.after(1000)
                .then(() => animate.tween(this, { r: targetR, opacity: 0.9 }, {
                    duration: 3000,
                    easing: animate.Easing.Exponential.Out,
                }))
                .then(() => animate.tween(this, { x: 500, y: 500 }, {
                    duration: 5000,
                    easing: animate.Easing.Cubic.InOut,
                }));
        }

        ctx.save();

        ctx.fillStyle = "black";
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        // ctx.moveTo(0, r);
        // ctx.quadraticCurveTo(r, r, r, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.lineTo(0, 0);
        ctx.arc(x, y, r, 2 * Math.PI, false);
        ctx.fill("evenodd");
        ctx.restore();
    }
}
