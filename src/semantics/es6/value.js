export default {
    number: {
        kind: "value",
        type: "number",
        fields: ["value"],
        subexpressions: [],
        projection: {
            type: "default",
            shape: "()",
            color: "cornsilk",
            highlightColor: "orangered",
            fields: ["value"],
        },
    },

    dynamicVariant: {
        kind: "value",
        type: (semant, state, types, expr) => {
            return {
                types: new Map([ [ expr.get("id"), expr.get("variant") ] ]),
                // TODO: this isn't true if it's a variant with
                // fields
                complete: true,
            };
        },
        fields: ["variant", "value"],
        subexpressions: [],
        projection: {
            type: "default",
            shape: "()",
            color: "cornsilk",
            fields: ["value"],
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
            padding: {
                left: 25,
                right: 25,
                inner: 10,
                top: 0,
                bottom: 0,
            },
        },
    },
};
