import * as gfx from "../gfx/core";
import * as progression from "../game/progression";
import Loader from "../loader";

export default class Feedback {
    constructor(stage) {
        this.stage = stage;

        const chapter = progression.currentChapter();
        const alienIndex = Math.floor(((progression.currentLevel() - chapter.startIdx) /
                                       ((chapter.endIdx - chapter.startIdx) + 1)) *
                                      chapter.resources.aliens.length);
        const image = Loader.images[chapter.resources.aliens[alienIndex]];
        const alien = stage.allocate(gfx.sprite({
            image,
            size: { h: 80, w: 80 * (image.frame.w / image.frame.h) },
        }));
        this.stage.views[alien].pos = { x: 5, y: 5 };

        this.alien = alien;
        this.contents = [];

        const layout = gfx.layout.hbox(() => this.contents, {
            subexpScale: 1,
        }, gfx.baseProjection);
        layout.anchor = { x: 0.5, y: 1 };
        this.container = stage.allocate(layout);
        this.visible = false;
    }

    /**
     * @param message List of strings and node IDs
     */
    update(color, ...rows) {
        this.visible = rows.length > 0;

        if (rows.length === 1) {
            this.contents = this._makeRow(color, rows[0]);
        }
        else {
            const rowIds = rows
                .map(items => this._makeRow(color, items))
                .map(ids => this.stage.allocate(gfx.layout.hbox(() => ids, {
                    subexpScale: 1,
                }, gfx.baseProjection)));
            this.contents = [
                this.stage.allocate(gfx.layout.vbox(() => rowIds, {
                    subexpScale: 1,
                }, gfx.baseProjection)),
            ];
        }
    }

    _makeRow(color, message) {
        return message.map((msgOrId) => {
            if (typeof msgOrId === "number" || Array.isArray(msgOrId)) {
                return msgOrId;
            }
            return this.stage.allocate(gfx.text(msgOrId, {
                color,
                font: gfx.text.script,
                fontSize: 40,
            }));
        });
    }

    clear() {
        this.visible = false;
        this.contents = [];
    }

    drawImpl(state) {
        if (!this.visible) return;

        // const alien = this.stage.views[this.alien];
        // alien.prepare(null, null, state, this.stage);
        // alien.draw(null, null, state, this.stage, this.stage.makeBaseOffset());

        const view = this.stage.getView(this.container);
        view.pos.x = this.stage.width / 2;
        view.pos.y = this.stage.toolbox.pos.y - 20;
        view.prepare(null, null, state, this.stage);
        view.draw(null, null, state, this.stage, this.stage.makeBaseOffset());
    }

    victory() {
        this.clear();
    }
}
