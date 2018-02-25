import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Audio from "../resource/audio";
import * as random from "../util/random";

import Loader from "../loader";

import BaseStage from "./basestage";
import BaseTouchRecord from "./touchrecord";

export default class ChapterEndStage extends BaseStage {
    constructor(...args) {
        super(...args);

        this.color = "#594764";

        if (progression.isGameEnd()) {
            Audio.play("game-complete");
        }

        this.title = this.allocateInternal(gfx.layout.sticky(
            gfx.text(progression.isGameEnd() ? "You win!" : "Chapter Finished!", {
                fontSize: 64,
                color: "#FFF",
            }),
            "top",
            {
                align: "center",
                margin: 50,
            }
        ));

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
            repeat: 5,
            duration: 200,
        });

        animate.tween(firework.pos, { x: this.width / 2 }, {
            duration: 1000,
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
        });

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

        animate.tween(firework.pos, { y: this.height / 2 }, {
            duration: 2000,
            easing: animate.Easing.Projectile(animate.Easing.Linear),
        });

        this.draw();

        if (!progression.isGameEnd()) {
            const continueButton = gfx.ui.button(this, "Next Chapter", {
                click: () => {
                    window.next();
                },
            });
            this.continueButtonId = this.allocateInternal(continueButton);
            this.continueButton = this.internalViews[this.continueButtonId];
            this.continueButton.opacity = 0;
            animate.tween(this.continueButton, { opacity: 1 }, {
                duration: 1000,
                easing: animate.Easing.Cubic.Out,
            }).delay(1000);

            if (progression.hasChallengeChapter()) {
                const challengeButton = gfx.ui.button(this, "Try Challenges", {
                    click: () => {
                        window.next(true);
                    },
                });
                this.challengeButtonId = this.allocateInternal(challengeButton);
                challengeButton.opacity = 0;
                animate.tween(challengeButton, { opacity: 1 }, {
                    duration: 1000,
                    easing: animate.Easing.Cubic.Out,
                }).delay(1000);
            }
        }
    }

    get touchRecordClass() {
        return TouchRecord;
    }

    drawContents() {
        const state = this.getState();

        for (const starId of this.stars) {
            this.drawInternalProjection(state, starId);
        }

        this.drawInternalProjection(state, this.title);

        if (this.continueButtonId) {
            this.continueButton.prepare(this.continueButtonId, this.continueButtonId, state, this);
            this.continueButton.draw(this.continueButtonId, this.continueButtonId, state, this, {
                x: this.width / 2,
                y: this.height / 2,
                sx: 1,
                sy: 1,
                opacity: 1,
            });
        }
        if (this.challengeButtonId) {
            const view = this.internalViews[this.challengeButtonId];
            view.prepare(this.challengeButtonId, this.challengeButtonId, state, this);
            view.draw(this.challengeButtonId, this.challengeButtonId, state, this, {
                x: this.width / 2,
                y: (this.height / 2) + 150,
                sx: 1,
                sy: 1,
                opacity: 1,
            });
        }
    }

    getNodeAtPos(pos, selectedId=null) {
        const projection = this.continueButton;
        const offset = {
            x: this.width / 2, y: this.height / 2, sx: 1, sy: 1
        };

        if (this.continueButtonId) {
            if (projection.containsPoint(pos, offset)) {
                return [ this.continueButtonId, this.continueButtonId ];
            }
        }

        if (this.challengeButtonId) {
            offset.y += 150;
            if (this.internalViews[this.challengeButtonId].containsPoint(pos, offset)) {
                return [ this.challengeButtonId, this.challengeButtonId ];
            }
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
}

class TouchRecord extends BaseTouchRecord {
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
