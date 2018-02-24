import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as random from "../util/random";

import Loader from "../loader";

import BaseStage from "./basestage";
import BaseTouchRecord from "./touchrecord";

export default class ChapterEndStage extends BaseStage {
    constructor(...args) {
        super(...args);

        this.color = "#594764";

        const title = gfx.layout.sticky(gfx.text("Chapter Finished!", {
            fontSize: 64,
            color: "#FFF",
        }), "top", {
            align: "center",
            margin: 50,
        });
        this.title = this.internalViews[this.allocateInternal(title)];

        this.stars = [];
        const firework = gfx.sprite({
            image: Loader.images["mainmenu-star1"],
            size: { h: 40, w: 40 },
        });
        firework.anchor = { x: 0.5, y: 0.5 };
        firework.pos = { x: (this.width / 2) - 100, y: this.height - 100 };
        this.stars.push(this.allocateInternal(firework));
        animate.tween(firework, { opacity: 0.0 }, {
            reverse: true,
            repeat: 3,
            duration: 330,
        });

        animate.tween(firework.pos, { x: this.width / 2 }, {
            duration: 500,
        }).then(() => {
            this.stars.shift();
            const scale = { x: 0.1, y: 0.1 };
            const rad = Math.min(this.width, this.height) / 2.5;

            for (let i = 0; i < 20; i++) {
                const idx = random.getRandInt(1, 15);
                const spark = gfx.sprite({
                    image: Loader.images[`mainmenu-star${idx}`],
                    size: { h: 40, w: 40 },
                });
                spark.anchor = { x: 0.5, y: 0.5 };
                spark.scale = scale;
                spark.pos = { x: firework.pos.x, y: firework.pos.y };
                spark.opacity = 0.0;
                this.stars.push(this.allocateInternal(spark));

                animate.tween(spark, { opacity: 1 }, {
                    duration: 1200,
                    easing: animate.Easing.Cubic.Out,
                }).then(() => {
                    animate.tween(spark, { opacity: 0 }, {
                        duration: 400,
                        easing: animate.Easing.Cubic.Out,
                    });
                });
                animate.tween(spark.pos, {
                    x: spark.pos.x + (rad * Math.cos((i * 2 * Math.PI) / 20)),
                    y: spark.pos.y + (rad * Math.sin((i * 2 * Math.PI) / 20)),
                }, {
                    duration: 1500,
                    easing: animate.Easing.Cubic.Out,
                });
            }
            return animate.tween(scale, { x: 1, y: 1 }, {
                duration: 1000,
                easing: animate.Easing.Cubic.Out,
            });
        }).then(() => {
            for (let i = 0; i < 50; i++) {
                const idx = random.getRandInt(1, 15);
                const star = gfx.sprite({
                    image: Loader.images[`mainmenu-star${idx}`],
                    size: { h: 20, w: 20 },
                });
                star.anchor = { x: 0.5, y: 0.5 };
                star.pos = {
                    x: random.getRandInt(0, this.width),
                    y: random.getRandInt(0, this.height),
                };
                star.opacity = 0.0;
                this.stars.push(this.allocateInternal(star));

                animate.tween(star, { opacity: 0.3 }, {
                    duration: 2500,
                    easing: animate.Easing.Cubic.Out,
                });
            }
        });
        animate.tween(firework.pos, { y: this.height / 2 }, {
            duration: 1000,
            easing: animate.Easing.Projectile(animate.Easing.Linear),
        });

        this.draw();

        const continueButton = gfx.ui.button(this, "Keep Playing!");
        this.continueButtonId = this.allocateInternal(continueButton);
        this.continueButton = this.internalViews[this.continueButtonId];
    }

    get touchRecordClass() {
        return TouchRecord;
    }

    drawContents() {
        const state = this.getState();
        this.title.prepare(null, null, state, this);
        this.title.draw(null, null, state, this, {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
            opacity: 1,
        });
        this.continueButton.prepare(this.continueButtonId, this.continueButtonId, state, this);
        this.continueButton.draw(this.continueButtonId, this.continueButtonId, state, this, {
            x: this.width / 2,
            y: this.height / 2,
            sx: 1,
            sy: 1,
            opacity: 1,
        });

        // for (const starId of this.stars) {
        //     const view = this.internalViews[starId];
        //     view.prepare(null, null, state, this);
        //     view.draw(null, null, state, this, {
        //         x: 0,
        //         y: 0,
        //         sx: 1,
        //         sy: 1,
        //         opacity: 1,
        //     });
        // }
    }

    getNodeAtPos(pos, selectedId=null) {
        const projection = this.continueButton;
        const offset = {
            x: this.width / 2, y: this.height / 2, sx: 1, sy: 1
        };

        if (projection.containsPoint(pos, offset)) {
            return [ this.continueButtonId, this.continueButtonId ];
        }
        return [ null, null ];
    }

    updateCursor(touchRecord, moved=false) {
        if (touchRecord.hoverNode !== null) {
            this.setCursor("pointer");
        }
        else {
            this.setCursor("default");
        }
    }

    _mousedown(e) {
        const touch = super._mousedown(e);
    }
}

class TouchRecord extends BaseTouchRecord {
    constructor(...args) {
        super(...args);
    }

    onstart() {
        if (this.topNode && this.stage.internalViews[this.topNode]) {
            const view = this.stage.internalViews[this.topNode];
            if (view.onmousedown) {
                view.onmousedown();
            }
        }
    }

    onend(...args) {
        super.onend(...args);

        if (this.topNode && this.stage.internalViews[this.topNode]) {
            const view = this.stage.internalViews[this.topNode];
            if (view.onclick) {
                view.onclick();
            }
        }
    }
}
