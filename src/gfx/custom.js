/**
 * Custom views for specific expressions.
 */

import * as gfx from "./core";
import * as animate from "./animate";
import * as primitive from "./primitive";
import * as util from "./util";
import * as random from "../util/random";

export function argumentBar() {
    const projection = gfx.baseProjection();
    projection.type = "custom/argumentBar";

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
            const params = Array.isArray(define.get("params")) ?
                  define.get("params") :
                  state.getIn([ "nodes", state.getIn([ "globals", define.get("name") ]), "params" ]);

            let maxY = 50;
            for (const name of params) {
                const subexprField = `arg_${name}`;
                if (define.get(subexprField)) {
                    const subexprId = define.get(subexprField);
                    const childProjection = stage.getView(subexprId);
                    childProjection.parent = this;
                    childProjection.pos.x = this.size.w;
                    childProjection.pos.y = 0;
                    childProjection.anchor.x = 0;
                    childProjection.anchor.y = 0;
                    // TODO: use subexpScale
                    childProjection.scale.x = 0.85;
                    childProjection.scale.y = 0.85;

                    childProjection.prepare(subexprId, subexprId, state, stage);
                    // TODO: use padding
                    this.size.w += (childProjection.size.w * childProjection.scale.x) + 20;
                    maxY = Math.max(maxY, childProjection.size.h * childProjection.scale.y);
                    this.names.push([ null, subexprId ]);
                }
                else {
                    txt.text = name;
                    txt.prepare(null, null, state, stage);
                    const size = txt.size.w;
                    this.names.push([ name, size ]);
                    this.size.w += Math.max(size, 40) + 20;
                }
            }

            this.size.h = maxY;

            for (const name of params) {
                const subexprField = `arg_${name}`;
                if (define.get(subexprField)) {
                    const subexprId = define.get(subexprField);
                    const childProjection = stage.getView(subexprId);
                    childProjection.pos.y = (this.size.h - (childProjection.size.h * childProjection.scale.y)) / 2;
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

        gfx.debugDraw(ctx, this, offset);
        ctx.restore();
    };

    projection.children = function* (exprId, state) {
        const expr = state.getIn([ "nodes", exprId ]);
        if (expr.get("type") === "define") return;

        let params = expr.get("params");

        if (!params) {
            params = state.getIn([
                "nodes",
                state.getIn([ "globals", expr.get("name") ]),
                "params",
            ]);
        }

        if (!params) return;

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

export function fadeMe(projection, onfade) {
    const origDraw = projection.draw;

    const stars = [];
    const size = gfx.absoluteSize(projection);
    const count = Math.min(100, 30 * (size.w / 50));
    for (let i = 0; i < count; i++) {
        stars.push({
            dx: Math.random() - 0.5,
            dy: Math.random() - 0.5,
            r: random.getRandInt(2, 8),
            opacity: 1.0,
            deltaOpacity: -Math.max(3 * Math.random(), 0.8),
        });
    }

    const tween = animate.infinite((dt) => {
        for (const star of stars) {
            star.opacity += star.deltaOpacity * (dt / 1000);
            if (star.opacity <= 0) {
                star.opacity = 1.0;
                star.deltaOpacity = -Math.max(3 * Math.random(), 0.8);
                star.dx = Math.random() - 0.5;
                star.dy = Math.random() - 0.5;
            }
        }
    });

    projection.onmouseenter = function() {
        onfade(tween);
    };

    projection.draw = function(id, exprId, state, stage, offset) {
        origDraw.call(this, id, exprId, state, stage, offset);

        const { x, y } = util.topLeftPos(this, offset);
        const [ sx, sy ] = util.absoluteScale(projection, offset);

        const { ctx } = stage;
        ctx.save();

        for (const star of stars) {
            ctx.globalAlpha = offset.opacity * star.opacity * this.opacity;
            ctx.fillStyle = "#000";
            primitive.drawStar(
                ctx,
                x + (sx * (this.size.w / 2)) + (this.size.w * sx * 1.2 * star.dx),
                y + (sy * (this.size.h / 2)) + (this.size.h * sy * 1.2 * star.dy),
                5,
                star.r / 2,
                star.r,
                true
            );
            ctx.fillStyle = "#0F0";
            primitive.drawStar(
                ctx,
                x + (sx * (this.size.w / 2)) + (this.size.w * sx * 1.2 * star.dx),
                y + (sy * (this.size.h / 2)) + (this.size.h * sy * 1.2 * star.dy),
                5,
                star.r / 2,
                star.r,
                true
            );
        }
        ctx.restore();
    };

    return projection;
}
