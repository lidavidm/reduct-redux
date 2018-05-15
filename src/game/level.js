import * as immutable from "immutable";

import * as progression from "../game/progression";
import * as action from "../reducer/action";
import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as layout from "../ui/layout";

export function startLevel(description, parse, store, stage) {
    animate.replaceDurationScales(description.animationScales);

    const macros = Object.assign({}, description.macros);
    for (const macroName of Object.keys(macros)) {
        // Needs to be a thunk in order to allocate new ID each time
        const macro = macros[macroName];
        macros[macroName] = () => parse(macro, {});
    }

    // Parse the defined names carried over from previous levels, the
    // globals added for this level, and any definitions on the board.

    // Lots of messiness because parse returns either an expression or
    // an array of expressions.
    const prevDefinedNames = description.extraDefines
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
          .map(expr => stage.semantics.parser.extractDefines(stage.semantics, expr))
          .filter(name => name !== null);
    const globalDefinedNames = Object.entries(description.globals)
          .map(([ name, str ]) => {
              let parsed = parse(str, macros);
              if (!Array.isArray(parsed)) {
                  parsed = [ parsed ];
              }
              [ parsed ] = parsed
                  .map(expr => stage.semantics.parser.extractDefines(stage.semantics, expr))
                  .filter(expr => expr !== null);
              return [ name, parsed[1] ];
          });
    const newDefinedNames = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
          .map(expr => stage.semantics.parser.extractDefines(stage.semantics, expr))
          .filter(name => name !== null);

    // Turn these defines into "macros", so that the name resolution
    // system can handle lookup.
    for (const [ name, expr ] of
         prevDefinedNames.concat(newDefinedNames).concat(globalDefinedNames)) {
        macros[name] = expr;
    }

    // Actually parse the goal, board, and toolbox.
    const goal = description.goal.map(str => parse(str, macros));
    const board = description.board
          .map(str => parse(str, macros))
          .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), []);
    const toolbox = description.toolbox
          .map(str => parse(str, macros));

    // Go back and parse the globals as well.
    const globals = {};
    description.extraDefines
        .map(str => parse(str, macros))
        .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
        .map(expr => stage.semantics.parser.extractGlobals(stage.semantics, expr))
        .filter(name => name !== null)
        .forEach(([ name, val ]) => {
            globals[name] = val;
        });
    for (const [ name, definition ] of Object.entries(description.globals)) {
        let rawParsed = parse(definition, macros);
        if (!Array.isArray(rawParsed)) rawParsed = [ rawParsed ];
        const parsed = rawParsed
              .reduce((a, b) => (Array.isArray(b) ? a.concat(b) : a.concat([b])), [])
              .map(expr => stage.semantics.parser.extractGlobals(stage.semantics, expr))
              .filter(name => name !== null);
        if (parsed.length !== 1) {
            console.error(`level.startLevel: defining global ${name} as ${definition} led to multiple parsed expressions.`);
            continue;
        }
        globals[name] = parsed[0][1];
    }

    // Update the store with the parsed data.
    store.dispatch(action.startLevel(stage, goal, board, toolbox, globals));
    stage.startLevel(description.textgoal, description.showConcreteGoal);
    stage.registerNewDefinedNames(newDefinedNames.map(elem => elem[0]));

    const state = stage.getState();
    const nodes = state.get("nodes");

    // Lay out the board.
    const positions = layout.repulsorPacking(stage, {
        x: 20,
        y: 150,
        w: stage.width - 40,
        h: (stage.height - (stage.toolbox.size.h) - 25 - 10 - 150),
    }, state.get("board").toArray().filter(id => nodes.get(id).get("type") !== "defineAttach"));

    if (positions !== null) {
        for (const [ id, pos ] of positions) {
            const view = stage.views[id];
            view.pos.x = pos.x;
            view.pos.y = pos.y;
        }
    }

    // TODO: semantics-specific layout algorithms. This lays out the
    // notches along the side for defines. Eventually we would want
    // this to be customizable as well.
    let notchY = 160;
    for (const nodeId of state.get("board")) {
        const node = nodes.get(nodeId);
        if (node.get("type") === "defineAttach") {
            stage.views[nodeId].pos.y = notchY;
            notchY += 160;
        }
    }

    // For anything that is fading, spawn the old node on top
    const checkFade = source => (nodeId, idx) => {
        if (stage.semantics.search(
            state.get("nodes"), nodeId,
            (_, id) => progression.isFadeBorder(state.getIn([ "nodes", id, "type" ]))
        ).length > 0) {
            const descr = description[source][idx];

            progression.overrideFadeLevel(() => {
                const flattened = stage.semantics.flatten(parse(descr, macros));
                const topNode = flattened[0].id;

                const tempNodes = state.get("nodes").withMutations((n) => {
                    for (const node of flattened) {
                        n.set(node.id, immutable.Map(node));
                    }
                });

                flattened.forEach((e) => {
                    const node = tempNodes.get(e.id);
                    stage.views[e.id] = stage.semantics.project(stage, tempNodes, node);
                });
                stage.views[topNode].pos = stage.views[nodeId].pos;

                stage.views[topNode] = gfx.custom.fadeMe(stage.views[topNode], (tween) => {
                    stage.fade(source, topNode, nodeId)
                        .then(() => tween.stop());
                });

                store.dispatch(action.unfade(
                    source, nodeId, topNode,
                    flattened.map(e => immutable.Map(e))
                ));
            });
        }
    };
    state.get("board").forEach(checkFade("board"));
    state.get("toolbox").forEach(checkFade("toolbox"));

    // "Inflate" animation.
    let i = 0;
    for (const nodeId of stage.getState().get("board")) {
        stage.views[nodeId].scale = { x: 0.0, y: 0.0 };
        stage.views[nodeId].anchor = { x: 0.5, y: 0.5 };
        animate.tween(stage.views[nodeId].scale, { x: 1.0, y: 1.0 }, {
            duration: 500,
            easing: animate.Easing.Anticipate.BackOut(1.1),
        }).delay(300 - (300 / (i + 1)));
        i += 1;
    }

    // Bump things away from edges
    animate.after(500).then(() => {
        for (const topViewId of stage.getState().get("board")) {
            stage.bumpAwayFromEdges(topViewId);
        }
    });

    if (description.syntax.length > 0) {
        animate.after(500).then(() => {
            stage.learnSyntax(description.syntax);
        });
    }
}

export function checkVictory(state, semantics, partial=false) {
    const board = state.get("board").filter(n => !semantics.ignoreForVictory(state.getIn([ "nodes", n ])));
    const goal = state.get("goal");

    if (board.size !== goal.size && !partial) {
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
        if (!found && !partial) {
            success = false;
            return false;
        }
        return true;
    });

    if (success || partial) {
        return matching;
    }
    return {};
}

/**
 * Convert the game state back into a JSON level description.
 */
export function serialize(state, semantics) {
    const board = [];
    const goal = [];
    const toolbox = [];
    const nodes = state.get("nodes");
    for (const id of state.get("board")) {
        const result = semantics.parser.unparse(semantics.hydrate(nodes, nodes.get(id)));
        if (result !== null) {
            board.push(result);
        }
    }
    for (const id of state.get("goal")) {
        const result = semantics.parser.unparse(semantics.hydrate(nodes, nodes.get(id)));
        if (result !== null) {
            goal.push(result);
        }
    }
    for (const id of state.get("toolbox")) {
        const result = semantics.parser.unparse(semantics.hydrate(nodes, nodes.get(id)));
        if (result !== null) {
            toolbox.push(result);
        }
    }

    return { board, goal, toolbox };
}
