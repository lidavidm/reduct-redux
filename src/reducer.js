import * as action from "./action";

const initialState = {
    nodes: {},
    goal: [],
    board: [],
    toolbox: [],
};

let idCounter = 0;

function flatten(expr) {
    switch (expr.type) {
    case "number":
    case "missing": {
        expr.id = idCounter++;
        return [expr];
    }
    case "add": {
        expr.id = idCounter++;
        const result = [expr].concat(flatten(expr.left)).concat(flatten(expr.right));
        expr.left = expr.left.id;
        expr.right = expr.right.id;
        return result;
    }
    default: {
        console.error(`Undefined expression type ${expr.type}.`);
        return [expr];
    }
    }
}

export function reduct(state=initialState, act) {
    switch (act.type) {
    case action.START_LEVEL: {
        let nodes = [];
        let goal = [];
        let board = [];
        let toolbox = [];
        for (const expr of act.goal) {
            nodes = nodes.concat(flatten(expr));
            goal.push(expr.id);
        }
        for (const expr of act.board) {
            nodes = nodes.concat(flatten(expr));
            board.push(expr.id);
        }
        for (const expr of act.toolbox) {
            nodes = nodes.concat(flatten(expr));
            toolbox.push(expr.id);
        }
        return Object.assign({}, state, {
            nodes: nodes,
            goal: goal,
            board: board,
            toolbox: toolbox,
        });
    }
    case action.CLICK: {
        const node = state.nodes[act.nodeId];
        console.log("Clicked", node);
        return state;
    }
    default: {
        console.error(`Unknown action ${act.type}`);
        return state;
    }
    }
}
