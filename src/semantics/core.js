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
        let currentStore = nodes;
        const currentNode = nodes.get(nodeId);
        const node = currentNode.withMutations(n => {
            for (const field of subexpressions(n)) {
                const [ newNode, newStore ] = innerMap(currentStore, n.get(field), f);
                console.debug(`genericMap: traversing ${currentNode.get("type")}.${field}, set to new node ${newNode.get("id")}`);
                currentStore = newStore.set(newNode.get("id"), newNode);
                n.set(field, newNode.get("id"));
            }
        });
        // Function returns new node and new store
        return f(currentStore.set(node.get("id"), node), node.get("id"));
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

export function genericEqual(subexpressions, shallowEqual) {
    return function equal(id1, id2, state) {
        const n1 = state.getIn([ "nodes", id1 ]);
        const n2 = state.getIn([ "nodes", id2 ]);

        if (!shallowEqual(n1, n2)) return false;
        for (const field of subexpressions(n1)) {
            if (!equal(n1.get(field), n2.get(field), state)) {
                return false;
            }
        }
        return true;
    };
}
