export const PROGRESSIONS = {
    'Elementary': {
        dir: 'levels-progression/',
        digraph: {
            'functions': ['arithmetic'],
            'arithmetic': ['application'],
            'application': ['definition'],
            'definition': ['define-challenges'],
            'define-challenges': ['booleans-intro'],
            'booleans-intro': ['weekdays'],
            'weekdays': ['recursion'],
            'recursion': [],
        },
        settings: { // This sets global flags.
            '__ALLOW_PARTIAL_REPLICATION': false,
            '__ALLOW_SKIPPING': true,
            '__ALLOW_ARRAY_EVENTS': false,
        }
    },
};

export const ACTIVE_PROGRESSION = 'Elementary';

export const ACTIVE_PROGRESSION_DEFINITION = PROGRESSIONS[ACTIVE_PROGRESSION];

export let currentLevelIdx = 1;
