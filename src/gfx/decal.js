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

        let firstFilled = false;
        let lastFilled = false;

        const nodes = state.get("nodes");
        for (const [ childId, subexprId ] of this.children(exprId, state)) {
            const view = stage.views[childId];
            const subexpr = nodes.get(subexprId);
            if (first) {
                first = false;
                firstFilled = subexpr.get("type") !== "missing";
                firstChild.x = view.pos.x;
                firstChild.y = view.pos.y;
                if (subexpr.get("type") === "lambda") {
                    const [ argChildId ] = stage.views[childId]
                          .children(subexprId, state)
                          .next().value;
                    const argView = stage.views[argChildId];
                    firstChild.x += argView.pos.x + ((argView.scale.x * argView.size.w) / 2);
                    firstChild.y += argView.pos.y + (argView.scale.y * argView.size.h * 0.2);
                }
                else {
                    firstChild.x += view.scale.x * view.size.w * 0.2;
                }
            }

            if (subexpr && subexpr.get("parentField") === "argument") {
                lastFilled = subexpr.get("type") !== "missing";
                lastChild.x = view.pos.x + (view.size.w / 2);
                lastChild.y = view.pos.y;
            }
        }

        const { ctx } = stage;
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#971a1e";
        ctx.beginPath();

        const { x, y } = util.topLeftPos(this, offset);
        const [ sx, sy ] = util.absoluteScale(this, offset);

        const gradient = ctx.createLinearGradient(
            x + (sx * lastChild.x), y + (sy * lastChild.y),
            x + (sx * firstChild.x), y + (sy * firstChild.y)
        );
        gradient.addColorStop(0, lastFilled ? "#14818b" : "gray");
        gradient.addColorStop(0.7, (firstFilled && lastFilled) ? "#c500ff" : "gray");
        gradient.addColorStop(1, firstFilled ? "#ff004b" : "gray");
        ctx.fillStyle = gradient;

        if (this.opacity) ctx.globalAlpha = this.opacity;
        if (typeof this.arrowOpacity !== "undefined") ctx.globalAlpha = this.arrowOpacity;

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
        ctx.restore();
    };

    return projection;
}
