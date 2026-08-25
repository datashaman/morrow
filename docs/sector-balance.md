# Expanded-sector balance report

Run the paired deterministic comparison with:

```sh
npm run evaluate:sectors
npm run evaluate:sectors -- --seeds 101,202,303 --days 30
npm run evaluate:sectors -- --json
```

Every seed runs twice. The documented baseline uses the four original essential firms, legacy local self-delivery, unlimited operating housing, and only café/premium-food private formation. The expanded run starts Morrow Haulage, enables finite housing, and permits all seven private formation archetypes: café, premium grocer, apothecary, school, materials yard, clinic, and builder. Policy and seed are otherwise identical.

The report records final alive/dead population and extinction; employment, unemployment, vacancies, active and target staffing, wage payments and staffed wages; firm formation, closure, insolvency and replacement; medicine, clinical treatment and recovery events; lessons and living skill; modeled dwelling capacity, housing and hunger; treasury support; and explicit `operating`, `constrained`, `failed`, or `absent` states for the expanded sectors. Baseline dwelling capacity is `null`, not a fictional number, because that configuration does not model a finite stock.

Cash conservation, finite non-negative balances, exact-transfer safety, valid employment and contract references, and reciprocal relationships are asserted after every simulated day. An invariant violation throws and fails the command; it is never averaged away. JSON output retains every paired run and its sector states for later analysis.

## Interpretation boundary

The report treats alive population, employment, hunger, housing, and extinction changes as observations, not pass criteria. A worse expanded outcome is retained in `regressions` with a review note rather than hidden or converted into an automatic tuning change. All thresholds, weights, prices, capacity values, and seeds remain gameplay hypotheses. This is not empirical calibration, validation, forecasting, or evidence for real policy.

## Bounded observation: three seeds for 30 days

The `101,202,303` run on 2026-08-25 passed every invariant after the population-scaled essential-food change. Expanded runs formed four, two, and three private firms versus one, zero, and zero in their baselines. They closed one, zero, and two firms versus one, one, and one; no replacement occurred in this horizon. Education operated in all three expanded runs and delivered 17, 34, and 31 lessons. No apothecary or clinic formed, so medicine and clinical treatment remained absent.

Outcomes still did not improve uniformly. Expanded survival changed by zero, plus two, and zero citizens; employment changed by plus one, plus five, and plus one. Hunger changed by minus two, plus one, and minus one, while unhoused counts rose by three, five, and four. The report retained four review observations across the three seeds. Morrow Haulage and the new builder were constrained in seed 101; the materials yard was constrained in seed 202; and the materials yard and builder failed in seed 303. Finite housing ended at 41, 32, and 42 dwellings respectively.

The plausible model-level mechanism is competition for scarce labour, founder cash, operating cash, farm inputs, and freight capacity: adding a legal business opportunity does not add resources to the closed economy. Transport can delay food inputs, and short-lived optional firms can redirect wages and capital before failing. This is an inference from the modeled pipelines and recorded states, not a proven causal decomposition. The next balancing pass should use the JSON histories to isolate freight priority, formation cost forecasts, essential-input protection, and repair cadence rather than simply weakening death or insolvency consequences.
