import * as action from "./reducer/action";
import * as animate from "./gfx/animate";
import * as gfxCore from "./gfx/core";
import * as progression from "./game/progression";
import { nextId } from "./reducer/reducer";
import Loader from "./loader";
import Goal from "./ui/goal";
import Toolbox from "./ui/toolbox";

/**
 * Handle drawing responsibilites for Reduct.
 */
export class Stage {
    constructor(width, height, store, views, semantics) {
        this.store = store;
        this.views = views;
        // A set of views for the toolbox, etc. that aren't cleared
        // when changing levels.
        this.internalViews = {};
        this.semantics = semantics;

        this.effects = {};

        this.alreadyWon = false;

        this.width = width;
        this.height = height;

        this.canvas = document.createElement("canvas");
        // TODO: dynamic resizing
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
        this._fromToolbox = false;
        this._dragged = false;

        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);

        animate.addUpdateListener(() => {
            this.drawImpl();
        });
    }

    /**
     * Allocate an ID for the given projection.
     *
     * Used for projections that don't directly correspond to nodes
     * and are static (e.g. the text view for the arow in a lambda),
     * but still need an ID.
     */
    allocate(projection) {
        const id = nextId();
        this.views[id] = projection;
        return id;
    }

    allocateInternal(projection) {
        const id = nextId();
        this.internalViews[id] = projection;
        return id;
    }

    reset() {
        for (const key in this.views) delete this.views[key];
        delete this.goal;
        this.goal = new Goal(this);
        this.toolbox._firstRender = true;
        this.alreadyWon = false;
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
        projection.prepare(nodeId, state, this);
        projection.draw(nodeId, state, this, { x: 0, y: 0, sx: 1, sy: 1 });
    }

    drawImpl() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this._redrawPending = false;

        const state = this.getState();
        this.toolbox.drawBase(state);
        this.goal.drawImpl(state);

        for (const nodeId of state.get("board")) {
            this.drawProjection(state, nodeId);
        }
        this.toolbox.drawImpl(state);

        for (const fx of Object.values(this.effects)) {
            fx.draw();
        }
    }

    draw() {
        if (this._redrawPending) return;
        this._redrawPending = true;
        window.requestAnimationFrame(() => {
            this.drawImpl();
        });
    }

    /**
     * Get the node at the given position.
     *
     * TODO: return all possible nodes?
     */
    getNodeAtPos(pos) {
        const state = this.getState();
        let result = null;
        let root = null;
        let toolbox = false;

        for (const nodeId of state.get("board")) {
            if (nodeId == this._selectedNode) continue;

            let node = state.getIn([ "nodes", nodeId ]);
            const projection = this.views[nodeId];

            if (projection.containsPoint(pos)) {
                root = result = nodeId;

                let subexprFields = this.semantics.subexpressions(node);

                pos.x -= projection.pos.x - projection.anchor.x * projection.size.w * projection.scale.x;
                pos.y -= projection.pos.y - projection.anchor.y * projection.size.h * projection.scale.y;

                outerLoop:
                while (subexprFields.length > 0) {
                    for (const subexprField of subexprFields) {
                        const subexprId = node.get(subexprField);
                        if (this.views[subexprId].containsPoint(pos)) {
                            node = state.getIn([ "nodes", subexprId ]);
                            if (this.semantics.targetable(node)) {
                                result = subexprId;
                            }

                            subexprFields = this.semantics.subexpressions(node);
                            pos.x -= this.views[subexprId].pos.x;
                            pos.y -= this.views[subexprId].pos.y;
                            continue outerLoop;
                        }
                    }
                    subexprFields = [];
                }
            }
        }

        if (!result && !root) {
            [ result, root ] = this.toolbox.getNodeAtPos(state, pos);
            toolbox = true;
        }

        return [ root, result, toolbox ];
    }

    findHoverNode(pos) {
        const before = this._hoverNode;
        const [ root, target ] = this.getNodeAtPos(pos);
        this._hoverNode = target;
        if (target !== before) {
            this.store.dispatch(action.hover(this._hoverNode));
        }
    }

    _mousedown(e) {
        const state = this.getState();
        const pos = this.getMousePos(e);
        [ this._selectedNode, this._targetNode, this._fromToolbox ] = this.getNodeAtPos(pos);
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
                this.views[this._selectedNode].scale.x = 1;
                this.views[this._selectedNode].scale.y = 1;
            }
        }

        this.findHoverNode(this.getMousePos(e));
    }

    _mouseup(e) {
        const state = this.getState();

        if (!this._dragged && this._selectedNode !== null) {
            // Click on object to reduce
            let selectedNode = this._selectedNode;

            if (this._targetNode) {
                const targetLocked = state.getIn([ "nodes", this._targetNode, "locked" ]);
                if (!targetLocked) {
                    selectedNode = this._targetNode;
                }
            }

            this.step(state, selectedNode);
        }
        else if (this._dragged && this._hoverNode &&
                 state.getIn([ "nodes", this._hoverNode, "type"]) === "missing") {
            // Drag something into hole
            this.store.dispatch(action.fillHole(this._hoverNode, this._selectedNode));
        }
        else if (this._dragged && this._hoverNode && this._selectedNode) {
            // Apply to lambda
            const state = this.getState();
            const arg = this._selectedNode;
            const target = this._hoverNode;
            this.betaReduce(state, target, arg);
        }
        else if (this._dragged && this._fromToolbox) {
            // Take item out of toolbox
            this.store.dispatch(action.useToolbox(this._selectedNode));
        }
        else {
            // Bump items out of toolbox
            const projection = this.views[this._selectedNode];
            if (projection && this.toolbox.containsPoint({ x: 0, y: projection.pos.y + projection.size.h })) {
                animate.tween(projection.pos, { y: this.toolbox.pos.y - projection.size.h - 25 }, {
                    duration: 250,
                    easing: animate.Easing.Cubic.Out,
                });
            }
        }

        this._selectedNode = this._targetNode = null;
        this.findHoverNode(this.getMousePos(e));
        this._dragged = false;
        this.draw();
    }

    /**
     * Helper that handles animation and updating the store for a small-step.
     */
    step(state, selectedNode) {
        const nodes = state.get("nodes");
        const node = nodes.get(selectedNode);
        this.semantics.reduce(this, nodes, node, (topNodeId, newNodeIds, addedNodes) => {
            const topView = this.views[selectedNode];
            const origPos = gfxCore.absolutePos(topView);

            if (newNodeIds.length !== 1) {
                throw "Stepping to produce multiple expressions is currently unsupported.";
            }

            const state = this.getState();
            const tempNodes = state.get("nodes").withMutations(nodes => {
                for (const node of addedNodes) {
                    nodes.set(node.get("id"), node);
                }
            });
            for (const node of addedNodes) {
                console.log("projecting", node.get("id"));
                this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
            }

            // Preserve position (TODO: better way)
            this.views[newNodeIds[0]].pos.x = origPos.x;
            this.views[newNodeIds[0]].pos.y = origPos.y;

            this.store.dispatch(action.smallStep(selectedNode, newNodeIds, addedNodes));
            return this.getState();
        });
    }

    /**
     * Helper that handles animation and updating the store for a beta reduction.
     */
    betaReduce(state, target, arg) {
        const result = this.semantics.betaReduce(state.get("nodes"), target, [ arg ]);
        if (result) {
            const [ topNode, resultNodeIds, newNodes ] = result;
            const tempNodes = state.get("nodes").withMutations(nodes => {
                for (const node of newNodes) {
                    nodes.set(node.get("id"), node);
                }
            });

            for (const node of newNodes) {
                this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
            }

            // Preserve position (TODO: better way)
            const topNodeRecord = state.getIn([ "nodes", topNode ]);
            if (topNodeRecord.get("body") && this.views[topNodeRecord.get("body")]) {
                const body = topNodeRecord.get("body");
                const spacing = 10;
                let totalHeight = 0;
                for (const newNodeId of resultNodeIds) {
                    totalHeight += gfxCore.absoluteSize(this.views[newNodeId]).h + spacing;
                }
                totalHeight -= spacing;

                const ap = gfxCore.absolutePos(this.views[body]);
                const as = gfxCore.absoluteSize(this.views[body]);
                const x = ap.x;
                let y = ap.y + as.h - totalHeight / 2;
                for (const newNodeId of resultNodeIds) {
                    this.views[newNodeId].pos.x = x + as.w / 2;
                    this.views[newNodeId].pos.y = y;
                    this.views[newNodeId].anchor.x = 0.5;
                    this.views[newNodeId].anchor.y = 0.5;
                    animate.tween(this.views[newNodeId].pos, { y: y - 50 }, {
                        duration: 250,
                        easing: animate.Easing.Cubic.In,
                    });
                    y += gfxCore.absoluteSize(this.views[newNodeId]).h + spacing;
                    this.views[newNodeId].scale.x = 0.0;
                    this.views[newNodeId].scale.y = 0.0;
                    animate.tween(this.views[newNodeId].scale, { x: 1, y: 1 }, {
                        duration: 250,
                        easing: animate.Easing.Cubic.In,
                    });
                }
            }
            else {
                for (const newNodeId of resultNodeIds) {
                    this.views[newNodeId].pos.x = this.views[topNode].pos.x;
                    this.views[newNodeId].pos.y = this.views[topNode].pos.y;
                }
            }
            this.store.dispatch(action.betaReduce(topNode, arg, resultNodeIds, newNodes));
        }
    }

    animateVictory(_matching) {
        this.alreadyWon = true;
        const state = this.getState();
        const tweens = [];
        for (const nodeId of state.get("goal").concat(state.get("board"))) {
            tweens.push(animate.fx.blink(this.views[nodeId], {
                times: progression.currentLevelIdx === 0 ? 2 : 1,
                color: "#0FF",
            }));
        }

        return Promise.all(tweens).then(() => {
            const subtweens = [];
            for (const nodeId of state.get("goal").concat(state.get("board"))) {
                subtweens.push(animate.fx.splosion(this, gfxCore.centerPos(this.views[nodeId])));
            }
            this.store.dispatch(action.victory());
            return Promise.all(subtweens);
        });
    }

    addEffect(fx) {
        const id = nextId();
        this.effects[id] = fx;
        return id;
    }

    removeEffect(id) {
        delete this.effects[id];
    }
}
