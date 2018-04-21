import * as gfx from "./core";

export function button(stage, label, options) {
    if (typeof label === "string") {
        label = gfx.constant(stage.allocate(gfx.text(label, {
            fontSize: 32,
            color: "#FFF",
        })));
    }
    const projection = gfx.layout.hbox(label, {
        color: options.color || "lightblue",
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
        this.offset.y -= 3;

        if (options.click) options.click();
    };

    projection.onmousedown = function() {
        this.shadow = false;
        this.offset.y += 3;
    };

    return projection;
}

export function imageButton(images, handlers) {
    const projection = gfx.baseProjection();

    const sprites = {
        normal: gfx.sprite({ image: images.normal }),
        hover: gfx.sprite({ image: images.hover }),
        active: gfx.sprite({ image: images.active }),
    };

    projection.size = {
        w: images.normal.naturalWidth,
        h: images.normal.naturalHeight,
    };

    let state = "normal";

    projection.onclick = function() {
        if (handlers.click) handlers.click();
        state = "normal";
    };

    projection.onmousedown = function() {
        state = "active";
    };

    projection.onmouseenter = function() {
        state = "hover";
    };

    projection.onmouseexit = function() {
        state = "normal";
    };

    projection.draw = function(...args) {
        sprites[state].draw.apply(this, args);
    };

    projection.highlight = function() {
        state = "hover";
    };

    return projection;
}
