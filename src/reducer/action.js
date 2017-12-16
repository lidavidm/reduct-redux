import * as immutable from "immutable";
import * as animate from "../gfx/animate";

export const HOVER = "hover";
export const USE_TOOLBOX = "use-toolbox";
export const RAISE = "raise";
export const DETACH = "detach";
export const FILL_HOLE = "fill-hole";
export const SMALL_STEP = "small-step";
export const BETA_REDUCE = "beta-reduce";
export const START_LEVEL = "start-level";

export function startLevel(stage, goal, board, toolbox) {
    const semantics = stage.semantics;

    console.info("action.startLevel: starting with", goal, board, toolbox);

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

    for (const nodeId of _board) {
        stage.views[nodeId].scale = { x: 0.0, y: 0.0 };
        stage.views[nodeId].anchor = { x: 0.5, y: 0.5 };
        animate.tween(stage.views[nodeId].scale, { x: 1.0, y: 1.0 }, {
            duration: 250,
            easing: animate.Easing.Cubic.In,
        });
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
    console.debug(`smallStep: ${nodeId} became ${newNode}`);
    return {
        type: SMALL_STEP,
        nodeId: nodeId,
        newNode: newNode,
        newNodes: newNodes,
    };
}

export function betaReduce(topNodeId, argNodeId, newNodeIds, addedNodes) {
    console.debug(`betaReduce: apply ${topNodeId} to ${argNodeId}, resulting in ${newNodeIds}`);
    return {
        type: BETA_REDUCE,
        topNodeId: topNodeId,
        argNodeId: argNodeId,
        newNodeIds: newNodeIds,
        addedNodes: addedNodes,
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

export function useToolbox(nodeId) {
    return {
        type: USE_TOOLBOX,
        nodeId: nodeId,
    };
}
