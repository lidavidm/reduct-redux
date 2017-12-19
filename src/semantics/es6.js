import * as core from "./core";
import transform from "./transform";

export default transform({
    name: "ECMAScript 6",
    parser: null,

    expressions: {
        number: {
            fields: ["value"],
            subexpressions: [],
            projection: {
                type: "default",
                shape: "()",
                color: "white",
                fields: ["value"],
            },
        },

        op: {
            fields: ["name"],
            subexpressions: [],
            projection: {
                type: "text",
                text: "{name}",
            },
        },

        binop: {
            fields: [],
            subexpressions: ["left", "op", "right"],
            projection: {
                type: "default",
                shape: "()",
                color: "orange",
            },
            // TODO: switch to Immutable.Record to clean this up
            smallStep: (semant, nodes, expr) =>
                semant.number(nodes.get(expr.get("left")).get("value") +
                              nodes.get(expr.get("right")).get("value")),
        },

        apply: {
            fields: [],
            subexpressions: ["callee", "argument"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["callee", "'('", "argument", "')'"],
            },
            smallStep: (semant, nodes, expr) =>
                semant.betaReduce(nodes, expr.get("callee"),
                                  [ expr.get("argument") ])
        },

        lambda: {
            fields: [],
            subexpressions: ["arg", "body"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["arg", "'=>'", "body"],
            },
            betaReduce: (semant, nodes, expr, argIds) => {
                return core.genericBetaReduce(semant, nodes, {
                    topNode:    expr,
                    targetNode: nodes.get(expr.get("arg")),
                    argIds:     argIds,
                    targetName: (node) => node.get("name"),
                    isVar:      (node) => node.get("type") === "lambdaVar",
                    varName:    (node) => node.get("name"),
                });
            },
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
                }
            },
        }
    },
});
