# Type Inference

## Use Cases

- Hinting at errors before player attempts to step code
- Provide more principled implementation of expression holes
    - Reject expressions that do not "fit" without having to manually
      define all the types
- Provide feedback as the player manipulates expressions
- Provide explanations for why code cannot be stepped

## Defining Types for a Language

- Need both principal type and type constraints on holes

Handling errors:

## Internal Implementation

Performance: how expensive is it to recompute types? Can we cache them
somehow? We should only need to recompute types when an expression is
changed.

Top-down pass that annotates each node with a principal type or type
constraint, or an error message if the node cannot be annotated.

```
semant.typeCheck : nodes -> expr -> { id: Set type }
```

`Set type` implies that an expression might have multiple principal
types, in which case we have an error. However, we might want to
support cases where depending on some missing subexpression, the
overal expression has two perfectly valid typing
judgments. Visualizing that would be difficult, though; it's probably
best to fall back on not showing types in that case. How does this
signature let us express typing errors?

```
semant.typeCheck : nodes -> expr -> { id: Set type | Error }
```

In cases where we know the expression cannot be valid, we can annotate
them.
