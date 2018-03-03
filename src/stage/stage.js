import * as action from "../reducer/action";
import * as level from "../game/level";
import * as animate from "../gfx/animate";
import Audio from "../resource/audio";
import * as gfxCore from "../gfx/core";
import * as progression from "../game/progression";

import Goal from "../ui/goal";
import Toolbox from "../ui/toolbox";
import Sidebar from "../ui/sidebar";
import SyntaxJournal from "../ui/syntaxjournal";

import Loader from "../loader";
import Logging from "../logging/logging";
import Network from "../logging/network";

import BaseTouchRecord from "./touchrecord";
import BaseStage from "./basestage";

class TouchRecord extends BaseTouchRecord {
    onstart() {
        this.isExpr = this.stage.getState().get("nodes").has(this.topNode);
        if (this.isExpr && this.topNode) {
            this.stage.store.dispatch(action.raise(this.topNode));
        }

        const view = this.stage.getView(this.topNode);
        if (view && view.onmousedown) {
            view.onmousedown();
        }
    }

    onmove(mouseDown, mousePos) {
        if (mouseDown && this.topNode !== null) {
            // 5-pixel tolerance before a click becomes a drag
            if (this.dragged || gfxCore.distance(this.dragStart, mousePos) > 5) {
                if (this.isExpr && !this.dragged && this.fromToolbox) {
                    Logging.log("toolbox-dragout", this.stage.saveNode(this.topNode));
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
                    }
                }
            }

            const view = this.stage.getView(this.topNode);
            const absSize = gfxCore.absoluteSize(view);
            view.pos.x = (mousePos.x - this.dragOffset.dx) + (view.anchor.x * absSize.w);
            view.pos.y = (mousePos.y - this.dragOffset.dy) + (view.anchor.y * absSize.h);

            if (this.isExpr && this.targetNode !== null) {
                this.stage.views[this.topNode].opacity = 0.6;
            }
        }

        // TODO: add tolerance here as well
        if (this.isExpr && mouseDown && this.targetNode) {
            const newSelected = this.stage.detachFromHole(this.topNode, this.targetNode);
            if (newSelected !== null) {
                this.stage.views[this.topNode].opacity = 1.0;
                this.topNode = newSelected;
                this.dragOffset = this.stage.computeDragOffset(
                    this.dragStart,
                    newSelected,
                    newSelected
                );
            }
        }

        this.findHoverNode(mousePos);
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
        }

        // Highlight nearby compatible notches, if applicable
        this.stage.highlightNotches(this.topNode);
    }

    onend(state, mousePos) {
        if (!this.dragged) {
            const view = this.stage.getView(this.topNode);
            if (view && view.onclick) {
                view.onclick();
            }
        }

        if (this.isExpr && !this.dragged && this.topNode !== null && !this.fromToolbox) {
            // Click on object to reduce
            let selectedNode = this.topNode;

            /*if (this.targetNode) {
                const targetLocked = state.getIn([ "nodes", this.targetNode, "locked" ]);
                if (!targetLocked) {
                    selectedNode = this.targetNode;
                }
            }*/

            this.stage.step(state, selectedNode);
        }
        else if (this.isExpr && this.dragged && this.hoverNode &&
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
        else if (this.isExpr && this.dragged && this.hoverNode && this.topNode) {
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
                Logging.log("toolbox-remove", this.stage.saveNode(this.topNode));
                this.stage.store.dispatch(action.useToolbox(this.topNode));
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
                this.stage.bumpAwayFromEdges(this.topNode);
            }
            this.stage.views[this.topNode].opacity = 1.0;
        }

        if (this.isExpr) this.stage.snapNotches(this.topNode);

        this.findHoverNode(mousePos);
    }
}

/**
 * Handle drawing responsibilites for Reduct.
 */
export default class Stage extends BaseStage {
    constructor(canvas, width, height, store, views, semantics) {
        super(canvas, width, height, store, views, semantics);

        this.sidebarWidth = 250;

        this.stateGraph = new Network();
        this.alreadyWon = false;

        this.timer = null;
        this.color = "#EEEEEE";

        this.toolbox = new Toolbox(this);
        this.goal = new Goal(this);
        this.sidebar = new Sidebar(this);
        this.syntaxJournal = new SyntaxJournal(this);

        this._currentlyReducing = {};
        this._newSyntax = [];

        this.newDefinedNames = []; //Field to keep track of which function names are newly defined so that we big-step it during reduction.
    }

    get touchRecordClass() {
        return TouchRecord;
    }

    get width() {
        return this._width - this.sidebarWidth;
    }

    getNodeAtPos(pos, selectedId=null) {
        if (this.syntaxJournal.isOpen) {
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
                    return [ curRoot, res ];
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

    /**
     * Log the current game state.
     *
     * @param changeData Data associated with this edge in the graph.
     */
    saveState(changeData=null) {
        const state = level.serialize(this.getState(), this.semantics);
        const changed = this.stateGraph.push(JSON.stringify(state), changeData);
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
    pushState(label) {
        this.stateGraph.push(label);
        Logging.log("state-path-save", this.stateGraph.toString());
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
        this.goal.startLevel(textGoal, showConcreteGoal);
        this.toolbox.startLevel(state);

        const numSidebarEntries = this.sidebar.startLevel(state);
        if (numSidebarEntries === 0) {
            this.sidebarWidth = 0;
        }
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
        this.syntaxJournal.drawBase(state);
        this.goal.drawImpl(state);

        for (const nodeId of state.get("board")) {
            this.drawProjection(state, nodeId);
        }

        this.toolbox.drawImpl(state);
        this.syntaxJournal.drawImpl(state);

        for (const id of this._newSyntax) {
            this.drawInternalProjection(state, id);
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

    /**
     * Helper that detaches an item from its parent.
     */
    detachFromHole(selectedNode, targetNode) {
        const state = this.getState();
        const target = state.getIn([ "nodes", targetNode ]);
        if (!target.get("locked") && target.get("parent") && target.get("type") !== "missing") {
            if (!this.semantics.detachable(state, target.get("parent"), targetNode)) {
                return null;
            }
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

        if (this.semantics.search(
            nodes, lambdaBody,
            (_, id) => nodes.get(id).get("type") === "missing"
        ).length > 0) {
            return;
        }

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
                    return;
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

        const finishReducing = () => {
            reductionAnimation.stop();
            delete this._currentlyReducing[selectedNode];
            for (const id of reducing) {
                this.views[id].stroke = null;
                delete this._currentlyReducing[id];
            }
        };

        const mode = document.querySelector("#evaluation-mode").value;
        this.semantics.interpreter.reduce(this, state, node, mode, {
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
            },
        }).finally(finishReducing);
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
            const tempNodes = state.get("nodes").withMutations(nodes => {
                for (const node of newNodes) {
                    nodes.set(node.get("id"), node);
                }
            });

            for (const node of newNodes) {
                this.views[node.get("id")] = this.semantics.project(this, tempNodes, node);
            }

            const topNodeRecord = state.getIn([ "nodes", topNode ]);
            if (topNodeRecord.get("body") && this.views[topNodeRecord.get("body")]) {
                const tempState = state.set("nodes", tempNodes);
                const body = topNodeRecord.get("body");
                Audio.play("pop");
                animate.fx.emerge(this, tempState, this.views[body], resultNodeIds).then(() => {
                    this.store.dispatch(action.betaReduce(topNode, arg, resultNodeIds, newNodes));
                });

                animate.tween(this.views[topNode], { opacity: 0 }, {
                    duration: 250,
                    easing: animate.Easing.Cubic.Out,
                }).then(() => {
                    this.views[topNode].opacity = 1;
                });
                animate.tween(this.views[arg], { opacity: 0 }, {
                    duration: 250,
                    easing: animate.Easing.Cubic.Out,
                }).then(() => {
                    this.views[arg].opacity = 1;
                });
            }
            else {
                for (const newNodeId of resultNodeIds) {
                    this.views[newNodeId].pos.x = this.views[topNode].pos.x;
                    this.views[newNodeId].pos.y = this.views[topNode].pos.y;
                }
                Audio.play("pop");
                this.store.dispatch(action.betaReduce(topNode, arg, resultNodeIds, newNodes));
            }

            Logging.log("reduction-lambda", {
                before: origExp,
                applied: origArg,
                after: resultNodeIds.map(id => this.saveNode(id, tempNodes)),
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

    _mousedown(e) {
        if (this.getMousePos(e).sidebar) {
            this.sidebar.toggle();
            return null;
        }

        if (this.syntaxJournal.isOpen) {
            this.syntaxJournal.close();
        }

        return super._mousedown(e);
    }

    _mousemove(e) {
        if (this.getMousePos(e).sidebar) {
            return;
        }
        super._mousemove(e);
    }

    _mouseup(e) {
        if (this.getMousePos(e).sidebar) {
            return;
        }
        super._mouseup(e);
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

        super._touchstart(e);
    }
}
