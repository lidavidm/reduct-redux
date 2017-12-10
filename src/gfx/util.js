export function absoluteScale(projection, offset) {
    return [
        projection.scale.x * offset.sx,
        projection.scale.y * offset.sy,
    ];
}
