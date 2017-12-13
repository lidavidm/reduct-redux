import * as action from "../reducer/action";

export function startLevel(description, parse, store, stage) {
    const macros = Object.assign({}, description.macros);
    for (let macroName of Object.keys(macros)) {
        // Needs to be a thunk in order to allocate new ID each time
        let macro = macros[macroName];
        macros[macroName] = () => parse(macro, {});
    }

    store.dispatch(action.startLevel(
        stage,
        description.goal.map((str) => parse(str, macros)),
        description.board.map((str) => parse(str, macros)),
        description.toolbox.map((str) => parse(str, macros))
    ));
}
