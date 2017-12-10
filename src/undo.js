import * as immutable from "immutable";

const UNDO = "undo";
const REDO = "redo";

export function undo() {
    return {
        type: UNDO,
    };
}

export function redo() {
    return {
        type: REDO,
    };
}

export function undoable(reducer, options={}) {
    const initialState = immutable.Map({
        $present: reducer(undefined, {}),
        $past: immutable.Stack(),
        $future: immutable.Stack(),
    });

    return function(state=initialState, action) {
        const $present = state.get("$present");
        const $past = state.get("$past");
        const $future = state.get("$future");

        switch (action.type) {
        case UNDO: {
            if ($past.isEmpty()) return state;

            return state.withMutations(map => {
                map
                    .set("$past", $past.shift())
                    .set("$present", $past.peek())
                    .set("$future", $future.unshift($present));
            });
        }
        case REDO: {
            if ($future.isEmpty()) return state;

            return state.withMutations(map => {
                map
                    .set("$past", $past.unshift($present))
                    .set("$present", $future.peek())
                    .set("$future", $future.shift());
            });
        }
        default: {
            const newPresent = reducer($present, action);
            if (newPresent === $present) {
                return state;
            }
            else if (options.actionFilter && options.actionFilter(action)) {
                return state.set("$present", newPresent);
            }
            return state.withMutations(map => {
                map
                    .set("$past", $past.unshift($present))
                    .set("$present", newPresent)
                    .set("$future", immutable.Stack());
            });
        }
        }
    };
}
