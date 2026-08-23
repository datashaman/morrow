# Domain docs

Morrow is a single-context repository. Engineering skills should read the following before exploring or changing domain behavior:

- `CONTEXT.md` at the repository root
- relevant accepted decisions under `docs/decisions/`
- the relevant documents linked from `docs/README.md`

If a referenced document does not exist, proceed silently.

## Use the project's vocabulary

When naming a domain concept in an issue, hypothesis, test, or proposal, use the terminology established in `CONTEXT.md` and the simulation documentation. Do not introduce synonyms where the project already has a precise term.

## Flag decision conflicts

If proposed work contradicts an accepted record under `docs/decisions/`, surface the conflict explicitly instead of silently overriding the decision.
