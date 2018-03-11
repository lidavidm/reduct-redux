/**
 * Custom views for specific expressions.
 */

import * as gfx from "./core";
import * as primitive from "./primitive";
import * as util from "./util";

export function argumentBar() {
    const projection = gfx.baseProjection();

    const txt = gfx.text("", {
        color: "#888",
    });

    projection.prepare = function(id, exprId, state, stage) {
        this.names = [];
        this.size = { w: 0, h: 50 };

        const define = state.getIn([ "nodes", exprId ]);

        if (define.get("type") === "define" && define.get("params") === "dynamic") {
            // let body = state.getIn([ "nodes", define.get("body") ]);
            // while (body.get("type") === "lambda") {
            //     const name = state.getIn([ "nodes", body.get("arg"), "name" ]);
            //     txt.text = name;
            //     txt.prepare(null, null, state, stage);
            //     const size = Math.max(txt.size.w, 40);
            //     this.names.push([ name, size + 10 ]);
            //     this.size.w += size + 20;
            //     body = state.getIn([ "nodes", body.get("body") ]);
            // }

            throw "Dynamic parameter lists are unimplemented.";
        }
        else {
            this.names = [];
            const params = define.get("type") === "define" ?
                  define.get("params") :
                  state.getIn([ "nodes", state.getIn([ "globals", define.get("name") ]), "params" ]);

            for (const name of params) {
                const subexprField = `arg_${name}`;
                if (define.get(subexprField)) {
                    const subexprId = define.get(subexprField);
                    const childProjection = stage.getView(subexprId);
                    childProjection.parent = this;
                    childProjection.pos.x = this.size.w;
                    childProjection.anchor.x = 0;
                    childProjection.anchor.y = 0;
                    // TODO: use subexpScale
                    childProjection.scale.x = 0.85;
                    childProjection.scale.y = 0.85;

                    childProjection.prepare(subexprId, subexprId, state, stage);
                    // TODO: use padding
                    this.size.w += (childProjection.size.w * childProjection.scale.x) + 20;
                    this.names.push([ null, subexprId ]);
                    childProjection.pos.y = (this.size.h - childProjection.size.h * childProjection.scale.y) / 2;
                }
                else {
                    txt.text = name;
                    txt.prepare(null, null, state, stage);
                    const size = txt.size.w;
                    this.names.push([ name, size ]);
                    this.size.w += Math.max(size, 40) + 20;
                }
            }
        }

        this.size.w = Math.max(0, this.size.w - 20);
    };
    projection.draw = function(id, exprId, state, stage, offset) {
        const { ctx } = stage;
        ctx.save();

        const [ sx, sy ] = util.absoluteScale(this, offset);
        const { x, y } = util.topLeftPos(this, offset);

        util.setOpacity(ctx, this.opacity, offset);

        const h = sy * (this.size.h - 10);

        const dy = sy * 5;
        let dx = 0;
        for (const [ name, width ] of this.names) {
            if (name === null) {
                const subexprId = width;
                const subOffset = Object.assign({}, offset, {
                    x,
                    y,
                    sx: offset.sx * this.scale.x,
                    sy: offset.sy * this.scale.y,
                    opacity: this.opacity * offset.opacity,
                });

                stage.getView(subexprId).draw(subexprId, subexprId, state, stage, subOffset);
            }
            else {
                const w = sx * Math.max(width, 40);
                ctx.fillStyle = "#000";
                primitive.roundRect(
                    ctx,
                    x + dx, y + (dy - 3), w, h,
                    sx * 22,
                    true,
                    false,
                    1.0,
                    null
                );

                ctx.fillStyle = "#555";
                primitive.roundRect(
                    ctx,
                    x + dx, y + dy, w, h,
                    sx * 22,
                    true,
                    false,
                    1.0,
                    null
                );

                txt.text = name;
                txt.draw(null, null, state, stage, Object.assign({}, offset, {
                    x: x + dx + Math.max(0, (w - width) / 2),
                    y: y + (5 * offset.sy),
                    sx,
                    sy,
                }));

                dx += w + (20 * sx);
            }
        }

        ctx.restore();
    };

    projection.children = function* (exprId, state) {
        const expr = state.getIn([ "nodes", exprId ]);
        if (expr.get("type") === "define") return;
        const params = state.getIn([
            "nodes",
            state.getIn([ "globals", expr.get("name") ]),
            "params",
        ]);

        for (const name of params) {
            const subexprField = `arg_${name}`;
            if (expr.get(subexprField)) {
                const child = expr.get(subexprField);
                yield [ child, child ];
            }
        }
    };
    return projection;
}
