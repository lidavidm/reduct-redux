import "babel-polyfill";
import vis from "vis";
import { createStore, applyMiddleware } from "redux";

import * as animate from "./gfx/animate";
import * as reducer from "./reducer/reducer";
import * as level from "./game/level";
import * as progression from "./game/progression";
import es6 from "./semantics/es6";
import Stage from "./stage/stage";
import ChapterEndStage from "./stage/chapterend";
import * as undo from "./reducer/undo";

import Loader from "./loader";
import Logging from "./logging/logging";

// Load assets.
Loader.loadAudioSprite("sounds", "resources/audio/output.json", [
    "resources/audio/output.opus",
    "resources/audio/output.ogg",
    "resources/audio/output.mp3",
    "resources/audio/output.wav",
]);
Loader.loadImageAtlas("spritesheet", "resources/graphics/assets.json", "resources/graphics/assets.png");
Loader.loadImageAtlas("menusprites", "resources/graphics/menu-assets.json", "resources/graphics/menu-assets.png");
Loader.loadChapters("Elementary", progression.ACTIVE_PROGRESSION_DEFINITION);

Promise.all([ Loader.finished, Logging.startSession() ]).then(initialize);

const views = {};
let store;
let stg;
let canvas;

function initialize() {
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    // Reducer needs access to the views in order to save their state
    // for undo/redo.
    const reduct = reducer.reduct(es6, views);
    store = createStore(
        reduct.reducer,
        undefined,
        applyMiddleware(Logging.logMiddleware(
            () => stg.getState(),
            (...args) => stg.saveState(...args),
            (...args) => stg.saveNode(...args),
            es6
        ))
    );
    stg = new Stage(canvas, 800, 600, store, views, es6);
    window.stage = stg;

    animate.addUpdateListener(() => {
        stg.drawImpl();
    });

    // TODO: resize scene as whole, then resize stage
    window.addEventListener("resize", () => {
        stg.resize();
    });

    // TODO: dispatch events to scene, then to stage
    canvas.addEventListener("mousedown", e => stg._mousedown(e));
    canvas.addEventListener("mousemove", e => stg._mousemove(e));
    canvas.addEventListener("mouseup", e => stg._mouseup(e));

    canvas.addEventListener("touchstart", e => stg._touchstart(e));
    canvas.addEventListener("touchmove", e => stg._touchmove(e));
    canvas.addEventListener("touchend", e => stg._touchend(e));

    // When the state changes, redraw the state.
    store.subscribe(() => {
        stg.draw();

        if (!stg.alreadyWon) {
            const matching = level.checkVictory(stg.getState(), es6);
            if (Object.keys(matching).length > 0) {
                Logging.log("victory", {
                    final_state: level.serialize(stg.getState(), es6),
                    // TODO: track num of moves via undo stack?
                    // num_of_moves: undefined,
                });
                stg.animateVictory(matching).then(() => {
                    nextLevel();
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
    document.querySelector("#download-log").addEventListener("click", () => {
        Logging.downloadStaticLog();
    });
    // document.querySelector("#toggle-graph").addEventListener("click", () => {
    //     Logging.toggleStateGraph();
    //     window.updateStateGraph();
    // });
    window.toggleStateGraph = function() {
        Logging.toggleStateGraph();
        window.updateStateGraph();
    };

    for (const chapterName of Loader.progressions["Elementary"].linearChapters) {
        const option = document.createElement("option");
        option.setAttribute("value", Loader.progressions["Elementary"].chapters[chapterName].startIdx);
        option.innerText = `Chapter: ${chapterName}`;
        document.querySelector("#chapter").appendChild(option);
    }
    document.querySelector("#chapter").addEventListener("change", () => {
        if (stg.pushState) stg.pushState("change-chapter");
        const lvl = window.parseInt(document.querySelector("#chapter").value, 10);
        progression.jumpToLevel(lvl);
        start();
    });

    start();
}

function start() {
    animate.clock.cancelAll();
    stg = new Stage(canvas, 800, 600, store, views, es6);
    window.stage = stg;

    const levelDefinition = Loader.progressions["Elementary"].levels[progression.currentLevel()];
    Logging.transitionToTask(progression.currentLevel(), levelDefinition).finally(() => {
        level.startLevel(levelDefinition, es6.parser.parse, store, stg);
        stg.drawImpl();

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
}

function showChapterEnd() {
    animate.clock.cancelAll();
    // TODO: bring back old reset
    // for (const key in views) delete views[key];
    stg = new ChapterEndStage(canvas, 800, 600, store, views, es6);
    window.stage = stg;
}

function nextLevel(enableChallenge) {
    if (progression.isChapterEnd() && !(stg instanceof ChapterEndStage)) {
        if (progression.isGameEnd()) {
            Logging.log("game-complete");
        }
        showChapterEnd();
    }
    else if (enableChallenge) {
        progression.nextChallengeLevel();
        start();
    }
    else {
        progression.nextLevel();
        start();
    }
}

window.reset = function reset() {
    if (stg.pushState) stg.pushState("reset");
    start();
};
window.next = function next(challenge) {
    if (stg.pushState) stg.pushState("next");
    nextLevel(challenge);
};
window.prev = function prev() {
    if (stg.pushState) stg.pushState("prev");
    progression.prevLevel();
    start();
};

window.updateStateGraph = function updateStateGraph(networkData) {
    if (!document.querySelector("#state-graph")) {
        const ctr = document.createElement("div");
        ctr.setAttribute("id", "state-graph");
        document.body.appendChild(ctr);
    }
    const container = document.querySelector("#state-graph");

    if (!Logging.config("stateGraph")) {
        container.style.display = "none";
        return;
    }
    container.style.display = "unset";

    if (!networkData) return;

    const options = {
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 1 },
            },
            font: {
                color: "lightgray",
                strokeWidth: 0,
                background: "#222",
            },
        },
        nodes: {
            shape: "box",
        },
    };
    return new vis.Network(container, networkData, options);
};
