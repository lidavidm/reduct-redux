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

    startLevel(textGoal, showConcreteGoal=false) {
        if (textGoal) {
            this.text = this.stage.allocate(gfx.text(textGoal, {
                fontSize: 20,
                font: gfx.text.sans,
            }));
            let contents = null;
            if (showConcreteGoal) {
                contents = (_id, state) => {
                    const result = [ this.text ];
                    return result.concat(state.get("goal").toArray());
                };
            }
            else {
                contents = gfx.constant(this.text);
            }
            const container = this.stage.allocate(gfx.layout.hbox(contents, {
                subexpScale: 1,
            }, gfx.baseProjection));

            this.container = this.stage.allocate(gfx.patch3(gfx.constant(container), {
                left: Loader.images["caption-long-left"],
                middle: Loader.images["caption-long-mid"],
                right: Loader.images["caption-long-right"],
            }));
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
        view.draw(null, null, state, this.stage, this.stage.makeBaseOffset({
            x: alien.size.w, y: 5,
        }));
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
