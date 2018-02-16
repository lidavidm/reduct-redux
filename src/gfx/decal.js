import * as util from "./util";

export default function decal(projection) {
    const origPrepare = projection.prepare;
    const origDraw = projection.draw;

    projection.prepare = function(id, exprId, state, stage) {
        origPrepare.call(this, id, exprId, state, stage);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        origDraw.call(this, id, exprId, state, stage, offset);

        const firstChild = { x: 0, y: 0 };
        const lastChild = { x: 0, y: 0 };
        let first = true;

        const nodes = state.get("nodes");
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const view = stage.views[childId];
            if (first) {
                first = false;
                firstChild.x = view.pos.x;
                firstChild.y = view.pos.y;
            }

            const subexpr = nodes.get(subexprId);
            if (subexpr && subexpr.get("parentField") === "argument") {
                lastChild.x = view.pos.x + (view.size.w / 2);
                lastChild.y = view.pos.y;
            }
        }

        const { ctx } = stage;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#971a1e";
        ctx.beginPath();

        const { x, y } = util.topLeftPos(this, offset);
        const [ sx, sy ] = util.absoluteScale(this, offset);

        const gradient = ctx.createLinearGradient(
            x + (sx * lastChild.x), y + (sy * lastChild.y),
            x + (sx * firstChild.x), y + (sy * firstChild.y)
        );
        gradient.addColorStop(0, "#14818b");
        gradient.addColorStop(0.7, "#c500ff");
        gradient.addColorStop(1, "#ff004b");
        ctx.fillStyle = gradient;

        const cx = x + (sx * ((lastChild.x - firstChild.x) / 2));
        const arrowBase = 5;
        const arrowWidth = arrowBase + 5;
        firstChild.x += 2 * arrowWidth;
        firstChild.y -= 2 * arrowWidth;
        ctx.moveTo(x + (sx * lastChild.x), y + (sy * lastChild.y));
        ctx.quadraticCurveTo(
            cx - 10,
            y - 40,
            x + (sx * (firstChild.x + arrowBase)),
            y + (sy * (firstChild.y + arrowBase))
        );
        ctx.lineTo(
            x + (sx * (firstChild.x + arrowWidth)),
            y + (sy * (firstChild.y + arrowWidth))
        );

        ctx.lineTo(
            x + (sx * (firstChild.x - (2 * arrowWidth))),
            y + (sy * (firstChild.y + (2 * arrowWidth)))
        );

        ctx.lineTo(
            x + (sx * (firstChild.x - arrowWidth)),
            y + (sy * (firstChild.y - arrowWidth))
        );
        ctx.lineTo(
            x + (sx * (firstChild.x - arrowBase)),
            y + (sy * (firstChild.y - arrowBase))
        );
        ctx.quadraticCurveTo(
            cx + 10,
            y - 50,
            x + (sx * lastChild.x),
            y + (sy * lastChild.y)
        );

        ctx.fill();
        ctx.stroke();
    };

    return projection;
}
