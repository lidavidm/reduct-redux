import * as chroma from "chroma-js";

import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Audio from "../resource/audio";
import * as random from "../util/random";

import Loader from "../loader";
import passwordPrompt from "../ui/instructor/password";

import BaseStage from "./basestage";
import BaseTouchRecord from "./touchrecord";

export default class ChapterEndStage extends BaseStage {
    constructor(...args) {
        super(...args);

        this.opacity = 1.0;
        this.color = "#594764";

        if (progression.isGameEnd()) {
            Audio.play("game-complete");
        }

        this.title = this.allocateInternal(gfx.layout.sticky(
            gfx.text(progression.isGameEnd() ? "You win!" : "Chapter Finished!", {
                fontSize: 96,
                color: "#FFF",
                font: gfx.text.script,
            }),
            "top",
            {
                align: "center",
                margin: 20,
            }
        ));

        this.stars = [];
        this.bgStars = [];
        this.levelStars = [];

        // Generate random background stars (distributed across grid
        // cells to make it more even)
        const X_CELLS = 4;
        const Y_CELLS = 4;
        const X_WIDTH = 1.0 / X_CELLS;
        const Y_WIDTH = 1.0 / Y_CELLS;
        for (let i = 0; i < X_CELLS; i++) {
            for (let j = 0; j < Y_CELLS; j++) {
                for (let k = 0; k < 3; k++) {
                    const idx = random.getRandInt(1, 15);
                    const x = (X_WIDTH * i) + (X_WIDTH * Math.random());
                    const y = (Y_WIDTH * j) + (Y_WIDTH * Math.random());

                    const star = gfx.layout.ratioPlacer(gfx.sprite({
                        image: Loader.images[`mainmenu-star${idx}`],
                        size: { h: 15, w: 15 },
                        anchor: { x: 0.5, y: 0.5 },
                        opacity: 0.0,
                        opacityDelta: 0.01 + (Math.random() / 10),
                    }), x, y);

                    const id = this.allocateInternal(star);
                    this.stars.push(id);
                    this.bgStars.push(id);
                    animate.tween(star, { opacity: (0.5 * Math.random()) + 0.3 }, {
                        duration: 2500,
                        easing: animate.Easing.Cubic.Out,
                    });
                }
            }
        }

        // Generate clusters of stars representing each chapter
        const numChapters = progression.ACTIVE_PROGRESSION_DEFINITION
              .progression.linearChapters.length;
        const bandWidth = this.width / numChapters;

        const scale = chroma.scale("Spectral").mode("lab");

        // Center of cluster of stars representing just-finished chapter
        let newStarX = 0;
        let newStarY = 0;

        let newCenterStar = null;

        for (let j = 0; j < numChapters; j++) {
            const lit = j < progression.chapterIdx();
            const lighting = j === progression.chapterIdx();
            const clusterX = ((j + 0.5) * bandWidth);
            const clusterY = (0.6 * this.height) +
                  (0.2 * this.height * Math.sin((2 * Math.PI * (clusterX / this.width))));
            const clusterR = 0.4 * bandWidth;

            if (lighting) {
                newStarX = clusterX;
                newStarY = clusterY;
            }

            let lineWidth = 2;
            if (lighting) lineWidth = 4;
            this.stars.push(this.allocateInternal(gfx.shapes.circle({
                color: null,
                shadow: false,
                pos: { x: clusterX, y: clusterY },
                size: { w: 2.2 * clusterR, h: 2.2 * clusterR },
                anchor: { x: 0.5, y: 0.5 },
                stroke: {
                    color: scale(j / numChapters),
                    lineWidth,
                    lineDash: [10, 5],
                },
            })));

            // Add center star
            if (lit || lighting) {
                const starIdx = j % 3;
                const star = gfx.sprite({
                    image: Loader.images[`star_${starIdx + 1}`],
                    size: { h: clusterR, w: clusterR },
                    anchor: { x: 0.5, y: 0.5 },
                    pos: { x: clusterX, y: clusterY },
                    opacity: lighting ? 0 : 1,
                    scale: { x: lighting ? 0 : 1, y: lighting ? 0 : 1 },
                });
                this.stars.push(this.allocateInternal(star));
                newCenterStar = star;
            }
        }

        // Create rows of stars representing levels of current chapter
        const chapter = progression.currentChapter();
        const spacing = 60;
        let rowStart = (this.width / 2) - (4 * spacing);
        const colStart = this.height / 3;
        const starTweens = [];
        const levelStars = [];
        for (let i = 0; i < chapter.levels.length; i++) {
            const remainingLevels = chapter.levels.length - i;
            if (remainingLevels < 9 && i % 9 === 0) {
                let spacingOffset = Math.floor(remainingLevels / 2);
                if (remainingLevels % 2 === 0) spacingOffset -= 0.5;
                rowStart = (this.width / 2) - (spacingOffset * spacing);
            }

            const col = i % 9;
            const row = Math.floor(i / 9);
            const star = gfx.shapes.star({
                color: "gold",
                anchor: { x: 0.5, y: 0.5 },
                pos: { x: rowStart + (col * spacing), y: colStart + (row * spacing) },
                scale: { x: 0, y: 0 },
            });

            starTweens.push(animate.tween(star, {
                scale: { x: 1, y: 1 },
            }, {
                easing: animate.Easing.Anticipate.BackOut(1.8),
                duration: 500,
                setAnimatingFlag: false,
            }).delay(i * 30));

            const id = this.allocateInternal(star);
            this.levelStars.push(id);
            levelStars.push([ id, star ]);
        }

        Promise.all(starTweens)
            .then(() => {
                const splosions = [];
                for (let i = 0; i < levelStars.length; i++) {
                    const [ id, star ] = levelStars[i];
                    splosions.push(animate.tween(star, {
                        pos: {
                            x: newStarX + ((Math.random() - 0.5) * bandWidth),
                            y: newStarY + ((Math.random() - 0.5) * bandWidth),
                        },
                        scale: { x: 0.3, y: 0.3 },
                    }, {
                        easing: animate.Easing.Cubic.In,
                        duration: 500,
                    }).delay(i * 30)
                        .then(() => {
                            this.levelStars.splice(this.levelStars.indexOf(id), 1);
                            if (i % 3 === 0) {
                                const particles = random.getRandInt(20, 50);
                                const rotation = Math.random() * (Math.PI / 2);
                                return animate.fx.splosion(this, star.pos, {
                                    explosionRadius: 500,
                                    numOfParticles: particles,
                                    duration: 600,
                                    color: idx => scale(idx / particles),
                                    angle: idx => rotation + (2 * Math.PI * (idx / particles)),
                                });
                            }
                            return null;
                        }));
                }
                return Promise.all(splosions);
            })
            .then(() => {
                animate.tween(newCenterStar, {
                    opacity: 1,
                    scale: { x: 1, y: 1 },
                }, {
                    easing: animate.Easing.Anticipate.BackOut(10),
                    duration: 500,
                    setAnimatingFlag: false,
                });
            });

        animate.infinite((dt) => {
            for (const id of this.bgStars) {
                const view = this.internalViews[id];

                view.opacity += view.opacityDelta * (dt / 100);
                if (view.opacity > 1.0) {
                    view.opacity = 1.0;
                    view.opacityDelta *= -1;
                }
                else if (view.opacity < 0.2) {
                    view.opacity = 0.2;
                    view.opacityDelta *= -1;
                }
            }
        });

        this.draw();

        if (!progression.isGameEnd()) {
            const continueButton = gfx.layout.sticky(gfx.ui.button(this, "Next Chapter", {
                color: "#e95888",
                click: () => {
                    const chapter = progression.nextChapter();
                    console.log(chapter);
                    if (chapter && chapter.password) {
                        passwordPrompt("Ask the teacher to continue on!", chapter.password).then(() => {
                            this.continue(false);
                        }, () => {});
                    }
                    else {
                        this.continue(false);
                    }
                },
            }), "top", {
                align: "center",
                margin: 150,
            });
            this.continueButtonId = this.allocateInternal(continueButton);
            this.continueButton = this.internalViews[this.continueButtonId];
            this.continueButton.opacity = 0;
            animate.tween(this.continueButton, { opacity: 1 }, {
                duration: 1000,
                easing: animate.Easing.Cubic.Out,
            }).delay(1000);

            if (progression.hasChallengeChapter()) {
                const challengeButton = gfx.layout.sticky(gfx.ui.button(this, "Try Challenges", {
                    color: "#e95888",
                    click: () => {
                        this.continue(true);
                    },
                }), "top", {
                    align: "center",
                    margin: 200,
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

    continue(challenge) {
        animate.tween(this, {
            color: "#EEE",
        }, {
            duration: 800,
            setAnimatingFlag: false,
            easing: animate.Easing.Color(animate.Easing.Cubic.In, this.color, "#EEE"),
        }).then(() => {
            window.next(challenge, false);
        });
        animate.tween(this, {
            opacity: 0.0,
        }, {
            duration: 500,
            setAnimatingFlag: false,
            easing: animate.Easing.Cubic.Out,
        });
    }

    spawnFirework(startPos, targetPos, delay) {
        const firework = gfx.sprite({
            image: Loader.images["mainmenu-star1"],
            size: { h: 40, w: 40 },
        });
        firework.anchor = { x: 0.5, y: 0.5 };
        firework.pos = startPos;
        this.stars.push(this.allocateInternal(firework));
        animate.tween(firework, { opacity: 0.0 }, {
            reverse: true,
            repeat: 5,
            duration: 200,
        }).delay(delay);

        animate.tween(firework.pos, { y: targetPos.y }, {
            duration: 2000,
            easing: animate.Easing.Projectile(animate.Easing.Linear),
        }).delay(delay);

        animate.tween(firework.pos, { x: targetPos.x }, {
            duration: 1000,
        }).delay(delay).then(() => {
            this.stars.shift();
            const scale = { x: 0.1, y: 0.1 };
            const rad = Math.min(this.width, this.height) / 2.5;
            const count = random.getRandInt(15, 30);
            const size = random.getRandInt(25, 40);

            const duration = random.getRandInt(600, 1200);
            for (let i = 0; i < count; i++) {
                const idx = random.getRandInt(1, 15);
                const spark = gfx.sprite({
                    image: Loader.images[`mainmenu-star${idx}`],
                    size: { h: size, w: size },
                });
                spark.anchor = { x: 0.5, y: 0.5 };
                spark.scale = scale;
                spark.pos = { x: firework.pos.x, y: firework.pos.y };
                spark.opacity = 0.0;
                this.stars.push(this.allocateInternal(spark));

                animate.tween(spark, { opacity: 1 }, {
                    duration,
                    easing: animate.Easing.Cubic.Out,
                }).then(() => {
                    animate.tween(spark, { opacity: 0 }, {
                        duration: duration / 3,
                        easing: animate.Easing.Cubic.Out,
                    });
                });
                animate.tween(spark.pos, {
                    x: spark.pos.x + (rad * Math.cos((i * 2 * Math.PI) / count)),
                    y: spark.pos.y + (rad * Math.sin((i * 2 * Math.PI) / count)),
                }, {
                    duration: 1.25 * duration,
                    easing: animate.Easing.Cubic.Out,
                });
            }
            return animate.tween(scale, { x: 1, y: 1 }, {
                duration: 1000,
                easing: animate.Easing.Cubic.Out,
            });
        });
    }

    get touchRecordClass() {
        return TouchRecord;
    }

    drawContents() {
        const state = this.getState();

        this.ctx.save();
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();

        for (const starId of this.stars) {
            this.drawInternalProjection(state, starId, starId, this.makeBaseOffset({ opacity: this.opacity }));
        }
        for (const starId of this.levelStars) {
            this.drawInternalProjection(state, starId, starId, this.makeBaseOffset({ opacity: this.opacity }));
        }

        this.drawInternalProjection(state, this.title, this.title, this.makeBaseOffset({ opacity: this.opacity }));

        if (this.continueButtonId) {
            this.continueButton.prepare(this.continueButtonId, this.continueButtonId, state, this);
            this.continueButton.draw(
                this.continueButtonId, this.continueButtonId, state, this,
                this.makeBaseOffset({ opacity: this.opacity })
            );
        }
        if (this.challengeButtonId) {
            const view = this.internalViews[this.challengeButtonId];
            view.prepare(this.challengeButtonId, this.challengeButtonId, state, this);
            view.draw(
                this.challengeButtonId, this.challengeButtonId, state, this,
                this.makeBaseOffset({ opacity: this.opacity })
            );
        }

        for (const fx of Object.values(this.effects)) {
            fx.prepare();
            fx.draw();
        }
    }

    getNodeAtPos(pos, selectedId=null) {
        const projection = this.continueButton;
        const offset = this.makeBaseOffset();

        if (this.continueButtonId) {
            if (projection.containsPoint(pos, offset)) {
                return [ this.continueButtonId, this.continueButtonId ];
            }
        }

        if (this.challengeButtonId) {
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
    onstart(mousePos) {
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
