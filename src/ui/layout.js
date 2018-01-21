import * as gfx from "../gfx/core";

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

        // return (pos1.x + sz1.w >= pos2.x && pos1.x <= pos2.x + sz2.w) ||
        //     (pos1.y + sz1.h >= pos2.y && pos1.y <= pos2.y + sz2.h) ||
        //     (pos1.x <= pos2.x + sz2.w && pos1.x >= pos2.x) ||
        //     (pos1.y <= pos2.y + sz2.h && pos1.y >= pos2.y);
        return !(pos2.x > pos1.x + sz1.w ||
                 pos2.x + sz2.w < pos1.x ||
                 pos2.y > pos1.y + sz1.h ||
                 pos2.y + sz2.h < pos1.y);
    };

    const candidates = [];
    const CANDIDATE_THRESHOLD = 10;

    let iterations = 0;

    while (candidates.length < CANDIDATE_THRESHOLD && iterations < 50000) {
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
                if (id1 === id2) continue;

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

    // 4. Select the candidate with the greatest pairwise distance between expressions.
    const pairwiseTotals = [];
    const pairwiseCalcs = [];
    const computePairwiseDist = function(a, b) {
        let sum = 0;
        for (const id1 of a.keys()) {
            for (const id2 of b.keys()) {
                const pos1 = a.get(id1);
                const pos2 = b.get(id2);
                sum += Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
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

    let maxDist = 0;
    let maxIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
        if (pairwiseTotals[i] > maxDist) {
            maxDist = pairwiseTotals[i];
            maxIdx = i;
        }
    }

    if (candidates[maxIdx]) {
        return candidates[maxIdx];
    }

    return null;
}
