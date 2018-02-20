import * as esprima from "esprima";

function modifier(ast) {
    if (ast.body.length !== 2) return null;
    if (ast.body[0].type !== "ExpressionStatement") return null;
    if (ast.body[0].expression.type !== "Identifier") return null;
    return [ ast.body[0].expression.name, ast.body[1] ];
}

export function makeParser(jssemant) {
    return function parseES6(program, macros) {
        const ast = esprima.parse(program);

        const mod = modifier(ast);

        if (ast.body.length === 1) {
            const result = parseNode(ast.body[0], macros);
            if (result === null) {
                return fail(`Cannot parse program.`, program);
            }
            if (result.type === "define") {
                return [ result, jssemant.defineAttach() ];
            }
            return result;
        }
        else if (mod !== null) {
            const [ modName, node ] = mod;
            const result = parseNode(node, macros);
            if (result === null) {
                return fail("Cannot parse node.", program);
            }

            if (modName === "__unlimited") {
                result.__meta = new jssemant.meta.Meta({
                    toolbox: jssemant.meta.ToolboxMeta({
                        unlimited: true,
                    }),
                });
            }
            else if (modName === "__targetable") {
                result.__meta = new jssemant.meta.Meta({
                    toolbox: jssemant.meta.ToolboxMeta({
                        targetable: true,
                    }),
                });
            }
            else {
                return fail(`Unrecognized expression modifier ${modName}`, program);
            }

            return result;
        }
        else {
            return fail(`Cannot parse multi-statement programs at the moment.`, program);
        }
    };

    function parseNode(node, macros) {
        switch (node.type) {
        case "ExpressionStatement":
            return parseNode(node.expression, macros);

        case "ReturnStatement":
            return parseNode(node.argument, macros);

        case "BlockStatement": {
            if (node.body.length !== 1) {
                return fail("Cannot parse multi-statement programs.", node);
            }
            return parseNode(node.body[0], macros);
        }

        case "Identifier": {
            if (node.name === "_") return jssemant.missing();

            // Each macro is a thunk
            if (macros && macros[node.name]) return macros[node.name]();

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
                // Implement capture of bindings
                const argName = node.params[0].name;
                const newMacros = {};
                newMacros[argName] = () => jssemant.lambdaVar(argName);
                const body = parseNode(node.body, Object.assign(macros, newMacros));
                return jssemant.lambda(jssemant.lambdaArg(argName), body);
            }
            return fail("Lambda expessions with more than one input are currently undefined.", node);
        }

        case "BinaryExpression":
            // TODO: need ExprManager
            return jssemant.binop(parseNode(node.left, macros),
                                  jssemant.op(node.operator),
                                  parseNode(node.right, macros));

        case "CallExpression": {
            if (node.callee.type === "Identifier" && node.callee.name === "__tests") {
                const testCases = node.arguments.map(arg => parseNode(arg, macros));
                // TODO: better way to figure out name
                const name = node.arguments[0].type === "CallExpression" ? node.arguments[0].callee.name : "f";
                return jssemant.lambda(jssemant.lambdaArg(name, true), jssemant.vtuple(testCases));
            }

            if (node.arguments.length === 0) {
                return fail("Call expressions with zero arguments are currently unsupported", node);
            }

            let result = jssemant.apply(
                parseNode(node.callee, macros),
                parseNode(node.arguments[0], macros)
            );

            for (const arg of node.arguments.slice(1)) {
                result = jssemant.apply(result, parseNode(arg, macros));
            }

            return result;
        }

        case "ConditionalExpression": {
            return jssemant.conditional(
                parseNode(node.test, macros),
                parseNode(node.consequent, macros),
                parseNode(node.alternate, macros)
            );
        }

        case "FunctionDeclaration": {
            const name = node.id.name;
            if (node.params.length === 0) {
                return jssemant.define(name, parseNode(node.body, macros));
            }

            let result = parseNode(node.body, macros);
            for (const arg of node.params.reverse()) {
                result = jssemant.lambda(jssemant.lambdaArg(arg.name), result);
            }
            return jssemant.define(name, result);
        }

        case "VariableDeclaration": {
            if (node.kind !== "let") {
                return fail(`parsers.es6: Unrecognized '${node.kind}' declaration`, node);
            }
            else if (node.declarations.length !== 1) {
                return fail("parsers.es6: Only declaring 1 item at a time is supported", node);
            }

            const name = node.declarations[0].id.name;
            const body = parseNode(node.declarations[0].init, macros);

            return jssemant.define(name, body);
        }

        default: return fail(`parsers.es6: Unrecognized ES6 node type ${node.type}`, node);
        }
    }
}

export function makeUnparser(jssemant) {
    const unparseES6 = function unparseES6(node) {
        switch (node.type) {
        case "missing": {
            return "_";
        }
        case "symbol": {
            return `"${node.name}"`;
        }
        case "lambda": {
            return `(${unparseES6(node.arg)}) => ${unparseES6(node.body)}`;
        }
        case "lambdaArg":
        case "lambdaVar": {
            return `${node.name}`;
        }
        default:
            console.log(`unparsers.es6: Unrecognized ES6 node type ${node.type}`, node);
            return null;
        }
    };
    return unparseES6;
}

function fail(message, node) {
    console.warn(message, node);
    throw { message: message, node: node };
}
