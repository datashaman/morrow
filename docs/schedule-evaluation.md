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
| 20260823 | 19 → 19 → 19 | 8 → 9 → 9 | 1 → 4 → 1 | 0.378 | 527.707 → 352.330 → 339.000 |
| 101 | 20 → 19 → 19 | 10 → 9 → 9 | 1 → 0 → 2 | 0.360 | 915.445 → 362.158 → 343.665 |
| 202 | 18 → 17 → 17 | 9 → 9 → 9 | 1 → 0 → 0 | 0.315 | 190.000 → 271.132 → 262.040 |
| 303 | 20 → 19 → 19 | 10 → 10 → 10 | 1 → 0 → 0 | 0.365 | 404.633 → 546.591 → 510.650 |
| 404 | 19 → 18 → 17 | 10 → 10 → 10 | 1 → 0 → 8 | 0.349 | 349.215 → 253.298 → 238.605 |
| 505 | 21 → 19 → 19 | 9 → 10 → 10 | 1 → 1 → 5 | 0.385 | 343.228 → 387.005 → 381.230 |

The earlier schedule regression was traced to three coupled boundaries: maintenance revenue could not sustain Makers Guild under scheduled wages, a one-worker carrier could not move the essential 40-crate order, and income staffing could reduce a six-day firm to a rota that left one opening day uncovered. Schedule mode now uses an 8 maintenance price, a 60-point pre-multiplier freight basis, and a five-shift opening-coverage floor. If all food retail disappears while citizens are hungry, the existing exact-cost public re-entry path may act after one day; a remaining Green Basket also orders toward a population-scaled two-day reserve. Compatibility pricing and freight capacity remain unchanged.

All eighteen current runs complete 56 days without extinction or a cash-conservation failure. Final living population is at least 17 in every mode, and final hunger remains at or below 8 of 17 living citizens. That is a regression boundary for these seeds, not a guarantee of stability: hunger, insolvency, business replacement, sleep debt, and death remain visible, and seed 404 still shows a materially worse sleep-enabled result worth further diagnosis.

These are causal comparisons within Morrow's configured rules, not empirical findings, forecasts, or evidence about real work schedules, sleep, hunger, or policy.
