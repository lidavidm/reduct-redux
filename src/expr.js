export function number(value) {
    return { kind: "number", value: value };
}

export function missing() {
    return { kind: "missing" };
}

export function add(expr1, expr2) {
    return { kind: "add", left: expr1, right: expr2 };
}
