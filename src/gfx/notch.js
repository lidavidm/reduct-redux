export class NotchSet {
    constructor(notches) {
        this.notches = notches;
    }

    drawSequence(ctx, side, x, y, len) {
        const notches = this.notches
              .filter(n => n.side === side)
              .sort((a, b) => a.relpos - b.relpos);
        if (side === "left" || side === "right") {
            notches.forEach(n => n.drawVertical(ctx, x, y, len));
        }
        else {
            notches.forEach(n => n.drawHorizontal(ctx, x, y, len));
        }
    }
}

export class Notch {
    constructor(side, shape, width, depth, relpos, inner) {
        this.side = side;
        this.shape = shape;
        this.width = width;
        this.depth = depth;
        this.inner = inner;
        this.relpos = relpos;
    }

    get direction() {
        if (this.side === "left" || this.side === "bottom") {
            return -1;
        }
        return 1;
    }

    drawVertical(ctx, x, y, h, dir=null) {
        if (!dir) dir = this.direction;
        const relpos = this.relpos;
        const facing = this.inner ? 1 : -1;
        ctx.lineTo(x, y + dir * (h * relpos - this.width));
        ctx.lineTo(x - facing * dir * this.depth, y + dir * h * relpos);
        ctx.lineTo(x, y + dir * (h * relpos + this.width));
    }

    drawHorizontal(ctx, x, y, w, dir=null) {
        if (!dir) dir = this.direction;
        let relpos = this.relpos;
        let facing = this.inner ? 1 : -1;
        ctx.lineTo(x + dir * (w * relpos - this.width), y);
        ctx.lineTo(x + dir * (w * relpos), y + facing * dir * this.depth);
        ctx.lineTo(x + dir * (w * relpos + this.width), y);
    }
}

export function parseDescription(description) {
    let relpos = 0.5;
    if (typeof description.relpos !== "undefined") {
        relpos = description.relpos;
    }
    return new Notch(description.side, description.shape, 10, 10, relpos, description.type === "inset");
}

export function parseDescriptions(descriptions) {
    return new NotchSet(descriptions.map(parseDescription));
}
