export function absoluteScale(projection, offset) {
    return [
        projection.scale.x * offset.sx,
        projection.scale.y * offset.sy,
    ];
}

export function topLeftPos(projection, offset) {
    const relW = projection.scale.x * projection.size.w;
    const relH = projection.scale.y * projection.size.h;
    const relX = projection.pos.x - (projection.anchor.x * relW);
    const relY = projection.pos.y - (projection.anchor.y * relH);
    return {
        x: offset.x + (relX * offset.sx),
        y: offset.y + (relY * offset.sy),
    };
}

export function genericChildrenFunc(childrenFunc) {
    return function* (exprId, state) {
        for (let childId of childrenFunc(exprId, state)) {
            // Allow childrenFunc to return [ subprojectionId,
            // subexprId ] - this allows "transparent" layouts where
            // children can project a parent expression

            let subexprId = childId;
            if (Array.isArray(childId)) {
                [ childId, subexprId ] = childId;
            }
            yield [ childId, subexprId ];
        }
    };
}
