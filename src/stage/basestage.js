/**
 * Handle drawing responsibilites for Reduct.
 * @module BaseStage
 */
import * as gfxCore from "../gfx/core";
import { nextId } from "../reducer/reducer";

import TouchRecord from "./touchrecord";

export default class BaseStage {
    constructor(canvas, width, height, store, views, semantics) {
        /** The Redux store. */
        this.store = store;
        /** A dictionary of view ID to view object. */
        this.views = views;
        /**
         * A set of views.
         * @deprecated
         */
        this.internalViews = {};
        /** The semantics module. */
        this.semantics = semantics;

        this.effects = {};

        this._width = width;
        this._height = height;

        this.canvas = canvas;
        this.canvas.setAttribute("width", this.width);
        this.canvas.setAttribute("height", this.height);

        /** The canvas drawing context. */
        this.ctx = this.canvas.getContext("2d");

        this.computeDimensions();

        /** The background color. */
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

    /**
     * The TouchRecord class to use for touch/mouse events. Override
     * to customize input handling.
     * @member
     */
    get touchRecordClass() {
        return TouchRecord;
    }

    /** Compute and resize the canvas when the window is resized. */
    computeDimensions() {
        this.ctx.scale(1.0, 1.0);
        this._height = window.innerHeight - document.querySelector("#nav").offsetHeight;
        if (gfxCore.viewport.IS_PHONE) {
            this._width = window.innerWidth * 0.75;
            this._height *= 0.75;
        }
        else if (gfxCore.viewport.IS_TABLET) {
            this._width = window.innerWidth;
        }
        else {
            this._width = Math.max(window.innerWidth, 1200);
            this._height = Math.max(this._height, 600);
        }
        this.canvas.setAttribute("width", this._width);
        this.canvas.setAttribute("height", this._height);
    }

    /**
     * The usable width of the stage. (Things like the sidebar can
     * change this.)
     * @member
     */
    get width() {
        return this._width;
    }

    /**
     * The usable width of the stage. (Things like the sidebar can
     * change this.)
     * @member
     */
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

    /**
     * @deprecated Use :func:`allocate` instead.
     */
    allocateInternal(projection) {
        const id = nextId();
        this.internalViews[id] = projection;
        return id;
    }

    /**
     * Get the view with the given ID.
     */
    getView(id) {
        return this.views[id] || this.internalViews[id];
    }

    /**
     * Convert a mouse/touch event into an { x, y } position,
     * accounting for scaling.
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Scaling
        const x = ((e.clientX - rect.left) / rect.width) * this._width;
        const y = ((e.clientY - rect.top) / rect.height) * this.height;
        return { x, y };
    }

    /**
     * Given a rectangular area, move it minimally to fit within the
     * stage bounds.
     */
    findSafePosition(x, y, w, h) {
        const MARGIN = 25;
        const minX = MARGIN;
        const maxX = this.width - MARGIN - w;
        const minY = 100 + MARGIN;
        // Extra margin on bottom to account for feedback message
        const maxY = this.height - this.toolbox.size.h - (3 * MARGIN) - h;

        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));

        return { x, y };
    }

    /**
     * Get the current Redux state.
     */
    getState() {
        return this.store.getState().getIn([ "program", "$present" ]);
    }

    /**
     * Create a basic offset object for rendering.
     */
    makeBaseOffset(opt={}) {
        return Object.assign({
            x: 0,
            y: 0,
            sx: 1,
            sy: 1,
            opacity: 1,
        }, opt);
    }

    /** Helper to draw a given view. */
    drawProjection(state, nodeId, offset=null) {
        const projection = this.views[nodeId];
        // TODO: autoresizing
        projection.parent = null;
        projection.prepare(nodeId, nodeId, state, this);
        projection.draw(nodeId, nodeId, state, this, offset || this.makeBaseOffset());
    }

    /** @deprecated Use :func:`BaseStage.drawProjection` instead. */
    drawInternalProjection(state, nodeId, exprId=null, offset=null) {
        const projection = this.internalViews[nodeId];
        projection.parent = null;
        projection.prepare(nodeId, exprId, state, this);
        projection.draw(nodeId, exprId, state, this, offset || this.makeBaseOffset());
    }

    /** Draw the contents of the stage. Override to customize. */
    drawContents() {
    }

    drawImpl() {
        this.drawContents();

        this._redrawPending = false;
    }

    /**
     * Request that the stage be redrawn. (Multiple calls have no
     * effect if no redraw happens in between.)
     */
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

    computeDragAnchor(pos, topNode, targetNode) {
        const dragAnchor = { x: 0, y: 0 };
        if (targetNode !== null) {
            const view = this.getView(topNode);
            const absPos = gfxCore.absolutePos(view);
            const absSize = gfxCore.absoluteSize(view);
            dragAnchor.x = (pos.x - absPos.x) / absSize.w;
            dragAnchor.y = (pos.y - absPos.y) / absSize.h;
        }
        return dragAnchor;
    }

    /**
     * Add an effect to the stage.
     */
    addEffect(fx) {
        const id = nextId();
        this.effects[id] = fx;
        return id;
    }

    removeEffect(id) {
        delete this.effects[id];
        this.draw();
    }

    /**
     * Check whether the given view ID is selected by any touch/mouse.
     */
    isSelected(id) {
        if (id === null) return false;

        for (const touch of this._touches.values()) {
            if (touch.targetNode === id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check whether the given view ID is hovered by any touch/mouse.
     */
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

    /** Set the mouse cursor. */
    setCursor(cursor) {
        // Try fallbacks because Chrome (e.g. -webkit-grab is recognized, but not grab)
        this.canvas.style.cursor = `-moz-${cursor}`;
        this.canvas.style.cursor = `-webkit-${cursor}`;
        this.canvas.style.cursor = cursor;
    }

    /** Update the cursor based on the mouse/touch state. */
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
            const node = this.getState().getIn([ "nodes", touchRecord.hoverNode ]);
            const view = this.getView(touchRecord.hoverNode);
            if (view && view.onmousedown && (typeof view.enabled === "undefined" || view.enabled)) {
                this.setCursor("pointer");
            }
            else if (node && this.semantics.kind(node) === "expression") {
                this.setCursor("pointer");
            }
            else if (node) {
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

            const dragAnchor = this.computeDragAnchor(pos, topNode, targetNode);

            const touchRecord = new (this.touchRecordClass)(
                this,
                topNode,
                targetNode,
                fromToolbox,
                dragAnchor,
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

        const dragAnchor = this.computeDragAnchor(pos, topNode, targetNode);

        const touch = this._touches.get("mouse");
        touch.reset();
        touch.topNode = topNode;
        touch.targetNode = targetNode;
        touch.fromToolbox = fromToolbox;
        touch.dragAnchor = dragAnchor;
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
