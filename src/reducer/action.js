import * as immutable from "immutable";
import * as animate from "../gfx/animate";

export const HOVER = "hover";
export const USE_TOOLBOX = "use-toolbox";
export const RAISE = "raise";
export const DETACH = "detach";
export const FILL_HOLE = "fill-hole";
export const ATTACH_NOTCH = "attach-notch";
export const SMALL_STEP = "small-step";
export const BETA_REDUCE = "beta-reduce";
export const START_LEVEL = "start-level";
export const VICTORY = "victory";

/**
 * Redux action to start a new level.
 *
 * Takes trees of normal AST nodes and flattens them into immutable
 * nodes, suitable to store in Redux.
 *
 * Flattened trees are doubly-linked: children know their parent, and
 * which parent field they are stored in.
 */
export function startLevel(stage, goal, board, toolbox) {
    const semantics = stage.semantics;

    console.info("action.startLevel: starting with", goal, board, toolbox);

    const _nodes = {};
    const _goal = [];
    const _board = [];
    const _toolbox = [];
    for (const expr of goal) {
        for (const newExpr of semantics.flatten(expr)) {
            _nodes[newExpr.id] = newExpr;
        }
        _goal.push(expr.id);
    }
    for (const expr of board) {
        for (const newExpr of semantics.flatten(expr)) {
            _nodes[newExpr.id] = newExpr;
        }
        _board.push(expr.id);
    }
    for (const expr of toolbox) {
        for (const newExpr of semantics.flatten(expr)) {
            _nodes[newExpr.id] = newExpr;
        }
        _toolbox.push(expr.id);
    }

    const finalNodes = immutable.Map().withMutations((fn) => {
        for (const node of Object.values(_nodes)) {
            fn.set(node.id, immutable.Map(node));
        }
    });

    let notchY = 160;
    finalNodes.map((node, nodeId) => {
        stage.views[nodeId] = semantics.project(stage, finalNodes, node);
        // TODO: real layout algorithm
        if (_board.indexOf(nodeId) >= 0) {
            stage.views[nodeId].pos.x = 50 + Math.floor(Math.random() * 500);
            stage.views[nodeId].pos.y = 100 + Math.floor(Math.random() * 300);
        }
        // TODO: semantics-specific layout algorithms
        if (node.get("type") === "defineAttach") {
            stage.views[nodeId].pos.y = notchY;
            notchY += 160;
        }
    });

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

/**
 * Node `nodeId` took a small step to produce `newNode` which contains
 * `newNodes` as nested nodes.
 */
export function smallStep(nodeId, newNodeIds, newNodes) {
    console.debug(`smallStep: ${nodeId} became ${newNodeIds}`);
    return {
        type: SMALL_STEP,
        topNodeId: nodeId,
        newNodeIds: newNodeIds,
        addedNodes: newNodes,
    };
}

/**
 * Node `topNodeId` was applied to `argNodeId` to produce `newNodeIds`
 * which contain `addedNodes` as nested nodes.
 *
 * A beta-reduction can produce multiple result nodes due to replicators.
 */
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

/**
 * Raise the given node to the top.
 *
 * This is a visual concern, but the stage draws nodes in the order
 * they are in the store, so this changes the z-index. We could make
 * the board an immutable.Set and store the draw-order elsewhere, but
 * we would have to synchronize it with any changes to the store. I
 * figured it was easier to just break separation in this case.
 */
export function raise(nodeId) {
    return {
        type: RAISE,
        nodeId: nodeId,
    };
}

/**
 * Detach the given node from its parent.
 */
export function detach(nodeId) {
    return {
        type: DETACH,
        nodeId: nodeId,
    };
}

/**
 * Replace the given hole by the given expression.
 */
export function fillHole(holeId, childId) {
    return {
        type: FILL_HOLE,
        holeId: holeId,
        childId: childId,
    };
}

/**
 * Attach the child to the given parent through the given notches
 */
export function attachNotch(parentId, notchIdx, childId, childNotchIdx) {
    return {
        type: ATTACH_NOTCH,
        parentId,
        childId,
        notchIdx,
        childNotchIdx,
    };
}

/**
 * Take the given node out of the toolbox.
 */
export function useToolbox(nodeId) {
    return {
        type: USE_TOOLBOX,
        nodeId: nodeId,
    };
}

/**
 * We've won the level.
 *
 * Clear the board/goal, which has the side effect of stopping them
 * from drawing anymore.
 */
export function victory() {
    return {
        type: VICTORY,
    };
}
