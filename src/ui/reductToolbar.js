import * as gfx from "../gfx/core";

export default class ReductToolbar {
    constructor(stage) {
        this.stage = stage;

        // Map of node ID to toolbox element
        this.ids = new Map();

        this.currentId = null;

        // TODO: move this somewhere else
        for (const el of document.querySelectorAll(".reduct-toolbar:not(#reduct-toolbar-proto)")) {
            el.remove();
        }
    }

    update(id, prevId=null) {
        const state = this.stage.getState();
        if (id !== null && (prevId === null || !this.ids.has(prevId))) {
            if (this.stage.semantics.kind(state.getIn([ "nodes", id ])) !== "expression") {
                return;
            }

            const cloned = document.querySelector("#reduct-toolbar-proto").cloneNode(true);
            cloned.setAttribute("id", "");
            document.body.appendChild(cloned);
            cloned.dataset.id = id;
            this.ids.set(id, cloned);

            cloned.querySelector(".toolbar-ffwd")
                .addEventListener("click", () => this.ffwd(parseInt(cloned.dataset.id, 10)));
            cloned.querySelector(".toolbar-play")
                .addEventListener("click", () => this.play(parseInt(cloned.dataset.id, 10)));
        }
        else if (this.ids.has(prevId)) {
            const el = this.ids.get(prevId);
            this.ids.delete(prevId);
            if (id !== null &&
                this.stage.semantics.kind(state.getIn([ "nodes", id ])) === "expression") {
                this.ids.set(id, el);
                el.dataset.id = id;
            }
            else {
                el.remove();
            }
        }
    }

    drawImpl(state) {
        const offsetX = this.stage.sidebarWidth;
        const offsetY = this.stage.canvas.offsetTop;

        const board = state.get("board");
        const toDelete = [];

        for (const [ id, toolbar ] of this.ids.entries()) {
            if (!board.includes(id)) {
                toDelete.push(id);
                continue;
            }

            const view = this.stage.getView(id);
            const absPos = gfx.absolutePos(view);
            const absSize = gfx.absoluteSize(view);

            toolbar.style.top = `${absPos.y + absSize.h + offsetY}px`;
            const posLeft = (absPos.x - (toolbar.clientWidth / 2)) +
                  (absSize.w / 2) +
                  offsetX;
            toolbar.style.left = `${posLeft}px`;
        }

        toDelete.forEach(id => this.update(null, id));
    }

    play() {

    }

    ffwd(id) {
        // TODO: LOGGING
        this.stage.step(this.stage.getState(), id, "big");
    }
}
