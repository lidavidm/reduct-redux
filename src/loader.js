import * as gfx from "./gfx/core";

const BASE_PATH = "dist/resources/";

function getJSON(path) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function() {
            resolve(JSON.parse(xhr.response));
        };

        xhr.open("GET", path);
        xhr.responseType = "text";
        xhr.send();
    });
}

export class Loader {
    constructor(root) {
        this.rootPath = root;
        this.graphicsPath = root + "/graphics/";
        this.pending = this.loaded = 0;

        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
        });

        this.images = {};
        this.progressions = {};
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

    loadChapter(progression, name, path) {
        this.startLoad();

        return getJSON(`${BASE_PATH}/${path}`).then((json) => {
            // Copy the planet's aliens to the individual level
            // definitions, so that buildLevel has access to
            // them. Provide a default alien when not specified.
            let aliens = (json.resources && json.resources.aliens) ?
                json.resources.aliens : ["alien-function-1"];
            for (let level of json.levels) {
                level.resources = level.resources || {
                    aliens: aliens,
                };
            }

            const d = {
                key: name,
                name: json.chapterName,
                description: json.description,
                language: json.language,
                levels: [],
                dependencies: [],
            };
            if (json.resources) d.resources = json.resources;

            json.levels.forEach((lvl) => {
                lvl.language = d.language;
                if (json.macros) lvl.macros = json.macros;
                if (typeof lvl.goal === "string") lvl.goal = [lvl.goal];
                if (!lvl.toolbox) lvl.toolbox = [];
                if (typeof lvl.toolbox === "string") lvl.toolbox = [lvl.toolbox];

                d.levels.push(lvl);
            });

            this.progressions[progression].chapters[name] = d;

            this.finishLoad();
        });
    }

    loadChapters(name, definition) {
        this.startLoad();
        const progression = this.progressions[name] = {
            chapters: {},
            levels: [],
        };
        const filenames = Object.keys(definition.digraph);

        Promise.all(filenames.map(
            (filename) => this.loadChapter(
                name, filename,
                `${definition.dir}/${filename}.json`)))
            .then(() => {
                for (const chapter of filenames) {
                    progression.chapters[chapter].transitions = definition.digraph[chapter];
                    for (const transition of definition.digraph[chapter]) {
                        progression.chapters[transition].dependencies.push(chapter);
                    }
                }

                // Topological sort
                const marked = {};
                let remaining = filenames.length;

                outerLoop:
                while (remaining > 0) {
                    for (const [chapterName, chapter] of Object.entries(progression.chapters)) {
                        if (chapter.dependencies.every(dep => marked[dep]) && !marked[chapterName]) {
                            marked[chapterName] = true;

                            chapter.startIdx = progression.levels.length;
                            progression.levels = progression.levels.concat(chapter.levels);
                            chapter.endIdx = progression.levels.length - 1;

                            remaining--;
                            console.info("Loader#loadChapters: traversed", chapterName);

                            continue outerLoop;
                        }
                    }

                    console.error("Could not finish digraph.");
                    break;
                }

                this.finishLoad();
            });
    }
}

export default Loader = new Loader();
