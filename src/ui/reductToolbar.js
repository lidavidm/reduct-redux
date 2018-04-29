import * as gfx from "../gfx/core";

export default class ReductToolbar {
    constructor(stage) {
        this.stage = stage;

        // Map of node ID to toolbox element
        this.ids = new Map();

        this.currentId = null;
    }

    update(id, prevId=null) {
        if (id !== null && (prevId === null || !this.ids.has(prevId))) {
            const cloned = document.querySelector("#reduct-toolbar").cloneNode(true);
            document.body.appendChild(cloned);
            this.ids.set(id, cloned);
            // TODO: bind event handlers
        }
        else if (this.ids.has(prevId)) {
            const el = this.ids.get(prevId);
            this.ids.delete(prevId);
            if (id !== null) {
                this.ids.set(id, el);
            }
            else {
                el.remove();
            }
        }
    }

    drawImpl(state) {
        const offsetX = this.stage.sidebarWidth;
        const offsetY = this.stage.canvas.offsetTop;

        for (const [ id, toolbar ] of this.ids.entries()) {
            const view = this.stage.getView(id);
            const absPos = gfx.absolutePos(view);
            const absSize = gfx.absoluteSize(view);

            toolbar.style.display = "flex";
            toolbar.style.top = `${absPos.y + absSize.h + offsetY}px`;
            const posLeft = (absPos.x - (toolbar.clientWidth / 2)) +
                  (absSize.w / 2) +
                  offsetX;
            toolbar.style.left = `${posLeft}px`;
        }
    }

    play() {

    }

    ffwd() {
        // TODO: LOGGING
        this.stage.step(this.stage.getState(), this.currentId, "big");
        this.update(null);
    }
}
