import * as gfx from "../gfx/core";

/**
 * Handle the play/pause/big-step toolbar for reducing expressions.
 *
 * These are rendered in HTML, and positioned to match their
 * corresponding expression. It does some work to recycle the toolbar
 * nodes and make sure they stay attached to the same expression
 * through reduction.
 *
 * @module ReductToolbar
 */
export default class ReductToolbar {
    constructor(stage) {
        this.stage = stage;

        // Map of node ID to [toolbox element, should stop reducing]
        this.ids = new Map();

        this.currentId = null;

        // TODO: move this somewhere else
        // Remove any toolbars from the previous level
        for (const el of document.querySelectorAll(".reduct-toolbar:not(#reduct-toolbar-proto)")) {
            el.remove();
        }

        this._shouldStop = this.shouldStop.bind(this);
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
            this.ids.set(id, { el: cloned, shouldStop: false });

            let status = "can-play";

            cloned.querySelector(".toolbar-ffwd")
                .addEventListener("click", () => this.ffwd(parseInt(cloned.dataset.id, 10)));

            cloned.querySelector(".toolbar-play")
                .addEventListener("click", () => {
                    if (status === "can-play") {
                        status = "playing";
                        cloned.classList.add("playing");
                        this.play(parseInt(cloned.dataset.id, 10));
                    }
                    else {
                        status = "can-play";
                        cloned.classList.remove("playing");
                        this.pause(parseInt(cloned.dataset.id, 10));
                    }
                    // Reposition buttons
                    this.drawImpl(this.stage.getState());
                });
        }
        else if (this.ids.has(prevId)) {
            const idRecord = this.ids.get(prevId);
            this.ids.delete(prevId);
            if (id !== null &&
                this.stage.semantics.kind(state.getIn([ "nodes", id ])) === "expression") {
                this.ids.set(id, idRecord);
                idRecord.el.dataset.id = id;
            }
            else {
                idRecord.el.remove();
            }
        }
    }

    drawImpl(state) {
        const offsetX = this.stage.sidebarWidth;
        const offsetY = this.stage.canvas.offsetTop;

        const board = state.get("board");
        const toDelete = [];

        for (const [ id, { el: toolbar } ] of this.ids.entries()) {
            if (!board.includes(id)) {
                toDelete.push(id);
                continue;
            }

            const view = this.stage.getView(id);
            const absPos = gfx.absolutePos(view);
            const absSize = gfx.absoluteSize(view);

            let posTop = absPos.y + absSize.h + offsetY;
            let posLeft = (absPos.x - (toolbar.clientWidth / 2)) +
                  (absSize.w / 2) +
                  offsetX;

            // TODO: refactor this to stage?
            if (gfx.viewport.IS_PHONE) {
                posTop *= 1.33;
                posLeft *= 1.33;
            }

            toolbar.style.top = `${posTop}px`;
            toolbar.style.left = `${posLeft}px`;
        }

        toDelete.forEach(id => this.update(null, id));
    }

    shouldStop(id) {
        if (this.ids.has(id)) {
            return this.ids.get(id).shouldStop;
        }
        return false;
    }

    play(id) {
        if (this.ids.has(id)) {
            this.ids.get(id).shouldStop = false;
        }
        this.stage.step(this.stage.getState(), id, "hybrid", this._shouldStop);
    }

    pause(id) {
        if (this.ids.has(id)) {
            this.ids.get(id).shouldStop = true;
        }
    }

    ffwd(id) {
        // TODO: LOGGING
        this.stage.step(this.stage.getState(), id, "big");
    }
}
