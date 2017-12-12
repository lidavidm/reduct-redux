import { nextId } from "../reducer/reducer";
import * as gfx from "../gfx/core";
import { genericFlatten } from "./core";

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

export const flatten = genericFlatten(nextId, subexpressions);

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
