import { createStore } from "redux";
import * as reducer from "./reducer";
import * as action from "./action";
import * as defaultSemantics from "./semantics/default";
import * as stage from "./stage";
import * as undo from "./undo";

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
    [ defaultSemantics.number(3) ],
    [
        defaultSemantics.add(defaultSemantics.missing(), defaultSemantics.number(2)),
        defaultSemantics.number(5),
        defaultSemantics.add(defaultSemantics.number(1), defaultSemantics.number(2)),
        defaultSemantics.add(defaultSemantics.add(defaultSemantics.number(8), defaultSemantics.missing()), defaultSemantics.number(2)),
        defaultSemantics.add(defaultSemantics.number(3), defaultSemantics.number(5)),
        defaultSemantics.add(defaultSemantics.number(4), defaultSemantics.number(7)),
    ],
    [ defaultSemantics.number(1) ]
));

const nodes = store.getState().getIn([ "program", "$present" ]).get("nodes");
nodes.forEach((node) => {
    views[node.get("id")] = defaultSemantics.project(stg, node);
});
store.getState().getIn([ "program", "$present" ]).get("board").forEach((id) => {
    views[id].pos.x = 100 + Math.floor(Math.random() * 600);
    views[id].pos.y = 100 + Math.floor(Math.random() * 400);
});

document.querySelector("#undo").addEventListener("click", () => {
    store.dispatch(undo.undo());
});
document.querySelector("#redo").addEventListener("click", () => {
    store.dispatch(undo.redo());
});

window.stage = stg;
