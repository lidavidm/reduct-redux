import * as core from "./core";
import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import { makeParser, makeUnparser } from "../syntax/es6";
import transform from "./transform";

import apply from "./es6/apply";
import binop from "./es6/binop";
import conditional from "./es6/conditional";
import define from "./es6/define";
import lambda from "./es6/lambda";
import reference from "./es6/reference";
import value from "./es6/value";

export default transform({
    name: "ECMAScript 6",
    parser: {
        parse: makeParser,
        unparse: makeUnparser,

        extractDefines: (semant, expr) => {
            if (expr.type !== "define") {
                return null;
            }
            // needs to be a thunk
            let thunk = null;
            // we have access to expr.params, so generate a thunk that
            // can take arguments
            if (expr.params) {
                const params = expr.params;
                thunk = (...args) => {
                    const missing = params.map((_, idx) => {
                        if (args[idx]) {
                            return args[idx];
                        }
                        // TODO: why is locked not respected?
                        const a = semant.missing();
                        a.locked = false;
                        return a;
                    });
                    return semant.reference(expr.name, params, ...missing);
                };
                // Flag to the parser that this thunk can take arguments
                thunk.takesArgs = true;
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
            if (expr.params) {
                const params = expr.params;
                const thunk = (...args) => {
                    const missing = params.map((_, idx) => {
                        if (args[idx]) {
                            return args[idx];
                        }
                        // TODO: why is locked not respected?
                        const a = semant.missing();
                        a.locked = false;
                        return a;
                    });
                    return semant.reference(expr.name, params, ...missing);
                };
                // Flag to the parser that this thunk can take arguments
                thunk.takesArgs = true;
                return [ name, thunk ];
            }
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

        ...apply,
        ...binop,
        ...conditional,
        ...define,
        ...lambda,
        ...reference,
        ...value,
    },
});
