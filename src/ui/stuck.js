import * as animate from "../gfx/animate";
import * as level from "../game/level";

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

        for (const id of board) {
            if (typeof reverseMatching[id] === "undefined") {
                blinkers.push(id);
                this.stage.getView(id).stroke = { color: "#F00", lineWidth: 0 };
            }
        }

        for (const id of goal) {
            if (typeof matching[id] === "undefined") {
                blinkers.push(id);
                this.stage.getView(id).stroke = { color: "#F00", lineWidth: 0 };
            }
        }

        let time = 0;
        animate.infinite((dt) => {
            time += dt;
            for (const id of blinkers) {
                this.stage.getView(id).stroke.lineWidth = 2 * (1 + Math.sin(time / 100));
            }
        });
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