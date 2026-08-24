# Architecture

## Runtime shape

The project is a client-side Vite application with no server or persistent storage.

```text
src/config.js ─────────┐
src/random.js ─────────┼──> src/simulation.js ──> state snapshots
src/citizen-policy.ts ─┘              │
                                      v
                               src/main.js
                                 │     │
                                 v     v
                            DOM details  Canvas town
                                 │
                                 v
                           src/styles.css
```

## Modules

### `src/config.js`

Owns fixed data and policy defaults: names, products, firms, supply contracts, phase labels, wages, prices, productivity, inventory, per-worker transaction capacity, staffing, and default policy settings.

Use this module for starting parameters, not evolving state.

### `src/random.js`

Creates an isolated seeded pseudorandom generator. Simulation code must use `this.random`; using `Math.random()` would break deterministic replay.

### `src/simulation.js`

Owns all domain state and causal rules. `TownSimulation` can run without a browser. Important public seams are:

- constructor and `reset(seed)`
- `setPolicy(name, value)`
- `step()`
- `snapshot()`
- `transfer()` and `assertInvariants()`
- phase methods for focused tests
- `stressPressure()`, `updateStress()`, and `assessNeeds()`

The class currently combines initialization, accounting, decision rules, phase orchestration, and firm settlement. This is acceptable at the current size but is the main future decomposition candidate.

### `src/citizen-policy.ts`

Defines the typed, injectable citizen-policy boundary. The simulation owns observations, legal actions, validation, and consequences; a policy only chooses among the legal actions and explains that choice. `RuleCitizenPolicy` preserves the seeded job-offer heuristic. `MotivationCitizenPolicy` delegates job offers to that rule and scores food, housing, and personal-time actions from stable seed-derived citizen weights plus current needs and constraints. Tests inject alternative policies to protect substitutability. Later motivation or neural policies should extend this boundary one decision domain at a time rather than bypassing `TownSimulation`.

### `src/firm-presentation.js`

Converts product, pipeline, and supply-contract state into display strings. It contains no economic decisions and is covered by focused Node tests.

### `src/map-presentation.js`

Owns deterministic canvas presentation geometry: full-name firm landmark bounds, employee orbit targets that clear workplace plaques, the deceased cross-and-base marker, and browser-safe light/dark canvas color resolution. These helpers keep display-only layout testable without moving economic decisions out of the simulation.

### `src/main.js`

Creates the interface, binds controls, advances the simulation on a timer, converts state into human-readable details, renders firm pipeline and activity panels, and draws firms, people, treasury, and recent money flows on canvas.

The UI should not decide economic outcomes. It may format or animate state but should call the simulation for changes.

### `src/styles.css`

Provides responsive light/dark presentation. At narrow widths metrics stack, needs and policy controls reduce columns, and the canvas legend is hidden.

### `test/simulation.test.js`

Uses Node’s built-in test runner. Tests directly exercise the simulation without Vite or a browser.

## State ownership

`TownSimulation` owns people, firms, treasury, policy, time, and recent transfer flows. The browser owns selected-person state, playback timing, pause state, speed, and canvas dimensions.

Person `x` and `y` positions are currently mutated by the renderer even though they live on simulation entities. The renderer derives workplace, job-application, Common Park, and cemetery destinations from domain state, but those positions are display-only and must never influence domain decisions. Moving them into a view model would strengthen the boundary.

## Adding a rule

1. State the intended causal behaviour in `docs/model.md`.
2. Decide whether it changes the economic boundary or a non-negotiable invariant.
3. Add the smallest state needed to the relevant entity.
4. Implement it in the appropriate phase or a named helper.
5. Record surprising outcomes as structured ledger or event entries.
6. Add a seeded regression test.
7. Update limitations and policy documentation.

## Likely future decomposition

When `simulation.js` becomes difficult to navigate, split by stable responsibility rather than by arbitrary file length:

- `domain/accounting.js`: transfers, money representation, ledgers, invariants
- `domain/people.js`: stress, health, needs, and individual decisions
- `domain/firms.js`: production, payroll, staffing, closure, and ownership
- `domain/social.js`: friendships, encounters, support, and relationship decay
- `simulation/phases.js`: day orchestration
- `simulation/state.js`: initialization and serialization

Keep the main `TownSimulation` API as a façade so tests and UI do not churn during decomposition.
