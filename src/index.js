import { createStore } from "redux";
import * as reducer from "./reducer/reducer";
import * as action from "./reducer/action";
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
Loader.finished.then(start);

function start() {
    const views = {};
    const reduct = reducer.reduct(defaultSemantics, views);
    const store = createStore(reduct.reducer);

    const stg = new stage.Stage(800, 600, store, views, defaultSemantics);
    document.body.appendChild(stg.view);

    store.subscribe(() => {
        const state = store.getState();
        stg.draw();
    });

    store.dispatch(action.startLevel(
        stg,
        [ defaultSemantics.number(3) ],
        [
            defaultSemantics.add(defaultSemantics.missing(), defaultSemantics.number(2)),
            defaultSemantics.number(5),
            defaultSemantics.add(defaultSemantics.number(1), defaultSemantics.number(2)),
            // defaultSemantics.add(defaultSemantics.add(defaultSemantics.number(8), defaultSemantics.missing()), defaultSemantics.number(2)),
            defaultSemantics.lambda(defaultSemantics.lambdaArg("x"), defaultSemantics.missing()),
        ],
        [ defaultSemantics.number(1), defaultSemantics.add(defaultSemantics.missing(), defaultSemantics.missing()) ]
    ));

    document.querySelector("#undo").addEventListener("click", () => {
        store.dispatch(undo.undo());
    });
    document.querySelector("#redo").addEventListener("click", () => {
        store.dispatch(undo.redo());
    });

    window.stage = stg;
}
