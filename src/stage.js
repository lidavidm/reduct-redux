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

        this.canvas.addEventListener("mousedown", (e) => this._mousedown(e));
        this.canvas.addEventListener("mousemove", (e) => this._mousemove(e));
        this.canvas.addEventListener("mouseup", (e) => this._mouseup(e));

        this._selectedNode = null;
    }

    get view() {
        return this.canvas;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            // TODO: scale
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top),
        };
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

    _mousedown(e) {
        const state = this.store.getState();
        const pos = this.getMousePos(e);
        for (const nodeId of state.board) {
            const node = state.nodes[nodeId];
            if (projections.containsPoint(pos, node, state.nodes, this.views, this)) {
                this._selectedNode = nodeId;
                console.log("selected", nodeId, node);
            }
        }
    }

    _mousemove(e) {
        if (e.buttons > 0 && this._selectedNode !== null) {
            const view = this.views[this._selectedNode];
            view.x += e.movementX;
            view.y += e.movementY;
            this.draw();
        }
    }

    _mouseup(e) {

    }
}
