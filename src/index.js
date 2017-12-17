import { createStore } from "redux";
import * as reducer from "./reducer/reducer";
import * as level from "./game/level";
import * as es6 from "./game/parsers/es6";
import * as progression from "./game/progression";
import * as defaultSemantics from "./semantics/default";
import * as stage from "./stage";
import * as undo from "./reducer/undo";

import Loader from "./loader";

// Load assets. Kinda wonky due to the build system, need to look at
// this later.
import spritesheetUrl from "../resources/graphics/assets.png";
import menuUrl from "../resources/graphics/menu-assets.png";
Loader.loadImageAtlas("spritesheet",
                      import("../resources/graphics/assets.json"),
                      // TODO: in ParcelJS master, we shouldn't need this concat
                      "dist/" + spritesheetUrl);
Loader.loadImageAtlas("spritesheet",
                      import("../resources/graphics/menu-assets.json"),
                      // TODO: in ParcelJS master, we shouldn't need this concat
                      "dist/" + menuUrl);
Loader.loadChapters("progression", progression.ACTIVE_PROGRESSION_DEFINITION);

Loader.finished.then(initialize);

const views = {};
let store;
let stg;

function initialize() {
    // Reducer needs access to the views in order to save their state
    // for undo/redo.
    const reduct = reducer.reduct(defaultSemantics, views);
    store = createStore(reduct.reducer);

    stg = new stage.Stage(800, 600, store, views, defaultSemantics);
    document.body.appendChild(stg.view);

    // When the state changes, redraw the state.
    store.subscribe(() => {
        stg.draw();

        // Right now it just goes on, but we would want the animation here.
        if (level.checkVictory(stg.getState(), defaultSemantics)) {
            next();
        }
    });

    start();

    window.stage = stg;

    document.querySelector("#undo").addEventListener("click", () => {
        store.dispatch(undo.undo());
    });
    document.querySelector("#redo").addEventListener("click", () => {
        store.dispatch(undo.redo());
    });
    document.querySelector("#prev").addEventListener("click", () => {
        window.prev();
    });
    document.querySelector("#reset").addEventListener("click", () => {
        window.reset();
    });
    document.querySelector("#next").addEventListener("click", () => {
        window.next();
    });
}

const start = window.reset = function start() {
    stg.reset();

    level.startLevel(Loader.progressions["progression"].levels[progression.currentLevelIdx],
                     es6.parse, store, stg);
};

window.next = function next() {
    progression.currentLevelIdx++;
    start();
};
window.prev = function prev() {
    progression.currentLevelIdx--;
    start();
};
