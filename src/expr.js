export function number(value) {
    return { type: "number", value: value };
}

export function missing() {
    return { type: "missing" };
}

export function add(expr1, expr2) {
    return { type: "add", left: expr1, right: expr2 };
}
