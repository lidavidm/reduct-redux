import * as core from "./core";
import transform from "./transform";

export default transform({
    name: "ECMAScript 6",
    parser: null,

    expressions: {
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
            type: (semant, nodes, expr) => expr.get("variant"),
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
            // type: (semant, nodes, expr) => {
            //     const opExpr = nodes.get(expr.get("op"));
            //     if (!opExpr) return "incomplete";

            //     const left = expr.get("left");
            //     const leftExpr = nodes.get(left);
            //     // TODO: function to check if expr is in missing class
            //     // (type box, etc)
            //     if (leftExpr.get("type") === "missing") return "incomplete";
            //     const leftType = semant.typeCheck(nodes, leftExpr);

            //     const right = expr.get("right");
            //     const rightExpr = nodes.get(right);
            //     if (rightExpr.get("type") === "missing") return "incomplete";
            //     const rightType = semant.typeCheck(nodes, rightExpr);

            //     const op = opExpr.get("name");
            //     if (op === "==") return "boolean";

            //     if (leftType === rightType) {
            //         return leftType;
            //     }
            //     // TODO: throw exception, present to player?
            //     return null;
            // },
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
                    // TODO: helper function, account for boolean
                    complete: types.has(expr.get("left")) &&
                        types.get(expr.get("left")).size === 1 &&
                        types.get(expr.get("left")).has("number") &&
                        types.has(expr.get("right")) &&
                        types.get(expr.get("right")).size === 1 &&
                        types.get(expr.get("right")).has("number"),
                };
            },
            // Invariant: all subexpressions are values or syntax;
            // none are missing. Return the first subexpression, if
            // any, that is blocking evaluation.
            // validateStep: (semant, nodes, expr) => {
            //     const left = expr.get("left");
            //     const leftExpr = nodes.get(left);
            //     const right = expr.get("right");
            //     const rightExpr = nodes.get(right);
            //     const op = nodes.get(expr.get("op")).get("name");

            //     if (op === "+" || op === "-") {
            //         if (semant.typeCheck(nodes, leftExpr) !== "number") {
            //             return left;
            //         }
            //         else if (semant.typeCheck(nodes, rightExpr) !== "number") {
            //             return right;
            //         }
            //     }
            //     else if (op === "==") {
            //         if (semant.typeCheck(nodes, leftExpr) !== semant.typeCheck(nodes, rightExpr)) {
            //             return right;
            //         }
            //     }

            //     return null;
            // },
            // TODO: switch to Immutable.Record to clean this up
            smallStep: (semant, nodes, expr) => {
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
            // type: (semant, nodes, expr) => {
            // },
            // validateStep: (semant, nodes, expr) => {
            // },
            smallStep: (semant, nodes, expr) => {
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
            smallStep: (semant, nodes, expr) => {
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
    },
});
