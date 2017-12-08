import * as action from "./action";

const initialState = {
    goal: [],
    board: [],
    toolbox: [],
};

export function reduct(state=initialState, act) {
    switch (act.type) {
    case action.START_LEVEL: {
        return Object.assign({}, state, {
            goal: act.goal,
            board: act.board,
            toolbox: act.toolbox,
        });
    }
    default: {
        console.error(`Unknown action ${act.type}`);
        return state;
    }
    }
}
