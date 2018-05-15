import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Audio from "../resource/audio";
import Logging from "../logging/logging";

import Loader from "../loader";

import BaseStage from "./basestage";
import BaseTouchRecord from "./touchrecord";

export default class TitleStage extends BaseStage {
    constructor(startGame, ...args) {
        super(...args);

        this.startGame = startGame;
        this.color = "#8ab7db";

        const title = gfx.layout.sticky(
            gfx.layout.ratioSizer(gfx.sprite({
                image: Loader.images["reduct_title"],
                size: { h: 213, w: 899 },
            }), 213 / 899, 0.6),
            "center",
            {}
        );
        title.opacity = 0;
        this.title = this.allocateInternal(title);

        const buttons = [];

        const shapeIds = [
            gfx.shapes.star(), gfx.shapes.triangle(),
        ].map(view => this.allocate(view));
        const foodIds = [
            Loader.images["food_1"],
            Loader.images["food_2"],
        ].map(image => this.allocate(gfx.sprite({
            image,
            size: image.naturalHeight / image.naturalWidth > 1.5 ?
                {
                    w: 25,
                    h: (image.naturalHeight / image.naturalWidth) * 25,
                } :
                {
                    w: 50,
                    h: (image.naturalHeight / image.naturalWidth) * 50,
                },
        })));
        const sportsIds = [
            Loader.images["sport_1"],
            Loader.images["sport_2"],
        ].map(image => this.allocate(gfx.sprite({
            image,
            size: image.naturalHeight / image.naturalWidth > 1.5 ?
                {
                    w: 25,
                    h: (image.naturalHeight / image.naturalWidth) * 25,
                } :
                {
                    w: 50,
                    h: (image.naturalHeight / image.naturalWidth) * 50,
                },
        })));

        const views = [
            [0, gfx.layout.hbox(
                () => shapeIds,
                {
                    subexpScale: 1.0,
                },
                gfx.baseProjection
            )],
            [1, gfx.layout.hbox(
                () => foodIds,
                {
                    subexpScale: 1.0,
                },
                gfx.baseProjection
            )],
            [2, gfx.layout.hbox(
                () => sportsIds,
                {
                    subexpScale: 1.0,
                },
                gfx.baseProjection
            )],
        ];

        for (const [ symbolFadeLevel, view ] of views) {
            const theme = this.allocate(view);
            const label = this.allocate(gfx.text("I like", {
                fontSize: 50,
                font: gfx.text.script,
            }));
            const label2 = this.allocate(gfx.text("!", {
                fontSize: 50,
                font: gfx.text.script,
            }));
            const button = gfx.ui.button(this, () => [ label, theme, label2 ], {
                color: "#e95888",
                anchor: {
                    x: 0,
                    y: 0,
                },
                subexpScale: 1,
                click: () => {
                    Logging.log("theme", symbolFadeLevel);
                    progression.forceFadeLevel("symbol", symbolFadeLevel);
                    this.animateStart();
                },
            });

            buttons.push(this.allocate(button));
        }

        this.buttons = buttons;

        const layout = gfx.layout.sticky(gfx.layout.vbox(() => buttons, {
            subexpScale: 1.0,
            padding: {
                inner: 20,
            },
        }, gfx.baseProjection), "center", {
            hAlign: 0.0,
        });
        layout.opacity = 0.0;
        this.layout = this.allocate(layout);

        // ** Startup Animations ** //

        this.state = "initializing";
        animate.tween(this, {
            color: "#FFF",
        }, {
            duration: 500,
            setAnimatingFlag: false,
            easing: animate.Easing.Color(animate.Easing.Cubic.In, this.color, "#FFF"),
        })
            .then(() => animate.tween(title, {
                opacity: 1.0,
            }, {
                duration: 500,
                easing: animate.Easing.Cubic.Out,
            }).delay(1000))
            .then(() => Promise.all([
                animate.tween(title, {
                    scale: { x: 0.7, y: 0.7 },
                    sticky: { marginY: -180 },
                }, {
                    duration: 800,
                    easing: animate.Easing.Cubic.Out,
                }),
                animate.tween(layout, {
                    opacity: 1.0,
                }, {
                    duration: 1000,
                    easing: animate.Easing.Cubic.Out,
                }),
            ]))
            .then(() => {
                this.state = "initialized";
            });
    }

    _mouseup(e) {
        if (this.state === "initializing") {
            this.fastForward();
        }

        super._mouseup(e);
    }

    fastForward() {
        animate.clock.cancelAll();
        this.state = "initialized";
        this.color = "#FFF";
        const title = this.getView(this.title);
        title.opacity = 1.0;
        title.scale = { x: 0.7, y: 0.7 };
        title.sticky.marginY = -180;
        this.getView(this.layout).opacity = 1.0;
    }

    animateStart() {
        this.state = "transitioning";

        Promise.all([
            animate.tween(this.getView(this.title), {
                scale: { x: 0.4, y: 0.4 },
                opacity: 0.5,
            }, {
                duration: 800,
                easing: animate.Easing.Cubic.In,
            }),
            animate.tween(this.getView(this.title), {
                sticky: { marginY: -this.height },
            }, {
                duration: 500,
                easing: animate.Easing.Anticipate.BackIn(1.5),
            }),
            animate.tween(this.getView(this.layout), {
                opacity: 0,
            }, {
                duration: 500,
                easing: animate.Easing.Cubic.In,
            }),
            animate.tween(this, {
                color: "#8ab7db",
            }, {
                duration: 500,
                setAnimatingFlag: false,
                easing: animate.Easing.Color(animate.Easing.Cubic.In, this.color, "#8ab7db"),
            }),
        ]).then(() => this.startGame());
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

        this.drawInternalProjection(state, this.title);
        this.drawProjection(state, this.layout);
    }

    getNodeAtPos(pos, selectedId=null) {
        if (this.state !== "initialized") return [ null, null ];

        const offset = this.makeBaseOffset();
        const buttonLayout = this.getView(this.layout);
        if (buttonLayout.containsPoint(pos, offset)) {
            const topLeft = gfx.util.topLeftPos(buttonLayout, offset);
            const subpos = {
                x: pos.x - topLeft.x,
                y: pos.y - topLeft.y,
            };

            for (const id of this.buttons) {
                const button = this.getView(id);
                if (button.containsPoint(subpos, offset)) {
                    return [ id, id ];
                }
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
    onstart(...args) {
        super.onstart(...args);

        if (this.topNode) {
            const view = this.stage.getView(this.topNode);
            if (view.onmousedown) {
                view.onmousedown();
            }
        }
    }

    onmove(...args) {
        super.onmove(...args);

        if (this.hoverNode !== this.prevHoverNode) {
            const view = this.stage.getView(this.hoverNode);
            const prevView = this.stage.getView(this.prevHoverNode);

            if (prevView && prevView.onmouseexit) {
                prevView.onmouseexit();
            }

            if (view && view.onmouseenter) {
                view.onmouseenter();
            }
        }
    }

    onend(...args) {
        super.onend(...args);

        if (this.topNode) {
            const view = this.stage.getView(this.topNode);
            if (view.onclick) {
                view.onclick();
            }
        }
    }
}
