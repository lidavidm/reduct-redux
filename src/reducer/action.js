import * as immutable from "immutable";

export const HOVER = "hover";
export const RAISE = "raise";
export const DETACH = "detach";
export const FILL_HOLE = "fill-hole";
export const SMALL_STEP = "small-step";
export const START_LEVEL = "start-level";

export function startLevel(stage, goal, board, toolbox) {
    const semantics = stage.semantics;

    let _nodes = [];
    let _goal = [];
    let _board = [];
    let _toolbox = [];
    for (const expr of goal) {
        _nodes = _nodes.concat(semantics.flatten(expr));
        _goal.push(expr.id);
    }
    for (const expr of board) {
        _nodes = _nodes.concat(semantics.flatten(expr));
        _board.push(expr.id);
    }
    for (const expr of toolbox) {
        _nodes = _nodes.concat(semantics.flatten(expr));
        _toolbox.push(expr.id);
    }

    const finalNodes = [];

    for (const node of _nodes) {
        const immNode = immutable.Map(node);
        finalNodes.push(immNode);
        stage.views[node.id] = semantics.project(stage, immNode);
        // TODO: real layout algorithm
        if (_board.indexOf(node.id) >= 0) {
            stage.views[node.id].pos.x = 50 + Math.floor(Math.random() * 500);
            stage.views[node.id].pos.y = 100 + Math.floor(Math.random() * 300);
        }
    }

    return {
        type: START_LEVEL,
        nodes: finalNodes,
        goal: _goal,
        board: _board,
        toolbox: _toolbox,
    };
}

export function smallStep(nodeId, newNode, newNodes) {
    return {
        type: SMALL_STEP,
        nodeId: nodeId,
        newNode: newNode,
        newNodes: newNodes,
    };
}

export function hover(nodeId) {
    return {
        type: HOVER,
        nodeId: nodeId,
    };
}

export function raise(nodeId) {
    return {
        type: RAISE,
        nodeId: nodeId,
    };
}

export function detach(nodeId) {
    return {
        type: DETACH,
        nodeId: nodeId,
    };
}

export function fillHole(holeId, childId) {
    return {
        type: FILL_HOLE,
        holeId: holeId,
        childId: childId,
    };
}
