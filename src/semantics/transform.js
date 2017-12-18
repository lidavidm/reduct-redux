import * as gfx from "../gfx/core";
import * as core from "./core";

import { nextId } from "../reducer/reducer";

function defaultProjector(definition) {
    const options = {};
    const optionFields = ["color", "strokeWhenChild"];
    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }
    // TODO: shape option

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

    // Add default definitions for missing, vtuple
    module.missing = function missing() {
        return { type: "missing", locked: false };
    };
    module.projections.missing = function(stage, expr) {
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
        for (let child of children) {
            result["child" + i.toString()] = child;
            i++;
        }
        return result;
    };
    module.projections.vtuple = function(stage, expr) {
        return gfx.layout.vbox((id, state) => {
            const node = state.getIn([ "nodes", id ]);
            const result = [];
            for (let i = 0; i < node.get("numChildren"); i++) {
                result.push(node.get(`child${i}`));
            }
            return result;
        }, {
            padding: { top: 0, inner: 5, bottom: 0, left: 0, right: 0 },
            strokeWhenChild: false,
            subexpScale: 1,
        });
    };

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

    module.project = function project(stage, expr) {
        const type = expr.get("type");
        if (!module.projections[type]) throw `Unrecognized expression type ${type}`;
        return module.projections[type](stage, expr);
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
