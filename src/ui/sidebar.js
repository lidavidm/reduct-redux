import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";

import Loader from "../loader";

export default class Sidebar {
    constructor(stage) {
        this.stage = stage;

        this.viewMap = new Map();
    }

    drawImpl(state) {
        const { ctx, sidebarWidth } = this.stage;
        ctx.save();

        ctx.fillStyle = "#594764";
        ctx.fillRect(0, 0, sidebarWidth, this.stage.height);

        const offset = {
            x: 10,
            y: 10,
            sx: 1,
            sy: 1,
            opacity: 1,
        };

        for (const [ key, id ] of state.get("globals")) {
            if (!this.viewMap.has(key)) {
                this.viewMap.set(key, this.project(state, key, id));
            }
            const viewId = this.viewMap.get(key);
            this.stage.drawProjection(state, viewId, offset);
            offset.y += gfx.absoluteSize(this.stage.views[viewId]).h + 10;
        }

        ctx.restore();
    }

    project(state, name, id) {
        const nodes = state.get("nodes");

        let result = null;
        const queue = [ id ];
        while (queue.length > 0) {
            const subId = queue.pop();
            if (result === null) result = subId;
            const expr = nodes.get(subId);

            this.stage.views[subId] = this.stage.semantics.project(this.stage, nodes, expr);

            for (const field of this.stage.semantics.subexpressions(expr)) {
                queue.push(expr.get(field));
            }
        }

        this.stage.views[result].shadow = false;
        this.stage.views[result].stroke = { lineWidth: 1, color: "gray" };

        return this.stage.allocate(gfx.layout.vbox(gfx.constant(
            this.stage.allocate(gfx.layout.hbox(
                gfx.constant(this.stage.allocate(gfx.text(`def ${name}`))),
                {
                    radius: 0,
                    padding: {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        inner: 15,
                    },
                    color: "salmon",
                    stroke: {
                        lineWidth: 0,
                        color: "rgba(0,0,0,0)",
                    },
                    subexpScale: 1.0,
                }
            )),
            this.stage.allocate(gfx.layout.hbox(
                gfx.constant(
                    this.stage.allocate(gfx.text("    ")),
                    id
                ),
                {
                    subexpScale: 1.0,
                },
                gfx.baseProjection
            ))
        ), {
            color: "OrangeRed",
            padding: {
                top: 10,
                left: 15,
                inner: 5,
                right: 10,
                bottom: 10,
            },
            horizontalAlign: 0,
            shadow: true,
        }));
    }
}
