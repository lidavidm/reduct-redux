import { createStore } from "redux";
import { reduct } from "./reducer";
import * as action from "./action";
import * as expr from "./expr";
import * as stage from "./stage";
import * as projection from "./projection";

let store = createStore(reduct);
let views = {};

const stg = new stage.Stage(800, 600, store, views);
document.body.appendChild(stg.view);

store.subscribe(() => {
    const state = store.getState();

    stg.draw();
});

store.dispatch(action.startLevel(
    [ expr.number(3) ],
    [ expr.add(expr.missing(), expr.number(2)), expr.number(5), expr.add(expr.number(1), expr.number(2)) ],
    [ expr.number(1) ]
));

store.getState().nodes.forEach((node) => {
    views[node.id] = projection.initializeView(node.id, store.getState().nodes, views);
});
store.getState().board.forEach((id) => {
    views[id].x = 100 + Math.floor(Math.random() * 600);
    views[id].y = 100 + Math.floor(Math.random() * 400);
});
