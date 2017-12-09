import * as immutable from "immutable";

import * as action from "./action";

const initialState = immutable.Map({
    nodes: immutable.Map(),
    goal: immutable.List(),
    board: immutable.List(),
    toolbox: immutable.List(),
    hover: null,
});

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
            return state.merge({
                nodes: immutable.Map(nodes.map((n) => [ n.id, immutable.Map(n) ])),
                goal: goal,
                board: board,
                toolbox: toolbox,
                hover: null,
            });
        }
        case action.SMALL_STEP: {
            const queue = [ act.nodeId ];
            const removedNodes = {};

            while (queue.length > 0) {
                const current = queue.pop();
                removedNodes[current] = true;
                for (const subexp of semantics.subexpressions(state.getIn([ "nodes", current ]))) {
                    queue.push(subexp);
                }
            }

            const newNodes = state.get("nodes").filter(function (key, value) {
                return !removedNodes[key];
            }).merge(immutable.Map(act.newNodes.map((n) => [ n.id, immutable.Map(n) ])));

            return state
                .set("nodes", newNodes)
                .set("board",
                     state.get("board").filter((id) => !removedNodes[id]).push(act.newNode.id));
        }
        case action.HOVER: {
            return state.set("hover", act.nodeId);
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
