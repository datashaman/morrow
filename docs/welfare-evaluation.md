# Welfare evaluation

`npm run evaluate:welfare` runs the accepted welfare tracer across seeds 101, 202, 303, 404, and 505 for 180 completed days. Each seed compares four isolated configurations with the same schedule, sleep, transport, housing-capacity, mutual-aid, and latent-firm settings:

- `none`: no treasury welfare;
- `legacy-cash`: the previous opaque cash-support baseline;
- `direct-only`: Food Assistance and Rent Assistance without cash relief;
- `combined`: both direct programmes plus Emergency Cash Relief, matching the browser.

Use `--seeds 101,202`, `--days 30`, or `--json` for a smaller diagnostic or machine-readable report. Every mode is replayed from the same seed; unequal replay is a hard failure.

The report includes programme eligibility, offers, acceptance, refusal, delivery, failure reasons, take-up, treasury contribution, complete provider revenue, legacy payments, treasury minimum/final cash, provider-attributed welfare revenue, employment, hunger-days, unhoused-days, mean living health, survival, and hardship among citizens who received no welfare delivery. `separateFundBalance` is explicitly `null` because the programmes spend ordinary treasury cash rather than a modeled fund.

Hard checks require conserved cash, non-negative balances, linked transaction evidence for every welfare delivery, and no welfare record after death. The simulation's ordinary invariant checks also run after every completed day.

These values are deterministic gameplay observations. They are not acceptance targets, forecasts, causal estimates, empirical calibration, evidence of fairness, or claims about real welfare policy. In particular, the non-recipient view is only a diagnostic for whether hardship concentrates among citizens who received no modeled delivery; it does not identify a protected group, household, or counterfactual exclusion effect.
