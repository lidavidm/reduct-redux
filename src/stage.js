import * as action from "./reducer/action";
import * as animate from "./gfx/animate";
import Audio from "./resource/audio";
import * as gfxCore from "./gfx/core";
import * as progression from "./game/progression";
import { nextId } from "./reducer/reducer";
import Goal from "./ui/goal";
import Toolbox from "./ui/toolbox";

class TouchRecord {
    constructor(stage, topNode, targetNode, fromToolbox, dragOffset, dragStart) {
        this.stage = stage;
        this.topNode = topNode;
        this.targetNode = targetNode;
        this.fromToolbox = fromToolbox;
        this.dragOffset = dragOffset;
        this.dragStart = dragStart;
        this.dragged = false;
        this.hoverNode = null;
    }

    findHoverNode(pos) {
        const before = this.hoverNode;
        const [ _, target ] = this.stage.getNodeAtPos(pos, this.topNode);
        this.hoverNode = target;
        if (target !== before) {
            // TODO: get rid of this
            this.stage.store.dispatch(action.hover(this.hoverNode));
        }
    }

    onmove(mouseDown, mousePos) {
        if (mouseDown && this.topNode !== null) {
            // 5-pixel tolerance before a click becomes a drag
            if (!this.dragStart || gfxCore.distance(this.dragStart, mousePos) > 5) {
                this.dragStart = null;
                this.dragged = true;

                if (this.fromToolbox) {
                    const resultNode = this.stage.cloneToolboxItem(this.topNode);
                    if (resultNode !== null) {
                        // Selected node was an __unlimited node
                        this.topNode = resultNode;
                        this.targetNode = resultNode;
                        this.fromToolbox = false;
                    }
                }
            }

            const view = this.stage.views[this.targetNode];
            const absSize = gfxCore.absoluteSize(view);
            view.pos.x = (mousePos.x - this.dragOffset.dx) + (view.anchor.x * absSize.w);
            view.pos.y = (mousePos.y - this.dragOffset.dy) + (view.anchor.y * absSize.h);
        }

        // TODO: add tolerance here as well
        if (mouseDown && this.targetNode) {
            const newSelected = this.stage.detachFromHole(this.topNode, this.targetNode);
            if (newSelected !== null) {
                this.topNode = newSelected;
            }
        }

        this.findHoverNode(mousePos);
        if (this.topNode && this.hoverNode) {
            const state = this.stage.getState();
            const holeExprType = state.getIn([ "nodes", this.hoverNode, "type" ]);
            const holeType = state.getIn([ "nodes", this.hoverNode, "ty" ]);
            const exprType = state.getIn([ "nodes", this.topNode, "ty" ]);
            // TODO: don't hardcode these checks
            if ((holeExprType !== "missing" &&
                 holeExprType !== "lambdaArg") ||
                (holeType && exprType && holeType !== exprType)) {
                this.hoverNode = null;
            }
        }

        // Highlight nearby compatible notches, if applicable
        this.stage.highlightNotches(this.topNode);
    }

    onend(state, mousePos) {
        if (!this.dragged && this.topNode !== null && !this.fromToolbox) {
            // Click on object to reduce
            let selectedNode = this.topNode;

            if (this.targetNode) {
                const targetLocked = state.getIn([ "nodes", this.targetNode, "locked" ]);
                if (!targetLocked) {
                    selectedNode = this.targetNode;
                }
            }

            this.stage.step(state, selectedNode);
        }
        else if (this.dragged && this.hoverNode &&
                 state.getIn([ "nodes", this.hoverNode, "type"]) === "missing") {
            // Drag something into hole
            // Use type inference to decide whether hole can be filled
            const holeType = state.getIn([ "nodes", this.hoverNode, "ty" ]);
            const exprType = state.getIn([ "nodes", this.topNode, "ty" ]);
            if (!holeType || !exprType || holeType === exprType) {
                Audio.play("pop");

                this.stage.store.dispatch(action.fillHole(this.hoverNode, this.topNode));
            }
        }
        else if (this.dragged && this.hoverNode && this.topNode) {
            // Apply to lambda
            const arg = this.topNode;
            const target = this.hoverNode;
            this.stage.betaReduce(state, target, arg);
        }
        else if (this.dragged && this.fromToolbox) {
            // Take item out of toolbox
            this.stage.store.dispatch(action.useToolbox(this.topNode));
        }

        // Bump items out of toolbox
        if (this.topNode !== null) {
            this.stage.bumpAwayFromEdges(this.topNode);
        }

        this.stage.snapNotches(this.topNode);

        this.findHoverNode(mousePos);
    }

    reset() {
        this.topNode = null;
        this.hoverNode = null;
        this.targetNode = null;
        this.dragged = false;
        this.fromToolbox = false;
    }
}

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

        this.canvas.addEventListener("touchstart", (e) => this._touchstart(e));
        this.canvas.addEventListener("touchmove", (e) => this._touchmove(e));
        this.canvas.addEventListener("touchend", (e) => this._touchend(e));

        this._touches = new Map();

        this._touches.set("mouse", new TouchRecord(
            this,
            null,
            null,
            false,
            { dx: 0, dy: 0 },
            { x: 0, y: 0 }
        ));

        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);

        animate.addUpdateListener(() => {
            this.drawImpl();
        });

        this._currentlyReducing = {};
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

    /**
     * Given a rectangular area, move it minimally to fit within the
     * stage bounds.
     */
    findSafePosition(x, y, w, h) {
        const MARGIN = 20;
        const minX = MARGIN;
        const maxX = this.width - MARGIN - w;
        const minY = MARGIN;
        const maxY = this.height - this.toolbox.size.h - 20 - h;

        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));

        return { x, y };
    }

    getState() {
        return this.store.getState().getIn([ "program", "$present" ]);
    }

    drawProjection(state, nodeId) {
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
    getNodeAtPos(pos, selectedId=null) {
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
            if (nodeId === selectedId) continue;

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

    /**
     * Helper that clones an item from the toolbox.
     */
    cloneToolboxItem(selectedNode) {
        const state = this.getState();
        const selected = state.getIn([ "nodes", selectedNode ]);
        // TODO: fix this check/use Record
        if (selected.has("__meta") && selected.get("__meta").toolbox.unlimited) {
            // If node has __meta indicating infinite uses,
            // clone instead.
            const [ clonedNode, addedNodes ] = this.semantics.clone(
                selectedNode,
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
            this.views[clonedNode.get("id")].pos.x = this.views[selectedNode].pos.x;
            this.views[clonedNode.get("id")].pos.y = this.views[selectedNode].pos.y;

            Audio.play("place_from_toolbox");

            this.store.dispatch(action.useToolbox(
                selectedNode,
                clonedNode.get("id"),
                addedNodes.concat([ clonedNode ])
            ));
            return clonedNode.get("id");
        }
        return null;
    }

    /**
     * Helper that detaches an item from its parent.
     */
    detachFromHole(selectedNode, targetNode) {
        const target = this.getState().getIn([ "nodes", targetNode ]);
        if (!target.get("locked") && target.get("parent") && target.get("type") !== "missing") {
            const pos = gfxCore.absolutePos(this.views[targetNode]);
            this.store.dispatch(action.detach(targetNode));
            this.views[targetNode].pos = pos;
            this.views[targetNode].scale.x = 1;
            this.views[targetNode].scale.y = 1;
            return targetNode;
        }
        return null;
    }

    /**
     * Bump items away from toolbox/edges
     */
    bumpAwayFromEdges(id) {
        const currentView = this.views[id];
        // Make sure result stays on screen
        const pos = gfxCore.absolutePos(currentView);
        const sz = gfxCore.absoluteSize(currentView);
        const { x: safeX, y: safeY } = this.findSafePosition(
            pos.x,
            pos.y,
            sz.w,
            sz.h
        );
        animate.tween(currentView.pos, {
            x: safeX + (currentView.anchor.x * sz.w),
            y: safeY + (currentView.anchor.y * sz.h),
        }, {
            duration: 250,
            easing: animate.Easing.Cubic.Out,
        });
    }

    /**
     * Helper to highlight applicable notches near a given expression.
     */
    highlightNotches(id) {
        const state = this.getState();
        const nodes = state.get("nodes");
        const selected = nodes.get(id);
        if (selected && this.semantics.hasNotches(selected)) {
            for (const nodeId of state.get("board")) {
                const node = nodes.get(nodeId);
                const compatible = this.semantics.notchesCompatible(selected, node);
                if (compatible && compatible.length > 0) {
                    for (const [ selNotchIdx, nodeNotchIdx ] of compatible) {
                        const distance = gfxCore.distance(
                            this.views[nodeId].notchPos(nodeId, nodeId, nodeNotchIdx),
                            this.views[id].notchPos(id, id, selNotchIdx)
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

    /**
     * Helper to combine notches where needed.
     */
    snapNotches(selectedNode) {
        const state = this.getState();

        const board = state.get("board");
        const nodes = state.get("nodes");

        for (const nodeId of board) {
            if (this.views[nodeId].highlighted) {
                this.views[nodeId].highlighted = false;
            }
        }

        const selected = nodes.get(selectedNode);
        if (selected && this.semantics.hasNotches(selected)) {
            let leastDistance = 9999;
            let closestNotch = null;

            for (const nodeId of state.get("board")) {
                if (nodeId === selectedNode) continue;

                const node = nodes.get(nodeId);
                const compatible = this.semantics.notchesCompatible(selected, node);
                // TODO: actually check distance to notch
                if (compatible && compatible.length > 0) {
                    for (const [ selNotchIdx, nodeNotchIdx ] of compatible) {
                        const distance = gfxCore.distance(
                            this.views[nodeId].notchPos(nodeId, nodeId, nodeNotchIdx),
                            this.views[selectedNode].notchPos(selectedNode, selectedNode, selNotchIdx)
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
                    selectedNode,
                    notchPair[0]
                )) {
                    this.views[parent].highlighted = false;
                    animate.fx.blink(this, this.views[parent], {
                        times: 2,
                        color: "magenta",
                        speed: 100,
                        lineWidth: 5,
                    });
                    animate.fx.blink(this, this.views[selectedNode], {
                        times: 2,
                        color: "magenta",
                        speed: 100,
                        lineWidth: 5,
                    });
                    this.store.dispatch(action.attachNotch(parent, 0, selectedNode, 0));
                }
            }
        }
    }

    /**
     * Helper that handles animation and updating the store for a small-step.
     */
    step(state, selectedNode) {
        const nodes = state.get("nodes");
        const node = nodes.get(selectedNode);

        if (this._currentlyReducing[selectedNode]) {
            return;
        }

        this._currentlyReducing[selectedNode] = true;

        const reducing = [];
        let time = 0;
        const reductionAnimation = animate.infinite((dt) => {
            time += dt;
            for (const id of reducing) {
                this.views[id].stroke = {
                    color: "lightblue",
                    lineWidth: 5,
                    lineDash: [5, 10],
                    lineDashOffset: time,
                };
            }
        });

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
                    // Make sure result stays on screen
                    this.bumpAwayFromEdges(topViewId);
                }

                const updatedNodes = this.getState().get("nodes");
                for (const id of newNodeIds) {
                    let n = updatedNodes.get(id);
                    while (n.has("parent")) {
                        n = updatedNodes.get(n.get("parent"));
                    }
                    reducing.push(n.get("id"));
                    this._currentlyReducing[n.get("id")] = true;
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
        }).then(() => {
            reductionAnimation.stop();
            delete this._currentlyReducing[selectedNode];
            for (const id of reducing) {
                delete this._currentlyReducing[id];
            }
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
                let maxWidth = 50;
                for (const newNodeId of resultNodeIds) {
                    this.views[newNodeId].prepare(newNodeId, newNodeId, state.set("nodes", tempNodes), this);
                    const sz = gfxCore.absoluteSize(this.views[newNodeId]);
                    totalHeight += sz.h + spacing;
                    maxWidth = Math.max(sz.w, maxWidth);
                }
                totalHeight -= spacing;

                const ap = gfxCore.absolutePos(this.views[body]);
                const as = gfxCore.absoluteSize(this.views[body]);
                let y = (ap.y + (as.h / 2)) - (totalHeight / 2);

                const { x: safeX, y: safeY } = this.findSafePosition(
                    (ap.x + (as.w / 2)) - (maxWidth / 2),
                    y,
                    maxWidth,
                    totalHeight
                );

                y = safeY + 25;

                for (const newNodeId of resultNodeIds) {
                    const sz = gfxCore.absoluteSize(this.views[newNodeId]);
                    this.views[newNodeId].pos.x = safeX + (maxWidth / 2);
                    this.views[newNodeId].pos.y = y + (sz.h / 2);
                    this.views[newNodeId].anchor.x = 0.5;
                    this.views[newNodeId].anchor.y = 0.5;
                    animate.tween(this.views[newNodeId].pos, {
                        y: this.views[newNodeId].pos.y - 25,
                    }, {
                        duration: 250,
                        easing: animate.Easing.Cubic.In,
                    });
                    y += sz.h + spacing;
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

    isSelected(id) {
        for (const touch of this._touches.values()) {
            if (touch.targetNode === id) {
                return true;
            }
        }
        return false;
    }

    isHovered(id) {
        for (const touch of this._touches.values()) {
            if (touch.hoverNode === id) {
                return true;
            }
        }
        return false;
    }

    _touchstart(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const pos = this.getMousePos(touch);
            const [ topNode, targetNode, fromToolbox ] = this.getNodeAtPos(pos);
            if (topNode === null) continue;

            this.store.dispatch(action.raise(topNode));
            const dragOffset = { dx: 0, dy: 0 };
            if (targetNode !== null) {
                const absPos = gfxCore.absolutePos(this.views[targetNode]);
                dragOffset.dx = pos.x - absPos.x;
                dragOffset.dy = pos.y - absPos.y;
            }

            this._touches.set(touch.identifier, new TouchRecord(
                this,
                topNode,
                targetNode,
                fromToolbox,
                dragOffset,
                pos
            ));
        }
    }

    _touchmove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (this._touches.has(touch.identifier)) {
                this._touches.get(touch.identifier).onmove(true, this.getMousePos(touch));
            }
        }
        this.draw();
    }

    _touchend(e) {
        e.preventDefault();
        const state = this.getState();
        for (const touch of e.changedTouches) {
            if (this._touches.has(touch.identifier)) {
                this._touches.get(touch.identifier).onend(state, this.getMousePos(touch));
                this._touches.delete(touch.identifier);
            }
        }
        this.draw();
    }

    _mousedown(e) {
        const pos = this.getMousePos(e);
        const [ topNode, targetNode, fromToolbox ] = this.getNodeAtPos(pos);
        if (topNode === null) return;

        this.store.dispatch(action.raise(topNode));
        const dragOffset = { dx: 0, dy: 0 };
        if (targetNode !== null) {
            const absPos = gfxCore.absolutePos(this.views[targetNode]);
            dragOffset.dx = pos.x - absPos.x;
            dragOffset.dy = pos.y - absPos.y;
        }

        const touch = this._touches.get("mouse");
        touch.topNode = topNode;
        touch.targetNode = targetNode;
        touch.fromToolbox = fromToolbox;
        touch.dragOffset = dragOffset;
        touch.dragStart = pos;

        this.draw();
    }

    _mousemove(e) {
        const buttons = typeof e.buttons !== "undefined" ? e.buttons : e.which;
        this._touches.get("mouse").onmove(buttons > 0, this.getMousePos(e));
        this.draw();
    }

    _mouseup(e) {
        const mouse = this._touches.get("mouse");
        mouse.onend(this.getState(), this.getMousePos(e));
        mouse.reset();
        this.draw();
    }
}
