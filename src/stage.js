export class Stage {
    constructor(width, height) {
        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute("width", width);
        this.canvas.setAttribute("height", height);
        this.ctx = this.canvas.getContext("2d");

        this.color = "#EEEEEE";

        this._redrawPending = false;
    }

    get view() {
        return this.canvas;
    }

    drawImpl() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        if (this._redrawPending) return;
        this._redrawPending = true;
        window.requestAnimationFrame(() => {
            this.drawImpl();
        });
    }
}
