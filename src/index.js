import "babel-polyfill";
import { createStore, applyMiddleware } from "redux";
import * as reducer from "./reducer/reducer";
import * as action from "./reducer/action";
import * as level from "./game/level";
import * as progression from "./game/progression";
import es6 from "./semantics/es6";
import * as stage from "./stage";
import * as undo from "./reducer/undo";

import { Loader } from "./loader";
import Logging from "./logging/logging";

// Load assets.
Loader.loadAudioSprite("sounds", "resources/audio/output.json", [
    "resources/audio/output.opus",
    "resources/audio/output.ogg",
    "resources/audio/output.mp3",
    "resources/audio/output.wav",
]);
Loader.loadImageAtlas("spritesheet", "resources/graphics/assets.json", "resources/graphics/assets.png");
Loader.loadChapters("Elementary", progression.ACTIVE_PROGRESSION_DEFINITION);

Promise.all([ Loader.finished, Logging.startSession() ]).then(initialize);

const views = {};
let store;
let stg;

function logState() {
    return next => act => {
        if (act.type === action.RAISE) {
            return next(act);
        }

        const before = level.serialize(stg.getState(), es6);
        const returnValue = next(act);
        const after = level.serialize(stg.getState(), es6);

        if (act.type === action.DETACH) {
            Logging.log("detached-expr", {
                before,
                after,
                "item": null,
            });
        }

        // Put action as edge data
        // TODO: how to deal with all the intermediate states??
        // TODO: dummy action that just indicates player clicked on
        // something, and dummy action to indicate reduction finished
        stg.saveState(act.type);

        return returnValue;
    };
}

function initialize() {
    // Reducer needs access to the views in order to save their state
    // for undo/redo.
    const reduct = reducer.reduct(es6, views);
    store = createStore(reduct.reducer, undefined, applyMiddleware(logState));

    stg = new stage.Stage(800, 600, store, views, es6);
    document.body.appendChild(stg.view);

    // When the state changes, redraw the state.
    store.subscribe(() => {
        stg.draw();

        if (!stg.alreadyWon) {
            const matching = level.checkVictory(stg.getState(), es6);
            if (Object.keys(matching).length > 0) {
                Logging.log("victory", {
                    // TODO: track final state
                    final_state: level.serialize(stg.getState(), es6),
                    // TODO: track num of moves via undo stack?
                    // num_of_moves: undefined,
                });
                stg.animateVictory(matching).then(() => {
                    window.next();
                });
            }
        }
    });

    progression.restore();

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

    for (const chapterName of Loader.progressions["Elementary"].linearChapters) {
        const option = document.createElement("option");
        option.setAttribute("value", Loader.progressions["Elementary"].chapters[chapterName].startIdx);
        option.innerText = `Chapter: ${chapterName}`;
        document.querySelector("#chapter").appendChild(option);
    }
    document.querySelector("#chapter").addEventListener("change", () => {
        const lvl = window.parseInt(document.querySelector("#chapter").value, 10);
        progression.jumpToLevel(lvl);
        window.reset();
    });

    window.reset();
}

window.reset = function start() {
    stg.reset();

    const levelDefinition = Loader.progressions["Elementary"].levels[progression.currentLevel()];
    Logging.transitionToTask(progression.currentLevel(), levelDefinition).finally(() => {
        level.startLevel(levelDefinition, es6.parser.parse, store, stg);

        document.querySelector("#level").innerText = progression.currentLevel().toString();
        // Sync chapter dropdown with current level
        let prevOption = null;
        for (const option of document.querySelectorAll("#chapter option")) {
            if (window.parseInt(option.getAttribute("value"), 10) <= progression.currentLevel()) {
                prevOption = option;
            }
            else {
                break;
            }
        }
        document.querySelector("#chapter").value = prevOption.getAttribute("value");
    });
};

window.next = function next() {
    progression.nextLevel();
    window.reset();
};
window.prev = function prev() {
    progression.prevLevel();
    window.reset();
};
