# Schedule evaluation

`npm run evaluate:schedules` runs the same deterministic town seeds through three feature modes for 56 calendar days:

1. `compatibility-calendar-only`: schedules and sleep disabled;
2. `schedules-without-sleep`: firm calendars, rotas, and activity budgets enabled;
3. `schedules-plus-sleep`: schedules plus overnight sleep decisions and debt enabled.

All modes use the minimal essential-sector start, all configured latent firm opportunities, finite housing, haulage, knowledge, and the employment intervention. The evaluator checks simulation invariants after every completed day and rejects any cash-conservation failure. Extinction ends that mode's run rather than fabricating later observations.

## Run it

```sh
npm run evaluate:schedules
npm run evaluate:schedules -- --seeds 11,22,33 --days 84
npm run evaluate:schedules -- --json > schedule-report.json
```

The JSON report includes complete daily alive, employed, hungry, unhoused, mean-health, and mean-sleep-debt trajectories. Final evidence covers:

- closure, capacity, stock, and affordability failures;
- scheduled and attended shifts, wage payments, wages paid, and living employment;
- personal primaries, park visits, rest, self-study, and learning records;
- nights, late study, mean sleep quality, and final sleep debt;
- attributable perishable waste, hunger events, and living hunger;
- survival, deaths, health, housing, formations, firm failures, active firms, and cash.

The report also computes schedules-versus-compatibility and sleep-versus-schedules deltas. It has no directional gameplay gate: a deterministic, conserved but harmful result is evidence to investigate, not a reason to weaken or conceal the comparison.

## Current six-seed evidence

The checked 56-day run on seeds `20260823, 101, 202, 303, 404, 505` completed deterministically. Final living counts for compatibility → schedules → schedules-plus-sleep were:

| Seed | Living | Employed | Hungry | Mean final sleep debt | Perishable waste |
|---:|---:|---:|---:|---:|---:|
| 20260823 | 19 → 15 → 15 | 8 → 5 → 5 | 1 → 15 → 15 | 0.432 | 527.707 → 302.300 → 284.290 |
| 101 | 20 → 18 → 18 | 10 → 7 → 8 | 1 → 17 → 17 | 0.404 | 915.445 → 385.532 → 381.263 |
| 202 | 18 → 16 → 16 | 9 → 5 → 5 | 1 → 16 → 16 | 0.510 | 190.000 → 167.412 → 165.683 |
| 303 | 20 → 18 → 18 | 10 → 6 → 6 | 1 → 17 → 17 | 0.471 | 404.633 → 451.411 → 449.997 |
| 404 | 19 → 0 → 0 | 10 → 0 → 0 | 1 → 0 → 0 | 0.000 | 349.215 → 241.598 → 236.482 |
| 505 | 21 → 16 → 17 | 9 → 6 → 6 | 1 → 15 → 17 | 0.437 | 343.228 → 263.115 → 273.108 |

The schedule modes reduced waste in most seeds, but they also produced substantially broader hunger, lower living employment, and one extinct seed. The capacity migration preserves five scheduled shifts as seven compatibility-day worker contributions, and closure-aware Saturday procurement can request stock through Monday, so the remaining result is not simply a missing `7 / 5` multiplier or a Sunday order ceiling. It is evidence that production, staffing income, physical distribution, pantry demand, and closures still need joint calibration. Sleep adds modest debt and only small outcome deltas in this sample; it does not explain the main schedule regression.

These are causal comparisons within Morrow's configured rules, not empirical findings, forecasts, or evidence about real work schedules, sleep, hunger, or policy.
