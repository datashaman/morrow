# Employment intervention evaluation

The paired evaluator compares the same seeded town with the employment intervention disabled and enabled:

```sh
npm run evaluate:employment
npm run evaluate:employment -- --seeds 20260823,101 --days 60
npm run evaluate:employment -- --json
```

Both arms use the interactive five-firm foundation, all seven latent private archetypes, finite housing, paid haulage, the same policy, and the same citizen controller. The control retains income-supported hiring plus the legacy seven-day formation window and ten-day founder reserve. The treatment adds attributable investment hiring and uses two viable days in a complete latest-three formation window with a six-day founder reserve.

For every completed day the report records living population, workforce adults, adult employment and unemployment, vacancies, distinct funded investment slots, mature slots, all funded employment opportunities, applications, offers, hires, layoffs, wage and support totals, hunger, housing and health events, and deaths. Dependents are not counted as unemployed. A funded employment opportunity is either an actual founder-capital-backed formation job or an investment slot that survived its two-day evidence period; starting jobs are not counted. Each arm also retains firm formations and closures, stable slot evidence, first positive payroll wages received by the initially unemployed cohort, and cash-conservation results. An extinct arm stops early rather than fabricating observations through day 60.

The concise report checks the fixed day-30 first-wage baseline, the reproducible completed-day-60 mortality baseline, treatment-funded jobs by day 7, treatment first wages by day 30, and bounded paired mortality. The six-seed treatment must create at least one funded job in every seed and at least two per seed in aggregate by day 7. By day 30 the median initially unemployed first-wage count must reach four, at least five seeds must reach three, and at least five must improve on control. By day 60 treatment deaths must be at most 91% of control deaths in aggregate, at least four seeds must improve, and no seed may regress by more than two deaths. These thresholds are gameplay acceptance hypotheses; the distribution rules prevent one exceptional seed from hiding a broadly inactive or harmful mechanism. JSON contains the complete trajectories and each individual gate result.

After the per-portion advance-food expiry rule, the checked disabled-control fixture is:

- initially unemployed citizens receiving a positive wage by day 30: `1, 1, 1, 1, 1, 0`;
- deaths by day 60 or earlier extinction: `40, 40, 22, 25, 22, 22`.

The funded-opportunity gate still passes, while the first-wage and mortality gates fail. The fixture and schema changed only after the FIFO expiry rule and adult-workforce accounting gained deterministic regression coverage; no acceptance threshold was weakened.

This harness can disprove a proposed gameplay outcome for the fixed seeds. Passing would not calibrate the rules, establish a real causal relationship between employment and mortality, or show that a policy is safe, fair, or generalizable.
