import * as action from "./reducer/action";
import * as animate from "./gfx/animate";
import * as gfxCore from "./gfx/core";
import { nextId } from "./reducer/reducer";
import Loader from "./loader";
import Goal from "./ui/goal";
import Toolbox from "./ui/toolbox";

export class Stage {
    constructor(width, height, store, views, semantics) {
        this.store = store;
        this.views = views;
        this.semantics = semantics;

        this.width = width;
        this.height = height;

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

        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);

        animate.addUpdateListener(() => {
            this.drawImpl();
        });
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

    drawProjection(state, nodeId) {
        const node = state.get("nodes").get(nodeId);
        const projection = this.views[nodeId];
        // TODO: autoresizing
        projection.parent = null;
        projection.scale.x = projection.scale.y = 1;
        projection.prepare(nodeId, state, this);
        projection.draw(nodeId, state, this, { x: 0, y: 0, sx: 1, sy: 1 });
    }

    drawImpl() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._redrawPending = false;

        const state = this.getState();
        this.toolbox.drawImpl(state);
        this.goal.drawImpl(state);

        for (const nodeId of state.get("board")) {
            this.drawProjection(state, nodeId);
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
        let toolbox = false;

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
                            if (!node.get("locked")) {
                                result = subexprId;
                            }

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

        if (!result && !root) {
            [ result, root ] = this.toolbox.getNodeAtPos(state, pos);
            toolbox = true;
        }

        return [ root, result, toolbox ];
    }

    _mousedown(e) {
        const state = this.getState();
        const pos = this.getMousePos(e);
        [ this._selectedNode, this._targetNode ] = this.getNodeAtPos(pos);
        if (this._selectedNode !== null) {
            this.store.dispatch(action.raise(this._selectedNode));
        }
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
            if (!target.get("locked") && target.get("parent") && target.get("type") !== "missing") {
                // Detach
                const pos = gfxCore.absolutePos(this.views[this._targetNode]);
                this.store.dispatch(action.detach(this._targetNode));
                this._selectedNode = this._targetNode;
                this.views[this._selectedNode].pos = pos;
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

        if (!this._dragged && this._selectedNode !== null) {
            let selectedNode = this._selectedNode;

            if (this._targetNode) {
                const targetLocked = state.getIn([ "nodes", this._targetNode, "locked" ]);
                if (!targetLocked) {
                    selectedNode = this._targetNode;
                }
            }

            const nodes = state.get("nodes");
            const node = nodes.get(selectedNode);
            this.semantics.reduce(nodes, node).then((res) => {
                // TODO: have semantics tell us which root node changed
                if (!res) return;

                const topView = this.views[selectedNode];
                topView.opacity = 1.0;
                animate.tween(topView, { opacity: 0 }).then(() => {
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
            });
        }
        else if (this._dragged && this._hoverNode) {
            const node = state.getIn([ "nodes", this._hoverNode ]);
            if (node.get("type") === "missing") {
                this.store.dispatch(action.fillHole(this._hoverNode, this._selectedNode));
            }
        }
        else {
            const projection = this.views[this._selectedNode];
            if (projection && this.toolbox.containsPoint({ x: 0, y: projection.pos.y + projection.size.h })) {
                animate.tween(projection.pos, { y: this.toolbox.pos.y - projection.size.h - 25 });
            }
        }

        this._dragged = false;
        this._selectedNode = null;
    }
}
