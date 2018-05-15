import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Loader from "../loader";

/**
 * Replace references to objects like stars with the correct name
 */
export function templateText(semantics, text) {
    return text.replace(/\{([\w\s]+)\}/g, (wholeMatch, groupMatch) => {
        const defn = semantics.definitionOf("symbol");
        const matchParts = groupMatch.split(" ");
        let key = matchParts[matchParts.length - 1];
        let offset = matchParts.length > 1 ? 1 : 0;
        if (!defn.goalNames[key] && key.endsWith("s")) {
            key = key.slice(0, -1);
            offset = 2;
        }
        return defn.goalNames[key][offset];
    });
}

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
            size: { h: 100, w: 100 * (image.frame.w / image.frame.h) },
        }));

        const alienBox = Loader.images["alien_box"];

        let bgSize = {
            h: 1.5 * this.stage.getView(alien).size.h * (alienBox.frame.h / alienBox.frame.w),
        };
        bgSize.w = bgSize.h * (alienBox.frame.w / alienBox.frame.h);
        if (image.frame.w > image.frame.h) {
            bgSize = {
                w: 1.5 * this.stage.getView(alien).size.w,
                h: 1.5 * this.stage.getView(alien).size.w * (alienBox.frame.h / alienBox.frame.w),
            };
        }
        const background = stage.allocate(gfx.sprite({
            image: alienBox,
            size: bgSize,
        }));
        this.stage.views[background].pos = { x: 5, y: 5 };
        this.stage.views[alien].anchor = { x: 0.5, y: 0.5 };
        const bg = this.stage.getView(background);
        this.stage.views[alien].pos = {
            x: 5 + (bg.size.w / 2),
            // Yes w not h
            y: 5 + (bg.size.w / 2),
        };

        this.alien = alien;
        this.background = background;

        const container = stage.allocate(gfx.layout.hbox((_id, state) => {
            return state.get("goal");
        }, {
            subexpScale: 1,
        }, gfx.baseProjection));
        this.container = stage.allocate(gfx.patch3(gfx.constant(container), {
            left: Loader.images["caption-long-left"],
            middle: Loader.images["caption-long-mid"],
            right: Loader.images["caption-long-right"],
            leftSpill: 0.4,
            rightSpill: 0.4,
        }));

        this.textGoal = null;
    }

    startLevel(textGoal, showConcreteGoal=false) {
        if (textGoal) {
            textGoal = templateText(this.stage.semantics, textGoal);

            this.text = this.stage.allocate(gfx.text(textGoal, {
                fontSize: 20,
                font: gfx.text.sans,
                wrapWidth: 70,
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
                leftSpill: 0.4,
                rightSpill: 0.4,
            }));
        }

        const alien = this.stage.getView(this.alien);
        this.stage.getView(this.container).pos = {
            x: gfx.absolutePos(alien).x + alien.size.w,
            y: -300,
        };

        animate.tween(this.stage.getView(this.container), {
            pos: {
                y: 25,
            },
        }, {
            duration: 500,
            easing: animate.Easing.Anticipate.BackOut(1.1),
        })
    }

    drawImpl(state) {
        const background = this.stage.views[this.background];
        background.prepare(null, null, state, this.stage);

        const alien = this.stage.views[this.alien];
        alien.prepare(null, null, state, this.stage);

        const view = this.stage.views[this.container];
        view.prepare(null, null, state, this.stage);

        background.draw(null, null, state, this.stage, this.stage.makeBaseOffset());
        alien.draw(null, null, state, this.stage, this.stage.makeBaseOffset());
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
        this.stage.getView(this.container).opacity = 0;
    }
}
