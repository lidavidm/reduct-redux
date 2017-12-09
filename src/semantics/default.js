import { nextId } from "../reducer";

export function number(value) {
    return { type: "number", value: value, locked: true };
}

export function missing() {
    return { type: "missing", locked: false, };
}

export function add(expr1, expr2) {
    return { type: "add", left: expr1, right: expr2, locked: true };
}

export function subexpressions(expr) {
    switch (expr.type) {
    case "number":
    case "missing":
        return [];
    case "add":
        return [expr.left, expr.right];
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
    switch (expr.type) {
    case "add": {
        const left = nodes[expr.left];
        const right = nodes[expr.right];
        if (left.type === "number" && right.type === "number") {
            return number(left.value + right.value);
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
