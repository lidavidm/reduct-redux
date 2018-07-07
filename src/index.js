import "babel-regenerator-runtime";
import vis from "vis";
import { createStore, applyMiddleware } from "redux";

import * as gfx from "./gfx/core";
import * as animate from "./gfx/animate";
import * as reducer from "./reducer/reducer";
import * as level from "./game/level";
import * as progression from "./game/progression";
import es6 from "./semantics/es6";
import Stage from "./stage/stage";
import TutorialStage from "./stage/tutorial";
import ChapterEndStage from "./stage/chapterend";
import TitleStage from "./stage/title";
import passwordPrompt from "./ui/instructor/password";
import consent from "./consent";
import tutorial from "./ui/instructor/tutorial";

import Loader from "./loader";
import Logging from "./logging/logging";
import { TITLE_LEVEL_ID, DEVELOPMENT_BUILD } from "./logging/logging";

// Globals to help you debug
window.gfx = gfx;
window.animate = animate;
window.Logging = Logging;
window.progression = progression;

// Load assets.
Loader.loadAudioSprite("sounds", "resources/audio/output.json", "resources/audio/volumes.json", [
    "resources/audio/output.opus",
    "resources/audio/output.ogg",
    "resources/audio/output.mp3",
    "resources/audio/output.wav",
]);
Loader.loadImageAtlas("spritesheet", "resources/graphics/assets.json", "resources/graphics/assets.png");
Loader.loadImageAtlas("titlesprites", "resources/graphics/title-assets.json", "resources/graphics/title-assets.png");
Loader.loadImageAtlas("menusprites", "resources/graphics/menu-assets.json", "resources/graphics/menu-assets.png");
Loader.loadChapters("Elementary", progression.ACTIVE_PROGRESSION_DEFINITION);
Loader.waitForFonts([ "Fira Mono", "Fira Sans", "Nanum Pen Script" ]);

Promise.all([ Loader.finished ])
    .then(([ _, consented ]) => {
        consented = false;
        console.log(`User consented to logging: ${consented}`);
        if (!consented) {
            Logging.resetState();
            Logging.clearStaticLog();
            Logging.saveState();
        }
        Logging.config("enabled", consented);
        if (consented) Logging.config("offline", false);
    })
    .then(() => Logging.startSession())
    .then(initialize);

const views = {};
let store;
let stg;
let canvas;

function toggleDev() {
    const nav = document.querySelector("#nav");
    const devEls = document.querySelectorAll(".dev");
    if (nav.style.display === "none") {
        nav.style.display = "flex";
        for (let i = 0; i < devEls.length; i++) {
            devEls[i].style.display = "block";
        }
    }
    else {
        nav.style.display = "none";
    }
}

function initialize() {
    if (DEVELOPMENT_BUILD && !gfx.viewport.IS_PHONE) {
        toggleDev();
    }

    document.querySelector("#loading-container").remove();

    document.body.addEventListener("keyup", (e) => {
        if (e.ctrlKey && e.code === "F6") {
            window.prev();
            e.preventDefault();
        }
        else if (e.ctrlKey && e.code === "F7") {
            window.next();
            e.preventDefault();
        }
        else if (e.ctrlKey && e.code === "F8") {
            toggleDev();
            e.preventDefault();
        }
        else if (e.shiftKey && e.code === "F9") {
            window.localStorage["version"] = "";
            Logging.resetState();
            Logging.clearStaticLog();
            Logging.saveState();
            e.preventDefault();
            window.location.reload();
        }
    });

    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    if (gfx.viewport.IS_PHONE) {
        document.body.classList.add("mobile-phone");
        canvas.style.width = "100%";
    }

    // Reducer needs access to the views in order to save their state
    // for undo/redo.
    const reduct = reducer.reduct(es6, views, (id, { x, y }) => {
        const { w, h } = gfx.absoluteSize(stg.getView(id));
        return stg.findSafePosition(x, y, w, h);
    });
    store = createStore(
        reduct.reducer,
        undefined,
        applyMiddleware(Logging.logMiddleware(
            () => stg.getState(),
            (...args) => stg.saveState(...args),
            (...args) => stg.pushState(...args),
            (...args) => stg.saveNode(...args),
            es6
        ))
    );
    stg = new TitleStage(startGame, canvas, 800, 600, store, views, es6);
    window.stage = stg;

    window.Logging = Logging;

    animate.addUpdateListener(() => {
        stg.draw();
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
            const state = stg.getState();
            const matching = level.checkVictory(state, es6);
            if (Object.keys(matching).length > 0) {
                const finalState = level.serialize(state, es6);
                stg.animateVictory(matching).then(() => {
                    persistGraph();

                    Logging.log("victory", {
                        final_state: finalState,
                        // TODO: track num of moves via undo stack?
                        // num_of_moves: undefined,
                    });

                    nextLevel();
                });
            }
            else if (stg.semantics &&
                     !stg.semantics.mightBeCompleted(state, s => level.checkVictory(s, es6))) {
                Logging.log("dead-end", {
                    final_state: level.serialize(state, es6),
                });
                stg.animateStuck();
            }
        }
    });

    progression.restore();

    window.stage = stg;

    document.querySelector("#download-log").addEventListener("click", () => {
        Logging.downloadStaticLog();
    });
    document.querySelector("#toggle-graph").addEventListener("click", () => {
        Logging.toggleStateGraph();
        window.updateStateGraph();
    });
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
        passwordPrompt("Ask the teacher to skip this level!", "cornell").then(() => {
            if (stg.pushState) stg.pushState("change-chapter");
            const lvl = window.parseInt(document.querySelector("#chapter").value, 10);
            start(() => progression.jumpToLevel(lvl));
        }, () => {});
    });

    Logging.transitionToTask(TITLE_LEVEL_ID);
}

function startGame() {
    start(null, { persistGraph: false });
}

// Log state graph, using multiple requests to avoid problem of too-long URI.
let __monotonic = 0;
function persistGraph() {
    if (!stg || !stg.stateGraph) return;

    try {
        const graph = stg.stateGraph.serialize();

        // Up to 2000 characters, as per
        // https://stackoverflow.com/a/417184, minus some for other
        // parameters
        const MAX_BLOB_LENGTH = 1500;

        const persistArray = (array, action) => {
            let serialized = 0;
            let counter = 0;

            while (serialized < array.length) {
                const attempt = {
                    graphSequenceID: __monotonic,
                    payloadSequenceID: counter,
                    partialData: [ array[serialized] ],
                };

                while (JSON.stringify(attempt).length < MAX_BLOB_LENGTH &&
                       serialized + attempt.partialData.length < array.length) {
                    attempt.partialData.push(array[serialized + attempt.partialData.length]);
                }
                if (attempt.partialData.length > 1 &&
                    JSON.stringify(attempt).length > MAX_BLOB_LENGTH) {
                    attempt.partialData.pop();
                }
                serialized += attempt.partialData.length;
                Logging.log(action, attempt);

                counter += 1;
            }

            return counter - 1;
        };
        const lastNodeCounter = persistArray(graph.nodes, "state-path-save-nodes");
        const lastEdgeCounter = persistArray(graph.edges, "state-path-save-edges");
        Logging.log("state-path-save-graph", {
            "nodePayloadSequenceIDEnd": lastNodeCounter,
            "edgePayloadSequenceIDEnd": lastEdgeCounter,
            "graphSequenceId": __monotonic,
        });
    }
    finally {
        __monotonic += 1;
    }
}

function start(updateLevel, options={}) {
    animate.clock.cancelAll();

    if (options.persistGraph !== false) persistGraph();

    // Take thunk that updates the level
    if (updateLevel) updateLevel();

    if (progression.currentLevel() === 0) {
        stg = new TutorialStage(canvas, 800, 600, store, views, es6);
    }
    else {
        stg = new Stage(canvas, 800, 600, store, views, es6);
    }
    window.stage = stg;

    const levelDefinition = Loader.progressions["Elementary"].levels[progression.currentLevel()];

    Logging.transitionToTask(progression.currentLevel(), levelDefinition)
        .finally(() => {
            // Show tutorial if present
            if (levelDefinition.tutorialUrl) {
                tutorial(levelDefinition.tutorialUrl);
            }

            level.startLevel(levelDefinition, es6.parser.parse, store, stg);
            stg.drawImpl();

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

    // Reset buttons
    window.updateStateGraph();
}

function showChapterEnd() {
    animate.clock.cancelAll();
    // TODO: bring back old reset
    // for (const key in views) delete views[key];
    stg = new ChapterEndStage(canvas, 800, 600, store, views, es6);
    window.stage = stg;
    Logging.transitionToTask(Logging.VICTORY_LEVEL_ID);
}

function nextLevel(enableChallenge) {
    if (progression.isChapterEnd() && !(stg instanceof ChapterEndStage)) {
        if (progression.isGameEnd()) {
            Logging.log("game-complete");
        }
        showChapterEnd();
    }
    else if (enableChallenge) {
        start(() => progression.nextChallengeLevel());
    }
    else {
        start(() => progression.nextLevel());
    }
}

window.reset = function reset() {
    if (stg.pushState) stg.pushState("reset");
    start();
};
window.next = function next(challenge, prompt=true) {
    const doNext = () => {
        if (stg.pushState) stg.pushState("next");
        nextLevel(challenge);
    };
    if (challenge) {
        doNext();
        return;
    }

    if (prompt) {
        passwordPrompt("Ask the teacher to skip this level!", "cornell")
            .then(() => doNext(), () => {});
    }
    else {
        doNext();
    }
};
window.prev = function prev() {
    if (stg.pushState) stg.pushState("prev");
    start(() => progression.prevLevel());
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
