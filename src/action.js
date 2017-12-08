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
