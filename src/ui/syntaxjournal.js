import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Loader from "../loader";

export default class SyntaxJournal {
    constructor(stage) {
        this.stage = stage;

        const syntaxJournal = gfx.layout.sticky(gfx.ui.imageButton({
            normal: Loader.images["journal-default"],
            hover: Loader.images["journal-hover"],
            active: Loader.images["journal-mousedown"],
        }, {
            click: () => this.stage.syntaxJournal.toggle(),
        }), "bottom", {
            align: "right",
        });
        syntaxJournal.size = { w: 79, h: 78 };
        this.button = stage.allocateInternal(syntaxJournal);

        this.overlay = stage.allocateInternal(gfx.layout.expand(gfx.rect({
            color: "#000",
            opacity: 0.7,
        }), {
            horizontal: true,
            vertical: true,
        }));

        this.background = stage.allocateInternal(gfx.layout.sticky(gfx.sprite({
            image: Loader.images["journal-bg"],
            size: { w: 558, h: 534 },
        }), "center"));

        this.next = stage.allocateInternal(gfx.layout.sticky(gfx.ui.imageButton({
            normal: Loader.images["btn-next-default"],
            hover: Loader.images["btn-next-hover"],
            active: Loader.images["btn-next-down"],
        }), "center", {
            marginX: 270,
        }));

        this.prev = stage.allocateInternal(gfx.layout.sticky(gfx.ui.imageButton({
            normal: Loader.images["btn-back-default"],
            hover: Loader.images["btn-back-hover"],
            active: Loader.images["btn-back-down"],
        }), "center", {
            marginX: -250,
        }));

        this.state = "closed";

        this.syntaxes = {};
        this.currentSyntax = 0;
    }

    getNodeAtPos(state, pos) {
        const journal = this.stage.internalViews[this.button];
        if (journal.containsPoint(pos, { x: 0, y: 0, sx: 1, sy: 1 })) {
            return [ this.button, this.button ];
        }
        return [ null, null ];
    }

    drawBase(state) {
        this.stage.internalViews[this.button].prepare(null, null, state, this.stage);
        this.stage.internalViews[this.button].draw(null, null, state, this.stage, {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
        });
    }

    get showBack() {
        return this.currentSyntax > 0;
    }

    get showForward() {
        return this.currentSyntax < Object.keys(this.syntaxes).length - 1;
    }

    drawImpl(state) {
        if (this.isOpen) {
            const bg = this.stage.getView(this.background);
            const offset = {
                x: 0,
                y: 0,
                sx: 1,
                sy: 1,
                opacity: bg.opacity,
            };

            this.stage.drawInternalProjection(state, this.overlay);
            this.stage.drawInternalProjection(state, this.background);
            if (this.showBack) {
                this.stage.drawInternalProjection(state, this.prev, null, offset);
            }
            if (this.showForward) {
                this.stage.drawInternalProjection(state, this.next, null, offset);
            }

            let y = bg.pos.y + 40;

            const { ctx } = this.stage;
            ctx.save();
            ctx.globalCompositeOperation = "multiply";

            this.project();
            const syntax = progression.getLearnedSyntaxes()[this.currentSyntax];

            const view = this.stage.getView(this.syntaxes[syntax]);
            view.pos.x = this.stage.width / 2;
            view.pos.y = y;
            y += view.size.h + 10;

            this.stage.drawProjection(state, this.syntaxes[syntax], offset);

            ctx.restore();
        }
    }

    get isOpen() {
        return this.state === "open";
    }

    open() {
        this.state = "open";

        const overlay = this.stage.getView(this.overlay);
        const bg = this.stage.getView(this.background);
        overlay.opacity = 0;
        bg.opacity = 0;

        animate.tween(overlay, { opacity: 0.7 }, {
            duration: 500,
            easing: animate.Easing.Cubic.In,
        });
        animate.tween(bg, { opacity: 1.0 }, {
            duration: 500,
            easing: animate.Easing.Cubic.In,
        }).delay(300);
    }

    close() {
        this.state = "closed";
    }

    toggle() {
        if (this.state === "open") {
            this.close();
        }
        else {
            this.open();
        }
    }

    project() {
        for (const syntax of progression.getLearnedSyntaxes()) {
            if (!this.syntaxes[syntax]) {
                const defn = progression.getSyntaxDefinition(syntax);

                const children = [];

                const image = Loader.images[defn.header];
                const sprite = gfx.sprite({
                    image,
                    size: { w: image.naturalWidth, h: image.naturalHeight },
                });
                children.push(this.stage.allocate(sprite));

                for (const item of defn.contents) {
                    if (typeof item === "string") {
                        children.push(this.stage.allocate(gfx.text(item, {
                            font: gfx.text.script,
                        })));
                    }
                }

                const container = gfx.layout.vbox(
                    gfx.constant(...children),
                    {
                        subexpScale: 1,
                        padding: {
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            inner: 10,
                        },
                    },
                    gfx.baseProjection
                );
                container.anchor = { x: 0.5, y: 0 };
                this.syntaxes[syntax] = this.stage.allocate(container);
            }
        }
    }
}
