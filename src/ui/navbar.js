import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import Loader from "../loader";

export default class Navbar {
    constructor(stage) {
        this.stage = stage;

        this.reset = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-reset-default"],
            hover: Loader.images["btn-reset-hover"],
            active: Loader.images["btn-reset-down"],
        }, {
            click: () => {},
            size: { w: 60, h: 60 },
        }));

        this.undo = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-back-default"],
            hover: Loader.images["btn-back-hover"],
            active: Loader.images["btn-back-down"],
        }, {
            click: () => {},
            size: { w: 60, h: 60 },
        }));

        this.buttons = [ this.reset, this.undo ];

        const topRow = stage.allocate(gfx.layout.hbox(
            () => [ this.reset ],
            {
                subexpScale: 1,
            },
            gfx.baseProjection
        ));
        const bottomRow = stage.allocate(gfx.layout.hbox(
            () => [ this.undo ],
            {
                subexpScale: 1,
            },
            gfx.baseProjection
        ));
        this.container = stage.allocate(gfx.layout.sticky(
            gfx.layout.vbox(
                () => [ topRow, bottomRow ],
                {
                    subexpScale: 1,
                },
                gfx.baseProjection
            ),
            "top",
            {
                align: "right",
            }
        ));
    }

    containsPoint(pos) {
        return this.stage.getView(this.container).containsPoint(pos, this.stage.makeBaseOffset());
    }

    get size() {
        const container = this.stage.getView(this.container);
        return {
            w: container.size.w,
            h: container.size.h,
        };
    }

    get pos() {
        return this.stage.getView(this.container).pos;
    }

    getNodeAtPos(state, pos) {
        if (!this.containsPoint(pos)) return [ null, null ];

        const result = this.stage.testNodeAtPos(
            state, pos, this.container, this.container,
            null, this.stage.makeBaseOffset(),
            viewId => this.buttons.includes(viewId)
        );
        if (result) {
            return [ result[1], result[1] ];
        }
        return [ null, null ];
    }

    drawImpl(state) {
        this.stage.getView(this.container).prepare(
            this.container, this.container,
            state, this.stage
        );
        this.stage.getView(this.container).draw(
            this.container, this.container,
            state, this.stage,
            this.stage.makeBaseOffset()
        );
    }
}
