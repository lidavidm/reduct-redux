export default {
    number: {
        kind: "value",
        type: "number",
        fields: ["value"],
        subexpressions: [],
        projection: {
            type: "default",
            shape: "()",
            color: "cornsilk",
            highlightColor: "orangered",
            fields: ["value"],
        },
    },

    dynamicVariant: {
        kind: "value",
        type: (semant, state, types, expr) => {
            return {
                types: new Map([ [ expr.get("id"), expr.get("variant") ] ]),
                // TODO: this isn't true if it's a variant with
                // fields
                complete: true,
            };
        },
        fields: ["variant", "value"],
        subexpressions: [],
        projection: {
            type: "default",
            shape: "()",
            color: "cornsilk",
            fields: ["value"],
        },
    },

    symbol: [
        {
            kind: "value",
            type: "symbol",
            fields: ["name"],
            subexpressions: [],
            goalNames: {
                "star": [ "star", "a star", "stars" ],
                "circle": [ "circle", "a circle", "circles" ],
                "triangle": [ "triangle", "a triangle", "triangles" ],
                "square": [ "square", "a square", "squares" ],
            },
            projection: {
                type: "case",
                on: "name",
                cases: {
                    star: {
                        type: "symbol",
                        symbol: "star",
                    },
                    circle: {
                        type: "symbol",
                        symbol: "circle",
                    },
                    triangle: {
                        type: "symbol",
                        symbol: "triangle",
                    },
                    rect: {
                        type: "symbol",
                        symbol: "rect",
                    },
                },
            },
        },
        {
            kind: "value",
            type: "symbol",
            fields: ["name"],
            subexpressions: [],
            goalNames: {
                "star": [ "burger", "a burger", "burgers" ],
                "circle": [ "lollipop", "a lollipop", "lollipops" ],
                "triangle": [ "fries", "some fries", "bags of fries" ],
                "square": [ "candy", "a piece of candy", "pieces of candy" ],
            },
            nameReplacements: [
                [ "trianglify", "gimmeFries" ],
                [ "starify", "gimmeBurger" ],
                [ "squarify", "gimmeCandy" ],
                [ "makeStar", "makeBurger" ],
                [ "star", "burger" ],
                [ "rect", "candy" ],
                [ "triangle", "fries" ],
            ],
            projection: {
                type: "case",
                on: "name",
                cases: {
                    star: {
                        type: "sprite",
                        image: "food_1",
                        size: { w: 50 },
                    },
                    circle: {
                        type: "sprite",
                        image: "food_2",
                        size: { h: 50 },
                    },
                    triangle: {
                        type: "sprite",
                        image: "food_3",
                        size: { w: 50 },
                    },
                    rect: {
                        type: "sprite",
                        image: "food_4",
                        size: { w: 50 },
                    },
                },
            },
        },
        {
            kind: "value",
            type: "symbol",
            fields: ["name"],
            subexpressions: [],
            goalNames: {
                "star": [ "basketball", "a basketball", "basketballs" ],
                "circle": [ "soccer ball", "a soccer ball", "soccer balls" ],
                "triangle": [ "football", "a football", "footballs" ],
                "square": [ "tennis ball", "a tennis ball", "tennis balls" ],
            },
            nameReplacements: [
                [ "trianglify", "footballify" ],
                [ "starify", "basketballify" ],
                [ "squarify", "tennisify" ],
                [ "makeStar", "makeBasketball" ],
                [ "star", "basketball" ],
                [ "rect", "tennisball" ],
                [ "triangle", "football" ],
            ],
            projection: {
                type: "case",
                on: "name",
                cases: {
                    star: {
                        type: "sprite",
                        image: "sport_1",
                        size: { w: 50 },
                    },
                    circle: {
                        type: "sprite",
                        image: "sport_2",
                        size: { w: 50 },
                    },
                    triangle: {
                        type: "sprite",
                        image: "sport_3",
                        size: { w: 50 },
                    },
                    rect: {
                        type: "sprite",
                        image: "sport_4",
                        size: { w: 50 },
                    },
                },
            },
        },
    ],

    bool: {
        kind: "value",
        type: "boolean",
        fields: ["value"],
        subexpressions: [],
        projection: {
            type: "default",
            shape: "<>",
            color: "hotpink",
            fields: ["value"],
            padding: {
                left: 25,
                right: 25,
                inner: 10,
                top: 0,
                bottom: 0,
            },
        },
    },
};
