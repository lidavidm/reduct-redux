import * as immutable from "immutable";

import Audio from "../resource/audio";

import * as animate from "../gfx/animate";

import { nextId } from "../reducer/reducer";

export default function(module) {
    /**
     * Take a small step on this expression.
     *
     * Requires that pertinent subexpressions (as defined by
     * substepFilter) have been reduced first.
     *
     * @returns {Array} The ID of the original expression, a list of
     * IDs of resulting nodes, and a list of added nodes (which have
     * IDs assigned and are immutable already).
     */
    module.interpreter.smallStep = function smallStep(stage, state, expr) {
        const type = expr.type || expr.get("type");
        const stepper = module.definitionOf(type).smallStep;
        if (stepper) {
            const result = stepper(module, stage, state, expr);

            if (!result) return null;

            if (Array.isArray(result)) return result;

            if (immutable.Map.isMap(result)) {
                // TODO: is this quite correct?
                return [ expr.get("id"), [ result.get("id") ], [ result ] ];
            }

            // Return [topLevelNodeId, newNodeIds[], addedNodes[]]
            result.id = nextId();
            const addedNodes = module.flatten(result).map(immutable.Map);
            return [ expr.get("id"), [ addedNodes[0].get("id") ], addedNodes ];
        }
        return null;
    };

    /**
     * Apply a list of expressions to another expression.
     */
    module.interpreter.betaReduce = function(stage, state, exprId, argIds) {
        const target = state.get("nodes").get(exprId);
        const reducer = module.definitionOf(target).betaReduce;
        if (!reducer) {
            console.warn(`Expression type ${target.get("type")} was beta-reduced, but has no reducer.`);
            return null;
        }

        return reducer(module, stage, state, target, argIds);
    };

    /**
     * Construct the animation for the small-step that the given
     * expression would take.
     */
    module.interpreter.animateStep = function animateStep(stage, state, exp) {
        const defn = module.definitionOf(exp.get("type"));
        if (defn && defn.stepSound) {
            if (typeof defn.stepSound === "function") {
                const sequence = defn.stepSound(module, state, exp);
                Audio.playSeries(sequence);
            }
            else {
                Audio.play(defn.stepSound);
            }
        }
        if (defn && defn.stepAnimation) {
            return defn.stepAnimation(module, stage, state, exp);
        }

        const scaleCategory = `expr-${exp.get("type")}`;
        return animate.fx.shatter(stage, stage.views[exp.get("id")], {
            introDuration: animate.scaleDuration(600, scaleCategory),
            outroDuration: animate.scaleDuration(600, scaleCategory),
        });
    };

    const __substepFilter = () => true;
    module.interpreter.substepFilter = function getSubstepFilter(type) {
        const defn = module.definitionOf(type);
        if (defn && defn.substepFilter) {
            return defn.substepFilter;
        }
        return __substepFilter;
    };

    /**
     * Given an expression, find the first child that needs to have a
     * step taken, or the first child that is blocking evaluation.
     */
    module.interpreter.singleStep = function singleStep(state, expr, exprFilter=null) {
        const nodes = state.get("nodes");
        const kind = module.kind(expr);
        if (kind !== "expression") {
            console.debug(`semant.interpreter.singleStep: could not step since ${expr.get("id")} is '${kind}', not 'expression'`);
            return [ "error", expr.get("id") ];
        }

        if (exprFilter === null) exprFilter = () => false;
        const substepFilter = module.interpreter.substepFilter(expr.get("type"));

        if (!exprFilter(state, expr)) {
            for (const field of module.subexpressions(expr)) {
                const subexprId = expr.get(field);
                const subexpr = nodes.get(subexprId);
                const subexprKind = module.kind(subexpr);

                if (!substepFilter(module, state, expr, field)) {
                    continue;
                }

                // Hardcoded: delay expansion of references until
                // absolutely necessary (when they're being applied)
                if (subexpr.get("type") === "reference") {
                    if (expr.get("type") !== "apply" && (
                        !subexpr.get("params") ||
                            module.subexpressions(subexpr)
                            .every(f => nodes.get(subexpr.get(f)).get("type") === "missing")
                    )) {
                        continue;
                    }
                }

                if (subexprKind !== "value" && subexprKind !== "syntax") {
                    return module.interpreter.singleStep(state, subexpr, exprFilter);
                }
            }
        }

        const errorExpId = module.interpreter.validateStep(state, expr);
        if (errorExpId !== null) {
            console.debug(`semant.interpreter.singleStep: could not step due to ${errorExpId}`);
            return [ "error", errorExpId ];
        }

        return [ "success", expr.get("id") ];
    };

    function nullToError(exprId, callback) {
        return (result) => {
            if (result === null) {
                callback(exprId);
                return Promise.reject(exprId);
            }
            return result;
        };
    }

    /**
     * A submodule containing evaluation strategies.
     */
    module.interpreter.reducers = {};
    module.interpreter.reducers.single = function singleStepReducer(
        stage, state, exp, callbacks,
        recordUndo=true
    ) {
        // Single-step mode

        const [ result, exprId ] = module.interpreter.singleStep(state, exp);
        if (result === "error") {
            callbacks.error(exprId);
            return Promise.reject(exprId);
        }

        const nodes = state.get("nodes");
        exp = nodes.get(exprId);
        return module
            .interpreter.animateStep(stage, state, exp)
            .then(() => module.interpreter.smallStep(stage, state, exp))
            .then(nullToError(exprId, callbacks.error))
            .then(([ topNodeId, newNodeIds, addedNodes ]) => {
                callbacks.update(topNodeId, newNodeIds, addedNodes, recordUndo);
                // TODO: handle multiple new nodes
                return newNodeIds[0];
            });
    };

    module.interpreter.reducers.over = function stepOverReducer(
        stage, state, exp, callbacks,
        recordUndo=true
    ) {
        // Step over previously defined names

        // Return true if we are at an apply expression where the
        // callee is a previously defined function
        const shouldStepOver = (state, expr) => {
            if (expr.get("type") === "reference" && expr.get("params") && expr.get("params").length > 0) {
                if (stage.newDefinedNames.includes(expr.get("name"))) {
                    return false;
                }

                // If reference with holes, step over so long as all
                // args are not references or applications
                for (const subexprField of module.subexpressions(expr)) {
                    const subexpr = state.getIn([ "nodes", expr.get(subexprField) ]);
                    const kind = module.kind(subexpr);
                    if (kind === "expression") {
                        if (subexpr.get("type") === "reference") {
                            return (!subexpr.get("params") ||
                                    subexpr.get("params").length === 0 ||
                                    module
                                    .subexpressions(subexpr)
                                    .every(p => state.getIn([ "nodes", subexpr.get(p) ])
                                           .get("type") === "missing"));
                        }
                        return false;
                    }
                    else if (kind === "missing") {
                        return false;
                    }
                }
                return true;
            }

            if (expr.get("type") !== "apply") {
                return false;
            }
            const callee = state.getIn([ "nodes", expr.get("callee") ]);
            if (callee.get("type") !== "reference") {
                return false;
            }
            if (stage.newDefinedNames.includes(callee.get("name"))) {
                return false;
            }
            for (const subexprField of module.subexpressions(expr)) {
                const subexpr = state.getIn([ "nodes", expr.get(subexprField) ]);
                if (subexpr.get("type") === "reference") {
                    return !(
                        subexpr
                            .get("params") &&
                            subexpr
                            .get("params")
                            .some(p => state.getIn([ "nodes", subexpr.get(`arg_${p}`), "type" ]) !== "missing")
                    );
                }
                else if (module.kind(subexpr) === "expression" && subexpr.get("type") !== "reference") {
                    return false;
                }
            }
            return true;
        };

        const [ result, exprId ] = module.interpreter.singleStep(state, exp, shouldStepOver);

        if (result === "error") {
            callbacks.error(exprId);
            return Promise.reject(exprId);
        }

        const nodes = state.get("nodes");
        exp = nodes.get(exprId);

        if (shouldStepOver(state, exp)) {
            const name = exp.get("type") === "reference" ? exp.get("name") :
                  `subcall ${nodes.get(exp.get("callee")).get("name")}`;
            console.debug(`semant.interpreter.reducers.over: stepping over call to ${name}`);
            return module.interpreter.reducers.big(stage, state, exp, callbacks);
        }
        return module
            .interpreter.animateStep(stage, state, exp)
            .then(() => module.interpreter.smallStep(stage, state, exp))
            .then(nullToError(exprId, callbacks.error))
            .then(([ topNodeId, newNodeIds, addedNodes ]) => {
                callbacks.update(topNodeId, newNodeIds, addedNodes, recordUndo);
                // TODO: handle multiple new nodes
                return newNodeIds[0];
            });
    };

    module.interpreter.reducers.multi = function multiStepReducer(
        stage, state, exp, callbacks,
        animated=true, recordUndo=true
    ) {
        let firstStep = true;

        const takeStep = (innerState, topExpr) => {
            const [ result, exprId ] = module.interpreter.singleStep(innerState, topExpr);
            if (result === "error") {
                callbacks.error(exprId);
                return Promise.reject();
            }

            const innerExpr = innerState.get("nodes").get(exprId);
            const nextStep = () => {
                const result = module.interpreter.smallStep(stage, innerState, innerExpr);
                if (result === null) {
                    callbacks.error(exprId);
                    return Promise.reject(topExpr.get("id"));
                }
                const [ topNodeId, newNodeIds, addedNodes ] = result;

                return callbacks.update(topNodeId, newNodeIds, addedNodes, recordUndo || firstStep)
                    .then((newState) => {
                        firstStep = false;
                        if (topExpr.get("id") === topNodeId) {
                            // TODO: handle multiple newNodeIds
                            topExpr = newState.getIn([ "nodes", newNodeIds[0] ]);
                        }
                        else {
                            topExpr = newState.getIn([ "nodes", topExpr.get("id") ]);
                        }

                        if ((callbacks.stop && callbacks.stop(newState, topExpr)) ||
                            module.kind(topExpr) !== "expression") {
                            return Promise.reject(topExpr.get("id"));
                        }
                        return [ newState, topExpr ];
                    });
            };

            if (animated) {
                return module.interpreter
                    .animateStep(stage, innerState, innerExpr)
                    .then(() => nextStep());
            }
            return nextStep();
        };

        let fuel = 200;
        const loop = (innerState, topExpr) => {
            if (fuel <= 0) return Promise.resolve(topExpr.get("id"));
            fuel -= 1;

            return takeStep(innerState, topExpr).then(([ newState, innerExpr ]) => {
                if (animated) {
                    return animate.after(800)
                        .then(() => loop(newState, innerExpr));
                }
                return loop(newState, innerExpr);
            }, (finalId) => {
                console.debug(`semant.interpreter.reducers.multi: ${fuel} fuel remaining`);
                return Promise.resolve(finalId);
            });
        };

        return loop(state, exp);
    };

    module.interpreter.reducers.big = function bigStepReducer(stage, state, exp, callbacks) {
        // Only play animation if we actually take any sort of
        // small-step
        let playedAnim = false;
        return module.interpreter.reducers.multi(
            stage, state, exp,
            Object.assign({}, callbacks, {
                update: (...args) => {
                    if (!playedAnim) {
                        playedAnim = true;
                        return module.interpreter
                            .animateStep(stage, state, exp)
                            .then(() => callbacks.update(...args));
                    }
                    return callbacks.update(...args);
                },
            }), false, false
        );
    };

    module.interpreter.reducers.medium = function mediumStepReducer(stage, state, exp, callbacks) {
        // Only play animation if we actually take any sort of
        // small-step
        let playedAnim = false;
        return module.interpreter.reducers.multi(
            stage, state, exp,
            Object.assign({}, callbacks, {
                update: (...args) => {
                    if (!playedAnim) {
                        playedAnim = true;
                        return module.interpreter
                            .animateStep(stage, state, exp)
                            .then(() => callbacks.update(...args));
                    }
                    return callbacks.update(...args);
                },
                stop: (state, topExpr) => {
                    let curExpr = topExpr;
                    const rhs = [];
                    const nodes = state.get("nodes");
                    let repeated = null;
                    while (curExpr.get("type") === "apply") {
                        const callee = nodes.get(curExpr.get("callee"));
                        if (callee.get("type") === "reference") {
                            rhs.push(callee.get("name"));
                            curExpr = nodes.get(curExpr.get("argument"));
                            if (callee.get("name") === "repeat") break;
                        }
                        else if (callee.get("type") === "apply") {
                            curExpr = callee;
                            if (!repeated) {
                                repeated = nodes.get(callee.get("argument"));
                                if (repeated.get("type") !== "reference") return false;
                            }
                        }
                        else {
                            return false;
                        }
                    }

                    if (curExpr.get("type") === "number") return true;
                    if (!repeated) return false;
                    if (curExpr.get("type") !== "number") return false;
                    if (rhs[rhs.length - 1].get("name") !== "repeat") return false;

                    for (const name of rhs.slice(0, -1)) {
                        if (name !== repeated.get("name")) return false;
                    }

                    return true;
                },
            }), false, false
        );
    };

    module.interpreter.reducers.hybrid = function multiStepReducer(stage, state, exp, callbacks) {
        const takeStep = (innerState, topExpr) => {
            const [ result, exprId ] = module.interpreter.singleStep(innerState, topExpr);
            if (result === "error") {
                callbacks.error(exprId);
                return Promise.reject();
            }

            const innerExpr = innerState.get("nodes").get(exprId);
            if (innerExpr.get("type") === "reference" && !stage.newDefinedNames.includes(innerExpr.get("name"))) {
                return module.interpreter.reducers
                    .over(stage, innerState, topExpr, callbacks)
                    .then((topId) => {
                        const newState = stage.getState();

                        let node = newState.getIn([ "nodes", topId ]);
                        while (node.has("parent")) {
                            node = newState.getIn([ "nodes", node.get("parent") ]);
                        }

                        if (module.kind(node) !== "expression") {
                            return Promise.reject(topId);
                        }
                        return [ newState, node ];
                    });
            }

            const nextStep = () => {
                const [ topNodeId, newNodeIds, addedNodes ] =
                      module.interpreter.smallStep(stage, innerState, innerExpr);

                return callbacks.update(topNodeId, newNodeIds, addedNodes, true)
                    .then((newState) => {
                        if (topExpr.get("id") === topNodeId) {
                            // TODO: handle multiple newNodeIds
                            topExpr = newState.getIn([ "nodes", newNodeIds[0] ]);
                        }
                        else {
                            topExpr = newState.getIn([ "nodes", topExpr.get("id") ]);
                        }

                        if (module.kind(topExpr) !== "expression" ||
                            stage.mode !== "hybrid") {
                            return Promise.reject(topExpr.get("id"));
                        }
                        return [ newState, topExpr ];
                    });
            };

            return module.interpreter
                .animateStep(stage, innerState, innerExpr)
                .then(() => nextStep());
        };

        let fuel = 50;
        const loop = (innerState, topExpr) => {
            if (fuel <= 0) return Promise.resolve(topExpr.get("id"));
            fuel -= 1;

            return takeStep(innerState, topExpr).then(([ newState, innerExpr ]) => {
                const duration = animate.scaleDuration(
                    800,
                    "multi-step",
                    `expr-${topExpr.get("type")}`
                );
                return animate.after(duration)
                    .then(() => loop(newState, innerExpr));
            }, (finalId) => {
                console.debug(`semant.interpreter.reducers.hybrid: ${fuel} fuel remaining`);
                return Promise.resolve(finalId);
            });
        };

        return loop(state, exp);
    };

    /**
     * A helper function that should abstract over big-step, small-step,
     * multi-step, and any necessary animation.
     *
     * TODO: it needs to also insert intermediate states into the
     * undo/redo stack, and mark which undo/redo states are big-steps,
     * small-steps, etc. to allow fine-grained undo/redo.
     */
    module.interpreter.reduce = function reduce(stage, state, exp, mode, callbacks) {
        switch (mode) {
        case "small":
            return module.interpreter.reducers.single(stage, state, exp, callbacks);
        case "over":
            return module.interpreter.reducers.over(stage, state, exp, callbacks);
        case "multi":
            return module.interpreter.reducers.multi(stage, state, exp, callbacks);
        case "big":
            return module.interpreter.reducers.big(stage, state, exp, callbacks);
        case "medium":
            return module.interpreter.reducers.medium(stage, state, exp, callbacks);
        case "hybrid":
        default:
            return module.interpreter.reducers.hybrid(stage, state, exp, callbacks);
        }
    };

    /**
     * Validate that the given expression can take a single step.
     */
    module.interpreter.validateStep = function(state, expr) {
        const defn = module.definitionOf(expr);
        if (!defn) return null;

        const validator = defn.validateStep;
        if (!validator) return null;

        return validator(module, state, expr);
    };
}
