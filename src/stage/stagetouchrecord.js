import chroma from "chroma-js";
import * as immutable from "immutable";

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
import FunctionDef from "../ui/functiondef";

import Loader from "../loader";
import Logging from "../logging/logging";
import Network from "../logging/network";

import BaseTouchRecord from "./touchrecord";
import BaseStage from "./basestage";

const DOUBLE_CLICK_THRESHOLD_MS = 250;

export default class TouchRecord extends BaseTouchRecord {
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

        this.stage.sidebar.resetIndicator();

        if (this.highlightAnimation) {
            this.highlightAnimation.stop();
        }
    }

    startHighlight() {
        const state = this.stage.getState();
        const nodes = state.get("nodes");

        const topNode = nodes.get(this.topNode);
        const highlightSidebar = topNode.get("type") === "define";

        let sidebarScale = null;
        let sidebarHoverScale = null;
        if (highlightSidebar) {
            sidebarScale = chroma.scale([ "#594764", "#02d8f9" ]).mode("lab");
            sidebarHoverScale = chroma.scale([ "#594764", "gold" ]).mode("lab");

            const indicator = this.stage.getView(this.stage.sidebar.indicator);
            indicator.tween = animate.tween(indicator, {
                padding: { top: 50, bottom: 50 },
                opacity: 1,
            }, {
                duration: 300,
                easing: animate.Easing.Cubic.In,
            });
        }

        state.get("board").forEach((id) => {
            if (id === this.topNode) return;

            this.dropTargets = this.dropTargets.concat(this.stage.semantics.search(
                nodes, id,
                (_, subId) => {
                    const droppable = this.stage.semantics.droppable(state, this.topNode, subId);
                    const other = nodes.get(subId);
                    const compatible = this.stage.semantics.notchesCompatible(topNode, other);
                    return droppable || (compatible && compatible.length > 0);
                }
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

            if (highlightSidebar) {
                const s = 0.5 + (0.5 * (1 - ((1 + Math.cos(time / 750)) / 2)));
                const scale = this.hoverSidebar ? sidebarHoverScale : sidebarScale;
                this.stage.getView(this.stage.sidebar.indicator).stroke.color = scale(s);
            }
        });
    }

    useToolboxItem() {
        Logging.log("toolbox-remove", this.stage.saveNode(this.topNode));
        this.stage.store.dispatch(action.useToolbox(this.topNode));
        animate.fx.expandingShape(this.stage, this.stage.getView(this.topNode));
    }

    onstart(mousePos) {
        const view = this.stage.getView(this.topNode);
        if (view && view.onmousedown) {
            view.onmousedown();
        }

        if (this.stage.alreadyWon) return;

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

        const referenceId = this.stage.getReferenceNameAtPos(mousePos);
        if (referenceId) {
            this.stage.showReferenceDefinition(this.stage.getState(), referenceId);
        }
    }

    onmove(mouseDown, mousePos) {
        if (this.stage.alreadyWon) {
            this.findHoverNode(mousePos);
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

            return;
        }

        if (mouseDown && this.topNode !== null && this.isExpr &&
            (!this.targetNode || !this.stage.isDetachable(this.targetNode))) {
            // Tolerance before a click becomes a drag
            if (this.dragged || gfxCore.distance(this.dragStart, mousePos) > 10) {
                // Clear any feedback messages
                this.stage.feedback.clear();

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
        if (this.isExpr && this.topNode !== null &&
            (this.hoverNode === null || !this.stage.semantics.droppable(
                this.stage.getState(),
                this.topNode,
                this.hoverNode
            )) &&
            oldHover !== null && this.hoverStartPos &&
            gfxCore.distance(mousePos, this.hoverStartPos) < 50) {
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

        // Highlight nearby compatible notches, if applicable
        this.stage.highlightNotches(this.topNode);
    }

    onend(state, mousePos) {
        this.stopHighlight();
        if (this.scaleAnimation) this.scaleAnimation.cancel();

        if (!this.dragged) {
            const view = this.stage.getView(this.topNode);
            if (view && view.onclick) {
                view.onclick();
            }
        }
        else if (this.isExpr) {
            // Clear any feedback messages
            this.stage.feedback.clear();
        }

        if (this.stage.alreadyWon) return;

        if (this.isExpr && this.topNode) {
            const view = this.stage.getView(this.topNode);
            view.scale = { x: 1, y: 1 };
            const cp = gfxCore.centerPos(view);
            view.anchor = { x: 0.5, y: 0.5 };
            view.pos = cp;
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
        else if (mousePos.sidebar && this.isExpr && this.stage.dropDefines(this.topNode)) {
            // Drop definitions in sidebar to activate them
        }
        else if (this.isExpr && this.dragged && this.hoverNode &&
                 this.stage.semantics.droppable(state, this.topNode, this.hoverNode) === "hole") {
            // Drag something into hole

            if (this.fromToolbox) this.useToolboxItem();

            Audio.play("pop");
            this.stage.reductToolbar.update(null, this.topNode);
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
                animate.fx.error(this.stage, this.stage.getView(this.topNode));
                this.stage.feedback.update("#000", [ "We can't put things back in the toolbox!" ]);
            }
            this.stage.bumpAwayFromEdges(this.topNode);
            this.stage.views[this.topNode].opacity = 1.0;
        }

        this.findHoverNode(mousePos);
    }
}
