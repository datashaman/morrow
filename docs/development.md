# Development guide

## Requirements

- Node.js 20.19 or newer, or 22.12 or newer, as required by the installed Vite version
- npm

## Install and run

```sh
npm install
npm run dev
```

Open the local HTTP address printed by Vite. Do not open `index.html` directly with a `file://` URL; browser module security rules may prevent the application from loading correctly.

## Commands

```sh
npm test          # deterministic domain tests
npm run typecheck # check TypeScript policy modules
npm run build     # typecheck and create the production bundle
npm run evaluate  # compare rule and motivation policies across fixed seeds
npm run preview   # serve the production bundle locally
```

## Verification before handoff

Run both:

```sh
npm test
npm run build
```

The current baseline is 101 passing tests and a successful typed Vite build.

For a custom headless comparison:

```sh
npm run evaluate -- --seeds 11,22,33 --days 120
npm run --silent evaluate -- --seeds 11,22,33 --days 120 --json
```

See [policy evaluation](./policy-evaluation.md) for metrics, policy registration, and interpretation limits.

## Testing strategy

Tests use Node’s built-in `node:test` API through `tsx`, allowing the existing JavaScript simulation and incremental TypeScript policy modules to run in one suite. Tests import `TownSimulation` directly.

Current coverage protects:

- closed-economy money conservation over 600 phase steps
- rejection of unaffordable exact transfers
- Sizwe’s specific inability to pay the full rehousing cost with 0.5 cash
- before/after ledger balances for a funded rehousing payment
- one-time eviction events with no arrears while unhoused
- weekly rent cadence, stable housing demand between bills, and wage-to-essential-cost coverage
- lower stress pressure under secure conditions
- critical-health death, terminal inactivity, population counts, and conserved intestate estate transfers
- attending-worker transaction limits and turned-away demand
- economically supported vacancies, constrained expansion, and eventual hiring
- agricultural production, cash-settled supply contracts, input costs, insolvency, and conserved one-time vital-business rescue
- runway-based owner wage waivers and retained-surplus dividend decisions
- owner equity contributions, voluntary insolvency, and constrained emergency distributions
- deterministic reproduction from a seed
- deterministic multi-seed policy comparison, machine-readable reports, and hard failure detection

For a random or emergent bug, preserve the seed and reduce the reproduction to the smallest phase or helper possible. Prefer assertions on causal state and ledger entries over screenshots.

## Debugging surprising transactions

1. Select the person and note the transaction day, amount, purpose, and before/after balance.
2. Reproduce with the same seed and unchanged policy sequence.
3. Identify the phase that owns the payment.
4. Check whether it uses an exact transfer.
5. Check total-money and non-negative-balance invariants.
6. Add a regression test before changing the rule.

## Repository hygiene

- The repository has an initial commit and lives at `/Users/marlinf/Projects/datashaman/morrow`.
- `work/` contains historical exported previews. It is ignored and should not be deleted unless the user requests it.
- `dist/` and `node_modules/` are generated and ignored.
- The lockfile is tracked to keep the toolchain reproducible.

## Documentation expectations

When changing behaviour:

- update `docs/model.md` for the actual rule
- update `docs/product-intent.md` if scope or principles change
- update `docs/known-limitations.md` when resolving or introducing a simplification
- add a decision record when changing the economic boundary, core invariants, or interpretation of the model
- update `AGENTS.md` only for durable agent workflow instructions
