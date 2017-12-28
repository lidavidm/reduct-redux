export function genericFlatten(nextId, subexpressions) {
    return function flatten(expr) {
        expr.id = nextId();
        let result = [expr];

        for (const field of subexpressions(expr)) {
            // Record the ID of the parent, as well as which field of
            // the parent we are stored in.
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

export function genericClone(nextId, subexpressions) {
    return function clone(id, nodes) {
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
                // TODO: delete any cached __missing fields
            }

            currentStore = currentStore.set(newId, n);
        });

        return [ result, newNodes, currentStore ];
    };
}

export function genericBetaReduce(semant, nodes, config) {
    const { topNode, targetNode, argIds } = config;
    // Prevent application when there are missing nodes
    // TODO: move this check into the core?
    if (semant.search(nodes, topNode.get("id"),
                      (n) => n.get("type") === "missing")) {
        return null;
    }

    if (argIds.length !== 1) {
        // TODO: will we ever have multi-argument application?
        return null;
    }

    // TODO: check for unbound names
    // TODO: need to do a noncapturing substitution
    const name = config.targetName(targetNode);
    let newNodes = [];
    let [ newTop, _ ] = semant.map(nodes, topNode.get("body"), (nodes, id) => {
        const node = nodes.get(id);
        if (config.isVar(node) && config.varName(node) === name) {
            const [ cloned, resultNewNodes, nodesStore ] = semant.clone(argIds[0], nodes);
            const result = cloned.withMutations(n => {
                n.set("parent", node.get("parent"));
                n.set("parentField", node.get("parentField"));
            });
            newNodes.push(result);
            newNodes = newNodes.concat(resultNewNodes);
            return [ result, nodesStore.set(result.get("id"), result) ];
        }
        else {
            const [ result, resultNewNodes, nodesStore ] = semant.clone(id, nodes);
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
            semant.subexpressions(newTop).map(field => newTop.get(field)),
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

/**
 * Standard definition for missing expression.
 */
export const missing = {
    kind: "placeholder",
    fields: [],
    subexpressions: [],
    locked: false,
    projection: {
        type: "default",
        shape: "()",
        color: "#555",
        shadowOffset: -2,
        radius: 22,
        padding: {
            left: 25,
            right: 25,
            inner: 0,
        },
    },
};
