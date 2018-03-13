import * as core from "./core";
import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import { makeParser, makeUnparser } from "../syntax/es6";
import transform from "./transform";

export default transform({
    name: "ECMAScript 6",
    parser: {
        parse: makeParser,
        unparse: makeUnparser,

        extractDefines: (semant, expr) => {
            if (expr.type !== "define") {
                return null;
            }
            // we have access to expr.params
            // needs to be a thunk
            let thunk = null;
            if (expr.params) {
                const params = expr.params;
                thunk = () => {
                    const missing = params.map(_ => {
                        // TODO: why is locked not respected?
                        const a = semant.missing();
                        a.locked = false;
                        return a;
                    });
                    return semant.reference(expr.name, expr.params, ...missing);
                };
            }
            else {
                thunk = () => semant.reference(expr.name, []);
            }
            return [ expr.name, thunk ];
        },

        extractGlobals: (semant, expr) => {
            if (expr.type !== "define") {
                return null;
            }
            // We have access to expr.params
            return [ expr.name, expr ];
        },

        extractGlobalNames: (semant, name, expr) => {
            // We have access to expr.params
            return [ name, () => semant.reference(name) ];
        },

        postParse: (nodes, goal, board, toolbox, globals) => {
            return {
                nodes,
                goal,
                board,
                toolbox,
                globals,
            };
        },
    },

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

        conditional: {
            kind: "expression",
            fields: [],
            subexpressions: ["condition", "positive", "negative"],
            // projection: {
            //     type: "default",
            //     shape: "()",
            //     color: "lightblue",
            //     fields: ["'if'", "condition", "'then'", "positive", "'else'", "negative"],
            // },
            projection: {
                type: "vbox",
                horizontalAlign: 0.0,
                color: "lightblue",
                subexpScale: 1.0,
                ellipsize: true,
                rows: [
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'if'", "condition", "'then'"],
                        subexpScale: 1.0,
                    },
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'    '", "positive"],
                        subexpScale: 1.0,
                    },
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'else'"],
                        subexpScale: 1.0,
                    },
                    {
                        type: "default",
                        shape: "none",
                        fields: ["'    '", "negative"],
                        subexpScale: 1.0,
                    },
                ],
            },
            type: (semant, state, types, expr) => {
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
                const posType = nodes.get(positive).get("ty");
                const negType = nodes.get(negative).get("ty");
                if (posType && negType && posType !== negType) {
                    return negative;
                }
                return null;
            },
            smallStep: (semant, stage, state, expr) => {
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
            stepAnimation: (semant, stage, state, expr) => {
                const nodes = state.get("nodes");
                const cond = nodes.get(expr.get("condition")).get("value");
                const color = cond ? "#00F" : "#F00";
                const branch = stage.getView(cond ? expr.get("positive") : expr.get("negative"));

                const view = stage.getView(expr.get("condition"));

                view.stroke = { lineWidth: 0, color };
                branch.stroke = { lineWidth: 0, color };
                const tween = animate.tween(view, { stroke: { lineWidth: 4 } }, {
                    duration: animate.scaleDuration(700, "expr-conditional"),
                    easing: animate.Easing.Cubic.In,
                });

                return tween
                    .then(() => animate.fx.blink(stage, branch, {
                        times: 3,
                        color,
                        speed: animate.scaleDuration(300, "expr-conditional"),
                    }))
                    .then(() => animate.after(animate.scaleDuration(700, "expr-conditional")))
                    .then(() => {
                        view.stroke = null;
                        branch.stroke = null;
                    });
            },
        },

        apply: {
            kind: "expression",
            fields: [],
            subexpressions: ["callee", "argument"],
            reductionOrder: ["argument", "callee"],
            projection: {
                type: "decal",
                content: {
                    type: "default",
                    shape: "()",
                    fields: ["callee", "'('", "argument", "')'"],
                },
            },
            stepAnimation: (semant, stage, state, expr) => {
                const callee = state.getIn([ "nodes", expr.get("callee") ]);
                const isCalleeLambda = callee.get("type") === "lambda";

                const introDuration = animate.scaleDuration(400, "expr-apply");
                const outroDuration = animate.scaleDuration(400, "expr-apply");
                const argView = stage.views[expr.get("argument")];
                const applyView = stage.views[expr.get("id")];

                // List of tweens to reset at end
                const reset = [];

                // Fade out arrow
                reset.push(animate.tween(applyView, { arrowOpacity: [ 1.0, 0.0 ] }, {
                    duration: animate.scaleDuration(200, "expr-apply"),
                    easing: animate.Easing.Cubic.InOut,
                }));

                // Scale down argument
                reset.push(animate.tween(argView, { scale: { x: 0.4, y: 0.4 } }, {
                    duration: animate.scaleDuration(300, "expr-apply"),
                    easing: animate.Easing.Cubic.Out,
                }));

                // Jump argument to hole
                const calleeView = stage.views[expr.get("callee")];
                const lambdaBody = isCalleeLambda ? callee.get("body") : null;
                const lambdaView = isCalleeLambda ? stage.views[callee.get("id")] : null;

                let centerX = gfx.centerPos(calleeView).x - gfx.absolutePos(applyView).x;
                if (isCalleeLambda) {
                    centerX = gfx.centerPos(stage.views[callee.get("arg")]).x
                        - gfx.absolutePos(lambdaView).x;
                }

                const jumpTween = animate.tween(argView, {
                    pos: {
                        x: [ centerX, animate.Easing.Linear ],
                        y: [ argView.pos.y - 75, animate.Easing.Projectile(animate.Easing.Linear) ],
                    },
                }, {
                    duration: animate.scaleDuration(500, "expr-apply"),
                });

                if (!isCalleeLambda) {
                    return jumpTween
                        .then(() => animate.fx.shatter(stage, stage.getView(expr.get("id")), {
                            introDuration,
                            outroDuration,
                        }))
                        .then(() => {
                            reset.forEach(tween => tween.undo());
                            argView.opacity = 1;
                        });
                }

                return jumpTween.then(() => {
                    const clearPreview = [];

                    const duration = animate.scaleDuration(700, "expr-apply");
                    const totalTime = duration + animate.scaleDuration(50, "expr-apply");
                    // How long to wait before clearing the 'animating' flag
                    const restTime = totalTime + introDuration + outroDuration;

                    // Replace arg hole with preview
                    if (isCalleeLambda) {
                        animate.tween(argView, {
                            scale: { x: 0, y: 0 },
                            opacity: 0,
                        }, {
                            duration,
                            easing: animate.Easing.Cubic.Out,
                        });

                        reset.push(animate.tween(lambdaView, {
                            subexpScale: 1.0,
                            padding: {
                                inner: 0,
                                right: 0,
                                left: 0,
                            },
                            backgroundOpacity: 0,
                        }, {
                            duration,
                            restTime,
                            easing: animate.Easing.Cubic.InOut,
                        }));

                        lambdaView.strokeWhenChild = false;

                        for (const [ childId, exprId ] of lambdaView.children(callee.get("id"), state)) {
                            if (exprId !== callee.get("body")) {
                                reset.push(animate.tween(stage.views[childId], { scale: { x: 0 } }, {
                                    duration,
                                    restTime,
                                    easing: animate.Easing.Cubic.InOut,
                                }));
                            }
                        }

                        const targetName = state.getIn([ "nodes", callee.get("arg"), "name" ]);
                        stage.semantics.searchNoncapturing(state.get("nodes"), targetName, lambdaBody)
                            .forEach((id) => {
                                if (stage.views[id]) {
                                    stage.views[id].previewOptions = {
                                        duration,
                                    };
                                    stage.views[id].preview = expr.get("argument");
                                    clearPreview.push(stage.views[id]);
                                }
                            });
                    }
                    else {
                        argView.opacity = 0;
                    }

                    reset.push(animate.tween(applyView, {
                        subexpScale: 1.0,
                        padding: {
                            inner: 0,
                            left: 0,
                            right: 0,
                        },
                        backgroundOpacity: 0,
                    }, {
                        duration,
                        restTime,
                        easing: animate.Easing.Cubic.InOut,
                    }));

                    for (const [ childId, exprId ] of applyView.children(expr.get("id"), state)) {
                        if (exprId !== expr.get("callee") && exprId !== expr.get("argument")) {
                            reset.push(animate.tween(stage.views[childId], { scale: { x: 0 } }, {
                                duration,
                                restTime,
                                easing: animate.Easing.Cubic.InOut,
                            }));
                        }
                    }

                    reset.push(animate.tween(argView, { x: 0 }, {
                        duration,
                        restTime,
                        easing: animate.Easing.Cubic.InOut,
                    }));

                    return animate.after(totalTime)
                        .then(() => {
                            reset.forEach(tween => tween.undo());
                            clearPreview.forEach((view) => {
                                view.preview = null;
                                delete view.previewOptions;
                            });
                            argView.opacity = 1;
                        });
                });
            },
            stepSound: "heatup",
            validateStep: (semant, state, expr) => {
                const callee = state.getIn([ "nodes", expr.get("callee") ]);
                const kind = semant.kind(callee);
                if (kind === "value" && callee.get("type") !== "lambda") {
                    return expr.get("callee");
                }
                return null;
            },
            smallStep: (semant, stage, state, expr) => {
                const [ topNodeId, newNodeIds, addedNodes ] = semant.interpreter.betaReduce(
                    stage,
                    state, expr.get("callee"),
                    [ expr.get("argument") ]
                );
                return [ expr.get("id"), newNodeIds, addedNodes ];
            },
            substepFilter: (semant, state, expr, field) => {
                if (field === "argument" && state.getIn([ "nodes", expr.get(field), "type" ]) === "reference") {
                    return false;
                }
                return true;
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
                            color: "orangered",
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

        reference: {
            kind: "expression",
            fields: ["name", "params"],
            subexpressions: (semant, expr) => {
                const params = (expr.get ? expr.get("params") : expr.params) || [];
                return params.map(name => `arg_${name}`);
            },
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

                if (!expr.has("parent") && expr.get("params") && expr.get("params").length > 0) {
                    const params = expr.get("params");
                    const [ _, newNodeIds, addedNodes ] = semant.interpreter.betaReduce(
                        stage,
                        state, res,
                        params.map(name => expr.get(`arg_${name}`)),
                    );
                    return [ expr.get("id"), newNodeIds, addedNodes ];
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
            // If expr is nested, don't care about subexpressions
            substepFilter: (semant, stage, expr, _field) =>
                !(expr.has ? expr.has("parent") : typeof expr.parent !== "undefined"),
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
                    radius: 0,
                    color: "OrangeRed",
                    strokeWhenChild: false,
                    fields: [{
                        field: "name",
                        color: "gray",
                    }],
                },
                cases: {
                    enabled: {
                        type: "hbox",
                        color: "OrangeRed",
                        radius: 0,
                        shape: "()",
                        strokeWhenChild: false,
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
    },
});
