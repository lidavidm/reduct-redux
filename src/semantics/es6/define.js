import * as core from "../core";
import * as gfx from "../../gfx/core";
import * as animate from "../../gfx/animate";

export default {
    define: {
        kind: "statement",
        ignoreForVictory: true,
        fields: ["name", "params"],
        subexpressions: ["body"],
        targetable: (semant, state, expr) => {
            return !expr.has("parent");
        },
        notches: [
            {
                side: "left",
                type: "inset",
                shape: "wedge",
                relpos: 0.8,
            },
        ],
        projection: {
            type: "dynamicProperty",
            field: (state, exprId) => {
                const node = state.getIn([ "nodes", exprId ]);
                if (node.has("parent")) {
                    return "attached";
                }
                return "default";
            },
            fields: {
                default: {
                    color: projection => animate.tween(projection, {
                        color: "#594764",
                    }, {
                        duration: 500,
                        easing: animate.Easing.Color(animate.Easing.Cubic.Out, projection.color, "OrangeRed"),
                    }),
                },
                attached: {
                    color: projection => animate.tween(projection, {
                        color: "OrangeRed",
                    }, {
                        duration: 500,
                        easing: animate.Easing.Color(animate.Easing.Cubic.Out, projection.color, "#594764"),
                    }),
                },
            },
            projection: {
                type: "vbox",
                horizontalAlign: 0.0,
                color: "OrangeRed",
                padding: {
                    top: 10,
                    left: 15,
                    inner: 5,
                    right: 10,
                    bottom: 10,
                },
                rows: [
                    {
                        type: "hbox",
                        shape: "none",
                        subexpScale: 1.0,
                        padding: {
                            left: 0, right: 0,
                        },
                        children: [
                            {
                                type: "text",
                                text: "def ",
                            },
                            {
                                type: "hbox",
                                shape: "()",
                                radius: 0,
                                color: "salmon",
                                shadow: false,
                                shadowColor: "rgba(0,0,0,0)",
                                shadowOffset: 0,
                                stroke: {
                                    lineWidth: 0,
                                    color: "rgba(0,0,0,0)",
                                },
                                strokeWhenChild: false,
                                padding: {
                                    left: 5,
                                    right: 5,
                                    inner: 0,
                                },
                                children: [
                                    { type: "text", text: "{name} " },
                                    {
                                        type: "generic",
                                        view: [ "custom", "argumentBar" ],
                                        options: {},
                                    },
                                ],
                            },
                        ],
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
    },

    defineAttach: {
        kind: "syntax",
        fields: [],
        subexpressions: [],
        targetable: () => false,
        notches: [
            {
                side: "right",
                type: "outset",
                shape: "wedge",
                relpos: 0.5,
                canAttach: (semant, state, selfId, otherId, notchPair) => {
                    const missingNodes = semant.search(
                        state.get("nodes"),
                        otherId,
                        (nodes, id) => nodes.get(id).get("type") === "missing"
                    );

                    return [ missingNodes.length === 0, missingNodes ];
                },
                canDetach: () => false,
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
                color: "#594764",
                shadow: true,
                shadowColor: "#000",
                shadowOffset: 4,
            },
        },
    },
};
