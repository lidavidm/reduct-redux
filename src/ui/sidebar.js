import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";

import Loader from "../loader";

export default class Sidebar {
    constructor(stage) {
        this.stage = stage;

        this.viewMap = new Map();

        const gradient = stage.ctx.createLinearGradient(0, 0, 15, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "#594764");
        this.gradient = gradient;
    }

    startLevel(state) {
        // Only show globals if they have a reference on the board
        const nodes = state.get("nodes");
        const globals = state.get("globals");

        const names = new Set();

        for (const id of state.get("toolbox").concat(state.get("board"))) {
            this.stage.semantics.search(nodes, id, (_, nid) => {
                const expr = nodes.get(nid);
                if (expr.get("type") === "reference" && globals.has(expr.get("name"))) {
                    names.add(expr.get("name"));
                }
            });
        }

        for (const name of names) {
            this.viewMap.set(name, this.project(state, name, globals.get(name)));
        }

        return names.size;
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

        for (const [ key ] of state.get("globals")) {
            if (!this.viewMap.has(key)) {
                continue;
            }
            const viewId = this.viewMap.get(key);
            this.stage.drawProjection(state, viewId, offset);
            offset.y += gfx.absoluteSize(this.stage.views[viewId]).h + 10;
        }

        ctx.translate(sidebarWidth - 15, 0);
        ctx.fillStyle = this.gradient;
        ctx.fillRect(0, 0, 15, this.stage.height);

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
                    padding: {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        inner: 0,
                    },
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
