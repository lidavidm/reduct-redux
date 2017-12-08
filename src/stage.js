import * as projections from "./projections";

export class Stage {
    constructor(width, height, store, views) {
        this.store = store;
        this.views = views;

        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute("width", width);
        this.canvas.setAttribute("height", height);
        this.ctx = this.canvas.getContext("2d");

        this.color = "#EEEEEE";

        this._redrawPending = false;
        this._drawFunc = null;
    }

    get view() {
        return this.canvas;
    }

    drawImpl() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._redrawPending = false;

        const state = this.store.getState();
        for (const nodeId of state.board) {
            const node = state.nodes[nodeId];
            projections.draw(node, state.nodes, this.views, this);
        }
    }

    draw() {
        if (this._redrawPending) return;
        this._redrawPending = true;
        window.requestAnimationFrame(() => {
            this.drawImpl();
        });
    }
}
