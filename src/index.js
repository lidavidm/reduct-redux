import { createStore } from "redux";
import { reduct } from "./reducer";
import * as action from "./action";
import * as expr from "./expr";

let store = createStore(reduct);

store.subscribe(() => {
    console.log(store.getState());
});

store.dispatch(action.startLevel(
    [ expr.number(3) ],
    [ expr.add(expr.missing(), expr.number(2)) ],
    [ expr.number(1) ]
));
