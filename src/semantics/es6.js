import * as core from "./core";
import transform from "./transform";

export default transform({
    name: "ECMAScript 6",
    parser: null,

    expressions: {
        missing: core.missing,

        number: {
            kind: "value",
            type: "number",
            fields: ["value"],
            subexpressions: [],
            projection: {
                type: "default",
                shape: "()",
                color: "white",
                fields: ["value"],
            },
        },

        dynamicVariant: {
            kind: "value",
            type: (semant, nodes, types, expr) => expr.get("variant"),
            fields: ["variant", "value"],
            subexpressions: [],
            projection: {
                type: "default",
                shape: "()",
                color: "purple",
                fields: ["value"],
            },
        },

        op: {
            kind: "syntax",
            fields: ["name"],
            subexpressions: [],
            projection: {
                type: "text",
                text: "{name}",
            },
        },

        binop: {
            kind: "expression",
            fields: [],
            subexpressions: ["left", "op", "right"],
            projection: {
                type: "case",
                key: (nodes, expr) => nodes.get(expr.get("op")).get("name"),
                cases: {
                    "+": {
                        type: "default",
                        shape: "()",
                        color: "orange",
                    },
                    "-": {
                        type: "default",
                        shape: "()",
                        color: "orange",
                    },
                    "==": {
                        type: "default",
                        shape: "<>",
                        color: "hotpink",
                    },
                },
            },
            type: (semant, nodes, types, expr) => {
                const opExpr = nodes.get(expr.get("op"));
                const id = expr.get("id");
                const result = new Map();
                if (!opExpr) {
                    result.set(id, "unknown");
                }

                const op = opExpr.get("name");
                if (op === "==") {
                    result.set(id, "boolean");
                }
                else {
                    result.set(id, "number");
                    result.set(expr.get("left"), "number");
                    result.set(expr.get("right"), "number");
                }

                return {
                    types: result,
                    complete: types.get(expr.get("left")) === "number" &&
                        types.get(expr.get("right")) === "number",
                };
            },
            // Invariant: all subexpressions are values or syntax;
            // none are missing. Return the first subexpression, if
            // any, that is blocking evaluation.
            validateStep: (semant, state, expr) => {
                const nodes = state.get("nodes");
                const left = expr.get("left");
                const leftExpr = nodes.get(left);
                const right = expr.get("right");
                const rightExpr = nodes.get(right);
                const op = nodes.get(expr.get("op")).get("name");

                if (op === "+" || op === "-") {
                    if (leftExpr.get("ty") !== "number") {
                        return left;
                    }
                    else if (rightExpr.get("ty") !== "number") {
                        return right;
                    }
                }
                else if (op === "==") {
                    if (leftExpr.get("ty") !== rightExpr.get("ty")) {
                        return right;
                    }
                }

                return null;
            },
            // TODO: switch to Immutable.Record to clean this up
            smallStep: (semant, state, expr) => {
                const nodes = state.get("nodes");
                const op = nodes.get(expr.get("op")).get("name");
                if (op === "+") {
                    return semant.number(nodes.get(expr.get("left")).get("value") +
                                         nodes.get(expr.get("right")).get("value"));
                }
                else if (op === "-") {
                    return semant.number(nodes.get(expr.get("left")).get("value") -
                                         nodes.get(expr.get("right")).get("value"));
                }
                else if (op === "==") {
                    return semant.bool(semant.shallowEqual(
                        nodes.get(expr.get("left")),
                        nodes.get(expr.get("right"))
                    ));
                }
                throw `Unrecognized operator ${op}`;
            },
        },

        conditional: {
            kind: "expression",
            fields: [],
            // TODO: need some way to specify that "positive" and
            // "negative" should not be evaluated
            subexpressions: ["condition", "positive", "negative"],
            projection: {
                type: "default",
                shape: "()",
                color: "lightblue",
                fields: ["'if'", "condition", "'then'", "positive", "'else'", "negative"],
            },
            type: (semant, nodes, types, expr) => {
                const result = new Map();
                const positiveTy = types.get(expr.get("positive"));
                const branchesMatch =
                      positiveTy === types.get(expr.get("negative")) &&
                      positiveTy !== null &&
                      typeof positiveTy !== "undefined";
                if (branchesMatch) {
                    result.set(expr.get("id"), types.get(expr.get("positive")));
                }
                result.set(expr.get("condition"), "boolean");

                return {
                    types: result,
                    complete: branchesMatch && types.get(expr.get("condition")) === "boolean",
                };
            },
            validateStep: (semant, state, expr) => {
                const nodes = state.get("nodes");
                const condition = expr.get("condition");
                if (nodes.get(condition).get("ty") !== "boolean") {
                    return condition;
                }

                const positive = expr.get("positive");
                const negative = expr.get("negative");
                if (nodes.get(positive).get("ty") !== nodes.get(negative).get("ty")) {
                    return negative;
                }
                return null;
            },
            smallStep: (semant, state, expr) => {
                const nodes = state.get("nodes");
                const cond = nodes.get(expr.get("condition")).get("value");
                // TODO: do this cleanup in evaluation?
                if (cond) {
                    return nodes.get(expr.get("positive"))
                        .delete("parent")
                        .delete("parentField");
                }
                return nodes.get(expr.get("negative"))
                    .delete("parent")
                    .delete("parentField");
            },
            // Filter to determine which subexpressions to evaluate
            // before stepping the overall expression.
            substepFilter: (semant, state, expr, field) => field === "condition",
        },

        apply: {
            kind: "expression",
            fields: [],
            subexpressions: ["callee", "argument"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["callee", "'('", "argument", "')'"],
            },
            smallStep: (semant, state, expr) => {
                const nodes = state.get("nodes");
                const [ topNodeId, newNodeIds, addedNodes ] = semant.betaReduce(
                    nodes, expr.get("callee"),
                    [ expr.get("argument") ]
                );
                return [ expr.get("id"), newNodeIds, addedNodes ];
            },
        },

        bool: {
            kind: "value",
            type: "boolean",
            fields: ["value"],
            subexpressions: [],
            projection: {
                type: "default",
                shape: "<>",
                color: "hotpink",
                fields: ["value"],
            },
        },

        lambda: {
            kind: "value",
            type: "lambda",
            fields: [],
            subexpressions: ["arg", "body"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["arg", "'=>'", "body"],
            },
            betaReduce: (semant, nodes, expr, argIds) =>
                core.genericBetaReduce(semant, nodes, {
                    topNode: expr,
                    targetNode: nodes.get(expr.get("arg")),
                    argIds,
                    targetName: node => node.get("name"),
                    isVar: node => node.get("type") === "lambdaVar",
                    varName: node => node.get("name"),
                }),
        },

        lambdaArg: {
            fields: ["name"],
            subexpressions: [],
            targetable: true,
            projection: {
                type: "text",
                text: "({name})",
            },
            betaReduce: (semant, nodes, expr, argIds) => {
                if (expr.get("parent")) {
                    return semant.betaReduce(nodes, expr.get("parent"), argIds);
                }
                return null;
            },
        },

        lambdaVar: {
            fields: ["name"],
            subexpressions: [],
            projection: {
                type: "default",
                shape: "()",
                strokeWhenChild: false,
                fields: ["name"],
            },
        },

        reference: {
            kind: "expression",
            fields: ["name"],
            subexpressions: [],
            smallStep: (semant, state, expr) => {
                let res = state.get("globals").get(expr.get("name"));
                if (!res) return null;
                const resNode = state.get("nodes").get(res);
                if (resNode.get("type") === "define") {
                    res = resNode.get("body");
                }
                const result = semant.clone(res, state.get("nodes"));
                return [
                    expr.get("id"),
                    [ result[0].get("id") ],
                    [ result[0].delete("parent").delete("parentField") ].concat(result[1]),
                ];
            },
            validateStep: (semant, state, expr) => {
                if (!state.get("globals").has(expr.get("name"))) {
                    return expr.get("id");
                }
                return null;
            },
            projection: {
                type: "dynamic",
                field: (state, exprId) => {
                    const name = state.getIn([ "nodes", exprId, "name" ]);
                    if (state.get("globals").has(name)) {
                        return "enabled";
                    }
                    return "default";
                },
                default: {
                    type: "default",
                    shape: "()",
                    strokeWhenChild: false,
                    fields: [{
                        field: "name",
                        color: "gray",
                    }],
                },
                cases: {
                    enabled: {
                        type: "default",
                        shape: "()",
                        strokeWhenChild: false,
                        fields: ["name"],
                    },
                },
            },
        },

        symbol: {
            kind: "value",
            type: "symbol",
            fields: ["name"],
            subexpressions: [],
            projection: {
                type: "case",
                on: "name",
                cases: {
                    star: {
                        type: "symbol",
                        symbol: "star",
                    },
                    circle: {
                        type: "symbol",
                        symbol: "circle",
                    },
                    triangle: {
                        type: "symbol",
                        symbol: "triangle",
                    },
                    rect: {
                        type: "symbol",
                        symbol: "rect",
                    },
                },
            },
        },

        define: {
            kind: "statement",
            ignoreForVictory: true,
            fields: ["name"],
            subexpressions: ["body"],
            notches: [
                {
                    side: "left",
                    type: "inset",
                    shape: "wedge",
                    relpos: 0.8,
                },
            ],
            projection: {
                type: "vbox",
                subexpScale: 1.0,
                rows: [
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'def'", "name"],
                        subexpScale: 1.0,
                    },
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'   '", "body"],
                        subexpScale: 1.0,
                    },
                ],
            },
        },

        defineAttach: {
            kind: "syntax",
            fields: [],
            subexpressions: [],
            notches: [
                {
                    side: "right",
                    type: "outset",
                    shape: "wedge",
                    relpos: 0.5,
                    onAttach: (semant, state, selfId, otherId) => {
                        const name = state.getIn([ "nodes", otherId, "name" ]);
                        state.set("globals", state.get("globals").set(name, otherId));
                    },
                    onDetach: (semant, state, selfId, otherId) => {
                        const name = state.getIn([ "nodes", otherId, "name" ]);
                        state.set("globals", state.get("globals").delete(name));
                    },
                },
            ],
            projection: {
                type: "sticky",
                side: "left",
                content: {
                    type: "default",
                    shape: "notch",
                    color: "lightgray",
                    shadow: true,
                    shadowColor: "#000",
                    shadowOffset: 2,
                },
            },
        },
    },
});
