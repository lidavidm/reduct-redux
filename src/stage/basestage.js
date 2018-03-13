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

        this._width = width;
        this._height = height;

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
        this._height = window.innerHeight - 40;
        if (window.matchMedia("only screen and (max-device-width: 812px) and (-webkit-min-device-pixel-ratio: 1.5)").matches) {
            this._width = window.innerWidth - 150;
        }
        else if (window.matchMedia("only screen and (max-device-width: 1366px) and (-webkit-min-device-pixel-ratio: 1.5)").matches) {
            this._width = 0.9 * window.innerWidth;
        }
        else {
            this._width = Math.max(window.innerWidth, 1200);
            this._height = Math.max(this._height, 600);
        }
        this.canvas.setAttribute("width", this._width);
        this.canvas.setAttribute("height", this._height);
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
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

    getView(id) {
        return this.views[id] || this.internalViews[id];
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

    drawProjection(state, nodeId, offset=null) {
        const projection = this.views[nodeId];
        // TODO: autoresizing
        projection.parent = null;
        projection.prepare(nodeId, nodeId, state, this);
        projection.draw(nodeId, nodeId, state, this, offset || {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
            opacity: 1,
        });
    }

    drawInternalProjection(state, nodeId, exprId=null, offset=null) {
        const projection = this.internalViews[nodeId];
        projection.parent = null;
        projection.prepare(nodeId, exprId, state, this);
        projection.draw(nodeId, exprId, state, this, offset || {
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
            opacity: 1,
        });
    }

    drawContents() {
    }

    drawImpl() {
        this.drawContents();

        this._redrawPending = false;
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
        return [ null, null ];
    }

    computeDragOffset(pos, topNode, targetNode) {
        const dragOffset = { dx: 0, dy: 0 };
        if (targetNode !== null) {
            const absPos = gfxCore.absolutePos(this.views[topNode] || this.internalViews[topNode]);
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
        if (id === null) return false;

        for (const touch of this._touches.values()) {
            if (touch.targetNode === id) {
                return true;
            }
        }
        return false;
    }

    isHovered(id) {
        if (id === null) return false;

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
        if (moved &&
            touchRecord.isExpr &&
            touchRecord.topNode !== null &&
            touchRecord.hoverNode !== null) {
            this.setCursor("copy");
        }
        else if (touchRecord.topNode !== null) {
            if (touchRecord.isExpr) {
                this.setCursor("grabbing");
            }
        }
        else if (touchRecord.hoverNode !== null) {
            if (this.getState().getIn([ "nodes", touchRecord.hoverNode, "complete" ])) {
                this.setCursor("pointer");
            }
            else if (touchRecord.isExpr) {
                this.setCursor("grab");
            }
            else {
                this.setCursor("pointer");
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

            const touchRecord = new (this.touchRecordClass)(
                this,
                topNode,
                targetNode,
                fromToolbox,
                dragOffset,
                pos
            );
            touchRecord.onstart(pos);
            this._touches.set(touch.identifier, touchRecord);
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
        touch.onstart(pos);

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
