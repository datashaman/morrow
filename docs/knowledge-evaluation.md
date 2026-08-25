# Knowledge tracer evaluation

Morrow compares `knowledge-v1` against the same seeded simulation with knowledge updates and effects disabled. The scalar baseline retains the existing generic-skill rules; the candidate adds workplace and retail-course learning plus the bounded everyday-grocer capacity multiplier.

Run the fixed comparison with:

```sh
npm run evaluate:knowledge
```

Use `--seeds 101,202 --days 60` to change the deterministic run set, or add `--json` for the full machine-readable report.

## Falsifiable tracer hypothesis

Across a requested fixed run set, the candidate must produce at least one auditable learning record, at least one gross grocery capacity-point-day, and at least one accumulated whole transaction slot while both candidate and baseline conserve cash. A capacity-point-day is the continuous knowledge contribution before integer conversion; the report separately exposes whole slots released by the fractional accumulator.

The evaluator reports each paired seed's learning sources and final knowledge means, grocery capacity and completed transactions, and deltas in survival, employment, hunger, housing, and firm insolvency. Those outcome deltas are observations, not success criteria: a capacity tracer is not allowed to hide worsened hardship behind an aggregate pass.

The default five-seed, 30-day comparison is deterministic and intended for regression diagnosis. Its learning rates, capacity conversion, horizon, and seeds are gameplay hypotheses. Passing does not validate real education, competence, productivity, firm behavior, labor markets, or public policy.

## Checked default result

On seeds 101, 202, 303, 404, and 505 for 30 days, the candidate recorded 1,527 learning updates and 30.21 gross capacity-point-days while every paired run conserved cash. The accumulator released 28 whole daily slots: 7, 4, 6, 3, and 8 by seed. Completed grocery transactions, survival, employment, hunger, housing, and firm-insolvency outcomes remained unchanged because no otherwise-legal customer reached a capacity-bound grocer on those runs. The tracer therefore demonstrates an operational capacity effect, but not increased demand, sales, welfare, or realism.
