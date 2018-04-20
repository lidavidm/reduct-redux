import * as gfx from "../gfx/core";
import * as progression from "../game/progression";
import Loader from "../loader";

export default class Goal {
    constructor(stage) {
        this.stage = stage;

        const chapter = progression.currentChapter();
        const alienIndex = Math.floor(((progression.currentLevel() - chapter.startIdx) /
                                       ((chapter.endIdx - chapter.startIdx) + 1)) *
                                      chapter.resources.aliens.length);
        const image = Loader.images[chapter.resources.aliens[alienIndex]];
        const alien = stage.allocate(gfx.sprite({
            image,
            size: { h: 80, w: 80 * (image.frame.w / image.frame.h) },
        }));
        this.stage.views[alien].pos = { x: 5, y: 5 };

        this.alien = alien;

        const container = stage.allocate(gfx.layout.hbox((_id, state) => {
            return state.get("goal");
        }, {
            subexpScale: 1,
        }, gfx.baseProjection));
        this.container = stage.allocate(gfx.patch3(gfx.constant(container), {
            left: Loader.images["caption-long-left"],
            middle: Loader.images["caption-long-mid"],
            right: Loader.images["caption-long-right"],
        }));

        this.textGoal = null;
    }

    /**
     * Replace references to objects like stars with the correct name
     */
    templateTextGoal(text) {
        return text.replace(/\{([\w\s]+)\}/g, (wholeMatch, groupMatch) => {
            const defn = this.stage.semantics.definitionOf("symbol");
            const matchParts = groupMatch.split(" ");
            return defn.goalNames[matchParts[matchParts.length - 1]][matchParts.length > 1 ? 1 : 0];
        });
    }

    startLevel(textGoal, showConcreteGoal=false) {
        if (textGoal) {
            textGoal = this.templateTextGoal(textGoal);

            this.text = this.stage.allocate(gfx.text(textGoal, {
                fontSize: 20,
                font: gfx.text.sans,
            }));
            let container = null;
            if (showConcreteGoal) {
                const goalLabel = this.stage.allocate(gfx.text("Goal: ", {
                    fontSize: 20,
                    font: gfx.text.sans,
                }));

                const contents = (_id, state) => {
                    const result = [ goalLabel ];
                    return result.concat(state.get("goal").toArray());
                };
                container = this.stage.allocate(gfx.layout.vbox(gfx.constant(
                    this.text,
                    this.stage.allocate(gfx.layout.hbox(contents, {
                        subexpScale: 1,
                    }, gfx.baseProjection))
                ), {
                    subexpScale: 1,
                }, gfx.baseProjection));
            }
            else {
                const contents = gfx.constant(this.text);
                container = this.stage.allocate(gfx.layout.hbox(contents, {
                    subexpScale: 1,
                }, gfx.baseProjection));
            }

            this.container = this.stage.allocate(gfx.patch3(gfx.constant(container), {
                left: Loader.images["caption-long-left"],
                middle: Loader.images["caption-long-mid"],
                right: Loader.images["caption-long-right"],
            }));
        }

        this.stage.getView(this.container).pos = {
            x: this.stage.getView(this.alien).size.w,
            y: 5,
        };

        if (textGoal) {
            this.stage.getView(this.container).pos.x -= 20;
        }
    }

    drawImpl(state) {
        const alien = this.stage.views[this.alien];
        alien.prepare(null, null, state, this.stage);

        const { ctx } = this.stage;
        const shadowSize = 3;
        const padding = 20;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "#000";
        ctx.moveTo(0, padding + shadowSize + alien.pos.y + alien.size.h);
        ctx.quadraticCurveTo(
            padding + alien.pos.x + alien.size.w,
            padding + shadowSize + alien.pos.y + alien.size.h,
            padding + alien.pos.x + alien.size.w,
            0
        );
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#594764";
        ctx.moveTo(0, padding + alien.pos.y + alien.size.h);
        ctx.quadraticCurveTo(
            padding + alien.pos.x + alien.size.w,
            padding + alien.pos.y + alien.size.h,
            padding + alien.pos.x + alien.size.w,
            0
        );
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.restore();

        alien.draw(null, null, state, this.stage, this.stage.makeBaseOffset());

        const view = this.stage.views[this.container];
        view.prepare(null, null, state, this.stage);
        view.draw(null, null, state, this.stage, this.stage.makeBaseOffset());
    }

    animatedNodes() {
        if (this.textGoal) {
            return [this.text];
        }
        return [];
    }

    victory() {
        if (this.text) {
            this.stage.views[this.text].text = "";
        }
    }
}
