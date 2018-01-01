import * as action from "../reducer/action";

export function startLevel(description, parse, store, stage) {
    const macros = Object.assign({}, description.macros);
    for (let macroName of Object.keys(macros)) {
        // Needs to be a thunk in order to allocate new ID each time
        let macro = macros[macroName];
        macros[macroName] = () => parse(macro, {});
    }

    const goal = description.goal.map(str => parse(str, macros));
    const board = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), []);
    const definedNames = board.filter(n => n.type === "define").map(n => n.name);
    // TODO: this should be a deep replace across board and toolbox
    // TODO: this should be semantics-independent
    const toolbox = description.toolbox
          .map(str => parse(str, macros))
          .map((n) => {
              if (n.type === "lambdaVar" && definedNames.indexOf(n.name) > -1) {
                  n.type = "reference";
              }
              return n;
          });
    store.dispatch(action.startLevel(stage, goal, board, toolbox));
}

export function checkVictory(state, semantics) {
    const board = state.get("board");
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
