import * as gfx from "./core";

export function button(stage, label, handlers) {
    if (typeof label === "string") {
        label = gfx.constant(stage.allocate(gfx.text(label, {
            fontSize: 32,
            color: "#FFF",
        })));
    }
    const projection = gfx.layout.hbox(label, {
        color: "lightblue",
        padding: {
            left: 20,
            right: 20,
            inner: 10,
        },
        size: {
            w: 50,
            h: 70,
        },
        anchor: {
            x: 0.5,
            y: 0.5,
        },
        shadow: true,
        shadowColor: "black",
    });

    projection.onclick = function() {
        this.shadow = true;
        this.pos.y -= 3;

        if (handlers.click) handlers.click();
    };

    projection.onmousedown = function() {
        this.shadow = false;
        this.pos.y += 3;
    };

    return projection;
}
