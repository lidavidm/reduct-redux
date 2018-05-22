import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";

import Loader from "../loader";

/**
 * Renders the definition sidebar at the left of the screen. Expects
 * support from its containing stage.
 * @module Sidebar
 */
export default class Sidebar {
    constructor(stage) {
        this.stage = stage;

        this.color = "#8ab7db";

        this.viewMap = new Map();
        this.fullWidth = 150;

        this._tween = null;
        this.status = "closed";

        const gradient = stage.ctx.createLinearGradient(0, 0, 15, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "#8ab7db");
        this.gradient = gradient;

        // Make a dashed-outline to serve as a placeholder indicator
        this.indicator = this.stage.allocate(gfx.layout.hbox(() => [], {
            notches: [{
                side: "left",
                type: "inset",
                shape: "wedge",
                relpos: 0.8,
            }],
            stroke: {
                lineWidth: 5,
                color: "#000",
                lineDash: [10, 5],
            },
            padding: {
                top: 0,
                bottom: 0,
                left: 100,
                right: 100,
            },
            color: null,
            opacity: 0,
            minHeight: 0,
        }));

        this.showing = false;
    }

    resetIndicator() {
        const indicator = this.stage.getView(this.indicator);
        if (indicator.tween) {
            indicator.tween.completed();
            indicator.tween = null;
        }
        indicator.stroke.color = "#000";
        indicator.opacity = 0;
        indicator.padding.top = 0;
        indicator.padding.bottom = 0;
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

        // Recursively add referenced names

        let newNames = names;
        let count = 0;
        while (newNames.size > 0 && count < 5) {
            const nextNames = new Set();
            for (const name of newNames) {
                const id = state.get("globals").get(name);
                this.stage.semantics.search(nodes, id, (_, nid) => {
                    const expr = nodes.get(nid);
                    if (expr.get("type") === "reference" && globals.has(expr.get("name"))) {
                        const name = expr.get("name");
                        if (!names.has(name)) {
                            names.add(name);
                            nextNames.add(name);
                        }
                    }
                });
            }
            newNames = nextNames;
            count += 1;
        }

        // TODO: don't hardcode repeat (also see stage/stage.js)
        for (const name of names) {
            if (name === "repeat") continue;
            const viewId = this.project(state, name, globals.get(name));
            this.viewMap.set(name, viewId);
        }

        this.showing = names.size > 0 ||
            state.get("board")
            .some(id => state.getIn([ "nodes", id, "type" ]) === "define");
        return this.showing;
    }

    addGlobal(state, name) {
        const nodeId = state.getIn([ "globals", name ]);
        let viewId = nodeId;
        if (this.stage.getView(nodeId)) {
            const view = this.stage.getView(viewId);
            view.anchor = { x: 0, y: 0 };
            view.pos.x += this.stage.sidebarWidth;
        }
        else {
            viewId = this.project(state, name, nodeId);
        }
        this.viewMap.set(name, viewId);
        animate.fx.blink(this.stage, this.stage.getView(viewId), {
            times: 2,
            color: "magenta",
            speed: 300,
            lineWidth: 5,
        });
    }

    toggle() {
        if (this._tween) {
            this._tween.cancel();
        }

        if (!this.showing) {
            // No entries/defines, don't appear
            this.stage.sidebarWidth = 0;
            return;
        }

        if (this.status === "closed") {
            this.status = "open";
            this._tween = animate.tween(this.stage, { sidebarWidth: this.fullWidth }, {
                duration: 500,
                easing: animate.Easing.Cubic.Out,
            });
        }
        else {
            this.status = "closed";
            this._tween = animate.tween(this.stage, { sidebarWidth: 150 }, {
                duration: 500,
                easing: animate.Easing.Cubic.Out,
            });
        }
    }

    drawImpl(state) {
        const { ctx, sidebarWidth } = this.stage;
        ctx.save();

        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, sidebarWidth, this.stage.height);

        const offset = this.stage.makeBaseOffset();

        let curY = 10;

        this.stage.getView(this.indicator).pos = {
            x: 10,
            y: curY,
        };
        this.stage.drawProjection(state, this.indicator, offset);
        curY += gfx.absoluteSize(this.stage.getView(this.indicator)).h + 10;

        for (const [ key ] of state.get("globals")) {
            if (!this.viewMap.has(key)) {
                continue;
            }
            const viewId = this.viewMap.get(key);
            const view = this.stage.views[viewId];
            view.pos.x = 10;
            view.pos.y = curY;
            this.stage.drawProjection(state, viewId, offset);
            const size = gfx.absoluteSize(view);
            curY += size.h + 10;
            this.fullWidth = Math.max(this.fullWidth, size.w + 20);
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

        return id;
    }
}
