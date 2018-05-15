import * as gfx from "../gfx/core";
import * as progression from "../game/progression";
import * as undo from "../reducer/undo";
import Loader from "../loader";

export default class Navbar {
    constructor(stage) {
        this.stage = stage;

        this.reset = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["blureset"],
            hover: Loader.images["btn-reset-hover"],
            active: Loader.images["btn-reset-down"],
        }, {
            click: () => {
                window.reset();
            },
            size: { w: 65, h: 65 },
        }));

        // this.prev = stage.allocate(gfx.ui.imageButton({
        //     normal: Loader.images["btn-back-default"],
        //     hover: Loader.images["btn-back-hover"],
        //     active: Loader.images["btn-back-down"],
        // }, {
        //     click: () => {
        //         window.prev();
        //     },
        //     size: { w: 60, h: 60 },
        // }));

        // this.next = stage.allocate(gfx.ui.imageButton({
        //     normal: Loader.images["btn-next-default"],
        //     hover: Loader.images["btn-next-hover"],
        //     active: Loader.images["btn-next-down"],
        // }, {
        //     click: () => {
        //         window.next();
        //     },
        //     size: { w: 60, h: 60 },
        // }));

        this.undo = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["bluundo"],
            hover: Loader.images["btn-back-hover"],
            active: Loader.images["btn-back-down"],
        }, {
            click: () => {
                this.stage.store.dispatch(undo.undo());
                this.stage.unstuck();
            },
            size: { w: 65, h: 65 },
        }));

        this.redo = stage.allocate(gfx.ui.imageButton({
            normal: Loader.images["bluredo"],
            hover: Loader.images["btn-next-hover"],
            active: Loader.images["btn-next-down"],
        }, {
            click: () => {
                this.stage.store.dispatch(undo.redo());
            },
            size: { w: 65, h: 65 },
        }));

        this.buttons = [ this.undo, this.reset, this.redo ];

        const topButtons = [ this.undo, this.reset, this.redo ];

        const topRow = stage.allocate(gfx.layout.hbox(
            () => topButtons,
            {
                subexpScale: 1,
                padding: {
                    left: 0,
                    right: 0,
                    inner: 10,
                },
            },
            gfx.baseProjection
        ));
        this.container = stage.allocate(gfx.layout.vbox(
            () => [ topRow ],
            {
                subexpScale: 1,
                padding: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    inner: 5,
                },
                highlight: false,
                color: null,
                anchor: { x: 1, y: 1 },
            },
            gfx.roundedRect
        ));
        const chapter = stage.allocate(gfx.text(`Chapter ${progression.chapterIdx() + 1}`, {
            font: gfx.text.sans,
            color: "#FFF",
        }));
        const level = stage.allocate(gfx.text(`Level ${progression.currentLevel() + 1}`, {
            font: gfx.text.sans,
            color: "#FFF",
        }));
        this.levelDisplay = stage.allocate(gfx.layout.vbox(
            () => [
                chapter,
                level,
            ],
            {
                subexpScale: 1,
                padding: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    inner: 5,
                },
                anchor: { x: 1, y: 1 },
                horizontalAlign: 0,
                highlight: false,
                color: null,
            },
            gfx.roundedRect
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
        const rawState = this.stage.store.getState().get("program");
        this.stage.getView(this.undo).enabled = rawState.get("$past").size > 0;
        this.stage.getView(this.redo).enabled = rawState.get("$future").size > 0;

        const levelDisplay = this.stage.getView(this.levelDisplay);
        levelDisplay.pos.x = this.stage.width - 25;
        levelDisplay.pos.y = 100;
        levelDisplay.prepare(
            this.levelDisplay, this.levelDisplay,
            state, this.stage
        );
        this.stage.getView(this.levelDisplay).draw(
            this.levelDisplay, this.levelDisplay,
            state, this.stage,
            this.stage.makeBaseOffset()
        );

        const container = this.stage.getView(this.container);
        container.pos.x = levelDisplay.pos.x - levelDisplay.size.w - 25;
        container.pos.y = 100;
        container.prepare(
            this.container, this.container,
            state, this.stage
        );
        container.draw(
            this.container, this.container,
            state, this.stage,
            this.stage.makeBaseOffset()
        );
    }

    animateStuck() {
        this.stage.getView(this.container).color = "#FFF";
    }

    unstuck() {
        this.stage.getView(this.container).color = null;
    }
}
