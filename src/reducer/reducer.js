import * as immutable from "immutable";
import { combineReducers } from "redux-immutable";

import * as action from "./action";
import * as gfx from "../gfx/core";
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

export function reduct(semantics, views) {
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
            const nodes = immutable.Map(act.nodes.map((n) => [ n.get("id"), n ]));
            return state.merge({
                nodes: nodes,
                goal: act.goal,
                board: act.board,
                toolbox: act.toolbox,
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
                const currentNode = state.getIn([ "nodes", current ]);
                removedNodes[current] = true;
                for (const subexpField of semantics.subexpressions(currentNode)) {
                    queue.push(currentNode.get(subexpField));
                }
            }

            const oldNode = state.getIn([ "nodes", act.nodeId ]);

            let newNodes = state.get("nodes").filter(function (key, value) {
                return !removedNodes[key];
            }).merge(immutable.Map(act.newNodes.map((n) => [ n.get("id"), immutable.Map(n) ])));

            let newBoard = state.get("board").filter((id) => !removedNodes[id]);
            if (!oldNode.get("parent")) {
                newBoard = newBoard.push(act.newNode);
            }
            else {
                const parent = newNodes.get(oldNode.get("parent"))
                      .set(oldNode.get("parentField"), act.newNode);
                newNodes = newNodes.set(oldNode.get("parent"), parent);
            }

            return state
                .set("nodes", newNodes)
                .set("board", newBoard);
        }
        case action.BETA_REDUCE: {
            const queue = [ act.topNodeId, act.argNodeId ];
            const removedNodes = {};

            const addedNodes = immutable.Map(act.addedNodes.map((n) => {
                const id = n.get("id");
                if (act.newNodeIds.indexOf(id) >= 0) {
                    return [ id, n.delete("parent").delete("parentField") ];
                }
                else {
                    return [ id, n ];
                }
            }));

            while (queue.length > 0) {
                const current = queue.pop();
                const currentNode = state.getIn([ "nodes", current ]);
                removedNodes[current] = true;
                for (const subexpField of semantics.subexpressions(currentNode)) {
                    queue.push(currentNode.get(subexpField));
                }
            }

            const oldNode = state.getIn([ "nodes", act.topNodeId ]);

            let newNodes = state.get("nodes").filter(function (key, value) {
                return !removedNodes[key];
            }).merge(addedNodes);

            let newBoard = state.get("board").filter((id) => !removedNodes[id]);
            if (!oldNode.get("parent")) {
                newBoard = newBoard.concat(act.newNodeIds);
            }
            else {
                if (act.newNodeIds.length > 1) {
                    console.error(`Can't beta reduce nested lambda that produced multiple new nodes!`);
                    return null;
                }
                const parent = newNodes.get(oldNode.get("parent"))
                      .set(oldNode.get("parentField"), act.newNodeIds[0]);
                newNodes = newNodes.set(oldNode.get("parent"), parent);
            }

            return state.withMutations(s => {
                s.set("nodes", newNodes);
                s.set("board", newBoard);
                s.set("toolbox", s.get("toolbox").filter((id) => !removedNodes[id]));
            });
        }
        case action.FILL_HOLE: {
            const hole = state.getIn([ "nodes", act.holeId ]);

            const holeParent = state.getIn([ "nodes", act.holeId, "parent" ]);
            if (holeParent === undefined) throw `Hole ${act.holeId} has no parent!`;

            const child = state.getIn([ "nodes", act.childId ]);
            if (child.get("parent")) throw `Dragging objects from one hole to another is unsupported.`;

            return state.withMutations(map => {
                map.set("board", map.get("board").filter((n) => n != act.childId));
                map.set("toolbox", map.get("toolbox").filter((n) => n != act.childId));
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
        case action.USE_TOOLBOX: {
            if (state.get("toolbox").contains(act.nodeId)) {
                return state.withMutations(state => {
                    state.set("board", state.get("board").push(act.nodeId));
                    state.set("toolbox", state.get("toolbox").filter((n) => n != act.nodeId));
                });
            }
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
                extraState: (state, newState) => {
                    const result = {};
                    for (const id of state.get("board")) {
                        if (views[id]) {
                            result[id] = Object.assign({}, gfx.absolutePos(views[id]));
                        }
                    }
                    for (const id of newState.get("board")) {
                        if (views[id]) {
                            result[id] = Object.assign({}, gfx.absolutePos(views[id]));
                        }
                    }
                    return result;
                },
                restoreExtraState: (state, oldState, extraState) => {
                    for (const id of state.get("board")) {
                        if (!oldState.get("board").contains(id)) {
                            if (extraState[id]) {
                                console.log(id);
                                views[id].pos.x = extraState[id].x;
                                views[id].pos.y = extraState[id].y;
                            }
                            else {
                                console.log("No extra state", id);
                            }
                        }
                    }
                    for (const id of state.get("toolbox")) {
                        if (!oldState.get("toolbox").contains(id)) {
                            views[id].pos = gfx.absolutePos(views[id]);
                        }
                    }
                },
            }),
        }),
    };
}
