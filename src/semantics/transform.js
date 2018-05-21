/**
 * @module transform
 */
import * as immutable from "immutable";

import * as progression from "../game/progression";
import Audio from "../resource/audio";
import Logging from "../logging/logging";

import * as gfx from "../gfx/core";
import * as animate from "../gfx/animate";
import projector from "../gfx/projector";

import * as core from "./core";
import * as meta from "./meta";
import makeInterpreter from "./interpreter";

import { nextId } from "../reducer/reducer";

const NotchRecord = immutable.Record({
    side: "left",
    shape: "wedge",
    type: "inset",
});

/**
 * This module turns a JSON-plus-functions specification of language
 * semantics and builds a module for the rest of Reduct to interact
 * with the semantics.
 *
 * @alias transform
 */
export default function transform(definition) {
    /**
     * The generated semantics module.
     */
    const module = {};
    /**
     * The original semantics definition.
     */
    module.definition = definition;
    module.projections = {};

    /** Get the definition of the given expression, accounting for fade level. */
    module.definitionOf = function getDefinition(exprOrType, fadeLevel=null) {
        const type = exprOrType.get ? exprOrType.get("type") : (exprOrType.type || exprOrType);
        const result = module.definition.expressions[type];
        if (Array.isArray(result)) {
            return result[typeof fadeLevel === "number" ? fadeLevel : progression.getFadeLevel(type)];
        }
        return result;
    };

    // Add default definitions for vtuple
    /**
     * A "virtual tuple" which kind of bleeds presentation into the
     * semantics. Represents a set of values that go together, but spill
     * onto the board when they are the top-level node.
     */
    module.vtuple = function vtuple(children) {
        const result = { type: "vtuple", locked: true, numChildren: children.length };
        let i = 0;
        for (const child of children) {
            result[`child${i}`] = child;
            i += 1;
        }
        return result;
    };

    module.projections.vtuple = [ function(_stage, _expr) {
        return gfx.layout.vbox((id, state) => {
            const node = state.getIn([ "nodes", id ]);
            const result = [];
            for (let i = 0; i < node.get("numChildren"); i++) {
                result.push(node.get(`child${i}`));
            }
            return result;
        }, {
            padding: {
                top: 0,
                inner: 5,
                bottom: 0,
                left: 0,
                right: 0,
            },
            strokeWhenChild: false,
            subexpScale: 1,
        });
    } ];

    module.constructors = {};
    for (const [ exprName, exprDefinitions ] of Object.entries(definition.expressions)) {
        module.constructors[exprName] = [];
        module.projections[exprName] = [];

        const defns = Array.isArray(exprDefinitions) ? exprDefinitions : [ exprDefinitions ];

        let fadeLevel = 0;
        for (const exprDefinition of defns) {
            const innerFadeLevel = fadeLevel; // Capture value inside loop body
            fadeLevel += 1;
            const ctor = function(...params) {
                const result = { type: exprName, locked: true };
                if (typeof exprDefinition.locked !== "undefined") {
                    result.locked = exprDefinition.locked;
                }
                if (typeof exprDefinition.notches !== "undefined") {
                    result.notches = immutable.List(exprDefinition.notches.map(n => new NotchRecord(n)));
                }

                let argPointer = 0;
                for (const fieldName of exprDefinition.fields) {
                    result[fieldName] = params[argPointer++];
                }
                const subexprs = typeof exprDefinition.subexpressions === "function" ?
                      exprDefinition.subexpressions(module, immutable.Map(result))
                      : exprDefinition.subexpressions;
                for (const fieldName of subexprs) {
                    result[fieldName] = params[argPointer++];
                }
                result.fadeLevel = innerFadeLevel;
                return result;
            };
            Object.defineProperty(ctor, "name", { value: exprName });
            module.constructors[exprName].push(ctor);

            if (typeof exprDefinition.notches !== "undefined") {
                exprDefinition.projection.notches = exprDefinition.notches;
            }

            module.projections[exprName].push(projector(exprDefinition));
        }

        module[exprName] = function(...params) {
            const ctors = module.constructors[exprName];
            return ctors[progression.getFadeLevel(exprName)](...params);
        };
        Object.defineProperty(module[exprName], "name", { value: exprName });
    }

    /**
     * Return a list of field names containing subexpressions of an expression.
     */
    module.subexpressions = function subexpressions(expr) {
        const type = expr.type || expr.get("type");
        if (type === "vtuple") {
            const result = [];
            const nc = expr.get ? expr.get("numChildren") : expr.numChildren;
            for (let i = 0; i < nc; i++) {
                result.push(`child${i}`);
            }
            return result;
        }

        const fadeLevel = expr.get ? expr.get("fadeLevel") : expr.fadeLevel;

        const defn = module.definitionOf(type, fadeLevel);
        if (!defn) throw `semantics.subexpressions: Unrecognized expression type ${type}`;

        const subexprBase = defn.reductionOrder || defn.subexpressions;
        const subexprs = typeof subexprBase === "function" ?
              subexprBase(module, expr)
              : defn.reductionOrder || defn.subexpressions;
        // Handle notches
        if (defn.notches && defn.notches.length > 0) {
            const result = subexprs.slice();
            for (let i = 0; i < defn.notches.length; i++) {
                const field = `notch${i}`;
                if (expr[field] || (expr.get && expr.get(field))) {
                    result.push(field);
                }
            }
            return result;
        }
        return subexprs;
    };

    /**
     * Construct the gfx view for a node. Accounts for fade level.
     *
     * @param stage
     * @param nodes - We have to provide the node map since the store
     * won't have been updated yet.
     * @param expr - The immutable expression to create a view for.
     */
    module.project = function project(stage, nodes, expr) {
        const type = expr.get("type");
        if (!module.projections[type]) throw `semantics.project: Unrecognized expression type ${type}`;
        return module.projections[type][progression.getFadeLevel(type)](stage, nodes, expr);
    };

    /**
     * Search for lambda variable nodes, ignoring ones bound by a
     * lambda with the same parameter name deeper in the tree.
     */
    module.searchNoncapturing = function(nodes, targetName, exprId) {
        const result = [];
        module.map(nodes, exprId, (nodes, id) => {
            const node = nodes.get(id);
            if (node.get("type") === "lambdaVar" && node.get("name") === targetName) {
                result.push(id);
                return [ node, nodes ];
            }
            return [ node, nodes ];
        }, (nodes, node) => (
            node.get("type") !== "lambda" ||
                nodes.get(node.get("arg")).get("name") !== targetName));
        return result;
    };

    /** Determine if a level could possibly be completed. */
    module.mightBeCompleted = function(state, checkVictory) {
        const nodes = state.get("nodes");
        const board = state.get("board");
        const toolbox = state.get("toolbox");

        const remainingNodes = board.concat(toolbox);

        const containsReducableExpr = remainingNodes.some((id) => {
            const node = nodes.get(id);
            const kind = module.kind(node);
            return kind === "expression" ||
                kind === "statement" ||
                node.get("type") === "lambda";
        });

        if (containsReducableExpr) {
            return true;
        }

        // Level is not yet completed, no reducible expressions, and
        // nothing in toolbox -> level can't be completed
        if (toolbox.size === 0) {
            return false;
        }

        // Only one thing in toolbox - does using it complete the level?
        if (toolbox.size === 1) {
            return checkVictory(state.withMutations((s) => {
                s.set("toolbox", immutable.List());
                s.set("board", remainingNodes);
            }));
        }

        // Try adding any combination of toolbox items to the board -
        // does using them complete the level?

        // Thanks to Nina Scholz @ SO:
        // https://stackoverflow.com/a/42774126
        // Generates all array subsets (its powerset).
        const powerset = (array) => {
            const fork = (i, t) => {
                if (i === array.length) {
                    result.push(t);
                    return;
                }
                fork(i + 1, t.concat([array[i]]));
                fork(i + 1, t);
            };

            const result = [];
            fork(0, []);
            return result;
        };

        for (const subset of powerset(toolbox.toArray())) {
            const matching = checkVictory(state.withMutations((s) => {
                s.set("toolbox", toolbox.filter(i => subset.indexOf(i) === -1));
                s.set("board", board.concat(immutable.List(subset)));
            }));
            if (matching && Object.keys(matching).length > 0) {
                return true;
            }
        }

        return false;
    };

    /**
     * Submodule for evaluating expressions.
     */
    module.interpreter = {};

    makeInterpreter(module);

    /** Check for equality of fields (but not of subexpressions). */
    module.shallowEqual = function shallowEqual(n1, n2) {
        if (n1.get("type") !== n2.get("type")) return false;

        for (const field of module.definitionOf(n1).fields) {
            if (n1.get(field) !== n2.get(field)) return false;
        }

        return true;
    };

    /**
     * Can an expression have something dropped into it?
     */
    module.droppable = function(state, itemId, targetId) {
        // TODO: don't hardcode these checks
        const item = state.getIn([ "nodes", itemId ]);
        const target = state.getIn([ "nodes", targetId ]);

        if (item.get("type") === "define") {
            return false;
        }
        else if (target.get("type") === "missing") {
            // Use type inference to decide whether hole can be filled
            const holeType = target.get("ty");
            const exprType = item.get("ty");
            if (!holeType || !exprType || holeType === exprType) {
                return "hole";
            }
        }
        else if (target.get("type") === "lambdaArg" &&
                 !state.getIn([ "nodes", target.get("parent"), "parent" ]) &&
                 // Lambda vars can't be dropped into lambda args
                 item.get("type") !== "lambdaVar") {
            return "arg";
        }
        return false;
    };

    /**
     * Is an expression selectable/hoverable by the mouse?
     */
    module.targetable = function(state, expr) {
        const defn = module.definitionOf(expr);
        if (defn && defn.targetable && typeof defn.targetable === "function") {
            return defn.targetable(module, state, expr);
        }
        return !expr.get("parent") || !expr.get("locked") || (defn && defn.alwaysTargetable);
    };

    /** Get the kind of an expression (e.g. "expression", "statement"). */
    module.kind = function(expr) {
        switch (expr.get("type")) {
        case "vtuple":
            // TODO: This isn't quite right - depends on the children
            return "expression";
        default:
            return module.definitionOf(expr).kind;
        }
    };

    /** Turn an immutable expression into a mutable one (recursively). */
    module.hydrate = function(nodes, expr) {
        return expr.withMutations((e) => {
            for (const field of module.subexpressions(e)) {
                e.set(field, module.hydrate(nodes, nodes.get(e.get(field))));
            }
        }).toJS();
    };

    /** The remnants of type checking. */
    module.collectTypes = function collectTypes(state, rootExpr) {
        const result = new Map();
        const completeness = new Map();
        const nodes = state.get("nodes");

        // Update the type map with the type for the expression.
        const update = function update(id, ty) {
            if (!result.has(id)) {
                result.set(id, ty);
            }
            else {
                const prevTy = result.get(id);
                if (prevTy === "unknown") {
                    result.set(id, ty);
                }
                else if (prevTy !== ty) {
                    result.set(id, "error");
                }
            }
        };

        const completeKind = (kind) => kind !== "expression" && kind !== "placeholder";

        const step = function step(expr) {
            const id = expr.get("id");

            for (const field of module.subexpressions(expr)) {
                step(nodes.get(expr.get(field)));
            }

            const type = expr.get("type");
            const exprDefn = module.definitionOf(type);
            if (!exprDefn) {
                if (type !== "vtuple") console.warn(`No expression definition for ${type}`);
            }
            else {
                const typeDefn = exprDefn.type;
                if (typeof typeDefn === "function") {
                    const { types, complete } = typeDefn(module, state, result, expr);
                    completeness.set(
                        id,
                        complete && module.subexpressions(expr)
                            .map(field => completeness.get(expr.get(field)) ||
                                 module.kind(nodes.get(expr.get(field))) !== "expression")
                            .every(x => x)
                    );
                    for (const entry of types.entries()) {
                        update(...entry);
                    }
                }
                else if (typeof typeDefn === "undefined") {
                    // TODO: define constants/typing module
                    // result[id].add("unknown");
                    completeness.set(
                        id,
                        module.subexpressions(expr)
                            .map(field => completeness.get(expr.get(field)) ||
                                 completeKind(module.kind(nodes.get(expr.get(field)))))
                            .every(x => x)
                    );
                }
                else {
                    completeness.set(id, true);
                    update(id, typeDefn);
                }
            }
        };

        step(rootExpr);

        return { types: result, completeness };
    };

    /** Check whether a node has any notches. */
    module.hasNotches = function(node) {
        return node.get("notches");
    };

    /** Check whether two nodes have an ycompatible notches. */
    module.notchesCompatible = function(node1, node2) {
        const notches1 = node1.get("notches");
        const notches2 = node2.get("notches");
        const result = [];
        if (notches1 && notches2) {
            for (let i = 0; i < notches1.size; i++) {
                for (let j = 0; j < notches2.size; j++) {
                    const notch1 = notches1.get(i);
                    const notch2 = notches2.get(j);
                    if (notch1.shape !== notch2.shape) continue;
                    if (notch1.type === "inset" && notch2.type !== "outset") continue;
                    if (notch1.type === "outset" && notch2.type !== "inset") continue;

                    if ((notch1.side === "left" && notch2.side === "right") ||
                        (notch1.side === "right" && notch2.side === "left") ||
                        (notch1.side === "top" && notch2.side === "bottom") ||
                        (notch1.side === "bottom" && notch2.side === "top")) {
                        result.push([ i, j ]);
                    }
                }
            }
        }
        return result;
    };

    /** Check whether two notches on two nodes can attach. */
    module.notchesAttachable = function(stage, state, parentId, childId, notchPair) {
        const nodes = state.get("nodes");
        const parent = nodes.get(parentId);

        // Prevent double-attaching
        if (parent.has(`notch${notchPair[0]}`)) return false;

        const defn = module.definitionOf(parent);

        if (defn && defn.notches && defn.notches[notchPair[0]]) {
            const notchDefn = defn.notches[notchPair[0]];
            if (notchDefn.canAttach) {
                const [ canAttach, blockingNodes ] = notchDefn.canAttach(
                    module,
                    state,
                    parentId,
                    childId,
                    notchPair
                );
                if (!canAttach) {
                    Logging.log("attached-expr-failed", {
                        parent: stage.saveNode(parentId),
                        item: stage.saveNode(childId),
                        parentNotchIdx: notchPair[0],
                        childNotchIdx: notchPair[1],
                        blocking: blockingNodes.map(id => stage.saveNode(id)),
                    });
                    blockingNodes.forEach((id) => {
                        animate.fx.error(stage, stage.views[id]);
                    });
                    return false;
                }
            }
        }
        return true;
    };

    /** Check whether a node is detachable from its parent. */
    module.detachable = function(state, parentId, childId) {
        const nodes = state.get("nodes");
        const defn = module.definitionOf(nodes.get(parentId));
        const parentField = nodes.get(childId).get("parentField");
        if (parentField.slice(0, 5) !== "notch") {
            return true;
        }
        const notchIdx = window.parseInt(parentField.slice(5), 10);
        if (defn && defn.notches && defn.notches[notchIdx]) {
            const notchDefn = defn.notches[notchIdx];
            if (notchDefn.canDetach) {
                return notchDefn.canDetach(
                    module,
                    state,
                    parentId,
                    childId
                );
            }
        }
        return true;
    };

    /**
     * Check whether we should ignore the given node when matching
     * nodes to determine victory.
     */
    module.ignoreForVictory = function(node) {
        const defn = module.definitionOf(node);
        return module.kind(node) === "syntax" || (defn && defn.ignoreForVictory);
    };

    /** Compare two nodes for equality (recursively). */
    module.equal = core.genericEqual(module.subexpressions, module.shallowEqual);
    /** Convert a mutable node into an immutable one (recursively). */
    module.flatten = core.genericFlatten(nextId, module.subexpressions);
    /** Apply a function to every node in a tree. */
    module.map = core.genericMap(module.subexpressions);
    /** Search an immutable node and its children. */
    module.search = core.genericSearch(module.subexpressions);
    /** Clone an immutable node and its children. */
    module.clone = core.genericClone(nextId, module.subexpressions);

    module.parser = {};
    module.parser.templatizeName = name => definition.parser.templatizeName(module, name);
    module.parser.parse = definition.parser.parse(module);
    module.parser.unparse = definition.parser.unparse(module);
    module.parser.postParse = definition.parser.postParse;
    module.parser.extractDefines = definition.parser.extractDefines;
    module.parser.extractGlobals = definition.parser.extractGlobals;
    module.parser.extractGlobalNames = definition.parser.extractGlobalNames;

    module.meta = meta;

    return module;
}
