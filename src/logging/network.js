import vis from "vis";

// Compares arrays like sets.
function setCompare(arr1, arr2, compareFunc) {
    if (arr1.length !== arr2.length) return false;

    let a1 = arr1.slice();
    let a2 = arr2.slice();

    while(a1.length > 0) {

        let e = a1.pop();

        let matching_idx = -1;
        for (let i = 0; i < a2.length; i++) {
            if (compareFunc(a2[i], e)) {
                matching_idx = i;
                break;
            }
        }

        if (matching_idx === -1) return false;
        else {
            a2.splice(matching_idx, 1); // remove this element
            continue;
        }
    }
    return true;
}

export default class Network {

    constructor() {

        // Objects, each with 'id' and 'data' elements.
        this.nodes = [];

        // Objects with 'from' and 'to' as node ids,
        // and an optional 'data' tag explaining the transition (e.g. reductions).
        this.edges = [];

        // The last state 'pushed' onto the network graph.
        this.lastNodeId = null;

        // The next available node id. (they must all be unique)
        this.unusedNodeId = 0;

        // For internal ordering purposes.
        // (e.g. to trace the player's moves precisely)
        this.unusedEdgeId = 0;
        this.lastEdgeId = 0;

        this.startTS = Date.now();
    }

    get length() {
        return this.nodes.length;
    }

    // Where 'from' and 'to' are node ids.
    addEdge(from, to, data=null) {
        if (!this.hasEdge(from, to, data)) {
            const new_edge = {from:from, to:to, uid:this.unusedEdgeId, ts:(Date.now() - this.startTS)};
            if (data !== null) new_edge.data = data;
            this.edges.push(new_edge);
            this.lastEdgeId = this.unusedEdgeId;
            this.unusedEdgeId += 1;
        }
    }
    setEdgeData(uid, data) {
        for (let i = 0; i < this.edges.length; i++) {
            if (this.edges[i].uid === uid) {
                this.edges[i].data = data;
                break;
            }
        }
    }
    // * Note that this will return 'false' if data differs.
    // * This is to allow for a multigraph, in case it arises.
    // * I.e., Players might use different ways to
    // * transition from two of the same states.
    hasEdge(from, to, data=null) {
        for (let i = 0; i < this.edges.length; i++) {
            const e = this.edges[i];
            if (e.from === from && e.to === to) {
                if (data === null || e.data === data)
                    return true; // match
            }
        }
        return false;
    }

    // Set-compare objects.
    compare(x, y) {
        const typeX = typeof x;
        const typeY = typeof y;
        if (Array.isArray(x)) {
            if (Array.isArray(y)) {
                return setCompare(x, y, (a, b) => this.compare(a, b));
            } else {
                return false;
            }
        }
        else if ((typeX === 'string' && typeY === 'string') ||
                 (typeX === 'number' && typeY === 'number')) {
            return x === y;
        }
        else if (typeX === 'object' && typeY === 'object') {
            if (Object.keys(x).length !== Object.keys(y).length)
                return false;
            for (var key in x) {
                if (!(key in y) || !this.compare(x[key], y[key]))
                    return false;
            }
            return true;
        }
        else if (typeX !== typeY)
            return false;
        else {
            console.warn('Cannot compare ', x, y, '. Types are odd: ', typeX, typeY);
            return false;
        }
    }

    // Where pattern is a semi-description of a node,
    // e.g. { id:2 } for node with id 2,
    // or { data:"x == star" } for all
    // nodes with data matching "x == star".
    nodesMatching(pattern) {
        let matches = [];
        for (let i = 0; i < this.nodes.length; i++) {
            const n = this.nodes[i];
            for (var key in pattern) {
                if (key in n) {
                    if (typeof n[key] === 'object') { // TODO: This must be set comparison, not sequences.
                        if (this.compare(n[key], pattern[key]))
                            matches.push(n);
                    } else if (n[key] === pattern[key]) {
                        matches.push(n);
                    }
                }
            }
        }
        return matches;
    }
    has(pattern) {
        return this.nodesMatching(pattern).length > 0;
    }
    nodeIdFor(pattern) {
        const ns = this.nodesMatching(pattern);
        if (ns.length === 0) return -1;
        else                 return ns[0].id;
    }
    nodeForId(id) {
        if (id === null || typeof id === 'undefined') return null;
        const ns = this.nodesMatching({id:id});
        if (ns.length === 0) return null;
        else                 return ns[0];
    }
    get lastAddedNode() {
        return this.nodeForId(this.lastNodeId);
    }

    // Push new node onto the graph,
    // checking for existing match,
    // defaulting to this.lastNode for previous node,
    //  and adding an appropriate edge.
    push(stateData, changeData=null, prevNodeId=null) {
        if (prevNodeId === null) prevNodeId = this.lastNodeId;

        // If we already have this node...
        const dup_id = this.nodeIdFor({data: stateData});
        if (dup_id > -1) { // If we've already seen this state...
            // console.log('dup state');
            if (dup_id === prevNodeId) { // We haven't actually moved, so do nothing.
                if (changeData !== null) {
                    this.setEdgeData(this.lastEdgeId, changeData); // belated setting of edge data
                    return true;
                }
                else
                    return false;
            } else {                     // We've gone back to a previous state, so add an edge.
                // console.log('went back to ', dup_id);
                this.addEdge(prevNodeId, dup_id, changeData);
                this.lastNodeId = dup_id; // This is the id of the 'current node' (state) in the 'stack'...
            }
        } else { // This is a new state.
            const nid = this.unusedNodeId;
            this.nodes.push( { id:nid, data:stateData, ts:(Date.now() - this.startTS) } ); // Add a new node.
            if (prevNodeId !== null)  // Add an edge going from prev. node to new one, if prev. node exists.
                this.addEdge(prevNodeId, nid, changeData);
            this.unusedNodeId += 1; // This id has been used, so increment to the next.
            this.lastNodeId = nid;
        }

        return true;
    }

    // For logging minor changes that occur _within_ the current game-state.
    pushAddendumToCurrentState(data) {
        let currentNode = this.lastAddedNode;
        if ('subchanges' in currentNode)
            currentNode.subchanges.push( data );
        else
            currentNode.subchanges = [ data ];
    }

    // Exporting methods
    serialize() {
        return {
            nodes:this.nodes,
            edges:this.edges
        };
    }
    toString() {
        return JSON.stringify(this.serialize());
    }
    toVisJSNetworkData(toLabel) {
        const clean = s => s.replace(/__(star|rect|tri|triangle|diamond|circle|dot)/g, '');
        const toEdgeLabel = e => {
            const d = e.data;
            if (typeof d === 'object') {
                if ('before' in d && 'after' in d)
                    if ('item' in d)
                        return `(${clean(d.before)}) (${clean(d.item)}) -> ${clean(d.after)}`;
                else
                    return clean(d.before) + ' -> ' + clean(d.after);
                else if ('item' in d && 'name' in d)
                    return d.name + ': ' + clean(d.item);
                else
                    return JSON.stringify(d);
            } else return d;
        };

        if (typeof toLabel === 'undefined')
            toLabel = n => {
                if (typeof n.data === 'string') return n.data;
                let s = n.data.board.map(clean).join(') (');
                if (n.data.board.length > 1)
                    s = '(' + s + ')';
                return s;
            };

        const lastNodeId = this.lastNodeId;
        let nodes = new vis.DataSet(this.nodes.map(n => {
            let v = { id:       n.id,
                      label:     toLabel(n) };
            if (n.data === 'reset' || n.data === 'prev' ||
                n.data === 'next' || n.data === 'change-chapter') {
                // Mark reset state.
                v.reset = true;
                v.color = {
                    background: '#BDAEC6',
                    border: '#732C7B',
                    highlight: {
                        background: '#BDAEC6',
                        border: 'Indigo'
                    }
                };
            } else if (n.data === "victory" || // Check for victory state.
                       (n.id === lastNodeId && n.data &&
                        this.compare(n.data.goal, n.data.board))) {
                v.final = true;
                v.color = {
                    background: 'Gold',
                    border: 'Orange',
                    highlight: {
                        background: 'Yellow',
                        border: 'OrangeRed'
                    }
                };
            } else if (n.id === 0) {                 // Mark initial state.
                v.initial = true;
                v.color = {
                    background: 'LightGreen',
                    border: 'green',
                    highlight: {
                        background: 'Aquamarine',
                        border: 'LightSeaGreen'
                    }
                };
            }
            return v;
        }));
        let edges = new vis.DataSet(this.edges.map(e => {
            return { from:      e.from,
                     to:        e.to,
                     label:     (e.data && e.data !== null) ? toEdgeLabel(e) : undefined, };
        }));
        return {
            nodes:nodes,
            edges:edges
        };
    }
}
