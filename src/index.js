import { createStore } from "redux";
import * as reducer from "./reducer/reducer";
import * as level from "./game/level";
import * as progression from "./game/progression";
import es6 from "./semantics/es6";
import * as stage from "./stage";
import * as undo from "./reducer/undo";

import { Loader } from "./loader";

// Load assets.
Loader.loadImageAtlas("spritesheet", "resources/graphics/assets.json", "resources/graphics/assets.png");
Loader.loadChapters("progression", progression.ACTIVE_PROGRESSION_DEFINITION);

Loader.finished.then(initialize);

const views = {};
let store;
let stg;

function initialize() {
    // Reducer needs access to the views in order to save their state
    // for undo/redo.
    const reduct = reducer.reduct(es6, views);
    store = createStore(reduct.reducer);

    stg = new stage.Stage(800, 600, store, views, es6);
    document.body.appendChild(stg.view);

    // When the state changes, redraw the state.
    store.subscribe(() => {
        stg.draw();

        if (!stg.alreadyWon) {
            const matching = level.checkVictory(stg.getState(), es6);
            if (Object.keys(matching).length > 0) {
                stg.animateVictory(matching).then(() => {
                    window.next();
                });
            }
        }
    });

    window.reset();

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

window.reset = function start() {
    stg.reset();

    level.startLevel(Loader.progressions["progression"].levels[progression.currentLevelIdx],
                     es6.parser.parse, store, stg);

    document.querySelector("#level").innerText = progression.currentLevelIdx.toString();
};

window.next = function next() {
    progression.currentLevelIdx++;
    window.reset();
};
window.prev = function prev() {
    progression.currentLevelIdx--;
    window.reset();
};
