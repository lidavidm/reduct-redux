const baseReference = {
    kind: "expression",
    fields: ["name"],
    subexpressions: [],
    stepSound: "heatup",
    type: (semant, state, types, expr) => ({
        types: new Map(),
        complete: state.get("globals").has(expr.get("name")),
    }),
    targetable: (semant, state, expr) => {
        if (expr.has("__meta") && expr.get("__meta").toolbox.targetable) {
            return true;
        }
        if (state.get("toolbox").includes(expr.get("id"))) {
            // If in toolbox, only targetable if defined
            return state.get("globals").has(expr.get("name"));
        }
        return !expr.get("parent") || !expr.get("locked");
    },
    smallStep: (semant, stage, state, expr) => {
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
            type: "hbox",
            color: "OrangeRed",
            radius: 0,
            shape: "()",
            strokeWhenChild: true,
            children: [
                {
                    type: "text",
                    text: "{name}",
                    color: "gray",
                },
            ],
        },
        cases: {
            enabled: {
                type: "hbox",
                color: "OrangeRed",
                radius: 0,
                shape: "()",
                strokeWhenChild: true,
                children: [
                    {
                        type: "text",
                        text: "{name}",
                    },
                ],
            },
        },
    },
};

export default {
    reference: [
        baseReference,
        Object.assign({}, baseReference, {
            fields: ["name", "params"],
            subexpressions: (semant, expr) => {
                const params = (expr.get ? expr.get("params") : expr.params) || [];
                return params.map(name => `arg_${name}`);
            },
            smallStep: (semant, stage, state, expr) => {
                // TODO: reuse orig smallStep somehow
                let res = state.get("globals").get(expr.get("name"));
                if (!res) return null;

                const resNode = state.get("nodes").get(res);
                if (resNode.get("type") === "define") {
                    res = resNode.get("body");
                }

                if (!(expr.has("parent") && state.getIn([ "nodes", expr.get("parent"), "type"]) === "define") &&
                    expr.get("params") &&
                    expr.get("params").length > 0 &&
                    expr.get("params").some(field => state.getIn([
                        "nodes",
                        expr.get(`arg_${field}`),
                        "type",
                    ]) !== "missing")) {
                    const params = expr.get("params");
                    const result = semant.interpreter.betaReduce(
                        stage,
                        state, res,
                        params.map(name => expr.get(`arg_${name}`)),
                    );
                    if (result) {
                        const [ _, newNodeIds, addedNodes ] = result;
                        return [ expr.get("id"), newNodeIds, addedNodes ];
                    }
                    return null;
                }

                const result = semant.clone(res, state.get("nodes"));
                return [
                    expr.get("id"),
                    [ result[0].get("id") ],
                    [ result[0].delete("parent").delete("parentField") ].concat(result[1]),
                ];
            },
            // Only care about arguments if partially filled
            substepFilter: (semant, state, expr, field) => {
                const params = expr.get("params");
                if (!params || params.length === 0) {
                    // wait, wtf?
                    console.warn(`es6.reference#substepFilter: No params, but asked about field ${field}?`);
                    return true;
                }

                return !params.every(p => state.getIn([ "nodes", expr.get(`arg_${p}`), "type" ]) === "missing");
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
                    type: "hbox",
                    color: "OrangeRed",
                    radius: 0,
                    shape: "()",
                    strokeWhenChild: true,
                    children: [
                        {
                            type: "text",
                            text: "{name}",
                            color: "gray",
                        },
                        {
                            type: "generic",
                            view: [ "custom", "argumentBar" ],
                            options: {},
                        },
                    ],
                },
                cases: {
                    enabled: {
                        type: "hbox",
                        color: "OrangeRed",
                        radius: 0,
                        shape: "()",
                        strokeWhenChild: true,
                        children: [
                            {
                                type: "text",
                                text: "{name}",
                            },
                            {
                                type: "generic",
                                view: [ "custom", "argumentBar" ],
                                options: {},
                            },
                        ],
                    },
                },
            },
        })
    ],
};
