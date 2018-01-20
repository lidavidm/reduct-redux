import * as action from "../reducer/action";
import * as animate from "../gfx/animate";
import * as layout from "../ui/layout";

export function startLevel(description, parse, store, stage) {
    const macros = Object.assign({}, description.macros);
    for (const macroName of Object.keys(macros)) {
        // Needs to be a thunk in order to allocate new ID each time
        const macro = macros[macroName];
        macros[macroName] = () => parse(macro, {});
    }
    const prevDefinedNames = description.extraDefines
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
          .map(expr => stage.semantics.parser.extractDefines(stage.semantics, expr))
          .filter(name => name !== null);
    const newDefinedNames = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
          .map(expr => stage.semantics.parser.extractDefines(stage.semantics, expr))
          .filter(name => name !== null);

    for (const [ name, expr ] of prevDefinedNames.concat(newDefinedNames)) {
        macros[name] = expr;
    }

    const goal = description.goal.map(str => parse(str, macros));
    const board = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), []);
    const toolbox = description.toolbox
          .map(str => parse(str, macros));

    const globals = {};
    description.extraDefines
        .map(str => parse(str, macros))
        .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
        .map(expr => stage.semantics.parser.extractGlobals(stage.semantics, expr))
        .filter(name => name !== null)
        .forEach(([ name, val ]) => {
            globals[name] = val;
        });
    // TODO: parse globals field of level description

    store.dispatch(action.startLevel(stage, goal, board, toolbox, globals));
    stage.startLevel();

    const scaleFactor = (1 - (1 / 1.4)) / 2.0;
    const positions = layout.ianPacking(stage, {
        x: stage.width * scaleFactor,
        y: stage.height * scaleFactor,
        w: stage.width - (stage.width * scaleFactor),
        h: (stage.height - (90 * (stage.toolbox.rows - 1))) / 1.4,
    }, stage.getState().get("board"));

    if (positions !== null) {
        for (const [ id, pos ] of positions) {
            stage.views[id].pos.x = pos.x;
            stage.views[id].pos.y = pos.y;
        }
    }

    // TODO: semantics-specific layout algorithms
    let notchY = 160;
    for (const nodeId of stage.getState().get("board")) {
        const node = stage.getState().get("nodes").get(nodeId);
        if (node.get("type") === "defineAttach") {
            stage.views[nodeId].pos.y = notchY;
            notchY += 160;
        }
    }

    for (const nodeId of stage.getState().get("board")) {
        stage.views[nodeId].scale = { x: 0.0, y: 0.0 };
        stage.views[nodeId].anchor = { x: 0.5, y: 0.5 };
        animate.tween(stage.views[nodeId].scale, { x: 1.0, y: 1.0 }, {
            duration: 250,
            easing: animate.Easing.Cubic.In,
        });
    }
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
