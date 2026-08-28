# Lifecycle evaluation

`npm run evaluate:lifecycle` runs the lifecycle activation gate for seeds 101, 202, 303, 404, and 505 over a requested 504-day horizon. Each seed compares otherwise identical towns with the complete lifecycle and with births disabled. Both modes keep lifecycle state, schedules, sleep, transport, housing capacity, mutual aid, combined welfare, latent firms, and the deterministic motivation policy. A run stops early on extinction while preserving the requested horizon and completed-day count in its metadata.

Use `--seeds 101,202`, `--days 28`, or `--json` for smaller diagnostics or machine-readable output. Every mode is replayed from the same seed by default; `--no-replay` exists only for exploratory diagnostics and is not an activation result.

The report records weekly eligible partnership opportunities, attempts, conceptions, births, active gestations, daily and final lifecycle-stage population, dependency ratios, dependent food demand and delivery, health-care attempts and outcomes, housing pressure, school demand and attendance, maturation, workforce entry and employment, treasury support, estate duty, firm failures, deaths, extinction, peak population, and initial/final cash.

Metric boundaries are deliberately explicit:

- an eligible partnership opportunity is one weekly partnered pair with no active gestation and no birth-spacing cooldown before its motivation-driven decision;
- dependent food demand is one unit per living dependent-day, split into food consumed and missed;
- dependent health care counts planned episodes and their completed or failed final status;
- school demand counts scheduled lesson records, with attendance funded and every other outcome missed;
- employment rate is employed adult citizen-days divided by adult workforce citizen-days.

Simulation invariants run after every completed day. Lost or created cash fails immediately, as does unequal seeded replay. The report separates that technical integrity from browser activation readiness. Activation requires every full-lifecycle seed to reach the 168-day adult threshold, at least one observed maturation across those runs, at least 75% aggregate dependent meal delivery, and at least one completed dependent health episode whenever care is attempted. These thresholds are gameplay hypotheses chosen to ensure the enabled model actually exercises maturation and basic care; they are not demographic or policy claims.

These are bounded deterministic gameplay observations under Morrow's compressed time scale and numerical hypotheses. They are not empirical or demographic validation, calibration, forecasts, causal estimates, or claims about real families, fertility, care, education, welfare, or population dynamics.

## Accepted 2026-08-28 diagnostic run

The required five-seed, 504-requested-day replay was rerun after advance food purchases began rejecting FIFO portions that would expire by their intended meal day. It completed with exact cash conservation and identical replay in every run. Its technical-integrity gate passes. Its lifecycle-reach and dependent-essentials gates fail, so the overall activation result is `FAILED`. Extinction stopped every run early, between day 79 and day 107, no maturation or workforce entry occurred, only 52.8% of dependent meals were delivered, and none of 101 attempted dependent health episodes completed.

| Seed | Mode | Days | Opportunities / attempts / conceptions / births | Dependent meals | Health care | Lessons | Firm failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 101 | full | 107 | 27 / 36 / 9 / 6 | 146 / 237 | 0 / 49 | 0 / 0 | 4 |
| 101 | disabled | 82 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 |
| 202 | full | 86 | 22 / 25 / 7 / 5 | 83 / 160 | 0 / 32 | 0 / 0 | 3 |
| 202 | disabled | 86 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 4 |
| 303 | full | 86 | 17 / 24 / 10 / 9 | 165 / 304 | 0 / 11 | 28 / 46 | 2 |
| 303 | disabled | 104 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 |
| 404 | full | 87 | 34 / 28 / 3 / 1 | 13 / 28 | 0 / 9 | 0 / 0 | 3 |
| 404 | disabled | 86 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 |
| 505 | full | 79 | 22 / 31 / 13 / 10 | 128 / 285 | 0 / 0 | 8 / 35 | 1 |
| 505 | disabled | 91 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 |

Across the full-lifecycle runs, 31 births occurred, 535 of 1,014 dependent meals were delivered, none of 101 planned dependent health episodes completed, and 36 of 81 scheduled lessons were attended. Compared with births-disabled controls, full lifecycle extended survival by 25 days in seed 101 and one day in seed 404, matched seed 202, and shortened survival by 18 and 12 days in seeds 303 and 505. These are coupled gameplay outcomes, not an isolated estimate of the birth system or the expiry fix.

These observations do not constitute a demographic acceptance threshold. They do show that the current economy prevents the evaluation from exercising maturation and workforce entry and repeatedly fails dependent essentials. The browser birth gate therefore remains off while the underlying town-survival and dependent-care constraints are investigated; the implemented lifecycle remains available to deterministic tests and explicit headless configurations.

The changed trajectories confirm that preventing impossible stockpiling does not solve the separately observed upstream stock, affordability, provider-closure, capacity, and dependent-care constraints. Browser births therefore remain disabled.
