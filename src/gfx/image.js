export class ImageAtlas {
    constructor(alias, jsonPromise, imageSrc) {
        this.finished = new Promise((resolve, reject) => {
            jsonPromise.then((atlas) => {
                this.img = new Image();
                this.img.src = imageSrc;
                this.img.alt = alias;
                this.img.onload = () => {
                    // Parse the atlas and add all the images
                    const result = [];
                    for (let frameName of Object.keys(atlas.frames)) {
                        let frame = atlas.frames[frameName];
                        // Convert resource-name.png to resource-name
                        let resourceName = frameName.split(".")[0];
                        let resource = new ImageAtlasProxy(resourceName, this, frame.frame);
                        result.push({ name: resourceName, image: resource });
                    }

                    resolve(result);
                };
            });
        });
    }
}

export class ImageProxy {
    constructor(alias, src) {
        this.img = new Image();
        this.img.src = src;
        this.img.alt = alias;
    }

    set onload(callback) {
        this.img.onload = callback;
    }

    get naturalWidth() {
        return this.img.naturalWidth;
    }

    get naturalHeight() {
        return this.img.naturalHeight;
    }

    get backingImage() {
        // This should raise an error for the AtlasProxy - you
        // shouldn't be able to manipulate the backing image
        return this.img;
    }

    draw(ctx, x, y, w=null, h=null) {
        if (w === null) {
            w = this.naturalWidth;
        }
        if (h === null) {
            h = this.naturalHeight;
        }

        ctx.drawImage(this.img, x, y, w, h);
    }
}

export class ImageAtlasProxy {
    constructor(alias, atlas, frame) {
        this.alias = alias;
        this.atlas = atlas;
        this.frame = frame;
    }

    get naturalWidth() {
        return this.frame.w;
    }

    get naturalHeight() {
        return this.frame.h;
    }

    get backingImage() {
        throw {
            "error": "Can't get the backing image of an image in an image atlas",
        };
    }

    draw(ctx, x, y, w=null, h=null) {
        if (w === null) {
            w = this.naturalWidth;
        }
        if (h === null) {
            h = this.naturalHeight;
        }

        ctx.drawImage(this.atlas.img, this.frame.x, this.frame.y, this.frame.w, this.frame.h, x, y, w, h);
    }
}
