# Employment intervention evaluation

The paired evaluator compares the same seeded town with the employment intervention disabled and enabled:

```sh
npm run evaluate:employment
npm run evaluate:employment -- --seeds 20260823,101 --days 60
npm run evaluate:employment -- --json
```

Both arms use the interactive five-firm foundation, all seven latent private archetypes, finite housing, paid haulage, the same policy, and the same citizen controller. The control retains income-supported hiring plus the legacy seven-day formation window and ten-day founder reserve. The treatment adds attributable investment hiring and uses two viable days in a complete latest-three formation window with a six-day founder reserve.

For every completed day the report records living employment and unemployment, vacancies, distinct funded investment slots, mature slots, applications, offers, hires, layoffs, wage and support totals, hunger, housing and health events, and deaths. Each arm also retains firm formations and closures, stable slot evidence, first positive payroll wages received by the initially unemployed cohort, and cash-conservation results.

The concise report checks the fixed day-30 first-wage baseline, the reproducible completed-day-60 mortality baseline, treatment slots mature by day 7, treatment first wages by day 30, and bounded paired mortality. JSON contains the complete trajectories and each individual gate result.

The checked disabled-control fixture is:

- initially unemployed citizens receiving a positive wage by day 30: `1, 2, 1, 1, 1, 1`;
- deaths after 60 completed days: `22, 32, 20, 21, 22, 22`.

The earlier issue brief listed 24 deaths for seed 101. Replay on the pre-intervention parent and the disabled current control both produce 32 after 60 completed days; 24 is the count after 56 completed days. The evaluator labels checkpoints by completed settlement days and does not relabel that earlier checkpoint.

This harness can disprove a proposed gameplay outcome for the fixed seeds. Passing would not calibrate the rules, establish a real causal relationship between employment and mortality, or show that a policy is safe, fair, or generalizable.
