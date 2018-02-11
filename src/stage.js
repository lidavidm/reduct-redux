import * as action from "./reducer/action";
import * as animate from "./gfx/animate";
import Audio from "./resource/audio";
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
        this._dragOffset = { dx: 0, dy: 0 };
        this._dragStart = { x: 0, y: 0 };
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
        this.toolbox.reset();
        this.alreadyWon = false;
    }

    startLevel() {
        this.toolbox.startLevel(this.getState());
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
        projection.prepare(nodeId, nodeId, state, this);
        projection.draw(nodeId, nodeId, state, this, { x: 0, y: 0, sx: 1, sy: 1 });
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
        const check = (curPos, curProjId, curExprId, curRoot, curOffset) => {
            const curNode = state.getIn([ "nodes", curExprId ]);
            const projection = this.views[curProjId];
            let res = null;

            const topLeft = gfxCore.util.topLeftPos(projection, curOffset);
            if (projection.containsPoint(curPos, curOffset)) {
                if (curRoot === null) {
                    curRoot = curExprId;
                    res = curExprId;
                }
                else if (curNode && this.semantics.targetable(state, curNode)) {
                    res = curExprId;
                }

                const subpos = {
                    x: curPos.x - topLeft.x,
                    y: curPos.y - topLeft.y,
                };
                for (const [ childId, subexprId ] of projection.children(curExprId, state)) {
                    const subresult = check(
                        subpos,
                        childId,
                        subexprId,
                        curRoot,
                        {
                            x: 0,
                            y: 0,
                            sx: curOffset.sx * projection.scale.x,
                            sy: curOffset.sy * projection.scale.y,
                        }
                    );
                    if (subresult) {
                        return subresult;
                    }
                }
                if (res) {
                    return [ curRoot, res ];
                }
            }
            return null;
        };

        let result = null;
        let root = null;
        let toolbox = false;

        for (const nodeId of state.get("board").toArray().reverse()) {
            if (nodeId === this._selectedNode) continue;

            const res = check(pos, nodeId, nodeId, null, {
                x: 0,
                y: 0,
                sx: 1,
                sy: 1,
            });
            if (res) {
                [ root, result ] = res;
                break;
            }
        }

        if (!result && !root) {
            [ result, root ] = this.toolbox.getNodeAtPos(state, pos);
            if (result) toolbox = true;
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
        const pos = this.getMousePos(e);
        [ this._selectedNode, this._targetNode, this._fromToolbox ] = this.getNodeAtPos(pos);
        this._dragOffset.dx = 0;
        this._dragOffset.dy = 0;
        this._dragStart = pos;
        if (this._selectedNode !== null) {
            this.store.dispatch(action.raise(this._selectedNode));
            const absPos = gfxCore.absolutePos(this.views[this._selectedNode]);
            this._dragOffset.dx = pos.x - absPos.x;
            this._dragOffset.dy = pos.y - absPos.y;
        }
    }

    _mousemove(e) {
        const mousePos = this.getMousePos(e);
        if (e.buttons > 0 && this._selectedNode !== null) {
            if (this._fromToolbox) {
                const state = this.getState();
                const selected = state.getIn([ "nodes", this._selectedNode ]);
                // TODO: fix this check/use Record
                if (selected.has("__meta") && selected.get("__meta").toolbox.unlimited) {
                    // If node has __meta indicating infinite uses,
                    // clone instead.
                    const [ clonedNode, addedNodes ] = this.semantics.clone(
                        this._selectedNode,
                        state.get("nodes")
                    );

                    // TODO: make clone include result in addedNodes
                    const tempNodes = state.get("nodes").withMutations((nodes) => {
                        for (const node of addedNodes) {
                            nodes.set(node.get("id"), node);
                        }
                        nodes.set(clonedNode.get("id"), clonedNode);
                    });
                    for (const node of addedNodes.concat([ clonedNode ])) {
                        this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                    }
                    this.views[clonedNode.get("id")].pos.x = this.views[this._selectedNode].pos.x;
                    this.views[clonedNode.get("id")].pos.y = this.views[this._selectedNode].pos.y;

                    Audio.play("place_from_toolbox");

                    this.store.dispatch(action.useToolbox(
                        this._selectedNode,
                        clonedNode.get("id"),
                        addedNodes.concat([ clonedNode ])
                    ));
                    this._selectedNode = clonedNode.get("id");
                    this._targetNode = null;
                    this._fromToolbox = false;
                }
            }

            const view = this.views[this._selectedNode];
            const absSize = gfxCore.absoluteSize(view);
            view.pos.x = (mousePos.x - this._dragOffset.dx) + (view.anchor.x * absSize.w);
            view.pos.y = (mousePos.y - this._dragOffset.dy) + (view.anchor.y * absSize.h);
            this.draw();

            // 5-pixel tolerance before a click becomes a drag
            if (!this._dragStart || gfxCore.distance(this._dragStart, mousePos) > 5) {
                this._dragStart = null;
                this._dragged = true;
            }
        }

        if (e.buttons > 0 && this._targetNode) {
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
        if (this._selectedNode && this._hoverNode) {
            const state = this.getState();
            const holeExprType = state.getIn([ "nodes", this._hoverNode, "type" ]);
            const holeType = state.getIn([ "nodes", this._hoverNode, "ty" ]);
            const exprType = state.getIn([ "nodes", this._selectedNode, "ty" ]);
            // TODO: don't hardcode these checks
            if ((holeExprType !== "missing" &&
                 holeExprType !== "lambdaArg") ||
                (holeType && exprType && holeType !== exprType)) {
                this._hoverNode = null;
            }
        }

        if (this._selectedNode) {
            // Highlight nearby compatible notches, if applicable
            const state = this.getState();
            const nodes = state.get("nodes");
            const selected = nodes.get(this._selectedNode);
            if (this.semantics.hasNotches(selected)) {
                for (const nodeId of state.get("board")) {
                    const node = nodes.get(nodeId);
                    const compatible = this.semantics.notchesCompatible(selected, node);
                    if (compatible && compatible.length > 0) {
                        for (const [ selNotchIdx, nodeNotchIdx ] of compatible) {
                            const distance = gfxCore.distance(
                                this.views[nodeId].notchPos(
                                    nodeId,
                                    nodeId,
                                    nodeNotchIdx
                                ),
                                this.views[this._selectedNode].notchPos(
                                    this._selectedNode,
                                    this._selectedNode,
                                    selNotchIdx
                                )
                            );
                            if (distance < 50) {
                                this.views[nodeId].highlighted = true;
                            }
                            else {
                                this.views[nodeId].highlighted = false;
                            }
                        }
                    }
                }
            }
        }
    }

    _mouseup(e) {
        const state = this.getState();

        if (!this._dragged && this._selectedNode !== null && !this._fromToolbox) {
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
            // Use type inference to decide whether hole can be filled
            const holeType = state.getIn([ "nodes", this._hoverNode, "ty" ]);
            const exprType = state.getIn([ "nodes", this._selectedNode, "ty" ]);
            if (!holeType || !exprType || holeType === exprType) {
                Audio.play("pop");

                this.store.dispatch(action.fillHole(this._hoverNode, this._selectedNode));
            }
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

        // Bump items out of toolbox
        const projection = this.views[this._selectedNode];

        if (projection) {
            const topLeft = gfxCore.util.topLeftPos(projection, { x: 0, y: 0, sx: 1, sy: 1 });
            const bottom = { x: 0, y: topLeft.y + projection.size.h };
            if (this.toolbox.containsPoint(bottom)) {
                const targetY = this.toolbox.pos.y -
                      (projection.size.h * (1 - projection.anchor.y)) - 25;
                animate.tween(projection.pos, { y: targetY }, {
                    duration: 250,
                    easing: animate.Easing.Cubic.Out,
                });
            }
        }

        const board = this.getState().get("board");
        for (const nodeId of board) {
            if (this.views[nodeId].highlighted) {
                this.views[nodeId].highlighted = false;
            }
        }
        const nodes = this.getState().get("nodes");
        const selected = nodes.get(this._selectedNode);
        if (selected && this.semantics.hasNotches(selected)) {
            let leastDistance = 9999;
            let closestNotch = null;

            for (const nodeId of state.get("board")) {
                if (nodeId === this._selectedNode) continue;

                const node = nodes.get(nodeId);
                const compatible = this.semantics.notchesCompatible(selected, node);
                // TODO: actually check distance to notch
                if (compatible && compatible.length > 0) {
                    for (const [ selNotchIdx, nodeNotchIdx ] of compatible) {
                        const distance = gfxCore.distance(
                            this.views[nodeId].notchPos(
                                nodeId,
                                nodeId,
                                nodeNotchIdx
                            ),
                            this.views[this._selectedNode].notchPos(
                                this._selectedNode,
                                this._selectedNode,
                                selNotchIdx
                            )
                        );
                        if (distance < 50) {
                            this.views[nodeId].highlighted = true;
                        }
                        else {
                            this.views[nodeId].highlighted = false;
                        }

                        if (distance < leastDistance) {
                            leastDistance = distance;
                            closestNotch = [ nodeId, compatible ];
                        }
                    }
                }
            }

            if (leastDistance <= 150 && closestNotch !== null) {
                // TODO: actually check the matched notches
                const [ parent, notchPair ] = closestNotch;
                if (this.semantics.notchesAttachable(
                    this,
                    this.getState(),
                    parent,
                    this._selectedNode,
                    notchPair[0]
                )) {
                    this.views[parent].highlighted = false;
                    animate.fx.blink(this, this.views[parent], {
                        times: 2,
                        color: "magenta",
                        speed: 100,
                        lineWidth: 5,
                    });
                    animate.fx.blink(this, this.views[this._selectedNode], {
                        times: 2,
                        color: "magenta",
                        speed: 100,
                        lineWidth: 5,
                    });
                    this.store.dispatch(action.attachNotch(parent, 0, this._selectedNode, 0));
                }
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
        this.semantics.interpreter.reduce(this, state, node, {
            update: (topNodeId, newNodeIds, addedNodes, recordUndo) => {
                const topView = this.views[topNodeId];
                const origPos = gfxCore.centerPos(topView);

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
                    this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                }

                // Preserve position
                this.views[newNodeIds[0]].anchor.x = 0.5;
                this.views[newNodeIds[0]].anchor.y = 0.5;
                this.views[newNodeIds[0]].pos.x = origPos.x;
                this.views[newNodeIds[0]].pos.y = origPos.y;

                let act = action.smallStep(topNodeId, newNodeIds, addedNodes);
                if (!recordUndo) {
                    act = action.skipUndo(act);
                }
                this.store.dispatch(act);

                for (const topViewId of this.getState().get("board")) {
                    const currentView = this.views[topViewId];
                    // Make sure result stays on screen horizontally
                    // TODO: don't hardcode margin?
                    const sz = gfxCore.absoluteSize(currentView);
                    currentView.pos.x = Math.min(
                        currentView.pos.x,
                        this.width - 20 - (sz.w * (1 - currentView.anchor.x))
                    );
                    currentView.pos.x = Math.max(
                        currentView.pos.x,
                        20 + (sz.w * currentView.anchor.x)
                    );
                }

                return Promise.resolve(this.getState());
            },
            error: (errorNodeId) => {
                animate.fx.blink(this, this.views[errorNodeId], {
                    times: 3,
                    color: "#F00",
                    speed: 150,
                });
            },
        });
    }

    /**
     * Helper that handles animation and updating the store for a beta reduction.
     */
    betaReduce(state, target, arg) {
        const result = this.semantics.interpreter.betaReduce(this, state, target, [ arg ]);
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

            Audio.play("pop");

            this.store.dispatch(action.betaReduce(topNode, arg, resultNodeIds, newNodes));
        }
    }

    animateVictory(_matching) {
        this.alreadyWon = true;
        const state = this.getState();
        const tweens = [];
        for (const nodeId of state.get("goal").concat(state.get("board"))) {
            if (this.semantics.ignoreForVictory(state.getIn([ "nodes", nodeId ]))) {
                continue;
            }

            tweens.push(animate.fx.blink(this, this.views[nodeId], {
                times: progression.currentLevel() === 0 ? 2 : 1,
                color: "#0FF",
            }));
        }

        Audio.play("matching-the-goal2");

        return Promise.all(tweens).then(() => {
            const subtweens = [];
            for (const nodeId of state.get("goal").concat(state.get("board"))) {
                subtweens.push(animate.fx.splosion(this, gfxCore.centerPos(this.views[nodeId])));
            }
            this.store.dispatch(action.victory());
            Audio.play("firework1");
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
