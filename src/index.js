import { createStore } from "redux";
import * as reducer from "./reducer/reducer";
import * as action from "./reducer/action";
import * as level from "./game/level";
import * as es6 from "./game/parsers/es6";
import * as defaultSemantics from "./semantics/default";
import * as stage from "./stage";
import * as undo from "./reducer/undo";
import Loader from "./loader";

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

Loader.finished.then(initialize);

const views = {};
let store;
let stg;
function initialize() {
    const reduct = reducer.reduct(defaultSemantics, views);
    store = createStore(reduct.reducer);

    stg = new stage.Stage(800, 600, store, views, defaultSemantics);
    document.body.appendChild(stg.view);

    store.subscribe(() => {
        stg.draw();
    });

    start();

    window.stage = stg;

    document.querySelector("#undo").addEventListener("click", () => {
        store.dispatch(undo.undo());
    });
    document.querySelector("#redo").addEventListener("click", () => {
        store.dispatch(undo.redo());
    });
}

function start() {
    // TODO: stage needs its own view store
    // for (const key in views) delete views[key];
    // TODO: reset stage

    level.startLevel({
        goal: ["3", "'star'"],
        board: ["1", "(x) => _"],
        toolbox: ["2", "'circle'", "'rect'", "'triangle'", "'star'", "x + _"],
    }, es6.parse, store, stg);
}
