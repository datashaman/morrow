# Closed Loop Town

An individual-level social and economic simulation. People work for firms, receive wages, buy food and services, pay rent, form relationships, experience stress and health changes, and sometimes become hungry or unhoused. Every cash transfer stays within the town economy.

This is an exploratory thinking tool, not an empirically calibrated forecast. For the project’s purpose and modeling principles, read [CONTEXT.md](./CONTEXT.md). For complete documentation, use [docs/README.md](./docs/README.md).

## Run it

```sh
npm install
npm run dev
```

Then open the local address printed in the terminal.

The app uses browser modules and should be served through Vite; opening `index.html` directly with a `file://` URL may not work.

## Verify it

```sh
npm test
npm run build
```

## Structure

- `src/simulation.js` contains the economy, individual state, Maslow needs, stress, health, labour, housing, and accounting rules.
- `src/config.js` contains people, firms, phases, and policy defaults.
- `src/random.js` provides seeded randomness for reproducible runs.
- `src/main.js` connects the simulation to the interactive interface.
- `src/styles.css` contains the responsive presentation.
- `test/simulation.test.js` protects money conservation, exact-payment rules, ledger balances, stress pressure, and deterministic replay.
- `CONTEXT.md` explains why the project exists and records the conversation-driven design principles.
- `AGENTS.md` is the starting point for another coding agent.
- `docs/` contains the full model, architecture, development workflow, decisions, and known limitations.

## Simulation clock

Each day has six phases:

1. Production
2. Payroll
3. Food shopping
4. Housing and bills
5. Personal time
6. Settlement

Calling `simulation.step()` advances exactly one phase. A full day is six calls.

## Accounting rule

`transfer(from, to, amount, { exact: true })` rejects a payment when the sender cannot cover the full amount. Rent, deposits, food, and goods use exact transfers. Each individual ledger entry records the amount, reason, day, and balance before and after the transaction.
