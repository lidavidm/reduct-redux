import * as action from "../reducer/action";

export function startLevel(description, parse, store, stage) {
    store.dispatch(action.startLevel(
        stage,
        description.goal.map(parse),
        description.board.map(parse),
        description.toolbox.map(parse)
    ));
}
