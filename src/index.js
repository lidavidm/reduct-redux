import { createStore } from "redux";
import { reduct } from "./reducer";
import * as action from "./action";
import * as expr from "./expr";
import * as stage from "./stage";
import * as projections from "./projections";

let store = createStore(reduct);

const stg = new stage.Stage(800, 600);
document.body.appendChild(stg.view);

store.subscribe(() => {
    const state = store.getState();
    console.log(state);

    stg.draw(() => {
        for (const nodeId of state.board) {
            const node = state.nodes[nodeId];
            projections.draw(stg, node, state.nodes);
        }
    });
});

store.dispatch(action.startLevel(
    [ expr.number(3) ],
    [ expr.add(expr.missing(), expr.number(2)), expr.number(5) ],
    [ expr.number(1) ]
));
