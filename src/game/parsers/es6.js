import * as esprima from "esprima";
import jssemant from "../../semantics/es6";

export function parse(program, macros) {
    const ast = esprima.parse(program);

    if (ast.body.length === 1) {
        const result = parseNode(ast.body[0], macros);
        if (result === null) {
            return fail(`Cannot parse program.`, program);
        }
        return result;
    }
    else {
        return fail(`Cannot parse multi-statement programs at the moment.`, program);
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

        // Each macro is a thunk
        if (macros && macros[node.name]) return macros[node.name]();
        if (node.name === "star" ||
            node.name === "circle" ||
            node.name === "triangle" ||
            node.name === "rect") {
            return jssemant.symbol(node.name);
        }

        if (node.name === "xx") {
            return jssemant.vtuple([ jssemant.lambdaVar("x"), jssemant.lambdaVar("x") ]);
        }
        else if (node.name === "xxx") {
            return jssemant.vtuple([
                jssemant.lambdaVar("x"),
                jssemant.lambdaVar("x"),
                jssemant.lambdaVar("x"),
            ]);
        }
        else if (node.name.slice(0, 9) === "__variant") {
            const [ variant, value ] = node.name.slice(10).split("_");
            if (!variant || !value) {
                throw `Invalid dynamic variant ${node.name}`;
            }

            return jssemant.dynamicVariant(variant, value);
        }

        return jssemant.lambdaVar(node.name);
    }

    case "Literal": {
        if (typeof node.value === "number") return jssemant.number(node.value);
        if (typeof node.value === "boolean") return jssemant.bool(node.value);

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
            let body = parseNode(node.body, macros);
            return jssemant.lambda(jssemant.lambdaArg(node.params[0].name), body);
        }
        else {
            return fail("Lambda expessions with more than one input are currently undefined.", node);
        }
    }

    case "BinaryExpression":
        // TODO: need ExprManager
        return jssemant.binop(parseNode(node.left, macros),
                              jssemant.op(node.operator),
                              parseNode(node.right, macros));

    case "CallExpression": {
        if (node.arguments.length !== 1) {
            return fail("Call expressions with zero or more than one argument are currently unsupported", node);
        }

        return jssemant.apply(parseNode(node.callee, macros),
                              parseNode(node.arguments[0], macros));
    }

    case "ConditionalExpression": {
        return jssemant.conditional(
            parseNode(node.test, macros),
            parseNode(node.consequent, macros),
            parseNode(node.alternate, macros)
        );
    }

    default: return fail(`parsers.es6: Unrecognized ES6 node type ${node.type}`, node);
    }
}
