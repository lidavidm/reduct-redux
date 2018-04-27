import * as core from "../core";
import * as gfx from "../../gfx/core";
import * as animate from "../../gfx/animate";

export default {
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
            const duration = animate.scaleDuration(700, "expr-apply");
            const totalTime = duration + animate.scaleDuration(50, "expr-apply");
            // How long to wait before clearing the 'animating' flag
            const restTime = totalTime + introDuration + outroDuration;

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
                restTime,
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

            const clearPreview = [];
            return jumpTween
                .then(() => {
                    // Replace arg hole with preview
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
                            reset.push(animate.tween(stage.views[childId], {
                                scale: { x: 0 },
                                opacity: 0,
                            }, {
                                duration,
                                restTime,
                                easing: animate.Easing.Cubic.InOut,
                            }));

                            reset.push(animate.tween(stage.views[childId], {
                                opacity: 0,
                            }, {
                                duration: duration / 16,
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
                            reset.push(animate.tween(stage.views[childId], {
                                scale: { x: 0 },
                                opacity: 0,
                            }, {
                                duration: duration / 4,
                                restTime,
                                easing: animate.Easing.Cubic.InOut,
                            }));
                        }
                    }

                    reset.push(animate.tween(argView, { x: 0 }, {
                        duration: duration / 4,
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
                            lambdaView.strokeWhenChild = true;
                        });
                });
        },
        stepSound: "heatup",
        validateStep: (semant, state, expr) => {
            const callee = state.getIn([ "nodes", expr.get("callee") ]);
            const kind = semant.kind(callee);
            if (kind === "value" && callee.get("type") !== "lambda") {
                return [ expr.get("callee"), "I need a function on the left!" ];
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
            // Don't force evaluation of reference-with-holes that
            // has unfilled holes, so that it can be used in
            // argument position. However, force evaluation if it
            // doesn't have holes or has filled holes.
            if (field === "argument" &&
                state.getIn([ "nodes", expr.get(field), "type" ]) === "reference") {
                const ref = state.getIn([ "nodes", expr.get(field) ]);

                if (!ref.has("params") || ref.get("params").length === 0) return true;

                if (ref.get("params").some(p => state.getIn([ "nodes", ref.get(`arg_${p}`), "type" ]) !== "missing")) {
                    return true;
                }

                return false;
            }
            return true;
        },
    },
};
