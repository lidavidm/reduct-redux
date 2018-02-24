import * as gfxCore from "../gfx/core";
import { nextId } from "../reducer/reducer";

import TouchRecord from "./touchrecord";

/**
 * Handle drawing responsibilites for Reduct.
 */
export default class BaseStage {
    constructor(canvas, width, height, store, views, semantics) {
        this.store = store;
        this.views = views;
        // A set of views for the toolbox, etc. that aren't cleared
        // when changing levels.
        this.internalViews = {};
        this.semantics = semantics;

        this.effects = {};

        this.width = width;
        this.height = height;

        this.canvas = canvas;
        this.canvas.setAttribute("width", this.width);
        this.canvas.setAttribute("height", this.height);

        this.ctx = this.canvas.getContext("2d");

        this.computeDimensions();

        this.color = "#EEEEEE";

        this._redrawPending = false;
        this._drawFunc = null;

        this._touches = new Map();

        this._touches.set("mouse", new (this.touchRecordClass)(
            this,
            null,
            null,
            false,
            { dx: 0, dy: 0 },
            { x: 0, y: 0 }
        ));
    }

    get touchRecordClass() {
        return TouchRecord;
    }

    computeDimensions() {
        this.ctx.scale(1.0, 1.0);
        this.height = window.innerHeight - 40;
        if (window.matchMedia("only screen and (max-device-width: 812px) and (-webkit-min-device-pixel-ratio: 1.5)").matches) {
            this.width = window.innerWidth - 150;
        }
        else if (window.matchMedia("only screen and (max-device-width: 1366px) and (-webkit-min-device-pixel-ratio: 1.5)").matches) {
            this.width = 0.9 * window.innerWidth;
        }
        else {
            this.width = Math.max(0.8 * window.innerWidth, 800);
            this.height = Math.max(this.height, 600);
        }
        this.canvas.setAttribute("width", this.width);
        this.canvas.setAttribute("height", this.height);
    }

    resize() {
        this.computeDimensions();
        this.draw();
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

        for (const nodeId of state.get("board")) {
            this.drawProjection(state, nodeId);
        }

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

        return [ root, result ];
    }

    computeDragOffset(pos, topNode, targetNode) {
        const dragOffset = { dx: 0, dy: 0 };
        if (targetNode !== null) {
            const absPos = gfxCore.absolutePos(this.views[topNode]);
            dragOffset.dx = pos.x - absPos.x;
            dragOffset.dy = pos.y - absPos.y;
        }
        return dragOffset;
    }

    addEffect(fx) {
        const id = nextId();
        this.effects[id] = fx;
        return id;
    }

    removeEffect(id) {
        delete this.effects[id];
        this.draw();
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
            // Light up topNode if hoverNode present
            if (touch.hoverNode === id || (touch.hoverNode !== null && touch.topNode === id)) {
                return true;
            }
        }
        return false;
    }

    setCursor(cursor) {
        // Try fallbacks because Chrome (e.g. -webkit-grab is recognized, but not grab)
        this.canvas.style.cursor = `-moz-${cursor}`;
        this.canvas.style.cursor = `-webkit-${cursor}`;
        this.canvas.style.cursor = cursor;
    }

    updateCursor(touchRecord, moved=false) {
        if (moved && touchRecord.topNode !== null && touchRecord.hoverNode !== null) {
            this.setCursor("copy");
        }
        else if (touchRecord.topNode !== null) {
            this.setCursor("grabbing");
        }
        else if (touchRecord.hoverNode !== null) {
            if (this.getState().getIn([ "nodes", touchRecord.hoverNode, "complete" ])) {
                this.setCursor("pointer");
            }
            else {
                this.setCursor("grab");
            }
        }
        else {
            this.setCursor("default");
        }
    }

    _touchstart(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const pos = this.getMousePos(touch);
            const [ topNode, targetNode, fromToolbox ] = this.getNodeAtPos(pos);
            if (topNode === null) continue;

            const dragOffset = this.computeDragOffset(pos, topNode, targetNode);

            this._touches.set(touch.identifier, new (this.touchRecordClass)(
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
        if (topNode === null) return null;

        const dragOffset = this.computeDragOffset(pos, topNode, targetNode);

        const touch = this._touches.get("mouse");
        touch.topNode = topNode;
        touch.targetNode = targetNode;
        touch.fromToolbox = fromToolbox;
        touch.dragOffset = dragOffset;
        touch.dragStart = pos;
        this.updateCursor(touch);

        this.draw();

        return touch;
    }

    _mousemove(e) {
        const buttons = typeof e.buttons !== "undefined" ? e.buttons : e.which;
        const mouse = this._touches.get("mouse");
        mouse.onmove(buttons > 0, this.getMousePos(e));

        this.updateCursor(mouse, true);

        this.draw();
    }

    _mouseup(e) {
        const mouse = this._touches.get("mouse");
        mouse.onend(this.getState(), this.getMousePos(e));
        mouse.reset();
        this.updateCursor(mouse);
        this.draw();
    }
}
