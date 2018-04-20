/**
 * Projectors transform a JSON-ish view specification into a gfx view.
 */
import * as gfx from "./core";
import Loader from "../loader";

const optionFields = [
    "color", "strokeWhenChild", "shadowOffset", "radius", "padding",
    "notches", "subexpScale", "shadow", "shadowColor", "horizontalAlign",
    "stroke", "highlightColor", "ellipsize",
];

function shapeToProjection(shape, options) {
    let baseProjection = gfx.roundedRect;
    if (shape === "<>") {
        baseProjection = gfx.hexaRect;
    }
    else if (shape === "none") {
        baseProjection = gfx.baseProjection;
    }
    else if (shape === "notch") {
        baseProjection = gfx.notchProjection;
    }

    return baseProjection;
}

/**
 * The default projector lays out children in a horizontal box with a
 * rounded or hexagonal background.
 */
function defaultProjector(definition) {
    const options = {};
    const baseProjection = shapeToProjection(definition.projection.shape, options);

    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }

    return function defaultProjectorFactory(stage, nodes, expr) {
        let childrenFunc = (id, state) =>
            definition.subexpressions.map(field => state.getIn([ "nodes", id, field ]));

        if (definition.projection.fields) {
            const fields = [];
            for (const field of definition.projection.fields) {
                if (typeof field === "object") {
                    // TODO: more extensible
                    const textOptions = {};
                    if (field.color) textOptions.color = field.color;

                    if (field.field) {
                        fields.push(stage.allocate(gfx.text(expr.get(field.field), textOptions)));
                    }
                    else if (field.text) {
                        fields.push(stage.allocate(gfx.text(field.text, textOptions)));
                    }
                    else {
                        throw `Cannot parse field specification: ${JSON.stringify(field)}`;
                    }
                }
                else {
                    const match = field.match(/'(.+)'/);
                    if (match) {
                        fields.push(stage.allocate(gfx.text(match[1])));
                    }
                    else if (definition.fields.indexOf(field) > -1) {
                        fields.push(stage.allocate(gfx.text(expr.get(field))));
                    }
                    else {
                        fields.push(field);
                    }
                }
            }
            childrenFunc = (id, state) => fields.map((field) => {
                if (typeof field === "number") return field;
                return state.getIn([ "nodes", id, field ]);
            });
        }

        return gfx.layout.hbox(childrenFunc, options, baseProjection);
    };
}

function textProjector(definition) {
    const options = {};

    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }

    return function textProjectorFactory(stage, nodes, expr) {
        const textDefn = definition.projection.text;
        const text = typeof textDefn === "function" ? textDefn : textDefn.replace(
            /\{([a-zA-Z0-9]+)\}/,
            (match, field) => expr.get(field)
        );
        return gfx.text(text, options);
    };
}

function casesProjector(definition) {
    const cases = {};
    for (const [ caseName, defn ] of Object.entries(definition.projection.cases)) {
        cases[caseName] = projector(Object.assign({}, definition, {
            projection: defn,
        }));
    }
    return function casesProjectorFactory(stage, nodes, expr) {
        // TODO: better error handling if not found
        let key = expr.get(definition.projection.on);
        if (definition.projection.key) {
            key = definition.projection.key(nodes, expr);
        }
        if (typeof cases[key] === "undefined") {
            throw `Unrecognized case ${key} for projection of ${definition}`;
        }
        return cases[key](stage, expr);
    };
}

function symbolProjector(definition) {
    switch (definition.projection.symbol) {
    case "star":
        return () => gfx.shapes.star();
    case "rect":
        return () => gfx.shapes.rectangle();
    case "circle":
        return () => gfx.shapes.circle();
    case "triangle":
        return () => gfx.shapes.triangle();
    default:
        throw `Undefined symbol type ${definition.symbol}.`;
    }
}

function dynamicProjector(definition) {
    const fieldName = definition.projection.field || "ty";
    const cases = {};
    cases["__default__"] = projector(Object.assign({}, definition, {
        projection: definition.projection.default,
    }));
    for (const [ caseName, defn ] of Object.entries(definition.projection.cases)) {
        cases[caseName] = projector(Object.assign({}, definition, {
            projection: defn,
        }));
    }
    return function dynamicProjectorFactory(stage, nodes, expr) {
        const projections = {};
        for (const [ key, subprojector ] of Object.entries(cases)) {
            projections[key] = subprojector(stage, nodes, expr);
        }
        return gfx.dynamic(projections, fieldName, definition.projection.resetFields);
    };
}

function dynamicPropertyProjector(definition) {
    const fieldName = definition.projection.field || "ty";
    definition.projection.projection.notches = definition.projection.notches;
    const subprojector = projector(Object.assign({}, definition, {
        projection: definition.projection.projection,
    }));
    return function dynamicPropertyProjectorFactory(stage, nodes, expr) {
        const subprojection = subprojector(stage, nodes, expr);
        return gfx.dynamicProperty(subprojection, fieldName, definition.projection.fields);
    };
}

function hboxProjector(definition) {
    const options = {};
    const subprojectors = [];
    const baseProjection = shapeToProjection(definition.projection.shape, options);

    for (const subprojection of definition.projection.children) {
        subprojectors.push(projector(Object.assign({}, definition, {
            projection: subprojection,
        })));
    }

    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }

    return function hboxProjectorFactory(stage, nodes, expr) {
        const subprojections = [];
        for (const subproj of subprojectors) {
            subprojections.push(stage.allocate(subproj(stage, nodes, expr)));
        }
        const childrenFunc = (id, _state) => subprojections.map(projId => [ projId, id ]);
        return gfx.layout.hbox(childrenFunc, options, baseProjection);
    };
}

function vboxProjector(definition) {
    const options = {};
    const subprojectors = [];
    for (const subprojection of definition.projection.rows) {
        subprojectors.push(projector(Object.assign({}, definition, {
            projection: subprojection,
        })));
    }

    for (const field of optionFields) {
        if (typeof definition.projection[field] !== "undefined") {
            options[field] = definition.projection[field];
        }
    }

    return function vboxProjectorFactory(stage, nodes, expr) {
        const subprojections = [];
        for (const subproj of subprojectors) {
            subprojections.push(stage.allocate(subproj(stage, nodes, expr)));
        }
        const childrenFunc = (id, _state) => subprojections.map(projId => [ projId, id ]);
        return gfx.layout.vbox(childrenFunc, options);
    };
}

function stickyProjector(definition) {
    for (const field in definition.projection) {
        if (field !== "type" && field !== "content" && field !== "side") {
            definition.projection.content[field] = definition.projection[field];
        }
    }
    const subprojector = projector(Object.assign({}, definition, {
        projection: definition.projection.content,
    }));

    return function stickyProjectorFactory(stage, nodes, expr) {
        const inner = subprojector(stage, nodes, expr);
        return gfx.layout.sticky(inner, definition.projection.side);
    };
}

// TODO: generalize all these projectors?
function decalProjector(definition) {
    const subprojector = projector(Object.assign({}, definition, {
        projection: definition.projection.content,
    }));

    return function decalProjectorFactory(stage, nodes, expr) {
        const inner = subprojector(stage, nodes, expr);
        return gfx.decal(inner);
    };
}

function previewProjector(definition) {
    const subprojector = projector(Object.assign({}, definition, {
        projection: definition.projection.content,
    }));

    return function previewProjectorFactory(stage, nodes, expr) {
        const inner = subprojector(stage, nodes, expr);
        return gfx.layout.previewer(inner);
    };
}

function genericProjector(definition) {
    return function genericProjectorFactory(stage, nodes, expr) {
        const path = definition.projection.view.slice();
        let view = gfx;
        while (path.length > 0) {
            view = view[path.shift()];
        }
        return view(definition.projection.options);
    };
}

function spriteProjector(definition) {
    return function spriteProjectorFactory(stage, nodes, expr) {
        const image = Loader.images[definition.projection.image];
        let w = image.naturalWidth;
        let h = image.naturalHeight;

        if (definition.projection.scale) {
            w *= definition.projection.scale;
            h *= definition.projection.scale;
        }
        else if (definition.projection.size) {
            w = definition.projection.size.w;
            h = definition.projection.size.h;
            if (typeof h === "undefined") {
                h = (image.naturalHeight / image.naturalWidth) * w;
            }
            else if (typeof w === "undefined") {
                w = (image.naturalWidth / image.naturalHeight) * h;
            }
        }

        const size = { w, h };

        return gfx.sprite({
            image,
            size,
        });
    };
}

export default function projector(definition) {
    switch (definition.projection.type) {
    case "default":
        return defaultProjector(definition);
    case "case":
    case "cases":
        return casesProjector(definition);
    case "text":
        return textProjector(definition);
    case "symbol":
        return symbolProjector(definition);
    case "dynamic":
        return dynamicProjector(definition);
    case "dynamicProperty":
        return dynamicPropertyProjector(definition);
    case "hbox":
        return hboxProjector(definition);
    case "vbox":
        return vboxProjector(definition);
    case "sticky":
        return stickyProjector(definition);
    case "decal":
        return decalProjector(definition);
    case "preview":
        return previewProjector(definition);
    case "generic":
        return genericProjector(definition);
    case "sprite":
        return spriteProjector(definition);
    default:
        throw `Unrecognized projection type ${definition.type}`;
    }
}
