export function decal(projection) {
    const origPrepare = projection.prepare;
    const origDraw = projection.draw;

    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        origDraw.call(this, id, exprId, state, stage, offset);
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
        }
    }

    return projection;
}
