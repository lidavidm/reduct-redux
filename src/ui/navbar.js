import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as undo from "../reducer/undo";
import Loader from "../loader";

import { DEVELOPMENT_BUILD } from "../logging/logging";

export default class Navbar {
    constructor(stage) {
        this.stage = stage;

        this.reset = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-reset-default"],
            hover: Loader.images["btn-reset-hover"],
            active: Loader.images["btn-reset-down"],
        }, {
            click: () => {
                window.reset();
            },
            size: { w: 60, h: 60 },
        }));

        this.prev = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-back-default"],
            hover: Loader.images["btn-back-hover"],
            active: Loader.images["btn-back-down"],
        }, {
            click: () => {
                window.prev();
            },
            size: { w: 60, h: 60 },
        }));

        this.next = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-next-default"],
            hover: Loader.images["btn-next-hover"],
            active: Loader.images["btn-next-down"],
        }, {
            click: () => {
                window.next();
            },
            size: { w: 60, h: 60 },
        }));

        this.undo = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-back-default"],
            hover: Loader.images["btn-back-hover"],
            active: Loader.images["btn-back-down"],
        }, {
            click: () => {
                this.stage.store.dispatch(undo.undo());
                this.stage.unstuck();
            },
            size: { w: 60, h: 60 },
        }));

        this.redo = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["btn-next-default"],
            hover: Loader.images["btn-next-hover"],
            active: Loader.images["btn-next-down"],
        }, {
            click: () => {
                this.stage.store.dispatch(undo.redo());
            },
            size: { w: 60, h: 60 },
        }));

        this.buttons = [ this.reset, this.next, this.undo, this.redo ];

        const topButtons = [ this.reset, this.next ];
        const bottomButtons = [ this.undo, this.redo ];

        if (DEVELOPMENT_BUILD) {
            this.buttons.push(this.prev);
            topButtons.unshift(this.prev);
        }

        const topRow = stage.allocate(gfx.layout.hbox(
            () => topButtons,
            {
                subexpScale: 1,
            },
            gfx.baseProjection
        ));
        const bottomRow = stage.allocate(gfx.layout.hbox(
            () => bottomButtons,
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
