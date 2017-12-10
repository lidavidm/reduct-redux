import * as action from "./action";
import { nextId } from "./reducer";

export class Stage {
    constructor(width, height, store, views, semantics) {
        this.store = store;
        this.views = views;
        this.semantics = semantics;

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
        this._hoverNode = null;
        this._targetNode = null;
        this._dragged = false;
    }

    allocate(projection) {
        const id = nextId();
        this.views[id] = projection;
        return id;
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

    getState() {
        return this.store.getState().getIn([ "program", "$present" ]);
    }

    drawImpl() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._redrawPending = false;

        const state = this.getState();
        for (const nodeId of state.get("board")) {
            const node = state.get("nodes").get(nodeId);
            const projection = this.views[nodeId];
            projection.prepare(nodeId, state, this);
            projection.draw(nodeId, state, this, { x: 0, y: 0, sx: 1, sy: 1 });
        }
    }

    draw() {
        if (this._redrawPending) return;
        this._redrawPending = true;
        window.requestAnimationFrame(() => {
            this.drawImpl();
        });
    }

    getNodeAtPos(pos) {
        const state = this.getState();
        let result = null;
        let root = null;

        for (const nodeId of state.get("board")) {
            if (nodeId == this._selectedNode) continue;

            const node = state.getIn([ "nodes", nodeId ]);
            const projection = this.views[nodeId];

            if (projection.containsPoint(pos)) {
                root = result = nodeId;

                let subexprIds = this.semantics.subexpressions(state.getIn([ "nodes", nodeId ]));

                pos.x -= projection.pos.x;
                pos.y -= projection.pos.y;

                outerLoop:
                while (subexprIds.length > 0) {
                    for (let subexprId of subexprIds) {
                        if (this.views[subexprId].containsPoint(pos)) {
                            const node = state.getIn([ "nodes", subexprId ]);
                            if (node.get("locked")) break outerLoop;

                            result = subexprId;
                            subexprIds = this.semantics.subexpressions(node);
                            pos.x -= this.views[subexprId].pos.x;
                            pos.y -= this.views[subexprId].pos.y;
                            continue outerLoop;
                        }
                    }
                    subexprIds = [];
                }
            }
        }

        return [ root, result ];
    }

    _mousedown(e) {
        const state = this.getState();
        const pos = this.getMousePos(e);
        [ this._selectedNode, this._targetNode ] = this.getNodeAtPos(pos);
    }

    _mousemove(e) {
        if (e.buttons > 0 && this._selectedNode !== null) {
            const view = this.views[this._selectedNode];
            view.pos.x += e.movementX;
            view.pos.y += e.movementY;
            this.draw();
            this._dragged = true;
        }

        if (e.buttons > 0 && this._targetNode && this._targetNode !== this._selectedNode) {
            const target = this.getState().getIn([ "nodes", this._targetNode ]);
            if (!target.get("locked") && target.get("parent")) {
                // Detach
                this.store.dispatch(action.detach(this._targetNode));
                this._selectedNode = this._targetNode;
            }
        }

        const before = this._hoverNode;
        const [ root, target ] = this.getNodeAtPos(this.getMousePos(e));
        this._hoverNode = target;
        if (target !== before) {
            this.store.dispatch(action.hover(this._hoverNode));
        }
    }

    _mouseup(e) {
        const state = this.getState();

        if (!this._dragged && this._selectedNode) {
            const selectedNode = this._selectedNode;

            const nodes = state.get("nodes");
            const node = nodes.get(selectedNode);
            this.semantics.reduce(nodes, node).then((res) => {
                // TODO: have semantics tell us which root node changed
                if (!res) return;

                const [ result, nodes ] = res;
                let state = this.getState();
                const queue = [ selectedNode ];
                const topView = this.views[selectedNode];
                while (queue.length > 0) {
                    const current = queue.pop();
                    // delete this.views[current];
                    for (const subexp of this.semantics.subexpressions(state.getIn([ "nodes", current ]))) {
                        queue.push(subexp);
                    }
                }

                this.store.dispatch(action.smallStep(selectedNode, result, nodes));

                state = this.getState();
                for (const node of nodes) {
                    this.views[node.id] = this.semantics.project(this, state.getIn([ "nodes", node.id ]));
                }

                // Preserve position (TODO: better way)
                this.views[nodes[0].id].pos.x = topView.pos.x;
                this.views[nodes[0].id].pos.y = topView.pos.y;
            });
        }

        if (this._dragged && this._hoverNode) {
            const node = state.getIn([ "nodes", this._hoverNode ]);
            if (node.get("type") === "missing") {
                this.store.dispatch(action.fillHole(this._hoverNode, this._selectedNode));
            }
        }

        this._dragged = false;
        this._selectedNode = null;
    }
}
