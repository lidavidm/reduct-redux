/**
 * Handle input for Reduct.
 * @module BaseTouchRecord
 */
export default class BaseTouchRecord {
    constructor(stage, topNode, targetNode, fromToolbox, dragAnchor, dragStart) {
        /**
         * The current stage.
         */
        this.stage = stage;
        /**
         * The top-level view ID that was clicked (if any).
         */
        this.topNode = topNode;
        /**
         * The targeted view ID that was clicked (if any). This may be
         * the same as the top-level view. The Stage controls how
         * these work.
         */
        this.targetNode = targetNode;
        /**
         * A flag indicating whether the selected view came from the
         * toolbox.
         * @type boolean
         */
        this.fromToolbox = fromToolbox;
        this.dragAnchor = dragAnchor;
        this.dragStart = dragStart;
        /**
         * A flag indicating whether the user has dragged the selected
         * view yet.
         */
        this.dragged = false;
        /**
         * The ID of the view currently under the mouse (if any).
         */
        this.hoverNode = null;
        /**
         * The ID of the view previously under the mouse (if any).
         */
        this.prevHoverNode = null;
        /**
         * A flag indicating whether the selected view belongs to an
         * expression.
         */
        this.isExpr = false;
        this.currTime = Date.now();
    }

    /**
     * Helper method to find the view under the current mouse
     * position. Defers to :func:`BaseStage.getNodeAtPos`, but also
     * tracks the previously hovered node (for things like mouse
     * enter/exit events).
     * @see module:BaseTouchRecord.hoverNode
     * @see module:BaseTouchRecord.prevHoverNode
     */
    findHoverNode(pos) {
        const before = this.hoverNode;
        this.prevHoverNode = before;
        const [ _, target ] = this.stage.getNodeAtPos(pos, this.topNode);
        this.hoverNode = target;
        this.hoverSidebar = pos.sidebar;
        this.stage.draw();
    }

    /**
     * Called when the mouse is pressed.
     */
    onstart(mousePos) {
        this.currTime = Date.now();
    }

    /**
     * Called when the mouse is moved.
     * @param mouseDown - whether the mouse was pressed
     * @param mousePos
     */
    onmove(mouseDown, mousePos) {
        this.findHoverNode(mousePos);
    }

    /**
     * Called when the mouse is released.
     */
    onend(state, mousePos) {
        this.findHoverNode(mousePos);
    }

    /**
     * Reset this TouchRecord. (The record for the mouse is not
     * recreated, as it can have move events with not pressed.)
     */
    reset() {
        this.topNode = null;
        this.hoverNode = null;
        this.prevHoverNode = null;
        this.targetNode = null;
        this.dragged = false;
        this.fromToolbox = false;
        this.isExpr = false;
        this.currTime = Date.now();
    }
}
