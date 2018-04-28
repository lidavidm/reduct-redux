import * as gfx from "../gfx/core";

export default class ReductToolbar {
    constructor(stage) {
        this.stage = stage;

        this.currentId = null;
    }

    update(id, mousePos) {
        const toolbar = document.querySelector("#reduct-toolbar");

        const offsetX = this.stage.sidebarWidth;
        const offsetY = this.stage.canvas.offsetTop;

        // TODO: find actual top-level ID

        let view = this.stage.getView(id === null ? this.currentId : id);
        if (!view) return;
        while (view.parent) view = view.parent;

        const absPos = gfx.absolutePos(view);
        const absSize = gfx.absoluteSize(view);

        if (id === null) {
            // Don't hide toolbar if mouse pokes out of the expression
            // region
            const safeX0 = Math.min(absPos.x, toolbar.offsetLeft);
            const safeX1 = Math.max(absPos.x + absSize.w, toolbar.offsetLeft + toolbar.offsetWidth);
            const safeY0 = Math.min(absPos.y, toolbar.offsetTop + offsetX);
            const safeY1 = Math.max(absPos.y + absSize.h, toolbar.offsetTop + toolbar.offsetHeight);
            if (mousePos.x >= safeX0 &&
                mousePos.x <= safeX1 &&
                mousePos.y >= safeY0 &&
                mousePos.y <= safeY1) {
                return;
            }

            toolbar.style.display = "none";
            this.currentId = null;
            return;
        }

        this.currentId = id;

        toolbar.style.display = "flex";
        toolbar.style.top = `${absPos.y + absSize.h + offsetY}px`;
        const posLeft = (absPos.x - (toolbar.clientWidth / 2)) +
              (absSize.w / 2) +
              offsetX;
        toolbar.style.left = `${posLeft}px`;
    }
}
