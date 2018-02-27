import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";
import Loader from "../loader";

export default class SyntaxJournal {
    constructor(stage) {
        this.stage = stage;

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

        this.state = "closed";

        this.syntaxes = {};
    }

    drawImpl(state) {
        if (this.isOpen) {
            this.stage.drawInternalProjection(state, this.overlay);
            this.stage.drawInternalProjection(state, this.background);

            const bg = this.stage.getView(this.background);
            let y = bg.pos.y + 40;

            const { ctx } = this.stage;
            ctx.save();
            ctx.globalCompositeOperation = "multiply";

            for (const syntax of progression.getLearnedSyntaxes()) {
                if (!this.syntaxes[syntax]) {
                    const image = Loader.images[syntax];
                    const sprite = gfx.sprite({
                        image,
                        size: { w: image.naturalWidth, h: image.naturalHeight },
                    });
                    sprite.anchor = { x: 0.5, y: 0 };
                    this.syntaxes[syntax] = this.stage.allocateInternal(sprite);
                }

                const view = this.stage.getView(this.syntaxes[syntax]);
                view.pos.x = this.stage.width / 2;
                view.pos.y = y;
                y += view.size.h + 10;

                this.stage.drawInternalProjection(state, this.syntaxes[syntax], null, {
                    x: 0,
                    y: 0,
                    sx: 1,
                    sy: 1,
                    opacity: bg.opacity,
                });
            }

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
}
