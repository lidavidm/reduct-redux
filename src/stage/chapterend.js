import * as gfx from "../gfx/core";

import BaseStage from "./basestage";

export default class ChapterEndStage extends BaseStage {
    constructor(...args) {
        super(...args);

        this.color = "#594764";

        const title = gfx.layout.sticky(gfx.text("Chapter Finished!", {
            fontSize: 40,
            color: "#FFF",
        }), "top", {
            align: "center",
            margin: 50,
        });
        this.title = this.internalViews[this.allocateInternal(title)];

        this.draw();
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
    }
}
