export function genericFlatten(nextId, subexpressions) {
    return function flatten(expr) {
        expr.id = nextId();
        let result = [expr];

        for (const field of subexpressions(expr)) {
            expr[field].parent = expr.id;
            expr[field].parentField = field;
            result = result.concat(flatten(expr[field]));
            expr[field] = expr[field].id;
        }

        return result;
    };
}

export function genericMap(subexpressions) {
    const innerMap = function(nodes, nodeId, f) {
        const node = f(nodes, nodeId);
        return node.withMutations(n => {
            for (const field of subexpressions(node)) {
                n.set(field, innerMap(nodes, n.get(field), f).get("id"));
            }
        });
    };
    return innerMap;
}

export function genericSearch(subexpressions) {
    return function(nodes, nodeId, f) {
        const queue = [ nodeId ];
        while (queue.length > 0) {
            const id = queue.pop();
            if (f(nodes, id)) return true;

            const n = nodes.get(id);
            for (const field of subexpressions(n)) {
                queue.push(n.get(field));
            }
        }
        return false;
    };
}
