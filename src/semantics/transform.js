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

    const optionFields = ["color", "strokeWhenChild"];
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
    default:
        throw `Unrecognized projection type ${definition.type}`;
    }
}

export default function transform(definition) {
    const module = {};
    module.definition = definition;
    module.projections = {};

    // Add default definitions for missing, vtuple
    module.missing = function missing() {
        return { type: "missing", locked: false };
    };
    module.projections.missing = function projectMissing(_stage, _expr) {
        return gfx.roundedRect({
            color: "#555",
            shadowOffset: -2,
            radius: 22,
        });
    };

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
        if (type === "missing") return [];
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

    /**
     * A helper function that should abstract over big-step, small-step,
     * multi-step, and any necessary animation.
     *
     * TODO: it needs to also insert intermediate states into the
     * undo/redo stack, and mark which undo/redo states are big-steps,
     * small-steps, etc. to allow fine-grained undo/redo.
     */
    module.reduce = function reduce(stage, nodes, exp, callback) {
        // Single-step mode
        for (const field of module.subexpressions(exp)) {
            const subexprId = exp.get(field);
            const subexpr = nodes.get(subexprId);
            const kind = module.kind(subexpr);
            if (kind !== "value" && kind !== "syntax") {
                module.reduce(stage, nodes, subexpr, callback);
                return;
            }
        }

        const errorExp = module.validateStep(nodes, exp);
        if (errorExp !== null) {
            // TODO: highlight error
            return;
        }

        module
            .animateStep(stage, nodes, exp)
            .then(() => module.smallStep(nodes, exp))
            .then(([ topNodeId, newNodeIds, addedNodes ]) => {
                callback(topNodeId, newNodeIds, addedNodes);
            });
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
        case "missing":
            return "placeholder";
        case "vtuple":
            // This isn't quite right - depends on the children
            return "expression";
        default:
            return definition.expressions[expr.get("type")].kind;
        }
    };

    module.typeCheck = function(nodes, expr) {
        const type = expr.get("type");
        const typeDefn = definition.expressions[type].type;
        if (typeof typeDefn === "function") {
            return typeDefn(nodes, expr);
        }
        return typeDefn;
    };

    module.validateStep = function(nodes, expr) {
        return null;
    };

    module.equal = core.genericEqual(module.subexpressions, module.shallowEqual);
    module.flatten = core.genericFlatten(nextId, module.subexpressions);
    module.map = core.genericMap(module.subexpressions);
    module.search = core.genericSearch(module.subexpressions);
    module.clone = core.genericClone(nextId, module.subexpressions);

    return module;
}
