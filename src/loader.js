import { Howl } from "howler";

import * as gfx from "./gfx/core";
import * as globalProgressions from "./game/progression";
import { getJSON } from "./util/ajax";

const BASE_PATH = "resources/";

function getImage(path) {
    return new Promise((resolve) => {
        const image = document.createElement("img");
        image.onload = function() {
            resolve(image);
        };
        image.setAttribute("src", path);
    });
}

export class LoaderClass {
    constructor(root) {
        this.rootPath = root;
        this.graphicsPath = root + "/graphics/";
        this.pending = this.loaded = 0;

        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
        });

        this.images = {};
        this.progressions = {};
        this.sounds = {};
        this.audioSprites = {};
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

        Promise.all([
            getJSON(jsonSrc),
            getImage(imageSrc),
        ]).then(([ json, img ]) => {
            const atlas = new gfx.image.ImageAtlas(alias, json, img);
            for (const sprite of atlas.sprites) {
                if (!this.images[sprite.name]) {
                    this.images[sprite.name] = sprite.image;
                }
                else {

                }
            }

            this.finishLoad();
        });
    }

    loadAudioSprite(alias, jsonSrc, audioSrcs) {
        this.startLoad();
        getJSON(jsonSrc).then((json) => {
            this.audioSprites[alias] = new Howl({
                src: audioSrcs,
                sprite: json.sprite,
                onload: () => {
                    for (const key of Object.keys(json.sprite)) {
                        this.sounds[key] = this.audioSprites[alias];
                    }
                    this.finishLoad();
                },
            });
        });
    }

    loadChapter(progression, name, path) {
        this.startLoad();

        return getJSON(`${BASE_PATH}/${path}`).then((json) => {
            // Copy the planet's aliens to the individual level
            // definitions, so that buildLevel has access to
            // them. Provide a default alien when not specified.
            const aliens = (json.resources && json.resources.aliens) ?
                json.resources.aliens : ["alien-function-1"];
            for (const level of json.levels) {
                level.resources = level.resources || { aliens };
            }

            const d = {
                key: name,
                name: json.chapterName,
                description: json.description,
                challenge: json.challenge || false,
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
                if (typeof lvl.board === "string") lvl.board = [lvl.board];
                if (typeof lvl.toolbox === "string") lvl.toolbox = [lvl.toolbox];
                if (!lvl.defines) lvl.defines = [];
                else if (typeof lvl.defines === "string") lvl.defines = [lvl.defines];
                if (!lvl.globals) lvl.globals = {};
                if (!lvl.syntax) lvl.syntax = [];
                else if (typeof lvl.syntax === "string") lvl.syntax = [lvl.syntax];

                if (!lvl.animationScales) lvl.animationScales = {};

                if (typeof lvl.showConcreteGoal === "undefined") lvl.showConcreteGoal = true;

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
            linearChapters: [],
        };
        const filenames = Object.keys(definition.digraph);

        let extraDefines = [];
        let animationScales = {};

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
                            progression.linearChapters.push(chapterName);

                            chapter.startIdx = progression.levels.length;
                            progression.levels = progression.levels.concat(chapter.levels);
                            chapter.endIdx = progression.levels.length - 1;

                            remaining--;
                            console.info("Loader#loadChapters: traversed", chapterName);

                            // TODO: patch defines
                            for (const level of chapter.levels) {
                                const newScales = Object.assign(
                                    {},
                                    animationScales,
                                    level.animationScales
                                );
                                level.animationScales = Object.assign(
                                    level.animationScales,
                                    animationScales
                                );
                                animationScales = newScales;
                                level.extraDefines = extraDefines;
                                extraDefines = extraDefines.concat(level.defines);
                            }

                            continue outerLoop;
                        }
                    }

                    console.error("Could not finish digraph.");
                    break;
                }

                globalProgressions.PROGRESSIONS[name].progression = progression;

                this.finishLoad();
            });
    }
}

const Loader = new LoaderClass();
export default Loader;
