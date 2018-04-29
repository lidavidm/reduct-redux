import * as chroma from "chroma-js";
import * as immutable from "immutable";

import * as action from "../reducer/action";
import * as level from "../game/level";
import * as animate from "../gfx/animate";
import Audio from "../resource/audio";
import * as gfxCore from "../gfx/core";
import * as progression from "../game/progression";

import Feedback from "../ui/feedback";
import Goal from "../ui/goal";
import Navbar from "../ui/navbar";
import Toolbox from "../ui/toolbox";
import ReductToolbar from "../ui/reductToolbar";
import Sidebar from "../ui/sidebar";
import StuckEffect from "../ui/stuck";
import SyntaxJournal from "../ui/syntaxjournal";
import FunctionDef from "../ui/functiondef";

import Loader from "../loader";
import Logging from "../logging/logging";
import Network from "../logging/network";

import BaseStage from "./basestage";
import StageTouchRecord from "./stagetouchrecord";

const DOUBLE_CLICK_THRESHOLD_MS = 250;

class DoubleClickLayer {
    constructor(mousedown, mousemove, mouseup, doubleclick) {
        this._mousedownInner = mousedown;
        this._mousemoveInner = mousemove;
        this._mouseupInner = mouseup;
        this._doubleclickInner = doubleclick;

        // Keep track of click times for double-click.
        this.clickTimer = null;
        this.clickStartTime = null;
        this.clickState = "reset";
        this.clickPos = null;
    }

    _resetmouse() {
        if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
        this.clickState = "reset";
        this.clickStartTime = null;
        this.clickTimer = null;
        this.clickPos = null;
    }

    onmousedown(e) {
        if (this.clickState === "reset") {
            this.clickState = "down";
            this.clickStartTime = Date.now();
            this.clickPos = e;
            this.clickTimer = window.setTimeout(() => {
                this._mousedownInner(e);
                this._resetmouse();
            }, DOUBLE_CLICK_THRESHOLD_MS);
        }
        else if (this.clickState === "up") {
            if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
            this.clickState = "down2";
            const cp = this.clickPos;
            this.clickPos = e;

            this.clickTimer = window.setTimeout(() => {
                this._mousedownInner(cp);
                this._mouseupInner(cp);
                this._mousedownInner(e);
                this._resetmouse();
            }, DOUBLE_CLICK_THRESHOLD_MS - (Date.now() - this.clickStartTime));
        }
    }

    onmousemove(e) {
        if (this.clickState !== "reset") {
            this._mousedownInner(this.clickPos);
            if (this.clickState === "up" || this.clickState === "down2") {
                this._mouseupInner(this.clickPos);
            }

            if (this.clickState === "down2") {
                this._mousedownInner(this.clickPos);
            }

            this._mousemoveInner(e);
            this._resetmouse();
            this.clickState = "reset";
        }
        else {
            this._mousemoveInner(e);
        }
    }

    onmouseup(e) {
        if (this.clickState === "down") {
            if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
            this.clickState = "up";
            this.clickTimer = window.setTimeout(() => {
                this._mousedownInner(this.clickPos);
                this._mouseupInner(e);
                this._resetmouse();
            }, Math.max(0, DOUBLE_CLICK_THRESHOLD_MS - (Date.now() - this.clickStartTime)));
        }
        else if (this.clickState === "down2") {
            this._doubleclickInner(e);
            if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
            this._resetmouse();
        }
        else {
            this._mouseupInner(e);
            this._resetmouse();
        }
    }
}

/**
 * Handle drawing responsibilites for Reduct.
 */
export default class Stage extends BaseStage {
    constructor(canvas, width, height, store, views, semantics) {
        super(canvas, width, height, store, views, semantics);

        document.querySelector("#current-level").style.display = "block";
        document.querySelector("#chapter").style.display = "block";

        this.sidebarWidth = 0;

        this.stateGraph = new Network();
        this.alreadyWon = false;

        this.timer = null;
        this.color = "#EEEEEE";

        this.feedback = new Feedback(this);
        this.navbar = new Navbar(this);
        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);
        this.sidebar = new Sidebar(this);
        this.syntaxJournal = new SyntaxJournal(this);
        this.reductToolbar = new ReductToolbar(this);
        // TODO: this only allows one function definition be shown at
        // a time - this will break with multitouch
        this.functionDef = null;

        this._currentlyReducing = {};
        this._newSyntax = [];

        // Track of which function names are newly defined so that we
        // big-step it during reduction.
        this.newDefinedNames = [];
        // Keep track of the reduction mode.
        this.mode = "over";

        this.clickWrapper = new DoubleClickLayer(
            this._mousedownInner.bind(this),
            this._mousemoveInner.bind(this),
            this._mouseupInner.bind(this),
            this._doubleclickInner.bind(this)
        );
    }

    get touchRecordClass() {
        return StageTouchRecord;
    }

    get width() {
        return this._width - this.sidebarWidth;
    }

    testNodeAtPos(state, curPos, curProjId, curExprId, curRoot, curOffset, targetable) {
        const projection = this.getView(curProjId);
        let res = null;

        const topLeft = gfxCore.util.topLeftPos(projection, curOffset);
        if (projection.containsPoint(curPos, curOffset)) {
            if (curRoot === null) {
                curRoot = curExprId;
                res = curExprId;
            }
            else if (targetable(curProjId, curExprId)) {
                res = curExprId;
            }

            const subpos = {
                x: curPos.x - topLeft.x,
                y: curPos.y - topLeft.y,
            };
            for (const [ childId, subexprId ] of projection.children(curExprId, state)) {
                const subresult = this.testNodeAtPos(
                    state,
                    subpos,
                    childId,
                    subexprId,
                    curRoot,
                    {
                        x: 0,
                        y: 0,
                        sx: curOffset.sx * projection.scale.x,
                        sy: curOffset.sy * projection.scale.y,
                    },
                    targetable
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
    }

    testExprAtPos(state, curPos, curProjId, curExprId, curRoot, curOffset) {
        const curNode = state.getIn([ "nodes", curExprId ]);
        const projection = this.getView(curProjId);
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

            // UGH, forgot why this is here
            if (curRoot === curExprId && curNode &&
                !this.semantics.targetable(state, curNode)) {
                return null;
            }

            const subpos = {
                x: curPos.x - topLeft.x,
                y: curPos.y - topLeft.y,
            };
            for (const [ childId, subexprId ] of projection.children(curExprId, state)) {
                const subresult = this.testExprAtPos(
                    state,
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
    }

    getNodeAtPos(pos, selectedId=null) {
        if (this.alreadyWon) {
            // If already won or stuck, only allow interaction with navbar
            [ result, root ] = this.navbar.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }
            return [ null, null, false ];
        }

        if (this.syntaxJournal.isOpen) {
            const [ result, root ] = this.syntaxJournal.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }

            return [ null, null, false ];
        }

        const state = this.getState();

        let result = null;
        let root = null;

        for (const nodeId of state.get("board").toArray().reverse()) {
            if (nodeId === selectedId) continue;

            const res = this.testExprAtPos(state, pos, nodeId, nodeId, null, this.makeBaseOffset());
            if (res) {
                [ root, result ] = res;
                break;
            }
        }

        if (!result && !root) {
            [ result, root ] = this.toolbox.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }
            [ result, root ] = this.syntaxJournal.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }
            [ result, root ] = this.navbar.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }
        }
        return [ root, result, false ];
    }

    getReferenceNameAtPos(pos) {
        const state = this.getState();
        const check = (curPos, curProjId, curExprId, curRoot, curOffset) => {
            const curNode = state.getIn([ "nodes", curExprId ]);
            const projection = this.views[curProjId];
            let res = null;

            const topLeft = gfxCore.util.topLeftPos(projection, curOffset);
            if (projection.containsPoint(curPos, curOffset)) {
                if (curNode && curNode.get("type") == "reference") {
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
                    return res;
                }
            }
            return null;
        };

        let result = null;

        for (const nodeId of state.get("board").toArray().reverse()) {
            const res = check(pos, nodeId, nodeId, null, this.makeBaseOffset());
            if (res) {
                result = res;
                break;
            }
        }

        return result;
    }

    /**
     * Log the current game state.
     *
     * @param changeData Data associated with this edge in the graph.
     */
    saveState(changeData=null) {
        const state = level.serialize(this.getState(), this.semantics);
        const changed = this.stateGraph.push(state, changeData);
        Logging.log("state-save", state);
        Logging.log("state-path-save", this.stateGraph.serialize());

        if (changed && window.updateStateGraph) {
            // See index.js
            window.updateStateGraph(this.stateGraph.toVisJSNetworkData());
        }
    }

    saveNode(id, nodes=null) {
        nodes = nodes === null ? this.getState().get("nodes") : nodes;
        return this.semantics.parser.unparse(this.semantics.hydrate(nodes, nodes.get(id)));
    }

    /**
     * Push and save a special state onto the state graph.
     */
    pushState(label, edge=null) {
        this.stateGraph.push(label, edge);
        Logging.log("state-save", label);
        Logging.log("state-path-save", this.stateGraph.serialize());
        if (window.updateStateGraph) {
            window.updateStateGraph(this.stateGraph.toVisJSNetworkData());
        }
    }

    resize() {
        super.resize();
        this.toolbox.resizeRows(this.getState());
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
        }
        this.timer = window.setTimeout(() => {
            for (const id of this.getState().get("board")) {
                this.bumpAwayFromEdges(id);
            }
        }, 500);
    }

    startLevel(textGoal, showConcreteGoal) {
        const state = this.getState();

        const showSidebar = this.sidebar.startLevel(state);
        if (showSidebar) {
            this.sidebarWidth = 250;
        }
        else {
            this.sidebarWidth = 0;
        }

        this.goal.startLevel(textGoal, showConcreteGoal);
        this.toolbox.startLevel(state);
    }

    registerNewDefinedNames(names) {
        this.newDefinedNames = names;
    }

    getState() {
        return this.store.getState().getIn([ "program", "$present" ]);
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        return { x: x - this.sidebarWidth, y, sidebar: x - this.sidebarWidth < 0 };
    }

    drawContents() {
        const state = this.getState();

        this.sidebar.drawImpl(state);

        this.ctx.save();
        this.ctx.translate(this.sidebarWidth, 0);
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.toolbox.drawBase(state);
        // this.syntaxJournal.drawBase(state);
        this.goal.drawImpl(state);

        for (const fx of Object.values(this.effects)) {
            if (fx.under) {
                fx.prepare();
                fx.draw();
            }
        }

        for (const nodeId of state.get("board")) {
            this.drawProjection(state, nodeId);
        }

        this.toolbox.drawImpl(state);
        // this.syntaxJournal.drawImpl(state);

        for (const id of this._newSyntax) {
            this.drawInternalProjection(state, id);
        }
        if (this.functionDef) {
            this.functionDef.drawImpl(state);
        }

        for (const fx of Object.values(this.effects)) {
            if (!fx.under) {
                fx.prepare();
                fx.draw();
            }
        }

        this.navbar.drawImpl(state);
        this.feedback.drawImpl(state);
        this.reductToolbar.drawImpl(state);

        this.ctx.restore();
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

    isDetachable(targetNode) {
        const state = this.getState();
        const target = state.getIn([ "nodes", targetNode ]);
        if (!target) {
            return false;
        }
        else if (!target.get("locked") && target.get("parent") && target.get("type") !== "missing") {
            return this.semantics.detachable(state, target.get("parent"), targetNode);
        }
        return false;
    }

    /**
     * Helper that detaches an item from its parent.
     */
    detachFromHole(selectedNode, targetNode) {
        if (this.isDetachable(targetNode)) {
            const pos = gfxCore.absolutePos(this.views[targetNode]);
            this.store.dispatch(action.detach(targetNode));
            this.views[targetNode].pos = pos;
            this.views[targetNode].parent = null;
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

    previewApplication(arg, target, prevTarget) {
        if (target === prevTarget) return;

        const state = this.getState();
        const nodes = state.get("nodes");

        if (prevTarget !== null) {
            const prevTargetNode = nodes.get(prevTarget);
            if (prevTargetNode.has("parent") && nodes.get(prevTargetNode.get("parent")).has("body")) {
                // Clear previous preview
                this.semantics.map(
                    nodes,
                    nodes.get(prevTargetNode.get("parent")).get("body"),
                    (nodes, id) => {
                        if (this.views[id]) {
                            delete this.views[id].preview;
                        }
                        return [ nodes.get(id), nodes ];
                    },
                    () => true
                );
            }
        }

        if (target === null) return;

        if (this.semantics.search(
            nodes, arg,
            (_, id) => nodes.get(id).get("type") === "missing"
        ).length > 0) {
            return;
        }

        const targetNode = nodes.get(target);
        if (targetNode.get("type") !== "lambdaArg") return;

        const lambdaBody = nodes.get(targetNode.get("parent")).get("body");

        const targetName = targetNode.get("name");
        this.semantics.searchNoncapturing(nodes, targetName, lambdaBody).forEach((id) => {
            if (this.views[id]) {
                this.views[id].preview = arg;
            }
        });
    }

    /**
     * Helper to activate definitions by placing them in sidebar.
     */
    dropDefines(selectedNode) {
        const state = this.getState();
        const nodes = state.get("nodes");

        if (nodes.get(selectedNode).get("type") !== "define") {
            return false;
        }

        const missingNodes = this.semantics.search(
            nodes,
            selectedNode,
            (nodes, id) => nodes.get(id).get("type") === "missing"
        ).filter((id) => {
            const node = nodes.get(id);
            if (!node.get("parent")) return true;
            const parent = nodes.get(node.get("parent"));
            const substepFilter = this.semantics.interpreter.substepFilter(parent.get("type"));
            return substepFilter(this.semantics, state, parent, node.get("parentField"));
        });

        if (missingNodes.length > 0) {
            Logging.log("define-failed", {
                item: this.saveNode(selectedNode),
                blocking: missingNodes.map(id => this.saveNode(id)),
            });
            missingNodes.forEach((id) => {
                animate.fx.error(this, this.getView(id));
            });
            this.feedback.update("#000", [ "There's a hole that needs to be filled in!" ]);
            return false;
        }

        const name = nodes.getIn([ selectedNode, "name" ]);
        this.store.dispatch(action.define(name, selectedNode));
        this.sidebar.addGlobal(this.getState(), name);
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
                // Don't reattach to the same notch
                this.views[parent].highlighted = false;
                if (selected.get("parent") === parent) {
                    return false;
                }

                if (this.semantics.notchesAttachable(
                    this,
                    this.getState(),
                    parent,
                    selectedNode,
                    notchPair[0]
                )) {
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
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Helper that handles animation and updating the store for a small-step.
     */
    step(state, selectedNode, overrideMode=null, shouldStop=null) {
        const nodes = state.get("nodes");
        const node = nodes.get(selectedNode);

        if (this.semantics.kind(node) !== "expression") {
            return;
        }

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

        const finishReducing = () => {
            reductionAnimation.stop();
            delete this._currentlyReducing[selectedNode];
            for (const id of reducing) {
                this.views[id].stroke = null;
                delete this._currentlyReducing[id];
            }
        };

        // Assumes clicks always dispatched to top-level node
        let origPos = {
            x: gfxCore.centerPos(this.getView(selectedNode)).x,
            y: gfxCore.centerPos(this.getView(selectedNode)).y,
        };

        const mode = overrideMode || this.mode;
        // const mode = document.querySelector("#evaluation-mode").value;
        this.semantics.interpreter.reduce(this, state, node, mode, {
            update: (topNodeId, newNodeIds, addedNodes, recordUndo) => {
                if (this.alreadyWon) return Promise.resolve(this.getState());

                if (newNodeIds.length !== 1) {
                    throw "Stepping to produce multiple expressions is currently unsupported.";
                }

                const state = this.getState();
                const tempNodes = state.get("nodes").withMutations((nodes) => {
                    for (const node of addedNodes) {
                        nodes.set(node.get("id"), node);
                    }
                });

                const origNode = state.getIn([ "nodes", selectedNode ]);
                const origNodeDefn = this.semantics.definitionOf(origNode);
                if (origNodeDefn && origNodeDefn.stepPosition) {
                    origPos = origNodeDefn.stepPosition(this.semantics, this, state, origNode);
                }

                // Project after getting position so that projecting
                // doesn't recreate existing view and thus mess up
                // view hierarchy. (We also can't run prepare() since
                // that might relayout things.)
                for (const node of addedNodes) {
                    this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                }

                // Preserve position
                this.views[newNodeIds[0]].anchor.x = 0.5;
                this.views[newNodeIds[0]].anchor.y = 0.5;
                this.views[newNodeIds[0]].pos.x = origPos.x;
                this.views[newNodeIds[0]].pos.y = origPos.y;

                let act = action.smallStep(topNodeId, newNodeIds, addedNodes);
                Logging.log("reduction", {
                    before: this.saveNode(topNodeId),
                    after: newNodeIds.map(id => this.saveNode(id, tempNodes)),
                });
                if (!recordUndo) {
                    act = action.skipUndo(act);
                }
                this.store.dispatch(act);

                for (const topViewId of this.getState().get("board")) {
                    // Make sure result stays on screen
                    this.bumpAwayFromEdges(topViewId);
                }

                const updatedNodes = this.getState().get("nodes");

                let prevNodeId = topNodeId;
                while (updatedNodes.getIn([ prevNodeId, "parent" ])) {
                    prevNodeId = updatedNodes.getIn([ prevNodeId, "parent" ]);
                }

                // TODO: actually handle multiple new nodes
                for (const id of newNodeIds) {
                    let n = updatedNodes.get(id);
                    while (n.has("parent")) {
                        n = updatedNodes.get(n.get("parent"));
                    }
                    reducing.push(n.get("id"));
                    this._currentlyReducing[n.get("id")] = true;

                    this.reductToolbar.update(n.get("id"), prevNodeId);
                    if (shouldStop && shouldStop(n.get("id"))) {
                        return Promise.reject();
                    }
                }

                return Promise.resolve(this.getState());
            },
            error: (errorNodeId, reason) => {
                animate.fx.error(this, this.views[errorNodeId]);
                if (reason) {
                    this.feedback.update("#000", [ reason ]);
                }
                Logging.log("reduction-error", {
                    clicked: this.saveNode(selectedNode),
                    cause: this.saveNode(errorNodeId),
                    reason,
                });
            },
        }).catch((_errorNodeId) => {
            // Ignore reduction errors, the reducer already handled it
        }).finally(finishReducing);

        if (this.mode === "big") {
            this.mode = "over";
        }
    }

    /**
     * Helper that handles animation and updating the store for a beta reduction.
     */
    betaReduce(state, target, arg) {
        const result = this.semantics.interpreter.betaReduce(this, state, target, [ arg ]);
        if (result) {
            const [ topNode, resultNodeIds, newNodes ] = result;
            const origExp = this.saveNode(topNode);
            const origArg = this.saveNode(arg);
            const tempNodes = state.get("nodes").withMutations((nodes) => {
                for (const node of newNodes) {
                    nodes.set(node.get("id"), node);
                }
            });

            const topNodeRecord = state.getIn([ "nodes", topNode ]);
            if (topNodeRecord.get("body") && this.views[topNodeRecord.get("body")]) {
                const body = topNodeRecord.get("body");
                Audio.play("pop");

                this.views[topNode].pos = gfxCore.centerPos(this.views[topNode]);
                this.views[topNode].anchor = { x: 0.5, y: 0.5 };

                const bodyPos = gfxCore.absolutePos(this.views[body]);
                const bodySize = gfxCore.absoluteSize(this.views[body]);
                // Project after measuring sizes
                for (const node of newNodes) {
                    this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                }

                this.store.dispatch(action.betaReduce(
                    topNode, arg,
                    resultNodeIds, newNodes
                ));

                Promise.all([
                    animate.fx.keepAlive(this, topNode, animate.tween(this.views[topNode], {
                        opacity: 0,
                        pos: { y: this.views[topNode].pos.y + 50 },
                        scale: { x: 0, y: 0 },
                    }, {
                        duration: 1000,
                        easing: animate.Easing.Cubic.Out,
                    }).delay(350), true),
                    animate.fx.emerge(this, this.getState(), bodyPos, bodySize, resultNodeIds),
                ])
                    .then(() => {
                        this.views[topNode].opacity = 1;
                    })
                    .then(() => {
                        this.views[arg].opacity = 1;
                        this.views[topNode].anchor = { x: 0, y: 0.5 };
                        this.views[topNode].scale = { x: 1, y: 1 };
                        this.views[topNode].pos.y = this.views[topNode].pos.y - 50;
                    });

                animate.tween(this.views[arg], { opacity: 0 }, {
                    duration: 250,
                    easing: animate.Easing.Cubic.Out,
                });
            }
            else {
                for (const newNodeId of resultNodeIds) {
                    this.views[newNodeId].pos.x = this.views[topNode].pos.x;
                    this.views[newNodeId].pos.y = this.views[topNode].pos.y;
                }
                Audio.play("pop");

                // Project after measuring sizes
                for (const node of newNodes) {
                    this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                }

                this.store.dispatch(action.betaReduce(topNode, arg, resultNodeIds, newNodes));
            }

            Logging.log("reduction-lambda", {
                before: origExp,
                applied: origArg,
                after: resultNodeIds.map(id => this.saveNode(id, tempNodes)),
            });
        }
        else {
            let applyTarget = target;
            const targetNode = state.get("nodes").get(target);
            if (targetNode.has("parent")) {
                applyTarget = targetNode.get("parent");
            }
            Logging.log("reduction-lambda-failed", {
                target: this.saveNode(applyTarget),
                arg: this.saveNode(arg),
            });
        }
    }

    animateVictory(_matching) {
        this.alreadyWon = true;
        const state = this.getState();
        const tweens = [];
        const views = [];
        for (const nodeId of state.get("goal").concat(state.get("board"))) {
            views.push([ nodeId, this.views[nodeId] ]);
        }
        for (const nodeId of this.goal.animatedNodes()) {
            views.push([ nodeId, this.views[nodeId] ]);
        }

        for (const [ nodeId, view ] of views) {
            if (state.getIn([ "nodes", nodeId ]) &&
                this.semantics.ignoreForVictory(state.getIn([ "nodes", nodeId ]))) {
                continue;
            }

            tweens.push(animate.fx.blink(this, view, {
                times: progression.currentLevel() === 0 ? 2 : 1,
                color: "#0FF",
            }));
        }

        Audio.play("matching-the-goal2");

        return Promise.all(tweens)
            .then(() => {
                const subtweens = [];
                for (const [ _, view ] of views) {
                    subtweens.push(animate.fx.splosion(this, gfxCore.centerPos(view)));
                }
                this.goal.victory();
                this.store.dispatch(action.victory());
                Audio.play("firework1");
                return Promise.all(subtweens);
            })
            .then(() => {
                const title = gfxCore.sprite({
                    image: Loader.images["you_win"],
                    size: { w: 509, h: 110.0 },
                });
                const titleId = this.allocate(title);

                const starList = [];
                const chapter = progression.currentChapter();
                for (let i = 0; i < chapter.levels.length; i++) {
                    const star = gfxCore.shapes.star({
                        color: (progression.currentLevel() > chapter.startIdx + i) ? "gold" : "gray",
                    });
                    star.opacity = 0;

                    let delay = 300;
                    if (chapter.startIdx + i <= progression.currentLevel()) {
                        delay = i * (300 / (progression.currentLevel() - chapter.startIdx));
                    }

                    animate.tween(star, { opacity: 1 }, {
                        easing: animate.Easing.Cubic.In,
                        duration: 300,
                        setAnimatingFlag: false,
                    }).delay(delay);
                    starList.push(this.allocate(star));
                }

                const rows = [ titleId ];
                const layout = gfxCore.layout.sticky(
                    gfxCore.layout.vbox(() => rows, {
                        subexpScale: 1,
                    }, gfxCore.baseProjection),
                    "center",
                    {}
                );
                const layoutId = this.allocate(layout);

                let i = 0;
                while (i < starList.length) {
                    const j = i;
                    rows.push(this.allocate(gfxCore.layout.hbox(
                        () => starList.slice(j, j + 9),
                        {},
                        gfxCore.baseProjection
                    )));
                    i += 9;
                }

                this.addEffect({
                    prepare: () => {
                        const state = this.getState();
                        layout.prepare(layoutId, null, state, this);
                    },

                    draw: () => {
                        const state = this.getState();
                        const offset = this.makeBaseOffset();
                        layout.draw(layoutId, null, state, this, offset);
                    },
                });

                const thisStar = this.getView(starList[progression.currentLevel() - chapter.startIdx]);
                thisStar.offset.y = 600;
                thisStar.opacity = 0;
                return Promise.all([
                    animate.tween(thisStar, {
                        color: "#F00",
                    }, {
                        duration: 1500,
                        setAnimatingFlag: false,
                        easing: animate.Easing.Color(animate.Easing.Cubic.In, thisStar.color, "#F00"),
                    }),
                    animate.tween(thisStar, {
                        offset: { y: 0 },
                    }, {
                        duration: 1500,
                        setAnimatingFlag: false,
                        easing: animate.Easing.Anticipate.BackOut(1.2),
                    }),
                    animate.tween(thisStar, {
                        opacity: 1,
                    }, {
                        duration: 500,
                        setAnimatingFlag: false,
                        easing: animate.Easing.Cubic.In,
                    }),
                ]).then(() => {
                    thisStar.color = "gold";
                    const scale = chroma.scale("Spectral").mode("lab");
                    return animate.fx.splosion(this, gfxCore.centerPos(thisStar), {
                        explosionRadius: 600,
                        numOfParticles: 60,
                        duration: 800,
                        color: idx => scale(idx / 60.0),
                        angle: idx => 2 * Math.PI * (idx / 60.0),
                    });
                }).then(() => Promise.all([
                    animate.tween(title, {
                        opacity: 0,
                    }, {
                        duration: 200,
                        setAnimatingFlag: false,
                        easing: animate.Easing.Cubic.In,
                    }),
                    animate.tween(layout, {
                        opacity: 0,
                    }, {
                        duration: 200,
                        setAnimatingFlag: false,
                        easing: animate.Easing.Cubic.In,
                    }),
                ]));
            });
    }

    animateStuck() {
        this._stuckFxId = this.addEffect(new StuckEffect(this));
        this.alreadyWon = true;
        this.navbar.animateStuck();
    }

    unstuck() {
        this.feedback.clear();
        if (this._stuckFxId) {
            this.effects[this._stuckFxId].cancel().then(() => {
                this.removeEffect(this._stuckFxId);
            });
        }
        this.navbar.unstuck();
        this.alreadyWon = false;
    }

    /**
     * Add new items to the syntax journal.
     */
    learnSyntax(syntaxes) {
        return; // Disabled for now
        const journalButton = this.internalViews[this.syntaxJournal.button];

        const step = () => {
            const syntax = syntaxes.shift();
            if (!syntax) {
                this.draw();
                return;
            }

            progression.learnSyntax(syntax);

            const defn = progression.getSyntaxDefinition(syntax);

            const image = Loader.images[defn.header];
            const sprite = gfxCore.sprite({
                image,
                size: { w: image.naturalWidth, h: image.naturalHeight },
            });
            const id = this.allocateInternal(sprite);

            sprite.opacity = 0;
            sprite.pos = {
                x: this.width / 2,
                y: this.height / 2,
            };
            sprite.anchor = { x: 0.5, y: 0.5 };
            animate.tween(sprite, { opacity: 1 }, {
                duration: 800,
                easing: animate.Easing.Cubic.Out,
            }).then(() => {
                animate.tween(sprite.scale, { x: 0.1, y: 0.1 }, {
                    duration: 1000,
                    easing: animate.Easing.Cubic.Out,
                });

                return animate.tween(sprite.pos, {
                    x: journalButton.pos.x + (journalButton.size.w / 2),
                    y: journalButton.pos.y + (journalButton.size.h / 2),
                }, {
                    duration: 2000,
                    easing: animate.Easing.Cubic.InOut,
                });
            }).then(() => {
                journalButton.highlight();
                this._newSyntax.shift();
                step();
            });

            this._newSyntax.push(id);
        };
        step();
    }

    /**
     * Show the definition of the given reference under its view.
     */
    showReferenceDefinition(state, referenceId, immediate=false) {
        const referenceNameNode = state.getIn([ "nodes", referenceId ]);
        const name = referenceNameNode.get("name");
        // TODO: don't hardcode repeat (also see ui/sidebar.js)
        if (name === "repeat") return;
        const functionNodeId = state.get("globals").get(name);
        const functionNode = state.get("nodes").get(functionNodeId);
        if (!functionNode) return;

        const type = functionNode.get("type");
        if (type === "define") {
            const functionBodyId = state.get("nodes").get(functionNodeId).get("body");
            this.functionDef = new FunctionDef(
                this,
                name,
                functionBodyId,
                referenceId,
                immediate ? 0 : 500
            );
        }
        else {
            this.functionDef = new FunctionDef(
                this,
                name,
                functionNodeId,
                referenceId,
                immediate ? 0 : 500
            );
        }
    }

    // TODO: refactor these methods onto the touchrecord
    /**
     * @returns {Boolean} ``true`` if the click was intercepted
     */
    hideReferenceDefinition(mousePos) {
        if (this.functionDef && mousePos) {
            const state = this.getState();
            const nodes = state.get("nodes");
            const contains = this.functionDef.containsPoint(state, mousePos);
            if (contains) {
                const body = this.semantics.hydrate(nodes, nodes.get(this.functionDef.id));
                if (body.parent) delete body.parent;
                if (body.parentField) delete body.parentField;

                const origRef = nodes.get(this.functionDef.referenceId);
                const subexprs = this.semantics.subexpressions(origRef);
                const hasArgs = subexprs.some(field => nodes.getIn([ origRef.get(field), "type" ]) !== "missing");

                let result = body;

                if (hasArgs) {
                    for (const field of subexprs) {
                        const hydrated = this.semantics.hydrate(
                            nodes,
                            nodes.get(origRef.get(field))
                        );
                        result = this.semantics.apply(result, hydrated);
                    }
                }

                // Add parent field so that when projected, the
                // unfolded reference isn't hoverable
                if (origRef.get("parent")) {
                    result.parent = origRef.get("parent");
                    result.parentField = origRef.get("parentField");
                }

                const fullNodes = this.semantics.flatten(result).map((n) => {
                    n.locked = true;
                    return immutable.Map(n);
                });
                const tempNodes = state.get("nodes").withMutations((n) => {
                    for (const node of fullNodes) {
                        n.set(node.get("id"), node);
                    }
                });
                for (const node of fullNodes) {
                    this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
                }

                const newView = this.views[fullNodes[0].get("id")];
                const oldView = this.views[this.functionDef.referenceId];
                newView.anchor.x = oldView.anchor.x;
                newView.anchor.y = oldView.anchor.y;
                newView.pos.x = oldView.pos.x;
                newView.pos.y = oldView.pos.y;

                this.store.dispatch(action.unfold(
                    this.functionDef.referenceId,
                    fullNodes[0].get("id"),
                    fullNodes
                ));
            }
            else {
                Logging.log("unfold-cancel", {
                    item: this.saveNode(this.functionDef.referenceId),
                });
            }
            this.functionDef = null;
            return true;
        }
        this.functionDef = null;
        return false;
    }

    /**
     * Replace an unfaded expression with its faded equivalent.
     */
    fade(source, unfadedId, fadedId) {
        this.store.dispatch(action.fade(source, unfadedId, fadedId));

        const fxId = this.addEffect({
            prepare: () => {
                this.getView(unfadedId).prepare(unfadedId, unfadedId, this.getState(), this);
            },
            draw: () => {
                this.getView(unfadedId)
                    .draw(unfadedId, unfadedId, this.getState(), this, this.makeBaseOffset());
            },
        });

        this.getView(fadedId).opacity = 0;
        this.getView(fadedId).anchor = this.getView(unfadedId).anchor;

        return Promise.all([
            animate.tween(this.getView(unfadedId), {
                opacity: 0,
            }, {
                duration: 2000,
                easing: animate.Easing.Cubic.InOut,
            }),
            animate.tween(this.getView(fadedId), {
                opacity: 1,
            }, {
                duration: 2000,
                easing: animate.Easing.Cubic.InOut,
            }),
        ]).then(() => {
            this.removeEffect(fxId);
        });
    }

    _mousedownInner(e) {
        const pos = this.getMousePos(e);

        if (pos.sidebar) {
            this.sidebar.toggle();
            return null;
        }

        if (this.syntaxJournal.isOpen) {
            const [ topNode ] = this.syntaxJournal.getNodeAtPos(this.getState(), pos);
            if (topNode === null) {
                this.syntaxJournal.close();
            }
        }

        if (this.hideReferenceDefinition(pos)) {
            return null;
        }

        return super._mousedown(e);
    }

    _mousemoveInner(e) {
        super._mousemove(e);
    }

    _mouseupInner(e) {
        super._mouseup(e);
    }

    _doubleclickInner(e) {
        const pos = this.getMousePos(e);
        if (pos.sidebar) return;

        const targetNode = this.getReferenceNameAtPos(pos);

        if (targetNode !== null) {
            const state = this.getState();
            const node = state.getIn([ "nodes", targetNode ]);
            if (node.get("type") === "reference") {
                this.showReferenceDefinition(this.getState(), targetNode, true);
            }
        }
    }

    /* ~~~~ Implement a double-click layer on top of click methods ~~~~ */
    _mousedown(e) {
        this.clickWrapper.onmousedown(e);
    }

    _mousemove(e) {
        this.clickWrapper.onmousemove(e);
    }

    _mouseup(e) {
        this.clickWrapper.onmouseup(e);
    }

    _touchstart(e) {
        if (this.getMousePos(e).sidebar) {
            this.sidebar.toggle();
            return;
        }

        if (this.syntaxJournal.isOpen) {
            this.syntaxJournal.close();
        }

        super._touchstart(e);
    }

    _touchmove(e) {
        if (this.getMousePos(e).sidebar) {
            return;
        }

        super._touchmove(e);
    }

    _touchend(e) {
        if (this.getMousePos(e).sidebar) {
            return;
        }

        if (this.hideReferenceDefinition(this.getMousePos(e))) {
            return;
        }

        super._touchend(e);
    }
}
