import * as numeric from "numeric";

import * as gfx from "../gfx/core";
import * as progression from "../game/progression";

/**
 * Seeded random number gen code from olsn @
 * http://indiegamr.com/generate-repeatable-random-numbers-in-js/
 */
let SEED = 6;
function seededRandom(max, min) {
    max = max || 1;
    min = min || 0;

    SEED = (SEED * 9301 + 49297) % 233280;
    const rnd = SEED / 233280;

    return min + rnd * (max - min);
};

// Ian's really inefficient packing algorithm:
// * 1. Put the expressions in random places.
// * 2. Check if they overlap.
// * --> If so, try again.
// * --> Otherwise, add to a list.
// * 3. When the list of candidates reaches a threshold #, quit.
// * 4. Select the candidate with the greatest pairwise distance between expressions.
export function ianPacking(stage, bounds, nodeIds) {
    SEED = 6;

    for (const nodeId of nodeIds) {
        stage.views[nodeId].prepare(nodeId, nodeId, stage.getState(), stage);
    }

    const sizeCache = {};
    const getSize = function(id) {
        if (!sizeCache[id]) {
            sizeCache[id] = gfx.absoluteSize(stage.views[id]);
        }
        return sizeCache[id];
    };

    const intersects = function(positions, id1, id2) {
        const pos1 = positions.get(id1);
        const sz1 = getSize(id1);
        const pos2 = positions.get(id2);
        const sz2 = getSize(id2);
        return !(pos2.x > pos1.x + sz1.w ||
                 pos2.x + sz2.w < pos1.x ||
                 pos2.y > pos1.y + sz1.h ||
                 pos2.y + sz2.h < pos1.y);
    };

    const candidates = [];
    const CANDIDATE_THRESHOLD = 10;

    let iterations = 0;

    while (candidates.length < CANDIDATE_THRESHOLD && iterations < 25000) {
        iterations += 1;

        const candidate = new Map();

        // 1. Put the expressions in random places.
        for (const nodeId of nodeIds) {
            const size = getSize(nodeId);

            let y = 0;
            while (y < 50) {
                y = (seededRandom() * (bounds.h - size.h)) + bounds.y;
            }

            const x = Math.max((seededRandom() * (bounds.w - size.w)) + bounds.x, bounds.x);

            const pos = { x, y };
            candidate.set(nodeId, pos);
        }

        // 2. Check if they overlap.
        let overlap = false;

        let numOverlaps = 0;
        outerLoop:
        for (const id1 of nodeIds) {
            for (const id2 of nodeIds) {
                if (id1 <= id2) continue;

                if (intersects(candidate, id1, id2)) {
                    numOverlaps += 1;

                    if (iterations < 10000 || numOverlaps > 4) {
                        overlap = true;
                        break outerLoop;
                    }
                }
            }
        }

        if (!overlap) {
            candidates.push(candidate);
        }
    }
    // 3. When the list of candidates reaches a threshold #, quit.

    // 4. Select the candidate with the (least seems to work better?)
    // pairwise distance between expressions.
    const pairwiseTotals = [];
    const pairwiseCalcs = [];
    const computePairwiseDist = function(a, b) {
        let sum = 0;
        for (const id1 of a.keys()) {
            for (const id2 of b.keys()) {
                const pos1 = a.get(id1);
                const pos2 = b.get(id2);
                sum += Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2);
            }
        }
        return sum;
    };

    for (let i = 0; i < candidates.length; i++) {
        pairwiseTotals[i] = 0;
        for (let j = 0; j < candidates.length; j++) {
            if (i === j) continue;

            const key = `${i} ${j}`;
            if (key in pairwiseCalcs) {
                pairwiseTotals[i] += pairwiseCalcs[key];
            }
            else {
                pairwiseCalcs[key] = computePairwiseDist(candidates[i], candidates[j]);
                pairwiseTotals[i] += pairwiseCalcs[key];
            }
        }
    }

    let maxDist = progression.currentLevel() === 0 ? 100000000 : 0;
    let maxIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
        if (progression.currentLevel() === 0 ?
            pairwiseTotals[i] < maxDist :
            pairwiseTotals[i] > maxDist) {
            maxDist = pairwiseTotals[i];
            maxIdx = i;
        }
    }

    if (candidates[maxIdx]) {
        return candidates[maxIdx];
    }

    return null;
}

window.steps = 30;
export function repulsorPacking(stage, bounds, nodeIds) {
    nodeIds.sort();

    SEED = 6;

    for (const nodeId of nodeIds) {
        stage.views[nodeId].prepare(nodeId, nodeId, stage.getState(), stage);
    }

    const sizeCache = {};
    const getSize = function(id) {
        if (!sizeCache[id]) {
            sizeCache[id] = gfx.absoluteSize(stage.views[id]);
        }
        return sizeCache[id];
    };

    const intersects = function(positions, id1, id2) {
        const pos1 = positions.get(id1);
        const sz1 = getSize(id1);
        const pos2 = positions.get(id2);
        const sz2 = getSize(id2);
        return !(pos2.x > pos1.x + sz1.w ||
                 pos2.x + sz2.w < pos1.x ||
                 pos2.y > pos1.y + sz1.h ||
                 pos2.y + sz2.h < pos1.y);
    };

    const distance = function(positions, id1, id2) {
        const pos1 = positions.get(id1);
        const sz1 = getSize(id1);
        const pos2 = positions.get(id2);
        const sz2 = getSize(id2);
        return Math.exp(edgeDistance({
            cx: pos1.x,
            cy: pos1.y,
            w: sz1.w,
            h: sz1.h,
        }, {
            cx: pos2.x,
            cy: pos2.y,
            w: sz2.w,
            h: sz2.h,
        }) / 2);

        // return Math.sqrt((pos1.x - pos2.x)**2 + (pos1.y - pos2.y)**2);
    };

    const positions = new Map();
    let force = 30;

    const centerX = bounds.x + (bounds.w / 2);
    const centerY = bounds.y + (bounds.h / 2);
    for (const nodeId of nodeIds) {
        positions.set(nodeId, { x: centerX, y: centerY });
    }

    for (let i = 0; i < window.steps; i++) {
        const forces = new Map();

        for (const id1 of nodeIds) {
            forces.set(id1, { x: 0, y: 0 });
        }

        for (const id1 of nodeIds) {
            const pos1 = positions.get(id1);
            const sz1 = getSize(id1);

            for (const id2 of nodeIds) {
                if (id1 <= id2) continue;

                let dx = 0;
                let dy = 0;
                const pos2 = positions.get(id2);
                const d = Math.max(1, distance(positions, id1, id2)) / 5;
                const delx = pos2.x - pos1.x;
                const dely = pos2.y - pos1.y;
                const angle = i === 0 ? seededRandom(0, 2 * Math.PI) : Math.atan2(dely, delx);

                dx = -(force / d) * Math.cos(angle);
                dy = -(force / d) * Math.sin(angle);

                forces.get(id1).x += dx;
                forces.get(id1).y += dy;
                forces.get(id2).x -= dx;
                forces.get(id2).y -= dy;
            }

            // forces.get(id1).x += Math.max(100, force) / (((pos1.x - (sz1.w / 2)) - bounds.x) ** 2);
            // forces.get(id1).y += Math.max(100, force) / (((pos1.y - (sz1.h / 2)) - bounds.y) ** 2);
            forces.get(id1).x -= Math.max(100, force) / (((pos1.x + (sz1.w / 2)) - (bounds.x + bounds.w)) ** 2);
            forces.get(id1).y -= Math.max(100, force) / (((pos1.y + (sz1.h / 2)) - (bounds.y + bounds.h)) ** 2);
        }

        for (const id1 of nodeIds) {
            // Constrain positions via bounds
            const pos = positions.get(id1);
            const sz1 = getSize(id1);

            pos.x = Math.max(bounds.x + (sz1.w / 2), pos.x + forces.get(id1).x);
            pos.y = Math.max(bounds.y + (sz1.h / 2), pos.y + forces.get(id1).y);
            pos.x = Math.min(pos.x, (bounds.x + bounds.w) - (sz1.w / 2));
            pos.y = Math.min(pos.y, (bounds.y + bounds.h) - (sz1.h / 2));
        }

        force = Math.max(10, force * 0.95);
    }

    // Recenter? (Compute bounding box and shift things so they are centered)
    let xmin = 10000;
    let ymin = 10000;
    let xmax = 0;
    let ymax = 0;
    for (const id of positions.keys()) {
        const pos = positions.get(id);
        const sz = getSize(id);
        console.log(pos, sz, bounds);
        xmin = Math.min(xmin, pos.x - (sz.w / 2));
        ymin = Math.min(ymin, pos.y - (sz.h / 2));
        xmax = Math.max(xmax, pos.x + (sz.w / 2));
        ymax = Math.max(ymax, pos.y + (sz.h / 2));
    }
    let dx = 0;
    let dy = 0;
    if (xmax - xmin < bounds.w) {
        dx = -(bounds.w - (xmax - xmin)) / 2;
    }
    console.log(dx, xmax, xmin);
    for (const id of positions.keys()) {
        const pos = positions.get(id);
        pos.x += dx;
        pos.y += dy;
    }

    return positions;
}

// Helper functions for edgeDistance. Note that these all use
// center-origin AABBs!
function aabbSides(aabb) {
    const x = aabb.cx - (aabb.w / 2);
    const y = aabb.cy - (aabb.h / 2);
    const { w, h } = aabb;

    return [
        // Top
        [ { x, y }, { x: w, y: 0 } ],
        // Left
        [ { x, y }, { x: 0, y: h } ],
        // Right
        [ { x: x + w, y: y + h }, { x: 0, y: -h } ],
        // Bottom
        [ { x: x + w, y: y + h }, { x: -w, y: 0 } ],
    ];
}

function aabbIntersects(aabb1, aabb2) {
    const pos1 = { x: aabb1.cx - (aabb1.w / 2), y: aabb1.cy - (aabb1.h / 2) };
    const sz1 = aabb1;
    const pos2 = { x: aabb2.cx - (aabb2.w / 2), y: aabb2.cy - (aabb2.h / 2) };
    const sz2 = aabb2;
    return !(pos2.x > pos1.x + sz1.w ||
             pos2.x + sz2.w < pos1.x ||
             pos2.y > pos1.y + sz1.h ||
             pos2.y + sz2.h < pos1.y);
}

function raySegmentIntersect(p, r, q, s) {
    // https://stackoverflow.com/a/565282
    const qmp = { x: q.x - p.x, y: q.y - p.y };
    const rxs = (r.x * s.y) - (r.y * s.x);
    const qmpxr = (qmp.x * r.y) - (qmp.y * r.x);

    if (Math.abs(rxs) < 1e-5) {
        if (Math.abs(qmpxr) < 1e-5) {
            // Colinear
            const t0 = (qmp.x * r.x + qmp.y * r.y) / (r.x**2 + r.y**2);
            // const qmpps = { x: q.x + s.x - p.x, y: q.x + s.y - p.y };
            // const t1 = (qmpps.x * r.x + qpsmp.y * r.y) / (r.x**2 + r.y**2);
            if (t0 >= 0) {
                return {
                    x: p.x + (t0 * r.x),
                    y: p.y + (t0 * r.y),
                    t: t0,
                };
            }
        }
        // Parallel and non-intersecting
        return null;
    }

    const qmpxs = (qmp.x * s.y) - (qmp.y * s.x);
    const t = qmpxs / rxs;
    const u = qmpxr / rxs;

    if (u >= 0 && u <= 1 && t >= 0) {
        // Intersection
        return {
            x: p.x + (t * r.x),
            y: p.y + (t * r.y),
            t,
            u,
        };
    }
    // Non-parallel and non-intersecting
    return null;
}

// Computes edge-to-edge distance between two AABBs.
function edgeDistance(aabb1, aabb2) {
    // Take the ray from the center of one box heading towards the
    // other. Determine the intersection points with the border of the
    // AABB, then compute distance between those.

    // The ray has origin p and direction r.
    const p = { x: aabb1.cx, y: aabb1.cy };
    const r = { x: aabb2.cx - aabb1.cx, y: aabb2.cy - aabb1.cy };

    let point1;
    let point2;
    for (const [ q, s ] of aabbSides(aabb1)) {
        const result = raySegmentIntersect(p, r, q, s);
        if (result) {
            point1 = result;
            break;
        }
    }

    for (const [ q, s ] of aabbSides(aabb2)) {
        const result = raySegmentIntersect(p, r, q, s);
        if (result) {
            point2 = result;
            break;
        }
    }

    const d = gfx.distance(point1, point2);
    // If the AABBs intersect, the distance is negative.
    if (aabbIntersects(aabb1, aabb2)) {
        return -d;
    }
    return d;
}

export function optimizationPacking(stage, bounds, nodeIds) {
    const initial = ianPacking(stage, bounds, nodeIds);
    const sizeCache = {};
    const getSize = function(id) {
        if (!sizeCache[id]) {
            sizeCache[id] = gfx.absoluteSize(stage.views[id]);
        }
        return sizeCache[id];
    };

    const f = (coords) => {
        let result = 0;

        for (let i = 0; i < nodeIds.length; i++) {
            const x1 = coords[(2 * i)];
            const y1 = coords[(2 * i) + 1];
            const sz1 = getSize(nodeIds[i]);
            for (let j = i + 1; j < nodeIds.length; j++) {
                const x2 = coords[(2 * j)];
                const y2 = coords[(2 * j) + 1];
                const sz2 = getSize(nodeIds[j]);
                // const pairwiseDistance = ((x1 - x2) ** 2) + ((y1 - y2) ** 2);
                // result += 1 / Math.exp(Math.sqrt(pairwiseDistance) / (Math.max(bounds.w, bounds.h) / 10));
                const pairwiseDistance = edgeDistance({
                    cx: x1,
                    cy: y1,
                    w: sz1.w,
                    h: sz1.h,
                }, {
                    cx: x2,
                    cy: y2,
                    w: sz2.w,
                    h: sz2.h,
                });
                result += 1 / Math.exp(Math.sqrt(pairwiseDistance) / (Math.max(bounds.w, bounds.h) / 5));
                // result += 1 / (1 + Math.abs(pairwiseDistance));
                // result += Math.exp(-pairwiseDistance / (Math.max(bounds.w, bounds.h) / 2));
            }

            // result += 1 / (((x1 - (sz1.w / 2)) - bounds.x) ** 2);
            // result += 1 / (((y1 - (sz1.h / 2)) - bounds.y) ** 2);
            // result += 1 / (((x1 + (sz1.w / 2)) - (bounds.x + bounds.w)) ** 2);
            // result += 1 / (((y1 + (sz1.h / 2)) - (bounds.y + bounds.h)) ** 2);
            // result += 1 / (Math.max(2.5, (x1 - (sz1.w / 2)) - bounds.x) ** 2);
            // result += 1 / (Math.max(2.5, (y1 - (sz1.h / 2)) - bounds.y) ** 2);
            // result += 1 / (Math.max(2.5, -(x1 + (sz1.w / 2)) + (bounds.x + bounds.w)) ** 2);
            // result += 1 / (Math.max(2.5, -(y1 + (sz1.h / 2)) + (bounds.y + bounds.h)) ** 2);


            result += 1 / Math.exp(((x1 - (sz1.w / 2)) - bounds.x) / (Math.max(bounds.w, bounds.h) / 2));
            result += 1 / Math.exp(((y1 - (sz1.h / 2)) - bounds.y) / (Math.max(bounds.w, bounds.h) / 2));
            result += Math.exp(((x1 + (sz1.w / 2)) - (bounds.x + bounds.w)) / (Math.max(bounds.w, bounds.h) / 2));
            result += Math.exp(((y1 + (sz1.h / 2)) - (bounds.y + bounds.h)) / (Math.max(bounds.w, bounds.h) / 2));
        }

        return result;
    };

    const initCoords = [];
    for (const id of nodeIds) {
        const { x, y } = initial.get(id);
        initCoords.push(x);
        initCoords.push(y);
    }

    console.log(f(initCoords));
    console.log(JSON.stringify(initCoords));

    const result = numeric.uncmin(f, initCoords, undefined, undefined, window.iterations || 5);
    const { solution } = result;

    console.log(f(solution), result);
    console.log(JSON.stringify(solution));
    const positions = new Map();
    let i = 0;
    for (const id of nodeIds) {
        positions.set(id, {
            x: solution[i],
            y: solution[i + 1],
        });
        i += 2;
    }

    return positions;
}
