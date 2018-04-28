import * as gfx from "../gfx/core";

export default class ReductToolbar {
    constructor(stage) {
        this.stage = stage;
    }

    update(id) {
        const toolbar = document.querySelector("#reduct-toolbar");
        if (id === null) {
            toolbar.style.display = "none";
            return;
        }

        let view = this.stage.getView(id);
        while (view.parent) view = view.parent;

        toolbar.style.display = "flex";
        const absPos = gfx.absolutePos(view);
        const absSize = gfx.absoluteSize(view);
        toolbar.style.top = `${absPos.y + (2 * absSize.h)}px`;
        const posLeft = (absPos.x - (toolbar.clientWidth / 2)) +
              (absSize.w / 2) +
              this.stage.sidebarWidth;
        toolbar.style.left = `${posLeft}px`;
    }
}
