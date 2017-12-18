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
            smallStep: (semant, expr) => semant.number(expr.left.value + expr.right.value),
        },

        lambda: {
            fields: [],
            subexpressions: ["arg", "body"],
            projection: {
                type: "default",
                shape: "()",
                fields: ["arg", "'=>'", "body"],
            },
            betaReduce: (semant, expr, args) => null,
        },

        lambdaArg: {
            fields: ["name"],
            subexpressions: [],
            projection: {
                type: "text",
                text: "({name})",
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
