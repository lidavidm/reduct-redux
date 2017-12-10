import * as immutable from "immutable";
import { combineReducers } from "redux-immutable";

import * as action from "./action";
import { undoable } from "./undo";

const initialProgram = immutable.Map({
    nodes: immutable.Map(),
    goal: immutable.List(),
    board: immutable.List(),
    toolbox: immutable.List(),
});
const initialState = immutable.Map({
    program: initialProgram,
    hover: null,
});

let idCounter = 0;

export function nextId() {
    return idCounter++;
}

export function reduct(semantics) {
    function hover(state=null, act) {
        switch(act.type) {
        case action.HOVER: {
            return act.nodeId;
        }
        default: return state;
        }
    }

    function program(state=initialProgram, act) {
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
        case action.RAISE: {
            const board = state.get("board");
            if (board.contains(act.nodeId)) {
                const newBoard = board.filter((n) => n !== act.nodeId).push(act.nodeId);
                return state.set("board", newBoard);
            }
            return state;
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
        case action.FILL_HOLE: {
            const hole = state.getIn([ "nodes", act.holeId ]);

            const holeParent = state.getIn([ "nodes", act.holeId, "parent" ]);
            if (holeParent === undefined) throw `Hole ${act.holeId} has no parent!`;

            const child = state.getIn([ "nodes", act.childId ]);
            if (child.get("parent")) throw `Dragging objects from one hole to another is unsupported.`;

            return state.withMutations(map => {
                map.set("board", map.get("board").filter((n) => n != act.childId));
                map.set("nodes", map.get("nodes").withMutations(nodes => {
                    nodes.set(holeParent, nodes.get(holeParent).withMutations(holeParent => {
                        holeParent.set(hole.get("parentField") + "__hole", holeParent.get(hole.get("parentField")));
                        holeParent.set(hole.get("parentField"), act.childId);
                    }));
                    nodes.set(act.childId, child.withMutations(child => {
                        child.set("parentField", hole.get("parentField"));
                        child.set("parent", holeParent);
                        child.set("locked", false);
                    }));
                }));
            });

            return state;
        }
        case action.DETACH: {
            const node = state.getIn([ "nodes", act.nodeId ]);

            const parent = state.getIn([ "nodes", act.nodeId, "parent" ]);
            if (parent === undefined) throw `Can't detach node ${act.nodeId} with no parent!`;

            return state.withMutations(map => {
                map.set("board", map.get("board").push(act.nodeId));
                map.set("nodes", map.get("nodes").withMutations(nodes => {
                    nodes.set(parent, nodes.get(parent).withMutations(parent => {
                        const oldHole = parent.get(node.get("parentField") + "__hole");
                        if (oldHole) {
                            parent.set(node.get("parentField"), oldHole);
                            parent.delete(node.get("parentField") + "__hole");
                        }
                        else {
                            throw `Unimplemented: creating new hole`;
                        }
                    }));
                    nodes.set(act.nodeId, node.withMutations(node => {
                        node.delete("parentField");
                        node.delete("parent");
                    }));
                }));
            });

            return state;
        }
        default: return state;
        }
    }

    return {
        reducer: combineReducers({
            hover,
            program: undoable(program, {
                actionFilter: (act) => act.type === action.RAISE,
            }),
        }),
    };
}
