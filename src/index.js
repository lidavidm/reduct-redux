import { createStore } from "redux";

const SMALL_STEP = "small-step";
const START_LEVEL = "start-level";

function number(value) {
    return { kind: "number", value: value };
}

function missing() {
    return { kind: "missing" };
}

function add(expr1, expr2) {
    return { kind: "add", left: expr1, right: expr2 };
}

function startLevel(goal, board, toolbox) {
    return {
        type: START_LEVEL,
        goal: goal,
        board: board,
        toolbox: toolbox,
    };
}

const initialState = {
    goal: [],
    board: [],
    toolbox: [],
};

function reduct(state=initialState, action) {
    switch (action.type) {
    case START_LEVEL: {
        return Object.assign({}, state, {
            goal: action.goal,
            board: action.board,
            toolbox: action.toolbox,
        });
    }
    default: {
        console.error(`Unknown action ${action.type}`);
        return state;
    }
    }
}

let store = createStore(reduct);

store.subscribe(() => {
    console.log(store.getState());
});

store.dispatch(startLevel(
    [ number(3) ],
    [ add(missing(), number(2)) ],
    [ number(1) ]
));
