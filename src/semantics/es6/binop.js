export default {
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
                    color: "#ffcc00",
                },
                "-": {
                    type: "default",
                    shape: "()",
                    color: "#ffcc00",
                },
                "==": {
                    type: "default",
                    shape: "<>",
                    color: "hotpink",
                    padding: {
                        left: 25,
                        right: 25,
                        inner: 10,
                        top: 0,
                        bottom: 0,
                    },
                },
            },
        },
        stepSound: (semant, state, expr) => {
            const op = state.get("nodes").get(expr.get("op"));
            if (op.get("name") === "==") {
                return ["shatter1", "heatup"];
            }
            return ["heatup"];
        },
        type: (semant, state, types, expr) => {
            const nodes = state.get("nodes");
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
                // TODO: less ad-hoc
                complete: (types.get(expr.get("left")) === "number" ||
                           nodes.get(expr.get("left")).get("type") === "lambdaVar") &&
                    (types.get(expr.get("right")) === "number" ||
                     nodes.get(expr.get("right")).get("type") === "lambdaVar"),
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
        smallStep: (semant, stage, state, expr) => {
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
};
