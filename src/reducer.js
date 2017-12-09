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
    function reducer(state=initialState, act) {
        switch (act.type) {
        case action.START_LEVEL: {
            let nodes = [];
            let goal = [];
            let board = [];
            let toolbox = [];
            for (const expr of act.goal) {
                nodes = nodes.concat(semantics.flatten(expr));
                goal.push(expr.id);
            }
            for (const expr of act.board) {
                nodes = nodes.concat(semantics.flatten(expr));
                board.push(expr.id);
            }
            for (const expr of act.toolbox) {
                nodes = nodes.concat(semantics.flatten(expr));
                toolbox.push(expr.id);
            }
            return Object.assign({}, state, {
                nodes: nodes,
                goal: goal,
                board: board,
                toolbox: toolbox,
            });
        }
        case action.SMALL_STEP: {
            const queue = [ act.nodeId ];
            const removedNodes = {};

            while (queue.length > 0) {
                const current = queue.pop();
                removedNodes[current] = true;
                for (const subexp of semantics.subexpressions(state.nodes[current])) {
                    queue.push(subexp);
                }
            }

            const newNodes = {};
            for (const [ id, node ] of Object.entries(state.nodes)) {
                if (removedNodes[id]) continue;
                newNodes[id] = node;
            }
            for (const node of act.newNodes) {
                newNodes[node.id] = node;
            }
            const result = Object.assign({}, state, {
                nodes: newNodes,
                board: [
                    ...state.board.filter((id) => !removedNodes[id]),
                    act.newNode.id,
                ]
            });
            console.log(result, act.newNodes);
            return result;
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
