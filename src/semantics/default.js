/**
 * Defines the semantics for a ES6-like language.
 */
import * as immutable from "immutable";
import { nextId } from "../reducer/reducer";
import * as gfx from "../gfx/core";
import * as core from "./core";

// TODO: pin down the signature for a semantics module

/**
 * A set of helpers to construct an AST.
 *
 * These construct a regular AST of nested objects, but in Redux
 * you're expected to flatten the AST. See reducer/action#startLevel
 * for more.
 */

export function number(value) {
    return { type: "number", value: value, locked: true };
}

export function missing() {
    return { type: "missing", locked: false, };
}

export function add(expr1, expr2) {
    return { type: "add", left: expr1, right: expr2, locked: true };
}

export function lambda(arg, body) {
    return { type: "lambda", arg: arg, body: body, locked: true };
}

export function lambdaArg(name) {
    return { type: "lambdaArg", name: name, locked: true };
}

export function targetable(expr) {
    return !expr.get("locked") || expr.get("type") === "lambdaArg";
}

export function lambdaVar(name) {
    return { type: "var", name: name, locked: true };
}

export function symbol(name) {
    if (name !== "star" && name !== "circle" && name !== "triangle" && name !== "rect") {
        throw `Unrecognized symbol ${name}.`;
    }
    return { type: "symbol", name: name, locked: true };
}

/**
 * A "virtual tuple" which kind of bleeds presentation into the
 * semantics. Represents a set of values that go together, but spill
 * onto the board when they are the top-level node.
 *
 * We probably want to move this and other game primitives (like
 * missing) into their own module.
 */
export function vtuple(children) {
    const result = { type: "vtuple", locked: true, numChildren: children.length };
    let i = 0;
    for (let child of children) {
        result["child" + i.toString()] = child;
        i++;
    }
    return result;
}

/**
 * Given an expression, return the projection used to represent it.
 *
 * The expression should already be flattened, and is thus an
 * Immutable.js object.
 */
export function project(stage, expr) {
    switch (expr.get("type")) {
    case "number":
        return gfx.layout.hbox(
            gfx.constant(stage.allocate(gfx.text(expr.get("value").toString()))),
            {
                color: "#FFF",
            });
    case "missing":
        return gfx.roundedRect({
            color: "#555",
            shadowOffset: -2,
            radius: 22,
        });
    case "add": {
        const textId = stage.allocate(gfx.text("+"));
        return gfx.layout.hbox((id, state) => [
            state.getIn([ "nodes", id, "left" ]),
            textId,
            state.getIn([ "nodes", id, "right" ]),
        ], {
            color: "orange",
        });
    }
    case "lambda": {
        const arrowTextId = stage.allocate(gfx.text("=>"));
        return gfx.layout.hbox((id, state) => [
            state.getIn([ "nodes", id, "arg" ]),
            arrowTextId,
            state.getIn([ "nodes", id, "body" ]),
        ]);
    }
    case "vtuple": {
        return gfx.layout.vbox((id, state) => {
            const node = state.getIn([ "nodes", id ]);
            const result = [];
            for (let i = 0; i < node.get("numChildren"); i++) {
                result.push(node.get(`child${i}`));
            }
            return result;
        }, {
            padding: { top: 0, inner: 5, bottom: 0, left: 0, right: 0 },
            strokeWhenChild: false,
            subexpScale: 1,
        });
    }
    case "lambdaArg":
        return gfx.text(`(${expr.get("name")})`);
    case "var":
        return gfx.layout.hbox(
            gfx.constant(stage.allocate(gfx.text(expr.get("name")))),
            {
                strokeWhenChild: false,
            });
    case "symbol": {
        switch (expr.get("name")) {
        case "star":
            return gfx.shapes.star();
        case "rect":
            return gfx.shapes.rectangle();
        case "circle":
            return gfx.shapes.circle();
        case "triangle":
            return gfx.shapes.triangle();
        default:
            console.error(`Undefined symbol type ${expr.get("name")}.`);
            return [];
        }
    }
    default:
        console.error(`Undefined expression type ${expr.get("type")}.`);
        return [];
    }
}

/**
 * Given an expression, return a list of fields that contain
 * subexpressions.
 */
export function subexpressions(expr) {
    let type;
    if (expr.type) type = expr.type;
    else type = expr.get("type");

    switch (type) {
    case "number":
    case "missing":
    case "lambdaArg":
    case "var":
    case "symbol":
        return [];
    case "add":
        return ["left", "right"];
    case "lambda":
        return ["arg", "body"];
    case "vtuple": {
        // vtuple is awkward since it might have an arbitrary number
        // of children, but since we can't override indexing in JS (I
        // think), we can't just return a list of indices - we have to
        // construct a field for each child
        const result = [];
        const nc = expr.get ? expr.get("numChildren") : expr.numChildren;
        for (let i = 0; i < nc; i++) {
            result.push(`child${i}`);
        }
        return result;
    }
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [];
    }
}

/**
 * Given an expression and the Redux node store, return a new
 * immutable expression representing the result of that expression
 * taking a small step, or null if it cannot step.
 */
export function smallStep(nodes, expr) {
    switch (expr.get("type")) {
    case "add": {
        const left = nodes.get(expr.get("left"));
        const right = nodes.get(expr.get("right"));
        if (left.get("type") === "number" && right.get("type") === "number") {
            return immutable.Map(number(left.get("value") + right.get("value"))).set("id", nextId());
        }
        break;
    }
    default:
        break;
    }
}

/**
 * Create a clone of an immutable node by ID.
 *
 * This should be moved somewhere else, as it isn't semantics-specific.
 */
export function clone(id, nodes) {
    const node = nodes.get(id);
    let newNodes = [];

    let currentStore = nodes;
    const result = node.withMutations(n => {
        const newId = nextId();
        n.set("id", newId);

        for (const field of subexpressions(node)) {
            const [ subclone, subclones, nodesStore ] = clone(node.get(field), currentStore);
            currentStore = nodesStore;
            const result = subclone.withMutations(sc => {
                sc.set("parent", newId);
                sc.set("parentField", field);
            });
            newNodes = newNodes.concat(subclones);
            newNodes.push(result);

            n.set(field, subclone.get("id"));
        }

        currentStore = currentStore.set(newId, n);
    });

    return [ result, newNodes, currentStore ];
}

/**
 * Given the node store and the IDs of two nodes, try to preform a
 * beta reduction. Return null if not possible.
 */
export function betaReduce(nodes, targetNodeId, argNodeId) {
    const targetNode = nodes.get(targetNodeId);
    const argNode = nodes.get(argNodeId);
    if (!targetNode.has("parent") || targetNode.get("parent") === null) {
        return null;
    }
    const topNode = nodes.get(targetNode.get("parent"));

    if (topNode.get("type") !== "lambda" ||
        targetNode.get("type") !== "lambdaArg" ||
        topNode.get("arg") !== targetNode.get("id")) {
        // TODO: check for no nesting of lambdas
        return null;
    }

    if (search(nodes, topNode.get("id"), (n) => n.get("type") === "missing")) {
        return null;
    }
    // TODO: check for unbound names
    // TODO: need to do a noncapturing substitution
    const name = targetNode.get("name");
    let newNodes = [];
    let [ newTop, _ ] = map(nodes, topNode.get("body"), (nodes, id) => {
        const node = nodes.get(id);
        if (node.get("type") === "var" && node.get("name") === name) {
            const [ cloned, resultNewNodes, nodesStore ] = clone(argNodeId, nodes);
            const result = cloned.withMutations(n => {
                n.set("parent", node.get("parent"));
                n.set("parentField", node.get("parentField"));
            });
            newNodes.push(result);
            newNodes = newNodes.concat(resultNewNodes);
            return [ result, nodesStore.set(result.get("id"), result) ];
        }
        else {
            const [ result, resultNewNodes, nodesStore ] = clone(id, nodes);
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
            subexpressions(newTop).map(field => newTop.get(field)),
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
}

// Create specialized copies of generic algorithms.
export const flatten = core.genericFlatten(nextId, subexpressions);
export const map = core.genericMap(subexpressions);
export const search = core.genericSearch(subexpressions);

/**
 * Construct the animation for the small-step that the given
 * expression would take.
 */
export function animateStep(nodes, exp) {
    return Promise.resolve(smallStep(nodes, exp));
}

/**
 * A helper function that should abstract over big-step, small-step,
 * multi-step, and any necessary animation.
 *
 * TODO: it needs to also insert intermediate states into the
 * undo/redo stack, and mark which undo/redo states are big-steps,
 * small-steps, etc. to allow fine-grained undo/redo.
 */
export function reduce(nodes, exp) {
    return animateStep(nodes, exp).then((result) => {
        if (!result) return null;
        // Flatten the result
        const nodes = flatten(result);
        return [ result, nodes ];
    });
}

/**
 * Shallow equality (does not compare children)
 */
export function shallowEqual(n1, n2) {
    if (n1.get("type") !== n2.get("type")) return false;

    switch (n1.get("type")) {
    case "symbol":
        return n1.get("name") === n2.get("name");
    case "lambda":
        // TODO: should do alpha renaming or something
        return true;
    case "number":
        return n1.get("value") === n2.get("value");
    case "lambdaArg":
        // TODO: should do alpha renaming or something
        return n1.get("name") === n2.get("name");
    case "var":
        // TODO: should do alpha renaming or something
        return n1.get("name") === n2.get("name");
    default:
        console.error(`Cannot compare ${n1.get("type")} for shallow equality.`);
        return false;
    }
}

// Generic equality
export const equal = core.genericEqual(subexpressions, shallowEqual);
