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
    }

    drawContents() {
        super.drawContents();

        if (this.tutorialState) {
            this.tutorialState.drawContents();
        }
    }

    _mousedown(e) {
        if (!this.tutorialState.next() && this.tutorialState.allowEvents) {
            super._mousedown(e);
        }
    }

    _touchstart(e) {
        if (!this.tutorialState.next() && this.tutorialState.allowEvents) {
            super._touchstart(e);
        }
    }
}

class GoalTutorial {
    constructor(stage) {
        this.stage = stage;
        this.r = 0;
        this.x = 0;
        this.y = 0;
        this.opacity = 0;

        this.state = "started";
        this.ready = false;
    }

    get allowEvents() {
        return this.state === "board" && this.ready;
    }

    next() {
        if (!this.ready) return true;

        if (this.state === "goal") {
            this.state = "board";

            let bbx = 10000;
            let bby = 10000;
            let bbmx = 0;
            let bbmy = 0;
            let bbw = 0;
            let bbh = 0;

            for (const id of this.stage.getState().get("board")) {
                const view = this.stage.getView(id);
                const pos = gfx.absolutePos(view);
                bbx = Math.min(bbx, pos.x);
                bby = Math.min(bby, pos.y);
                bbmx = Math.max(bbmx, pos.x + view.size.w);
                bbmy = Math.max(bbmy, pos.y + view.size.h);
            }

            bbw = bbmx - bbx;
            bbh = bbmy - bby;

            const afterR = 1.25 * (Math.max(bbw, bbh) * (Math.sqrt(2) / 2));
            const afterX = bbx + (bbw / 2);
            const afterY = bby + (bbh / 2);

            animate.tween(this, { x: afterX, y: afterY, r: afterR }, {
                duration: 5000,
                easing: animate.Easing.Cubic.InOut,
            })
                .then(() => {
                    this.ready = true;
                });
        }

        return false;
    }

    drawContents() {
        const { ctx, width, height } = this.stage;
        const { x, y, r, opacity } = this;

        if (this.state === "started") {
            this.state = "goal";
            const goalContainer = this.stage.getView(this.stage.goal.container);
            const alienView = this.stage.getView(this.stage.goal.alien);
            const targetR = gfx.absoluteSize(goalContainer).w + alienView.size.w;

            animate.after(1000)
                .then(() => animate.tween(this, { r: targetR, opacity: 0.7 }, {
                    duration: 3000,
                    easing: animate.Easing.Exponential.Out,
                }))
                .then(() => {
                    this.ready = true;
                });
        }

        ctx.save();

        ctx.fillStyle = "black";
        ctx.globalAlpha = opacity;
        ctx.beginPath();
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
