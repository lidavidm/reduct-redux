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

        lambda: {
            fields: [],
            subexpressions: ["arg", "body"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["arg", "'=>'", "body"],
            },
            betaReduce: (semant, nodes, expr, argIds) => {
                // Prevent application when there are missing nodes
                // TODO: move this check into the core?
                if (semant.search(nodes, expr.get("id"),
                                  (n) => n.get("type") === "missing")) {
                    return null;
                }

                const targetNode = nodes.get(expr.get("arg"));
                const topNode = expr;

                if (argIds.length !== 1) {
                    // TODO: will we ever have multi-argument application?
                    return null;
                }

                // TODO: check for unbound names
                // TODO: need to do a noncapturing substitution
                const name = targetNode.get("name");
                let newNodes = [];
                let [ newTop, _ ] = semant.map(nodes, topNode.get("body"), (nodes, id) => {
                    const node = nodes.get(id);
                    if (node.get("type") === "lambdaVar" && node.get("name") === name) {
                        const [ cloned, resultNewNodes, nodesStore ] = semant.clone(argIds[0], nodes);
                        const result = cloned.withMutations(n => {
                            n.set("parent", node.get("parent"));
                            n.set("parentField", node.get("parentField"));
                        });
                        newNodes.push(result);
                        newNodes = newNodes.concat(resultNewNodes);
                        return [ result, nodesStore.set(result.get("id"), result) ];
                    }
                    else {
                        const [ result, resultNewNodes, nodesStore ] = semant.clone(id, nodes);
                        newNodes.push(result);
                        newNodes = newNodes.concat(resultNewNodes);
                        return [ result, nodesStore.set(result.get("id", result)) ];
                    }
                });
                newTop = newTop.delete("parent").delete("parentField");

                if (newTop.get("type") === "vtuple") {
                    // Spill vtuple onto the board
                    return [
                        topNode.get("id"),
                        semant.subexpressions(newTop).map(field => newTop.get(field)),
                        newNodes.slice(1),
                    ];
                }
                else {
                    return [
                        topNode.get("id"),
                        [ newTop.get("id") ],
                        newNodes.slice(1).concat([newTop]),
                    ];
                }

                return [ expr.get("id"), [ expr.get("id") ], [ expr ] ];
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
