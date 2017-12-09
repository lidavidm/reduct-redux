import { createStore } from "redux";
import * as reducer from "./reducer";
import * as action from "./action";
import * as defaultSemantics from "./semantics/default";
import * as stage from "./stage";
import * as projection from "./projection";

const reduct = reducer.reduct(defaultSemantics);
let store = createStore(reduct.reducer);
let views = {};

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
    ],
    [ defaultSemantics.number(1) ]
));

store.getState().nodes.forEach((node) => {
    console.log(node);
    views[node.id] = projection.initializeView(node.id, store.getState().nodes, views);
});
store.getState().board.forEach((id) => {
    views[id].x = 100 + Math.floor(Math.random() * 600);
    views[id].y = 100 + Math.floor(Math.random() * 400);
});
