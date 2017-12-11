import * as gfx from "./gfx/core";

export class Loader {
    constructor(root) {
        this.rootPath = root;
        this.graphicsPath = root + "/graphics/";
        this.pending = this.loaded = 0;

        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
        });

        this.images = {};
    }

    get finished() {
        return this._promise;
    }

    startLoad() {
        this.pending++;
    }

    finishLoad() {
        this.loaded++;
        if (this.loaded === this.pending) {
            this._resolve();
        }
    }

    loadImageAtlas(alias, jsonSrc, imageSrc) {
        this.startLoad();

        const atlas = new gfx.image.ImageAtlas(alias, jsonSrc, imageSrc);
        atlas.finished.then((sprites) => {
            for (const sprite of sprites) {
                if (!this.images[sprite.name]) {
                    this.images[sprite.name] = sprite.image;
                }
            }

            this.finishLoad();
        });
    }
}

export default Loader = new Loader();
