# Endogenous-development sensitivity

Run the deterministic report with:

```sh
npm run evaluate:development
npm run evaluate:development -- --seeds 101,202,303 --days 30
npm run evaluate:development -- --json
```

The report always starts from the interactive four-firm foundation. For every fixed seed and policy scenario it records optional-firm opening day, instance and founder; private replacements; reversible town-stage transitions; final survival, employment, hunger, housing hardship and firm failures; and initial/final cash. It explicitly flags runs with no optional formation, repeated private churn, or collapse. A failed cash-conservation check fails the report.

## Default sensitivity matrix

The default matrix varies one gameplay control at a time around the configured baseline:

| Control | Tested values |
|---|---|
| Discretionary demand | 20%, 50%, 80% |
| Treasury support | 10%, 35% |
| Economic shocks | 20%, 40% |
| Minimum wage | 5, 10 |

The formation window, demand-capture fraction, margin buffer, startup capital, founder reserve, and replacement cooldown are held fixed. Consequently this report tests outcome sensitivity to the exposed policy environment; it does not yet identify each formation constant independently.

## Bounded observations

A 3-seed (`101,202,303`), 30-day run on 2026-08-25 conserved cash in every scenario. Under low, baseline, and high discretionary demand, Green Basket opened on day 7 or 12 in every seed and no café opened. Those three demand settings produced identical reported 30-day outcomes because premium-food formation uses eligible essential-reserve demand rather than the discretionary café control. This is useful negative sensitivity evidence, not proof that discretionary demand is irrelevant over longer runs.

Reducing support from 35% to 10% increased final combined hunger-and-housing hardship in seeds 101 and 202 from 25.0% and 29.2% to 65.6% and 72.4%. Seed 303 remained near 25% and had one firm failure. Raising shock risk from 20% to 40% produced no reported difference in these particular 30-day seeds. No replacement, repeated churn, stage transition, or collapse appeared in this bounded matrix; longer horizons are required to exercise those report paths.

The high-wage scenario produced no optional formation in all three seeds. Each moved from Subsistence to Collapsed with no survivors by day 30 and one or two failed firms. This is an obvious degenerate parameter region in the current closed economy: immediately doubling the wage floor without changing starting firm capital, productivity, prices, or demand destabilizes both employers and household provisioning. It is not evidence about real minimum-wage policy.

These are deterministic gameplay diagnostics. The seeds are synthetic, the ranges are design choices, and no parameter is fitted to observed people, firms, towns, or policy outcomes. The report is not empirical calibration, model validation, a forecast, evidence about real entrepreneurship, or support for real policy decisions.
