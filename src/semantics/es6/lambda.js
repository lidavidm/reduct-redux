import * as core from "../core";
import * as gfx from "../../gfx/core";
import * as animate from "../../gfx/animate";

export default {
    lambda: {
        kind: "value",
        type: (semant, state, types, expr) => ({
            types: new Map([ [ expr.get("id"), "lambda" ] ]),
            complete: typeof types.get(expr.get("body")) !== "undefined",
        }),
        fields: [],
        subexpressions: ["arg", "body"],
        projection: {
            type: "default",
            shape: "()",
            fields: ["arg", "'=>'", "body"],
            subexpScale: 1.0,
            padding: {
                top: 3.5,
                bottom: 3.5,
                left: 10,
                right: 10,
                inner: 5,
            },
        },
        betaReduce: (semant, stage, state, expr, argIds) =>
            core.genericBetaReduce(semant, state, {
                topNode: expr,
                targetNode: state.get("nodes").get(expr.get("arg")),
                argIds,
                targetName: node => node.get("name"),
                isVar: node => node.get("type") === "lambdaVar",
                varName: node => node.get("name"),
                isCapturing: node => node.get("type") === "lambda",
                captureName: (nodes, node) => nodes.get(node.get("arg")).get("name"),
                animateInvalidArg: (id) => {
                    animate.fx.error(stage, stage.views[id]);
                },
            }),
    },

    lambdaArg: {
        fields: ["name", "functionHole"],
        subexpressions: [],
        targetable: (semant, state, expr) => {
            const nodes = state.get("nodes");
            const lambdaParent = nodes.get(expr.get("parent"));
            return !lambdaParent.has("parent");
        },
        projection: {
            type: "preview",
            content: {
                type: "dynamic",
                resetFields: ["text", "color"],
                field: (state, exprId) => {
                    const isFunctionHole = !!state.getIn([ "nodes", exprId, "functionHole" ]);
                    if (isFunctionHole) return "functionHole";
                    return "default";
                },
                default: {
                    type: "text",
                    text: "({name})",
                },
                cases: {
                    functionHole: {
                        type: "default",
                        shape: "()",
                        radius: 0,
                        fields: ["name"],
                    },
                },
            },
        },
        betaReduce: (semant, stage, state, expr, argIds) => {
            if (expr.get("parent")) {
                return semant.interpreter.betaReduce(stage, state, expr.get("parent"), argIds);
            }
            return null;
        },
    },

    lambdaVar: {
        fields: ["name"],
        subexpressions: [],
        projection: {
            type: "preview",
            content: {
                type: "default",
                shape: "()",
                strokeWhenChild: false,
                fields: ["name"],
            },
        },
    },
};
