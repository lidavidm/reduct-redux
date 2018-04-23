import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as progression from "../game/progression";

import Loader from "../loader";

export default class Sidebar {
    constructor(stage) {
        this.stage = stage;

        this.viewMap = new Map();
        this.fullWidth = 250;

        this._tween = null;
        this.status = "closed";

        const gradient = stage.ctx.createLinearGradient(0, 0, 15, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "#594764");
        this.gradient = gradient;

        this.showing = false;
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
        const viewId = this.project(state, name, state.getIn([ "globals", name ]));
        animate.fx.blink(this.stage, this.stage.getView(viewId), {
            times: 2,
            color: "magenta",
            speed: 100,
            lineWidth: 5,
        });
        this.viewMap.set(name, viewId);
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
            this._tween = animate.tween(this.stage, { sidebarWidth: 250 }, {
                duration: 500,
                easing: animate.Easing.Cubic.Out,
            });
        }
    }

    drawImpl(state) {
        const { ctx, sidebarWidth } = this.stage;
        ctx.save();

        ctx.fillStyle = "#594764";
        ctx.fillRect(0, 0, sidebarWidth, this.stage.height);

        const offset = this.stage.makeBaseOffset();

        let curY = 10;

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
