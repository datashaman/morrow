# Agent guide

Start with [CONTEXT.md](./CONTEXT.md), then use [docs/README.md](./docs/README.md) to find the relevant detail.

## Before changing simulation behaviour

1. Read [docs/product-intent.md](./docs/product-intent.md).
2. Read the applicable rule in [docs/model.md](./docs/model.md).
3. Check [docs/known-limitations.md](./docs/known-limitations.md) so an acknowledged simplification is not mistaken for an accidental design.
4. Add or update a deterministic regression test.
5. Run `npm test` and `npm run build`.

## Non-negotiable invariants

- Cash is conserved within people, firms, and the treasury unless an explicit future design decision changes the boundary of the economy.
- An exact purchase cannot overdraw the buyer or create a partial essential purchase.
- Individual outcomes must be traceable to transactions and life events.
- Random behaviour must remain reproducible from a seed.
- Firms are distinct economic actors. People do not create income without a paying counterparty.
- Consequences such as hunger, declining health, arrears, eviction, unemployment, business failure, and death must remain possible.

## Working conventions

- Keep domain rules in `src/simulation.js`; do not hide economic decisions in the UI.
- Put fixed starting values in `src/config.js`.
- Keep rendering and browser interaction in `src/main.js` and `src/styles.css`.
- Represent money to cents internally and show before/after balances for individual transactions.
- Treat numerical weights as hypotheses. Document and test changes; do not present them as empirically calibrated facts.
- Preserve existing user work in `work/`; it contains historical previews and is intentionally ignored by Git.

## Current repository state

The confirmed product name is “Provision.” The repository currently lives at `/Users/marlinf/Projects/datashaman/morrow` and has an initial commit.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `datashaman/morrow`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Provision is a single-context repository. See `docs/agents/domain.md`.
