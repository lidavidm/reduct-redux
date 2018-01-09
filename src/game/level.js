import * as action from "../reducer/action";

export function startLevel(description, parse, store, stage) {
    const macros = Object.assign({}, description.macros);
    for (const macroName of Object.keys(macros)) {
        // Needs to be a thunk in order to allocate new ID each time
        const macro = macros[macroName];
        macros[macroName] = () => parse(macro, {});
    }
    // TODO: add a macro for each defined name

    const goal = description.goal.map(str => parse(str, macros));
    const board = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), []);
    const toolbox = description.toolbox
          .map(str => parse(str, macros));
    store.dispatch(action.startLevel(stage, goal, board, toolbox));
}

export function checkVictory(state, semantics) {
    const board = state.get("board").filter(n => !semantics.ignoreForVictory(state.getIn([ "nodes", n ])));
    const goal = state.get("goal");

    if (board.size !== goal.size) {
        return false;
    }

    const used = {};
    const matching = {};
    let success = true;
    goal.forEach((nodeId) => {
        let found = false;
        board.forEach((candidateId, idx) => {
            if (used[idx]) return true;
            if (semantics.equal(nodeId, candidateId, state)) {
                used[idx] = true;
                matching[nodeId] = candidateId;
                found = true;
                return false;
            }
            return true;
        });
        if (!found) {
            success = false;
            return false;
        }
        return true;
    });

    if (success) {
        return matching;
    }
    return {};
}
