import { createStore } from "redux";
import { reduct } from "./reducer";
import * as action from "./action";
import * as expr from "./expr";
import * as stage from "./stage";
import * as projections from "./projections";

let store = createStore(reduct);
let views = {};

const stg = new stage.Stage(800, 600, store, views);
document.body.appendChild(stg.view);

store.subscribe(() => {
    const state = store.getState();
    console.log(state);

    stg.draw();
});

store.dispatch(action.startLevel(
    [ expr.number(3) ],
    [ expr.add(expr.missing(), expr.number(2)), expr.number(5), expr.add(expr.number(1), expr.number(2)) ],
    [ expr.number(1) ]
));

store.getState().board.forEach((nodeId) => {
    views[nodeId] = Object.assign({}, projections.defaultView, {
        x: Math.floor(800 * Math.random()),
        y: Math.floor(600 * Math.random()),
    });
});
