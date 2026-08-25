# Firm viability evaluation

The headless optional-firm diagnostic explains whether Green Basket and Common Café are supported by the current closed economy. It observes existing simulation state without changing any rule, random draw, transaction, or decision. The output is a reproducible gameplay diagnostic, not empirical calibration or a forecast.

## Run it

```sh
npm run evaluate:firms
npm run evaluate:firms -- --seeds 11,22,33 --days 120
npm run --silent evaluate:firms -- --seeds 11,22,33 --days 120 --json
```

Defaults are seeds 101, 202, 303, 404, and 505 over 90 days. `--firms` can select configured firm names as a comma-separated list. `--json` emits the complete versioned report.

## Evidence recorded

For every firm-day, the diagnostic records:

- revenue, produce inputs, maintenance, actual payroll and employer tax, and net cash flow;
- start/end cash, status, staff, price, inventory, units sold, and operating readiness;
- citizens with an observable need, citizens receiving a legal purchase option, and completed customer transactions;
- affordability, inventory, transaction-capacity, and upstream-contract constraints;
- requested and delivered inputs, closure day, and recorded closure reason.
- living-citizen cash above a four-day essential reserve, reported as an explicit uncalibrated purchasing-power proxy.

`eligiblePotentialCustomers` is deliberately broader than legal demand. For food it counts active shoppers who can afford at least one unit; for the café it counts current belonging or acute-comfort need before the discretionary-demand draw. `legalPotentialCustomers` counts citizens whose actual policy decision received a concrete action for that firm. Neither is a claim about a real demand curve.

The summary labels a closed firm `unsupported-demand` only when realized revenue fails to cover observed inputs, maintenance, and payroll while supply fulfillment remains at least 80% and no customer was turned away by transaction capacity. Observed supply, inventory, capacity, and affordability constraints remain separately reported even when they are not the primary closure signature.

## Baseline

The committed 90-day baseline uses seeds 101, 202, 303, 404, and 505. Common Café closed on days 30–35 in every seed. It completed 70–98 customers, recorded no capacity failures, fulfilled 97.2–100% of requested supply, and ended 118.53–148.64 below observed costs. Every seed therefore retained `unsupported-demand`: sales covered produce but the remaining margin did not cover actual payroll.

Green Basket remained active through day 90 in every seed, with positive observed operating margins of 99.06–490.46. It completed 242–748 purchases, fulfilled 99.9–100% of requested supply, and recorded 220–509 transaction-capacity failures plus 141–360 affordability failures. Its current baseline therefore does not support treating premium food and café failure as the same mechanism.

These results describe five deterministic stories under current hypotheses. They do not establish suitable prices, wages, preferences, or business conditions outside the simulation.
