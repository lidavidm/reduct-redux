import * as immutable from "immutable";

import * as action from "../reducer/action";
import * as reducer from "../reducer/reducer";
import * as level from "../game/level";
import * as animate from "../gfx/animate";
import Audio from "../resource/audio";
import * as gfxCore from "../gfx/core";
import * as progression from "../game/progression";

import Goal from "../ui/goal";
import Toolbox from "../ui/toolbox";
import Sidebar from "../ui/sidebar";
import SyntaxJournal from "../ui/syntaxjournal";
import FunctionDef from "../ui/functiondef";

import Loader from "../loader";
import Logging from "../logging/logging";
import Network from "../logging/network";

import BaseTouchRecord from "./touchrecord";
import BaseStage from "./basestage";

const DOUBLE_CLICK_THRESHOLD_MS = 250;

class TouchRecord extends BaseTouchRecord {
    constructor(...args) {
        super(...args);
        this.dropTargets = [];
        this.dropTweens = new Map();
        this.highlightAnimation = null;
        this.scaleAnimation = null;
        this.hoverStartPos = null;
        this.clonable = false;
    }

    reset() {
        super.reset();
        this.stopHighlight();
        this.highlightAnimation = null;
        this.dropTargets = [];
        this.dropTweens = new Map();
        this.hoverStartPos = null;
        this.clonable = false;
    }

    // TODO: refactor this onto the stage
    stopHighlight() {
        for (const id of this.dropTargets) {
            this.stage.getView(id).stroke = null;
            this.stage.getView(id).outerStroke = null;
        }

        for (const [ tween, isExpand ] of this.dropTweens.values()) {
            if (isExpand) {
                tween.completed();
                tween.undo();
            }
        }

        if (this.highlightAnimation) {
            this.highlightAnimation.stop();
        }
    }

    startHighlight() {
        const state = this.stage.getState();
        const nodes = state.get("nodes");

        state.get("board").forEach((id) => {
            if (id === this.topNode) return;

            this.dropTargets = this.dropTargets.concat(this.stage.semantics.search(
                nodes, id,
                (_, subId) => this.stage.semantics.droppable(state, this.topNode, subId)
            ));
        });

        let time = 0;
        this.highlightAnimation = animate.infinite((dt) => {
            const state = this.stage.getState();
            time += dt;

            for (const targetId of this.dropTargets) {
                const view = this.stage.getView(targetId);
                const stroke = {
                    color: targetId === this.hoverNode ? "gold" : "#02d8f9",
                    lineWidth: 3 + (1.5 * Math.cos(time / 750)),
                };

                if (state.getIn([ "nodes", targetId, "type" ]) === "lambdaArg") {
                    view.outerStroke = stroke;
                }
                else {
                    view.stroke = stroke;
                }
            }
        });
    }

    useToolboxItem() {
        Logging.log("toolbox-remove", this.stage.saveNode(this.topNode));
        this.stage.store.dispatch(action.useToolbox(this.topNode));
        animate.fx.expandingShape(this.stage, this.stage.getView(this.topNode));
    }

    onstart(mousePos) {
        super.onstart(mousePos);

        this.isExpr = this.stage.getState().get("nodes").has(this.topNode);
        if (this.isExpr && this.topNode) {
            this.stage.store.dispatch(action.raise(this.topNode));

            const state = this.stage.getState();
            const selected = state.getIn([ "nodes", this.topNode ]);
            this.clonable = this.fromToolbox &&
                selected.has("__meta") &&
                selected.get("__meta").toolbox.unlimited;
        }

        const view = this.stage.getView(this.topNode);
        if (view && view.onmousedown) {
            view.onmousedown();
        }

        const referenceId = this.stage.getReferenceNameAtPos(mousePos);
        if (referenceId) {
            this.stage.showReferenceDefinition(this.stage.getState(), referenceId);
        }
    }

    onmove(mouseDown, mousePos) {
        if (mouseDown && this.topNode !== null &&
            (!this.targetNode || !this.stage.isDetachable(this.targetNode))) {
            // Tolerance before a click becomes a drag
            if (this.dragged || gfxCore.distance(this.dragStart, mousePos) > 10) {
                if (this.stage.functionDef) {
                    this.stage.functionDef = null;
                }

                if (this.isExpr && !this.dragged && this.fromToolbox) {
                    Logging.log("toolbox-dragout", this.stage.saveNode(this.topNode));
                }

                if (!this.dragged) {
                    // Highlight droppable holes
                    this.startHighlight();
                }
                this.dragged = true;

                if (this.isExpr && this.fromToolbox) {
                    const resultNode = this.stage.cloneToolboxItem(this.topNode);
                    if (resultNode !== null) {
                        Logging.log("toolbox-remove", this.stage.saveNode(this.topNode));
                        this.stage.views[this.topNode].opacity = 1.0;
                        // Selected node was an __unlimited node
                        this.topNode = resultNode;
                        this.targetNode = resultNode;
                        this.fromToolbox = false;
                        this.clonable = false;
                    }
                }
            }

            if (!this.clonable) {
                const view = this.stage.getView(this.topNode);
                this.stage.views[this.topNode].anchor = {
                    x: this.dragAnchor.x,
                    y: this.dragAnchor.y,
                };
                view.pos.x = mousePos.x;
                view.pos.y = mousePos.y;

                if (this.isExpr && this.targetNode !== null) {
                    this.stage.views[this.topNode].opacity = 0.7;
                }
            }
        }

        if (this.isExpr && mouseDown && this.targetNode &&
            gfxCore.distance(this.dragStart, mousePos) > 10) {
            const newSelected = this.stage.detachFromHole(this.topNode, this.targetNode);
            if (newSelected !== null) {
                // Highlight droppable holes
                this.startHighlight();

                this.stage.views[this.topNode].opacity = 1.0;
                this.topNode = newSelected;
                this.dragAnchor = this.stage.computeDragAnchor(
                    this.dragStart,
                    newSelected,
                    newSelected
                );
            }
        }

        // Previewing application can cause holes to jump around a
        // lot, making it frustrating to use. This makes holes
        // "sticky".
        const oldHover = this.hoverNode;
        this.findHoverNode(mousePos);
        if (this.topNode !== null && (this.hoverNode === null || !this.stage.semantics.droppable(
            this.stage.getState(),
            this.topNode,
            this.hoverNode
        )) &&
            oldHover !== null && this.hoverStartPos &&
            gfxCore.distance(mousePos, this.hoverStartPos) < 25) {
            this.hoverNode = oldHover;
        }
        else if (this.topNode !== null && this.hoverNode !== null) {
            this.hoverStartPos = Object.assign({}, mousePos);
        }

        if (this.isExpr && this.topNode && this.hoverNode) {
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

        if (this.isExpr && this.topNode !== null) {
            // Show previews for lambda application, if applicable
            this.stage.previewApplication(this.topNode, this.hoverNode, this.prevHoverNode);
        }

        if (this.topNode && this.isExpr) {
            // Scale things down when they're over a hole
            if (this.hoverNode) {
                if (this.scaleAnimation) this.scaleAnimation.cancel();
                this.scaleAnimation = animate.tween(this.stage.getView(this.topNode), {
                    scale: { x: 0.6, y: 0.6 },
                }, {
                    easing: animate.Easing.Cubic.Out,
                    setAnimatingFlag: false,
                    duration: 300,
                });
            }
            else if (this.stage.getView(this.topNode).scale.x < 1) {
                if (this.scaleAnimation) this.scaleAnimation.cancel();
                this.scaleAnimation = animate.tween(this.stage.getView(this.topNode), {
                    scale: { x: 1, y: 1 },
                }, {
                    easing: animate.Easing.Cubic.Out,
                    setAnimatingFlag: false,
                    duration: 300,
                });
            }
        }

        // onmouseenter/onmouseexit for views (e.g. buttons)
        if (this.hoverNode !== this.prevHoverNode) {
            const view = this.stage.getView(this.hoverNode);
            const prevView = this.stage.getView(this.prevHoverNode);
            if (view && view.onmouseenter) {
                view.onmouseenter();
            }
            if (prevView && prevView.onmouseexit) {
                prevView.onmouseexit();
            }

            if (this.topNode !== null && this.isExpr && this.hoverNode !== null) {
                // Scale holes up when something is dragged over them
                const targetSize = gfxCore.absoluteSize(this.stage.getView(this.topNode));

                const state = this.stage.getState();
                if (this.stage.semantics.droppable(state, this.topNode, this.hoverNode)) {
                    const view = this.stage.getView(this.hoverNode);
                    if (view.padding) {
                        const curSize = gfxCore.absoluteSize(view);
                        const lr = Math.min(Math.max((targetSize.w - curSize.w) / 1.5, 15), 60);
                        const tb = Math.min(Math.max((targetSize.h - curSize.h) / 1.5, 10), 30);

                        if (this.dropTweens.has(this.hoverNode)) {
                            const [ tween, isExpand ] = this.dropTweens.get(this.hoverNode);
                            tween.completed();
                            if (isExpand) {
                                tween.undo();
                            }
                        }
                        const tween = animate.tween(view, {
                            padding: {
                                left: view.padding.left + lr,
                                right: view.padding.right + lr,
                                top: view.padding.top + tb,
                                bottom: view.padding.bottom + tb,
                            },
                        }, {
                            duration: 600,
                            easing: animate.Easing.Cubic.Out,
                            // Don't override layout
                            setAnimatingFlag: false,
                        });
                        this.dropTweens.set(this.hoverNode, [ tween, true ]);
                    }
                }
            }

            if (this.prevHoverNode !== null && this.dropTweens.has(this.prevHoverNode)) {
                const record = this.dropTweens.get(this.prevHoverNode);
                if (record[1]) {
                    record[0].completed();
                    record[0] = record[0].undo(true);
                    record[1] = false;
                }
            }
        }

        // Highlight nearby compatible notches, if applicable
        this.stage.highlightNotches(this.topNode);
    }

    onend(state, mousePos) {
        this.stopHighlight();
        if (this.scaleAnimation) this.scaleAnimation.cancel();
        if (this.isExpr && this.topNode) {
            const view = this.stage.getView(this.topNode);
            view.scale = { x: 1, y: 1 };
            const cp = gfxCore.centerPos(view);
            view.anchor = { x: 0.5, y: 0.5 };
            view.pos = cp;
        }

        if (!this.dragged) {
            const view = this.stage.getView(this.topNode);
            if (view && view.onclick) {
                view.onclick();
            }
        }

        if (this.isExpr && !this.dragged && this.topNode !== null && !this.fromToolbox) {
            if (Date.now() - this.currTime < 1000) {
                // Click on object to reduce; always targets toplevel node
                if (this.stage.functionDef) {
                    this.stage.functionDef = null;
                }
                this.stage.step(state, this.topNode);
            }
        }
        else if (this.isExpr && this.stage.snapNotches(this.topNode)) {
            // Prioritize snapping over filling
        }
        else if (this.isExpr && this.dragged && this.hoverNode &&
                 this.stage.semantics.droppable(state, this.topNode, this.hoverNode) === "hole") {
            // Drag something into hole

            if (this.fromToolbox) this.useToolboxItem();

            Audio.play("pop");
            this.stage.store.dispatch(action.fillHole(this.hoverNode, this.topNode));
            animate.fx.expandingShape(this.stage, this.stage.getView(this.topNode));
        }
        else if (this.isExpr && this.dragged && this.hoverNode && this.topNode) {
            if (this.fromToolbox) this.useToolboxItem();
            // Clear application previews (otherwise they stick around
            // if beta-reduction is undone)
            this.stage.previewApplication(this.topNode, null, this.hoverNode);
            // Apply to lambda
            const arg = this.topNode;
            const target = this.hoverNode;
            this.stage.betaReduce(state, target, arg);
        }
        else if (this.isExpr && this.dragged && this.fromToolbox) {
            const projection = this.stage.views[this.topNode];
            let useItem = true;
            // Allow items to be placed back in toolbox if and only if
            // they were dragged from and released in the toolbox in
            // one motion
            if (projection) {
                const topLeft = gfxCore.absolutePos(projection);
                const bottom = { x: 0, y: topLeft.y + projection.size.h };
                if (this.stage.toolbox.containsPoint(bottom)) {
                    useItem = false;
                }
            }
            if (useItem) {
                // Take item out of toolbox
                this.useToolboxItem();
            }
            else {
                Logging.log("toolbox-addback", this.stage.saveNode(this.topNode));
            }
        }

        // Bump items out of toolbox
        if (this.isExpr && this.topNode !== null) {
            const projection = this.stage.views[this.topNode];
            const topLeft = gfxCore.absolutePos(projection);
            const bottom = { x: 0, y: topLeft.y + projection.size.h };
            if (this.stage.toolbox.containsPoint(bottom) &&
                !this.stage.getState().get("toolbox").includes(this.topNode)) {
                Logging.log("toolbox-reject", this.stage.saveNode(this.topNode));
            }
            this.stage.bumpAwayFromEdges(this.topNode);
            this.stage.views[this.topNode].opacity = 1.0;
        }

        this.findHoverNode(mousePos);
    }
}

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

        this.sidebarWidth = 0;

        this.stateGraph = new Network();
        this.alreadyWon = false;

        this.timer = null;
        this.color = "#EEEEEE";

        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);
        this.sidebar = new Sidebar(this);
        this.syntaxJournal = new SyntaxJournal(this);
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
        return TouchRecord;
    }

    get width() {
        return this._width - this.sidebarWidth;
    }

    getNodeAtPos(pos, selectedId=null) {
        if (this.syntaxJournal.isOpen) {
            const [ result, root ] = this.syntaxJournal.getNodeAtPos(state, pos);
            if (result) {
                return [ root, result, true ];
            }

            return [ null, null, false ];
        }

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

                if (curRoot === curExprId && curNode &&
                    !this.semantics.targetable(state, curNode)) {
                    return null;
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

        for (const nodeId of state.get("board").toArray().reverse()) {
            if (nodeId === selectedId) continue;

            const res = check(pos, nodeId, nodeId, null, this.makeBaseOffset());
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
        Logging.log("state-path-save", this.stateGraph.toString());

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
        Logging.log("state-path-save", this.stateGraph.toString());
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

        const numSidebarEntries = this.sidebar.startLevel(state);
        if (numSidebarEntries === 0) {
            this.sidebarWidth = 0;
        }
        else {
            this.sidebarWidth = 250;
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

        if (x >= this.sidebarWidth) {
            return { x: x - this.sidebarWidth, y, sidebar: false };
        }

        return { x, y, sidebar: true };
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
            fx.draw();
        }

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
        if (!target.get("locked") && target.get("parent") && target.get("type") !== "missing") {
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
    step(state, selectedNode, overrideMode=null) {
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
                const topView = this.views[topNodeId];

                if (newNodeIds.length !== 1) {
                    throw "Stepping to produce multiple expressions is currently unsupported.";
                }

                const state = this.getState();
                const tempNodes = state.get("nodes").withMutations(nodes => {
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
                animate.fx.error(this, this.views[errorNodeId]);
                Logging.log("reduction-error", {
                    clicked: this.saveNode(selectedNode),
                    cause: this.saveNode(errorNodeId),
                });
            },
        }).finally(finishReducing);

        if (this.mode === "big") {
            this.mode = "over";
            document.querySelector("#ffwd").classList.remove("active");
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
                let fxId = null;

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
                    }).delay(350)),
                    animate.fx.emerge(this, this.getState(), bodyPos, bodySize, resultNodeIds)
                ])
                    .then(() => {
                        this.views[topNode].opacity = 1;
                    })
                    .then(() => {
                        this.views[arg].opacity = 1;
                        this.views[topNode].anchor = { x: 0, y: 0.5 };
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

        return Promise.all(tweens).then(() => {
            const subtweens = [];
            for (const [ _, view ] of views) {
                subtweens.push(animate.fx.splosion(this, gfxCore.centerPos(view)));
            }
            this.goal.victory();
            this.store.dispatch(action.victory());
            Audio.play("firework1");
            return Promise.all(subtweens);
        });
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

                this.views[fullNodes[0].get("id")].pos.x = this.views[this.functionDef.referenceId].pos.x;
                this.views[fullNodes[0].get("id")].pos.y = this.views[this.functionDef.referenceId].pos.y;

                this.store.dispatch(action.unfold(
                    this.functionDef.referenceId,
                    fullNodes[0].get("id"),
                    fullNodes
                ));
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

    togglePause() {
        if (this.mode === "hybrid") {
            this.mode = "over";
        }
        else {
            this.mode = "hybrid";
        }
    }

    setFfwd() {
        this.mode = "big";
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
        if (this.getMousePos(e).sidebar) {
            return;
        }
        super._mousemove(e);
    }

    _mouseupInner(e) {
        if (this.getMousePos(e).sidebar) {
            return;
        }

        super._mouseup(e);
    }

    _doubleclickInner(e) {
        const pos = this.getMousePos(e);
        if (pos.sidebar) return;

        const [ topNode, _, fromToolbox ] = this.getNodeAtPos(pos);
        if (fromToolbox) {
            return;
        }

        if (topNode !== null) {
            const state = this.getState();
            const node = state.getIn([ "nodes", topNode ]);
            if (node.get("type") === "reference") {
                this.showReferenceDefinition(this.getState(), topNode, true);
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
