import VERSION from "../version";

export const PROGRESSIONS = {
    "Elementary": {
        dir: "levels-progression/",
        digraph: {
            "functions": ["replication"],
            "replication": ["multiargument"],
            "multiargument": ["functions-challenge"],
            "functions-challenge": ["arithmetic"],
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

let learnedSyntaxes = [];

export function currentLevel() {
    return currentLevelIdx;
}

export function jumpToLevel(idx) {
    currentLevelIdx = idx;
    save();
}

export function nextLevel() {
    if (isChapterEnd()) {
        const challenge = hasChallengeChapter();
        if (challenge) {
            currentLevelIdx = challenge.endIdx + 1;
            save();
            return;
        }
    }
    currentLevelIdx = Math.min(
        currentLevelIdx + 1,
        ACTIVE_PROGRESSION_DEFINITION.progression.levels.length - 1
    );
    save();
}

export function nextChallengeLevel() {
    currentLevelIdx = Math.min(
        currentLevelIdx + 1,
        ACTIVE_PROGRESSION_DEFINITION.progression.levels.length - 1
    );
    save();
}

export function prevLevel() {
    currentLevelIdx = Math.max(0, currentLevelIdx - 1);
    const chapter = currentChapter();
    if (chapter.challenge) {
        currentLevelIdx = chapter.startIdx - 1;
    }
    save();
}

export function currentChapter() {
    for (const chapter of Object.values(ACTIVE_PROGRESSION_DEFINITION.progression.chapters)) {
        if (currentLevelIdx >= chapter.startIdx && currentLevelIdx <= chapter.endIdx) {
            return chapter;
        }
    }
    return null;
}

export function chapterIdx() {
    let idx = 0;
    for (const chapter of Object.values(ACTIVE_PROGRESSION_DEFINITION.progression.chapters)) {
        if (currentLevelIdx >= chapter.startIdx && currentLevelIdx <= chapter.endIdx) {
            break;
        }
        idx += 1;
    }
    return idx;
}

export function isChapterStart() {
    return currentLevelIdx === currentChapter().startIdx;
}

export function isChapterEnd() {
    return currentLevelIdx === currentChapter().endIdx;
}

export function isGameEnd() {
    return currentLevelIdx === ACTIVE_PROGRESSION_DEFINITION.progression.levels.length - 1;
}

export function hasChallengeChapter() {
    const chapters = ACTIVE_PROGRESSION_DEFINITION.progression.linearChapters;
    for (let i = 0; i < chapters.length; i++) {
        const chapterName = chapters[i];
        const chapter = ACTIVE_PROGRESSION_DEFINITION.progression.chapters[chapterName];
        if (currentLevelIdx >= chapter.startIdx && currentLevelIdx <= chapter.endIdx) {
            const nextChapter = ACTIVE_PROGRESSION_DEFINITION.progression.chapters[chapters[i + 1]];
            if (nextChapter && nextChapter.challenge) {
                return nextChapter;
            }
        }
    }
    return false;
}

export function learnSyntax(name) {
    if (learnedSyntaxes.indexOf(name) === -1) {
        learnedSyntaxes.push(name);
    }
    save();
}

export function getLearnedSyntaxes() {
    // Filter out undefined syntaxes
    learnedSyntaxes = learnedSyntaxes.filter(name => getSyntaxDefinition(name));
    save();
    return learnedSyntaxes;
}

export function getSyntaxDefinition(name) {
    return ACTIVE_PROGRESSION_DEFINITION.progression.syntax[name];
}

const __fadeOverrides = {};
export function getFadeLevel(exprType, level=null) {
    level = level === null ? currentLevel() : level;
    const fadeLevels = ACTIVE_PROGRESSION_DEFINITION.progression.levels[level].fade;
    if (typeof __fadeOverrides[exprType] === "number") {
        return __fadeOverrides[exprType];
    }
    else if (typeof fadeLevels[exprType] === "number") {
        return fadeLevels[exprType];
    }
    return 0;
}

export function forceFadeLevel(exprType, level) {
    __fadeOverrides[exprType] = level;
}

export function isFadeBorder(exprType) {
    return currentLevel() !== 0 &&
        (getFadeLevel(exprType, currentLevel()) !==
         getFadeLevel(exprType, currentLevel() - 1));
}

export function overrideFadeLevel(cb) {
    currentLevelIdx -= 1;
    try {
        cb();
    }
    finally {
        currentLevelIdx += 1;
    }
}

export function save() {
    window.localStorage["currentLevelIdx"] = currentLevelIdx;
    window.localStorage["learnedSyntaxes"] = JSON.stringify(learnedSyntaxes);
    window.localStorage["version"] = VERSION;
}

export function restore() {
    if (parseInt(window.localStorage["version"], 10) !== VERSION) {
        save();
        return;
    }

    if (window.localStorage["currentLevelIdx"]) {
        currentLevelIdx = window.parseInt(window.localStorage["currentLevelIdx"], 10);
    }

    if (window.localStorage["learnedSyntaxes"]) {
        learnedSyntaxes = JSON.parse(window.localStorage["learnedSyntaxes"]);
    }

    // Guard against negatives, NaN
    if (currentLevelIdx < 0 || !(currentLevelIdx >= 0)) currentLevelIdx = 0;
    if (currentLevelIdx > ACTIVE_PROGRESSION_DEFINITION.progression.levels.length - 1) {
        currentLevelIdx = ACTIVE_PROGRESSION_DEFINITION.progression.levels.length - 1;
    }
    save();
}
