import { createStore } from "redux";
import { reduct } from "./reducer";
import * as action from "./action";
import * as expr from "./expr";
import * as stage from "./stage";

let store = createStore(reduct);

const stg = new stage.Stage(800, 600);
document.body.appendChild(stg.view);

store.subscribe(() => {
    console.log(store.getState());

    stg.draw();
});

store.dispatch(action.startLevel(
    [ expr.number(3) ],
    [ expr.add(expr.missing(), expr.number(2)) ],
    [ expr.number(1) ]
));
