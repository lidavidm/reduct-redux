import * as immutable from "immutable";

export const USE_TOOLBOX = "use-toolbox";
export const RAISE = "raise";
export const DETACH = "detach";
export const FILL_HOLE = "fill-hole";
export const ATTACH_NOTCH = "attach-notch";
export const SMALL_STEP = "small-step";
export const UNFOLD = "unfold";
export const BETA_REDUCE = "beta-reduce";
export const START_LEVEL = "start-level";
export const VICTORY = "victory";
export const FADE = "fade";
export const UNFADE = "unfade";
export const DEFINE = "define";

/**
 * Redux action to start a new level.
 *
 * Takes trees of normal AST nodes and flattens them into immutable
 * nodes, suitable to store in Redux. Also runs the semantics module's
 * postParse hook, if defined, and creates the initial views for these
 * expressions.
 *
 * Flattened trees are doubly-linked: children know their parent, and
 * which parent field they are stored in.
 *
 * @param {basestage.BaseStage} stage
 * @param {Array} goal - List of (mutable) expressions for the goal.
 * @param {Array} board - List of (mutable) expressions for the board.
 * @param {Array} toolbox - List of (mutable) expressions for the toolbox.
 * @param {Object} globals - Map of (mutable) expressions for globals.
 */
export function startLevel(stage, goal, board, toolbox, globals) {
    const semantics = stage.semantics;

    let _nodes = {};
    let _goal = [];
    let _board = [];
    let _toolbox = [];
    let _globals = {};

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
    for (const [ name, expr ] of Object.entries(globals)) {
        for (const newExpr of semantics.flatten(expr)) {
            _nodes[newExpr.id] = newExpr;
        }
        _globals[name] = expr.id;
    }

    ({
        nodes: _nodes,
        goal: _goal,
        board: _board,
        toolbox: _toolbox,
        globals: _globals,
    } = semantics.parser.postParse(_nodes, _goal, _board, _toolbox, _globals));

    const finalNodes = immutable.Map().withMutations((fn) => {
        for (const node of Object.values(_nodes)) {
            fn.set(node.id, immutable.Map(node));
        }
    });

    finalNodes.forEach((node, nodeId) => {
        stage.views[nodeId] = semantics.project(stage, finalNodes, node);
    });

    return {
        type: START_LEVEL,
        nodes: finalNodes,
        goal: _goal,
        board: _board,
        toolbox: _toolbox,
        globals: _globals,
    };
}

/**
 * Node ``nodeId`` took a small step to produce ``newNode`` which
 * contains ``newNodes`` as nested nodes. All of these are immutable
 * nodes.
 */
export function smallStep(nodeId, newNodeIds, newNodes) {
    return {
        type: SMALL_STEP,
        topNodeId: nodeId,
        newNodeIds: newNodeIds,
        addedNodes: newNodes,
    };
}

/**
 * Unfold the definition of ``nodeId``, producing ``newNodeId`` (and
 * adding ``addedNodes`` to the store).
 */
export function unfold(nodeId, newNodeId, addedNodes) {
    return {
        type: UNFOLD,
        nodeId,
        newNodeId,
        addedNodes,
    };
}

/**
 * Node ``topNodeId`` was applied to ``argNodeId`` to produce
 * ``newNodeIds`` which contain ``addedNodes`` as nested nodes.
 *
 * A beta-reduction can produce multiple result nodes due to
 * replicators.
 */
export function betaReduce(topNodeId, argNodeId, newNodeIds, addedNodes) {
    return {
        type: BETA_REDUCE,
        topNodeId,
        argNodeId,
        newNodeIds,
        addedNodes,
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
export function useToolbox(nodeId, clonedNodeId=null, addedNodes=null) {
    return {
        type: USE_TOOLBOX,
        nodeId,
        clonedNodeId,
        addedNodes,
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

/**
 * Add a flag to the action indicating not to record this on the
 * undo/redo stack.
 */
export function skipUndo(action) {
    action.skipUndo = true;
    return action;
}

/**
 * Replace a node with its unfaded variant temporarily.
 */
export function unfade(source, nodeId, newNodeId, addedNodes) {
    return {
        type: UNFADE,
        source,
        nodeId,
        newNodeId,
        addedNodes,
    };
}

/**
 * Replace an unfaded node with its faded variant.
 */
export function fade(source, unfadedId, fadedId) {
    return {
        type: FADE,
        source,
        unfadedId,
        fadedId,
    };
}

/**
 * Define the given name as the given node ID.
 */
export function define(name, id) {
    return {
        type: DEFINE,
        name,
        id,
    };
}
