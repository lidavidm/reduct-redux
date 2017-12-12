import * as esprima from "esprima";
import * as jssemant from "../../semantics/default";

export function parse(program, macros) {
    const ast = esprima.parse(program);

    if (ast.body.length === 1) {
        return parseNode(ast.body[0], macros);
    }
    else {
        return null;
    }
}

function fail(message, node) {
    console.warn(message, node);
    throw { message: message, node: node };
}

function parseNode(node, macros) {
    switch (node.type) {
    case "ExpressionStatement":
        return parseNode(node.expression, macros);
    case "Identifier": {
        if (node.name === "_") return jssemant.missing();

        if (macros && macros[node.name]) return macros[node.name];

        return jssemant.lambdaVar(node.name);
    }
    case "Literal": {
        if (typeof node.value === "number") return jssemant.number(node.value);

        if (node.value === "star" ||
            node.value === "circle" ||
            node.value === "triangle" ||
            node.value === "rect") {
            return jssemant.symbol(node.value);
        }

        return fail(`parsers.es6: Unrecognized value ${node.value}`, node);
    }
    case "ArrowFunctionExpression": {
        if (node.params.length === 1 && node.params[0].type === "Identifier") {
            let body = parseNode(node.body);
            return jssemant.lambda(jssemant.lambdaArg(node.params[0].name), body);
        }
        else {
            return fail("Lambda expessions with more than one input are currently undefined.", node);
        }
    }

    case "BinaryExpression":
        // TODO: need ExprManager
        return jssemant.add(parseNode(node.left, macros), parseNode(node.right, macros));
    default: return fail(`parsers.es6: Unrecognized ES6 node type ${node.type}`, node);
    }
}
