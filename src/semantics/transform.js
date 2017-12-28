import * as immutable from "immutable";
import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import * as core from "./core";

import { nextId } from "../reducer/reducer";

function defaultProjector(definition) {
    const options = {};
    let baseProjection = gfx.roundedRect;
    if (definition.projection.shape === "<>") {
        baseProjection = gfx.hexaRect;
        options.padding = { left: 18, right: 18, inner: 10 };
    }

    const optionFields = ["color", "strokeWhenChild", "shadowOffset", "radius", "padding"];
    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }

    return function defaultProjectorFactory(stage, nodes, expr) {
        let childrenFunc = (id, state) =>
            definition.subexpressions.map(field => state.getIn([ "nodes", id, field ]));

        if (definition.projection.fields) {
            const fields = [];
            for (const field of definition.projection.fields) {
                const match = field.match(/'(.+)'/);
                if (match) {
                    fields.push(stage.allocate(gfx.text(match[1])));
                }
                else if (definition.fields.indexOf(field) > -1) {
                    fields.push(stage.allocate(gfx.text(expr.get(field))));
                }
                else {
                    fields.push(field);
                }
            }
            childrenFunc = (id, state) => fields.map((field) => {
                if (typeof field === "number") return field;
                return state.getIn([ "nodes", id, field ]);
            });
        }

        return gfx.layout.hbox(childrenFunc, options, baseProjection);
    };
}

function textProjector(definition) {
    return function textProjectorFactory(stage, nodes, expr) {
        return gfx.text(definition.projection.text.replace(
            /\{([a-zA-Z0-9]+)\}/,
            (match, field) => expr.get(field)
        ));
    };
}

function casesProjector(definition) {
    const cases = {};
    for (const [ caseName, defn ] of Object.entries(definition.projection.cases)) {
        cases[caseName] = projector(Object.assign({}, definition, {
            projection: defn,
        }));
    }
    return function casesProjectorFactory(stage, nodes, expr) {
        // TODO: better error handling if not found
        let key = expr.get(definition.projection.on);
        if (definition.projection.key) {
            key = definition.projection.key(nodes, expr);
        }
        if (typeof cases[key] === "undefined") {
            throw `Unrecognized case ${key} for projection of ${definition}`;
        }
        return cases[key](stage, expr);
    };
}

function symbolProjector(definition) {
    switch (definition.projection.symbol) {
    case "star":
        return () => gfx.shapes.star();
    case "rect":
        return () => gfx.shapes.rectangle();
    case "circle":
        return () => gfx.shapes.circle();
    case "triangle":
        return () => gfx.shapes.triangle();
    default:
        throw `Undefined symbol type ${definition.symbol}.`;
    }
}

function dynamicProjector(definition) {
    const cases = {};
    cases["__default__"] = projector(Object.assign({}, definition, {
        projection: definition.projection.default,
    }));
    for (const [ caseName, defn ] of Object.entries(definition.projection.cases)) {
        cases[caseName] = projector(Object.assign({}, definition, {
            projection: defn,
        }));
    }
    return function dynamicProjectorFactory(stage, nodes, expr) {
        const projections = {};
        for (const [ key, subprojector ] of Object.entries(cases)) {
            projections[key] = subprojector(stage, nodes, expr);
        }
        return gfx.dynamicType(projections);
    };
}

function projector(definition) {
    switch (definition.projection.type) {
    case "default":
        return defaultProjector(definition);
    case "case":
    case "cases":
        return casesProjector(definition);
    case "text":
        return textProjector(definition);
    case "symbol":
        return symbolProjector(definition);
    case "dynamic":
        return dynamicProjector(definition);
    default:
        throw `Unrecognized projection type ${definition.type}`;
    }
}

export default function transform(definition) {
    const module = {};
    module.definition = definition;
    module.projections = {};

    // Add default definitions for vtuple
    /**
     * A "virtual tuple" which kind of bleeds presentation into the
     * semantics. Represents a set of values that go together, but spill
     * onto the board when they are the top-level node.
     */
    module.vtuple = function vtuple(children) {
        const result = { type: "vtuple", locked: true, numChildren: children.length };
        let i = 0;
        for (const child of children) {
            result[`child${i}`] = child;
            i += 1;
        }
        return result;
    };
    module.projections.vtuple = function(_stage, _expr) {
        return gfx.layout.vbox((id, state) => {
            const node = state.getIn([ "nodes", id ]);
            const result = [];
            for (let i = 0; i < node.get("numChildren"); i++) {
                result.push(node.get(`child${i}`));
            }
            return result;
        }, {
            padding: {
                top: 0,
                inner: 5,
                bottom: 0,
                left: 0,
                right: 0,
            },
            strokeWhenChild: false,
            subexpScale: 1,
        });
    };

    for (const [ exprName, exprDefinition ] of Object.entries(definition.expressions)) {
        module[exprName] = function(...params) {
            const result = { type: exprName, locked: true };
            if (typeof exprDefinition.locked !== "undefined") {
                result.locked = exprDefinition.locked;
            }
            let argPointer = 0;
            for (const fieldName of exprDefinition.fields) {
                result[fieldName] = params[argPointer++];
            }
            for (const fieldName of exprDefinition.subexpressions) {
                result[fieldName] = params[argPointer++];
            }
            return result;
        };
        Object.defineProperty(module[exprName], "name", { value: exprName });

        module.projections[exprName] = projector(exprDefinition);
    }

    module.subexpressions = function subexpressions(expr) {
        const type = expr.type || expr.get("type");
        if (type === "vtuple") {
            const result = [];
            const nc = expr.get ? expr.get("numChildren") : expr.numChildren;
            for (let i = 0; i < nc; i++) {
                result.push(`child${i}`);
            }
            return result;
        }
        if (!definition.expressions[type]) throw `Unrecognized expression type ${type}`;
        return definition.expressions[type].subexpressions;
    };

    /**
     * @param nodes - We have to provide the node map since the store
     * won't have been updated yet.
     */
    module.project = function project(stage, nodes, expr) {
        const type = expr.get("type");
        if (!module.projections[type]) throw `Unrecognized expression type ${type}`;
        return module.projections[type](stage, nodes, expr);
    };

    module.smallStep = function smallStep(nodes, expr) {
        const type = expr.type || expr.get("type");
        const stepper = definition.expressions[type].smallStep;
        if (stepper) {
            // TODO: figure out where is best to do mutable->Immutable
            // conversion
            const result = stepper(module, nodes, expr);
            if (Array.isArray(result)) return result;

            // Return [topLevelNodeId, newNodeIds[], addedNodes[]]
            const imm = immutable.Map(result).set("id", nextId());
            const addedNodes = module.flatten(imm);
            return [ expr.get("id"), [ imm.get("id") ], addedNodes ];
        }
        return null;
    };

    module.betaReduce = function(nodes, exprId, argIds) {
        const target = nodes.get(exprId);
        const reducer = definition.expressions[target.get("type")].betaReduce;
        if (!reducer) return null;

        return reducer(module, nodes, target, argIds);
    };

    /**
     * Construct the animation for the small-step that the given
     * expression would take.
     */
    module.animateStep = function animateStep(stage, nodes, exp) {
        return animate.fx.shatter(stage, stage.views[exp.get("id")]);
    };

    module.singleStep = function singleStep(nodes, expr) {
        const kind = module.kind(expr);
        if (kind !== "expression") {
            return [ "error", expr.get("id") ];
        }

        for (const field of module.subexpressions(expr)) {
            const subexprId = expr.get(field);
            const subexpr = nodes.get(subexprId);
            const subexprKind = module.kind(subexpr);
            if (subexprKind !== "value" && subexprKind !== "syntax") {
                return module.singleStep(nodes, subexpr);
            }
        }

        const errorExpId = module.validateStep(nodes, expr);
        if (errorExpId !== null) {
            return [ "error", errorExpId ];
        }

        return [ "success", expr.get("id") ];
    };

    module.reducers = {};
    // TODO: need a "hybrid multi-step" that big-steps expressions we
    // don't care about
    module.reducers.single = function singleStepReducer(
        stage, nodes, exp,
        callback, errorCallback
    ) {
        // Single-step mode

        const [ result, exprId ] = module.singleStep(nodes, exp);
        if (result === "error") {
            errorCallback(exprId);
            return;
        }

        exp = nodes.get(exprId);
        module
            .animateStep(stage, nodes, exp)
            .then(() => module.smallStep(nodes, exp))
            .then(([ topNodeId, newNodeIds, addedNodes ]) => {
                callback(topNodeId, newNodeIds, addedNodes);
            });
    };

    module.reducers.multi = function multiStepReducer(
        stage, nodes, exp,
        callback, errorCallback, animated=true
    ) {
        const takeStep = (innerNodes, innerExpr) => {
            const [ result, exprId ] = module.singleStep(innerNodes, innerExpr);
            if (result === "error") {
                errorCallback(exprId);
                return Promise.reject();
            }

            innerExpr = innerNodes.get(exprId);
            const nextStep = () => {
                const [ topNodeId, newNodeIds, addedNodes ] =
                      module.smallStep(innerNodes, innerExpr);
                return callback(topNodeId, newNodeIds, addedNodes)
                    .then(newState => [ newState, topNodeId, newNodeIds ]);
            };

            if (animated) {
                return module.animateStep(stage, innerNodes, innerExpr).then(() => nextStep());
            }
            return nextStep();
        };

        let fuel = 20;
        const loop = (innerNodes, innerExpr) => {
            if (fuel <= 0) return;
            fuel -= 1;

            takeStep(innerNodes, innerExpr).then(([ newState, topNodeId, newNodeIds ]) => {
                if (innerExpr.get("id") === topNodeId) {
                    // TODO: handle multiple newNodeIds
                    innerExpr = newState.getIn([ "nodes", newNodeIds[0] ]);
                }
                else {
                    innerExpr = newState.getIn([ "nodes", innerExpr.get("id") ]);
                }

                if (module.kind(innerExpr) === "expression") {
                    if (animated) {
                        animate.after(350)
                            .then(() => loop(newState.get("nodes"), innerExpr));
                    }
                    else {
                        loop(newState.get("nodes"), innerExpr);
                    }
                }
            });
        };

        loop(nodes, exp);
    };

    module.reducers.big = function bigStepReducer(
        stage, nodes, exp,
        callback, errorCallback
    ) {
        // TODO: error callback needs to happen first
        module
            .animateStep(stage, nodes, exp)
            .then(() => module.reducers.multi(stage, nodes, exp, callback, errorCallback, false));
    };

    /**
     * A helper function that should abstract over big-step, small-step,
     * multi-step, and any necessary animation.
     *
     * TODO: it needs to also insert intermediate states into the
     * undo/redo stack, and mark which undo/redo states are big-steps,
     * small-steps, etc. to allow fine-grained undo/redo.
     */
    module.reduce = function reduce(stage, nodes, exp, callback, errorCallback) {
        // return module.reducers.single(stage, nodes, exp, callback, errorCallback);
        // return module.reducers.multi(stage, nodes, exp, callback, errorCallback);
        return module.reducers.big(stage, nodes, exp, callback, errorCallback);
    };

    module.shallowEqual = function shallowEqual(n1, n2) {
        if (n1.get("type") !== n2.get("type")) return false;

        for (const field of definition.expressions[n1.get("type")].fields) {
            if (n1.get(field) !== n2.get(field)) return false;
        }

        return true;
    };

    module.targetable = function(expr) {
        const defn = definition.expressions[expr.get("type")];
        return !expr.get("locked") || (defn && defn.targetable);
    };

    module.kind = function(expr) {
        switch (expr.get("type")) {
        case "vtuple":
            // This isn't quite right - depends on the children
            return "expression";
        default:
            return definition.expressions[expr.get("type")].kind;
        }
    };

    module.hydrate = function(nodes, expr) {
        return expr.withMutations((e) => {
            for (const field of module.subexpressions(e)) {
                e.set(field, module.hydrate(nodes, nodes.get(e.get(field))));
            }
        });
    };

    // TODO: get rid of this?
    module.typeCheck = function(nodes, expr) {
        const type = expr.get("type");
        const typeDefn = definition.expressions[type].type;
        if (typeof typeDefn === "function") {
            return typeDefn(module, nodes, expr);
        }
        else if (typeof typeDefn === "undefined") {
            return null;
        }
        return typeDefn;
    };

    module.collectTypes = function collectTypes(nodes, rootExpr) {
        const result = new Map();
        const completeness = new Map();

        // Update the type map with the type for the expression.
        const update = function update(id, ty) {
            if (!result.has(id)) {
                result.set(id, ty);
            }
            else {
                const prevTy = result.get(id);
                if (prevTy === "unknown") {
                    result.set(id, ty);
                }
                else if (prevTy !== ty) {
                    result.set(id, "error");
                }
            }
        };

        const step = function step(expr) {
            const id = expr.get("id");

            for (const field of module.subexpressions(expr)) {
                step(nodes.get(expr.get(field)));
            }

            const type = expr.get("type");
            const exprDefn = definition.expressions[type];
            if (!exprDefn) {
                console.warn(`No expression definition for ${type}`);
            }
            else {
                const typeDefn = exprDefn.type;
                if (typeof typeDefn === "function") {
                    const { types, complete } = typeDefn(module, nodes, result, expr);
                    completeness.set(
                        id,
                        complete && module.subexpressions(expr)
                            .map(field => completeness.get(expr.get(field)) ||
                                 module.kind(nodes.get(expr.get(field))) !== "expression")
                            .every(x => x)
                    );
                    for (const entry of types.entries()) {
                        update(...entry);
                    }
                }
                else if (typeof typeDefn === "undefined") {
                    // TODO: define constants/typing module
                    // result[id].add("unknown");
                }
                else {
                    completeness.set(id, true);
                    update(id, typeDefn);
                }
            }
        };

        step(rootExpr);

        return { types: result, completeness };
    };

    module.validateStep = function(nodes, expr) {
        const defn = definition.expressions[expr.get("type")];
        if (!defn) return null;

        const validator = defn.validateStep;
        if (!validator) return null;

        return validator(module, nodes, expr);
    };

    module.equal = core.genericEqual(module.subexpressions, module.shallowEqual);
    module.flatten = core.genericFlatten(nextId, module.subexpressions);
    module.map = core.genericMap(module.subexpressions);
    module.search = core.genericSearch(module.subexpressions);
    module.clone = core.genericClone(nextId, module.subexpressions);

    return module;
}
