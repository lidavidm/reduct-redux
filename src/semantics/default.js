import { nextId } from "../reducer";
import * as gfx from "../gfx/core";

export function number(value) {
    return { type: "number", value: value, locked: true };
}

export function missing() {
    return { type: "missing", locked: false, };
}

export function add(expr1, expr2) {
    return { type: "add", left: expr1, right: expr2, locked: true };
}

export function project(stage, expr) {
    switch (expr.get("type")) {
    case "number":
        return gfx.hbox(
            gfx.constant(stage.allocate(gfx.text(expr.get("value").toString()))),
            {
                color: "#FFF",
            });
    case "missing":
        return gfx.roundedRect({
            color: "#555",
            shadowOffset: -2,
        });
    case "add":
        const textId = stage.allocate(gfx.text("+"));
        return gfx.hbox((id, nodes) => [
            nodes.getIn([ id, "left" ]),
            textId,
            nodes.getIn([ id, "right" ]),
        ], {
            color: "orange",
        });
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [];
    }
}

export function subexpressions(expr) {
    switch (expr.get("type")) {
    case "number":
    case "missing":
        return [];
    case "add":
        return [expr.get("left"), expr.get("right")];
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [];
    }
}

export function flatten(expr) {
    switch (expr.type) {
    case "number":
    case "missing":
        expr.id = nextId();
        return [expr];
    case "add":
        let result = [expr];
        expr.id = nextId();
        expr.left.parent = expr.id;
        result = result.concat(flatten(expr.left));
        expr.left = expr.left.id;
        expr.right.parent = expr.id;
        result = result.concat(flatten(expr.right));
        expr.right = expr.right.id;
        return result;
    default:
        console.error(`Undefined expression type ${expr.type}.`);
        return [expr];
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
