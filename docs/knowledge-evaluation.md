# Cross-trade knowledge evaluation

Morrow compares `knowledge-v2` with the same post-schedule simulation when vocational workplace learning and operational effects are disabled. Generic skill and every other rule remain active in both modes.

Run the checked comparison with:

```sh
npm run evaluate:knowledge
```

The default uses seeds 20260823, 101, 202, 303, 404, and 505 for 60 days. Use `--seeds 101,202 --days 30` for a diagnostic subset, or `--json` for the complete machine-readable report.

## Two evidence layers

The first layer runs a deterministic 30-day fixture for all twelve archetypes. Every vocational field starts at zero. Relevant workers attend and learn at the configured rate before the same day's effect; the fixture supplies enough input and funded demand to use added capacity. Transaction, processing, and haulage effects must accumulate and use at least one whole unit. Direct yield must remain fractional and add output. The scalar pair must record no vocational learning or effect. Processing fixtures use six synthetic attending workers so the shared 0.003 rate crosses one whole unit inside 30 days; that saturation setup is evaluator evidence, not an ordinary staffing claim.

The second layer runs schedule, sleep, housing-capacity, transport, and latent formation features for the six fixed seeds. Each pair reports:

- observed and newly formed archetypes;
- per-domain learning records and final means;
- gross, whole released, and actually used effects by archetype;
- realized sales by archetype and in total;
- final employment, hunger, housing, survival, and firm failures;
- candidate-minus-baseline deltas, replay identity, and cash conservation.

Hard checks cover zero-start fixture coverage and use, scalar isolation, deterministic replay, observed town learning, and conservation. Downstream welfare and business deltas are never directional pass/fail gates.

## Checked default result

The six-seed, 60-day evaluation passed. The twelve fixtures recorded 960 learning updates, 32.16 gross effect units, 27 whole released units, and 28.90 used units including continuous direct output. Every archetype learned and used its configured effect from zero vocational knowledge.

Across paired towns, candidate learning records ranged from 1,364 to 1,553. Candidate-minus-baseline sales ranged from −98.92 to +27.50. Five seeds had no final employment delta and seed 101 had +1 employed and +1 hungry; survival, housing, and firm-failure deltas were zero in this run set. Both modes replayed exactly and conserved cash for every seed.

These are deterministic gameplay observations, not evidence that knowledge improves welfare, that a negative or positive sales delta is desirable, or that the taxonomy, rates, effect ceiling, fixtures, firms, education, professions, labor markets, or town dynamics are empirically calibrated.
