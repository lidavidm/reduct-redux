import * as gfx from "./core";

import Audio from "../resource/audio";

export function button(stage, label, options) {
    if (typeof label === "string") {
        label = gfx.constant(stage.allocate(gfx.text(label, {
            fontSize: 32,
            color: "#FFF",
        })));
    }
    const projection = gfx.layout.hbox(label, Object.assign({
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
    }, options));

    projection.onclick = function() {
        this.shadow = true;
        this.offset.y -= 3;

        Audio.play("convert");
        if (options.click) options.click();
    };

    projection.onmousedown = function() {
        this.shadow = false;
        this.offset.y += 3;
    };

    return projection;
}

export function imageButton(images, options={}) {
    const projection = gfx.baseProjection(Object.assign({}, {
        enabled: true,
    }, options));

    const sprites = {
        normal: gfx.sprite({ image: images.normal }),
        hover: gfx.sprite({ image: images.hover }),
        active: gfx.sprite({ image: images.active }),
    };

    projection.size = Object.assign({}, {
        w: images.normal.naturalWidth,
        h: images.normal.naturalHeight,
    }, options.size || {});

    let state = "normal";

    projection.onclick = function() {
        if (!this.enabled) {
            state = "normal";
            return;
        }
        Audio.play("convert");
        if (options.click) options.click();
        state = "normal";
    };

    projection.onmousedown = function() {
        if (!this.enabled) {
            state = "normal";
            return;
        }
        state = "active";
    };

    projection.onmouseenter = function() {
        if (!this.enabled) {
            state = "normal";
            return;
        }
        state = "hover";
    };

    projection.onmouseexit = function() {
        if (!this.enabled) {
            state = "normal";
            return;
        }
        state = "normal";
    };

    projection.draw = function(id, exprId, boardState, stage, offset) {
        sprites[state].draw.call(this, id, exprId, boardState, stage, Object.assign({}, offset, {
            opacity: offset.opacity * (this.enabled ? 1 : 0.3),
        }));
    };

    projection.highlight = function() {
        if (!this.enabled) {
            state = "normal";
            return;
        }

        state = "hover";
    };

    return projection;
}
