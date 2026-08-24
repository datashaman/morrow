# Policy evaluation

The headless evaluator compares citizen-policy implementations across the same seeds without opening the browser. It is a regression and plausibility tool, not empirical validation.

## Run it

```sh
npm run evaluate
npm run evaluate -- --seeds 11,22,33 --days 120
npm run --silent evaluate -- --seeds 11,22,33 --days 120 --policies motivation --baseline rule --json
```

Defaults are five fixed seeds, 90 simulated days, `rule` as the baseline, and `motivation` as the candidate. `--seeds` accepts comma-separated integers. `--days` must be a positive integer. `--policies` accepts registered comma-separated policy names. `--json` emits the complete machine-readable report; use npm's `--silent` form shown above to suppress npm's own banner. Without `--json`, the command prints a concise human comparison.

Library callers can pass additional `policyFactories` to `evaluatePolicies()`. A fresh policy instance and town are created for every seed, so mutable policy state cannot leak between runs.

## Report

The versioned report records the simulation version, schema version, baseline, policy names and implementation IDs, seeds, days, and phases per day. Each run includes:

- final living, dead, hungry, unhoused, and employed citizens;
- final inactive/insolvent firms;
- accumulated living, hungry, unhoused, and employed citizen-days;
- rejected job offers and invalid actions;
- initial/final cash, difference, and conservation status;
- a complete chosen-action frequency distribution;
- neural-shadow decision counts, divergence and invalid pre-mask preference rates, and shadow action distributions;
- directional missed-shift, essential-skip, and accepted-offer projections where direct action comparison is meaningful;
- pass/fail status and any failure message.

Aggregates report mean survival, hunger, homelessness, employment, insolvency, rejection, invalid-action, cash-difference, and neural-shadow results. Candidate comparisons are expressed as deltas from the deterministic `rule-v2` baseline. Shadow projections compare immediate action labels only; they are not simulated causal outcomes.

## Hard failures

Every phase still runs the simulation's normal invariants. The evaluator additionally scans domain state for non-finite numbers. An invariant exception, illegal policy action, or non-finite value marks that seed run and the whole report failed. The CLI exits non-zero when any run fails.

Passing means only that the configured runs were reproducible and remained within current technical invariants. It does not mean a policy is safe, realistic, fair, or calibrated. Explicit activation gates for a learned policy belong to a later roadmap slice.
