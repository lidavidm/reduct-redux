import * as gfx from "../gfx/core";
import * as core from "./core";

import { nextId } from "../reducer/reducer";

function defaultProjector(definition) {
    const options = {};
    // TODO: shape
    if (definition.projection.color) options.color = definition.projection.color;

    return function(stage, expr) {
        let childrenFunc = (id, state) => {
            return definition.subexpressions.map((field) => state.getIn([ "nodes", id, field ]));
        };

        if (definition.projection.fields) {
            const fields = [];
            for (const field of definition.projection.fields) {
                const match = field.match(/'(.+)'/);
                if (match) {
                    fields.push(stage.allocate(gfx.text(match[1])));
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

        return gfx.layout.hbox(childrenFunc, options);
    };
}

function textProjector(definition) {
    return function(stage, expr) {
        return gfx.text(definition.projection.text.replace(/\{([a-zA-Z0-9]+)\}/, (match, field) => {
            return expr.get(field);
        }));
    };
}

function casesProjector(definition) {
    const cases = {};
    for (const [ caseName, defn ] of Object.entries(definition.projection.cases)) {
        cases[caseName] = projector(Object.assign({}, definition, {
            projection: defn,
        }));
    }
    return function(stage, expr) {
        // TODO: better error handling if not found
        return cases[expr.get(definition.projection.on)](stage, expr);
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

    // TODO: add default definitions for missing, vtuple

    for (const [ exprName, exprDefinition ] of Object.entries(definition.expressions)) {
        module[exprName] = function() {
            const result = { type: exprName, locked: true };
            let argPointer = 0;
            for (const fieldName of exprDefinition.fields) {
                result[fieldName] = arguments[argPointer++];
            }
            for (const fieldName of exprDefinition.subexpressions) {
                result[fieldName] = arguments[argPointer++];
            }
        };
        Object.defineProperty(module[exprName], "name", { value: exprName });

        module.projections[exprName] = projector(exprDefinition);
    }

    module.subexpressions = function subexpressions(expr) {
        const type = expr.type || expr.get("type");
        // TODO: account for missing, vtuple
        return definition.expressions[type].subexpressions;
    };

    module.project = function project(stage, expr) {
        return module.projections[expr.get("type")](stage, expr);
    };

    module.smallStep = function smallStep(nodes, expr) {
        const type = expr.type || expr.get("type");
        if (definition.expressions[type].smallStep) {
            return definition.expressions[type].smallStep(module, nodes, expr);
        }
        return null;
    };

    // module.clone = genericClone

    module.shallowEqual = function shallowEqual(n1, n2) {
        if (n1.get("type") !== n2.get("type")) return false;

        for (const field of definition.expressions[n1.get("type")].fields) {
            if (n1.get(field) !== n2.get("field")) return false;
        }

        return true;
    };

    module.equal = core.genericEqual(module.subexpressions, module.shallowEqual);
    module.flatten = core.genericFlatten(nextId, module.subexpressions);

    return module;
}
