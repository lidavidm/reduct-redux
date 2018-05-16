import * as animate from "../gfx/animate";
import * as level from "../game/level";

import Audio from "../resource/audio";

export default class StuckEffect {
    constructor(stage) {
        this.stage = stage;
        this.opacity = 0.0;

        Audio.play("stuck");
        animate.tween(this, {
            opacity: 0.5,
        }, {
            duration: 1000,
            easing: animate.Easing.Cubic.Out,
        }).then(() => this.highlightMismatches());

        this.infinite = null;
        this.blinkers = [];
    }

    cancel() {
        if (this.infinite) this.infinite.stop();

        for (const id of this.blinkers) {
            this.stage.getView(id).stroke = null;
        }

        return animate.tween(this, {
            opacity: 0,
        }, {
            duration: 400,
            easing: animate.Easing.Cubic.Out,
        });
    }

    highlightMismatches() {
        // Get a partial matching between board/goal
        const state = this.stage.getState();
        const matching = level.checkVictory(state, this.stage.semantics, true);
        const reverseMatching = {};
        Object.keys(matching).forEach((id) => {
            reverseMatching[matching[id]] = id;
        });

        const board = state.get("board")
              .filter(n => !this.stage.semantics.ignoreForVictory(state.getIn([ "nodes", n ])));
        const goal = state.get("goal");

        const blinkers = [];
        const msg = [ [ "Oh no, we're stuck!" ] ];

        const extraMsg = [ "We have extra things: " ];
        for (const id of board) {
            if (typeof reverseMatching[id] === "undefined") {
                blinkers.push(id);
                // Clone view to avoid messing up positioning
                extraMsg.push([ this.stage.allocate(Object.assign(
                    {},
                    this.stage.getView(id),
                    {
                        pos: { x: 0, y: 0 },
                        anchor: { x: 0, y: 0 },
                        animating: 0,
                    }
                )), id ]);
                this.stage.getView(id).stroke = { color: "#F00", lineWidth: 0 };
            }
        }

        const missingMsg = [ "We're still missing:" ];
        for (const id of goal) {
            if (typeof matching[id] === "undefined") {

                blinkers.push(id);
                // Clone view to avoid messing up positioning
                missingMsg.push([ this.stage.allocate(Object.assign(
                    {},
                    this.stage.getView(id),
                    {
                        pos: { x: 0, y: 0 },
                        animating: 0,
                    }
                )), id ]);

                this.stage.getView(id).stroke = { color: "#F00", lineWidth: 0 };
            }
        }

        let time = 0;
        this.blinkers = blinkers;
        this.infinite = animate.infinite((dt) => {
            time += dt;
            for (const id of blinkers) {
                this.stage.getView(id).stroke.lineWidth = 2 * (1 + Math.sin(time / 100));
            }
        });

        if (extraMsg.length > 1) msg.push(extraMsg);
        if (missingMsg.length > 1) msg.push(missingMsg);

        msg.push([ "Reset or undo and keep trying!" ]);
        this.stage.feedback.update("#FFF", ...msg);
    }

    prepare() {

    }

    draw() {
        const { ctx, width, height } = this.stage;

        ctx.save();
        ctx.fillStyle = "#000";
        ctx.globalAlpha = this.opacity;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}
