export const CLICK = "click";
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

export function click(nodeId) {
    return {
        type: CLICK,
        nodeId: nodeId,
    };
}

export function hover(nodeId) {
    return {
        type: HOVER,
        nodeId: nodeId,
    };
}
