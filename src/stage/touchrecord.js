export default class BaseTouchRecord {
    constructor(stage, topNode, targetNode, fromToolbox, dragOffset, dragStart) {
        this.stage = stage;
        this.topNode = topNode;
        this.targetNode = targetNode;
        this.fromToolbox = fromToolbox;
        this.dragOffset = dragOffset;
        this.dragStart = dragStart;
        this.dragged = false;
        this.hoverNode = null;
        this.prevHoverNode = null;
        this.isExpr = false;
        this.currTime = Date.now();
    }

    findHoverNode(pos) {
        const before = this.hoverNode;
        this.prevHoverNode = before;
        const [ _, target ] = this.stage.getNodeAtPos(pos, this.topNode);
        this.hoverNode = target;
        this.stage.draw();
    }

    onstart() {
        this.currTime = Date.now();
    }

    onmove(mouseDown, mousePos) {
        this.findHoverNode(mousePos);
    }

    onend(state, mousePos) {
        this.findHoverNode(mousePos);
    }

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
