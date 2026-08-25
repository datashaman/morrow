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

Defines the typed, injectable citizen-policy boundary. The simulation owns observations, legal actions, validation, and consequences; a policy only chooses among legal actions and explains that choice. `RuleCitizenPolicy` is the complete deterministic `rule-v2` evaluation baseline. `MotivationCitizenPolicy` scores attendance, job search and offers, food, housing, personal time, and owner decisions from stable seed-derived weights plus current needs and constraints. Tests inject alternative policies to protect substitutability.

### `src/neural-policy.ts`

Defines versioned observation/action schemas, shared-weight loading, local MLP inference, legal-action masking, `ShadowCitizenPolicy`, and the passed-gate wrapper that can control personal time only. The simulation still owns legal-action generation, validation, and consequences. There is no per-citizen network, runtime Python, or raw citizen-ID input.

### `src/neural-runtime.ts` and `src/neural-activation-evaluation.ts`

The runtime module loads the bundled Python-trained artifact, binds it to the checked activation certificate, and constructs the default switchable policy. The evaluator runs motivation and personal-time neural candidates across fresh held-out towns twice, requiring zero failures, illegal applied actions, or cash differences; identical replay; personal-time-only control; and explicit bounded aggregate deltas. `scripts/evaluate-neural-activation.ts` is the reproducible command-line adapter.

### `src/personalization-research.ts` and `src/personalization-evaluation.ts`

Define headless-only profile, four-value learned-embedding, and four-value bounded-adaptation variants plus diversity, replay, sample-cost, state, and interpretability comparisons. The adaptation prototype supports versioned serialization, reset, and per-update audit without bypassing legal actions. These modules support ADR 0002 and are not imported by the browser runtime. `scripts/evaluate-personalization.ts` reproduces the report.

### `src/policy-evaluation.ts`

Runs fresh headless towns across configurable seeds, days, and policy factories. It collects outcomes, active, controlled, and shadow action distributions, controller and weight metadata, neural divergence, invalid pre-mask preferences, directional shadow projections, checks invariants and finite state, aggregates results, and computes candidate deltas from a named deterministic baseline. `scripts/evaluate-policies.ts` is the human/JSON command-line adapter.

### `src/development-sensitivity.ts`

Runs the minimal foundation across fixed seeds and named policy scenarios without mutating domain rules. It records formation, founders, replacements, stage transitions, outcomes, failures, cash conservation, and degenerate-run flags. `scripts/evaluate-development.ts` provides text and JSON output.

### `src/trajectory-export.ts`

Converts complete synthetic decision traces into a deterministic, versioned observation/action/reward dataset without names, histories, external data, or new legal actions. `scripts/export-trajectories.ts` is the JSON command-line adapter. The optional standard-library `scripts/train_shared_policy.py` validates this dataset, trains the same pair-MLP shape, and exports a versioned artifact. TypeScript validates artifact schemas, action order, shapes, finite values, and golden vectors before weights can be constructed.

### `src/firm-presentation.js`

Converts product, pipeline, and supply-contract state into display strings. It contains no economic decisions and is covered by focused Node tests.

### `src/firm-opportunity-presentation.js`

Formats domain-owned formation evidence and blockers for the firm panel. It does not calculate demand, choose a founder, create a firm, or move cash.

### `src/town-stage.js`

Projects current people, firms, policy, day, and essential cost into a deterministic descriptive stage and its evidence. It is read by `snapshot()` for presentation only and is intentionally absent from opportunity and consequence code.

### `src/map-presentation.js`

Owns deterministic canvas presentation geometry: full-name firm landmark bounds, employee orbit targets that clear workplace plaques, the deceased cross-and-base marker, and browser-safe light/dark canvas color resolution. These helpers keep display-only layout testable without moving economic decisions out of the simulation.

### `src/main.js`

Creates the interface, binds controls, advances the simulation on a timer, converts state into human-readable details, renders firm pipeline and activity panels, and draws firms, people, treasury, and recent money flows on canvas.

The UI should not decide economic outcomes. It may format or animate state but should call the simulation for changes.

### `src/styles.css`

Provides responsive light/dark presentation. At narrow widths metrics stack, needs and policy controls reduce columns, and the canvas legend is hidden.

### `src/knowledge-evaluation.ts`

Runs paired seeded towns with knowledge disabled and enabled, then reports auditable learning, gross and floored everyday-grocer capacity, completed transactions, town outcomes, and cash conservation. `scripts/evaluate-knowledge.ts` is the command-line adapter. This evaluator observes the domain model and does not introduce alternative simulation rules.

### `test/simulation.test.js`

Uses Node’s built-in test runner. Tests directly exercise the simulation without Vite or a browser.

## State ownership

`TownSimulation` owns people, their versioned knowledge and complete learning histories, configured archetypes, runtime firm instances, each firm's knowledge-capacity carry and daily slots, opportunity observations, contracts, treasury, policy, time, and recent transfer flows. The browser owns selected-person state, selected-firm identity, playback timing, pause state, speed, and canvas dimensions; it renders the selected citizen's knowledge profile and scrollable learning stream plus the firm's already-derived capacity state without deriving learning outcomes. Runtime firms and contracts may be appended but are never removed, so their numeric IDs remain valid references and their unique `archetypeId:instanceNumber` identities preserve lifecycle history. Historical instances remain inspectable in the firm grid; the canvas suppresses an inactive historical landmark when an active replacement of the same archetype occupies that location.

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
