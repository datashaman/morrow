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

The `101,202,303` run on 2026-08-25 passed every invariant. Expanded runs formed three or four private firms versus one in each baseline, but also closed one to three firms versus zero or one. No replacement occurred in this horizon. Education operated in all three expanded runs and delivered 9, 4, and 55 lessons; medicine reached 38 purchases only in seed 101; no clinic formed, so clinical treatment remained absent.

Outcomes did not automatically improve. Expanded alive population was lower by 9, 6, and 1 citizens. Seed 202 also had three fewer employed citizens and eleven more hungry citizens; seed 303 had two more employed and one fewer hungry citizen. The report retained six review observations across the three seeds. Morrow Haulage was constrained in seed 101, and several new firms were constrained or failed. Finite housing fell to 32 dwellings in all three expanded runs because builders never remained available to complete repairs, although the surviving population stayed below capacity and no living citizen was unhoused at the endpoint.

The plausible model-level mechanism is competition for scarce labour, founder cash, operating cash, farm inputs, and freight capacity: adding a legal business opportunity does not add resources to the closed economy. Transport can delay food inputs, and short-lived optional firms can redirect wages and capital before failing. This is an inference from the modeled pipelines and recorded states, not a proven causal decomposition. The next balancing pass should use the JSON histories to isolate freight priority, formation cost forecasts, essential-input protection, and repair cadence rather than simply weakening death or insolvency consequences.
