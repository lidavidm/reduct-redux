export const HOVER = "hover";
export const SMALL_STEP = "small-step";
export const START_LEVEL = "start-level";

export function startLevel(goal, board, toolbox) {
    return {
        type: START_LEVEL,
        goal: goal,
        board: board,
        toolbox: toolbox,
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
