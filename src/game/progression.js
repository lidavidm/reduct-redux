export const PROGRESSIONS = {
    "Elementary": {
        dir: "levels-progression/",
        digraph: {
            "functions": ["arithmetic"],
            "arithmetic": ["application"],
            "application": ["definition"],
            "definition": ["define-challenges"],
            "define-challenges": ["booleans-intro"],
            "booleans-intro": ["weekdays"],
            "weekdays": ["recursion"],
            "recursion": [],
        },
        settings: { // This sets global flags.
            "__ALLOW_PARTIAL_REPLICATION": false,
            "__ALLOW_SKIPPING": true,
            "__ALLOW_ARRAY_EVENTS": false,
        }
    },
};

export const ACTIVE_PROGRESSION = "Elementary";

export const ACTIVE_PROGRESSION_DEFINITION = PROGRESSIONS[ACTIVE_PROGRESSION];

let currentLevelIdx = 0;

export function currentLevel() {
    return currentLevelIdx;
}

export function jumpToLevel(idx) {
    currentLevelIdx = idx;
    save();
}

export function nextLevel() {
    currentLevelIdx++;
    save();
}

export function prevLevel() {
    currentLevelIdx--;
    save();
}

export function save() {
    window.localStorage["currentLevelIdx"] = currentLevelIdx;
}

export function restore() {
    if (window.localStorage["currentLevelIdx"]) {
        currentLevelIdx = window.parseInt(window.localStorage["currentLevelIdx"], 10);
    }
}
