import * as action from "./action";

const initialState = {
    nodes: {},
    goal: [],
    board: [],
    toolbox: [],
    hover: null,
};

let idCounter = 0;

export function nextId() {
    return idCounter++;
}

export function reduct(semantics) {
    const flatten = function(expr) {
        return semantics.flatten(nextId, expr);
    };

    function reducer(state=initialState, act) {
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
            const result = stepExpr(state.nodes, state.board, act.nodeId);
            return Object.assign({}, state, result);
        }
        case action.HOVER: {
            return Object.assign({}, state, {
                hover: act.nodeId,
            });
        }
        default: {
            console.error(`Unknown action ${act.type}`);
            return state;
        }
        }
    }
    return {
        reducer: reducer,
    };
}

function stepExpr(nodes, board, node) {
    let topParent = node;

    while (nodes[topParent].parent) {
        topParent = nodes[topParent].parent;
    }

    if (board.indexOf(topParent) === -1) {
        return {
            nodes: nodes,
            board: board,
        };
    }

    switch (node.type) {
    case "add": {
        break;
    }
    default:
        break;
    }

    return {
        nodes: nodes,
        board: board,
    };
}
