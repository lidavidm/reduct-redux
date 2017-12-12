import { nextId } from "../reducer/reducer";
import * as gfx from "../gfx/core";
import * as core from "./core";

// TODO: pin down the signature for a semantics module

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
    case "lambdaArg":
        return gfx.text(`(${expr.get("name")})`);
    case "var":
        return gfx.text(`${expr.get("name")}`);
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [];
    }
}

export function subexpressions(expr) {
    let type;
    if (expr.type) type = expr.type;
    else type = expr.get("type");

    switch (type) {
    case "number":
    case "missing":
    case "lambdaArg":
    case "var":
        return [];
    case "add":
        return ["left", "right"];
    case "lambda":
        return ["arg", "body"];
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [];
    }
}

export function smallStep(nodes, expr) {
    switch (expr.get("type")) {
    case "add": {
        const left = nodes.get(expr.get("left"));
        const right = nodes.get(expr.get("right"));
        if (left.get("type") === "number" && right.get("type") === "number") {
            return number(left.get("value") + right.get("value"));
        }
        break;
    }
    default:
        break;
    }
}

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
    const newNodes = [];
    const newTop = map(nodes, topNode.get("body"), (nodes, id) => {
        const node = nodes.get(id);
        if (node.get("type") === "var" && node.get("name") === name) {
            const result = argNode.withMutations(n => {
                n.set("id", nextId());
                n.set("parent", node.get("parent"));
                n.set("parentField", node.get("parentField"));
            });
            newNodes.push(result);
            return result;
        }
        else {
            const result = node.set("id", nextId());
            newNodes.push(result);
            return result;
        }
    }).delete("parent");

    return [
        topNode.get("id"),
        newTop,
        newNodes.slice(1).concat([newTop]),
    ];
}

export const flatten = core.genericFlatten(nextId, subexpressions);
export const map = core.genericMap(subexpressions);
export const search = core.genericSearch(subexpressions);

export function animateStep(nodes, exp) {
    return Promise.resolve(smallStep(nodes, exp));
}

export function reduce(nodes, exp) {
    return animateStep(nodes, exp).then((result) => {
        if (!result) return null;
        // Flatten the result
        const nodes = flatten(result);
        return [ result, nodes ];
    });
}
