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

The required five-seed, 504-requested-day replay completed with exact cash conservation in every primary and replay run. Its technical-integrity gate passes. Its lifecycle-reach and dependent-essentials gates fail, so the overall activation result is `FAILED`. Extinction stopped every run early, between day 80 and day 100, no maturation or workforce entry occurred, only 59% of dependent meals were delivered, and none of 124 attempted dependent health episodes completed.

| Seed | Mode | Days | Opportunities / attempts / conceptions / births | Dependent meals | Health care | Lessons | Firm failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 101 | full | 100 | 22 / 34 / 11 / 6 | 138 / 228 | 0 / 54 | 0 / 0 | 3 |
| 101 | disabled | 80 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 |
| 202 | full | 89 | 22 / 23 / 7 / 5 | 96 / 174 | 0 / 34 | 0 / 0 | 3 |
| 202 | disabled | 87 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 |
| 303 | full | 98 | 19 / 25 / 10 / 10 | 252 / 401 | 0 / 24 | 58 / 88 | 2 |
| 303 | disabled | 97 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 |
| 404 | full | 91 | 34 / 33 / 4 / 1 | 19 / 34 | 0 / 12 | 0 / 0 | 4 |
| 404 | disabled | 92 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 |
| 505 | full | 100 | 24 / 32 / 13 / 12 | 236 / 419 | 0 / 0 | 48 / 95 | 0 |
| 505 | disabled | 92 | 0 / 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 1 |

Across the full-lifecycle runs, 34 births occurred, 741 of 1,256 dependent meals were delivered, none of 124 planned dependent health episodes completed, and 106 of 183 scheduled lessons were attended. Births extended survival in four seeds by 1–20 days and shortened it in seed 404 by one day. No run exceeded the initial peak of 40 living citizens because deaths outpaced births.

These observations do not constitute a demographic acceptance threshold. They do show that the current economy prevents the evaluation from exercising maturation and workforce entry and repeatedly fails dependent essentials. The browser birth gate therefore remains off while the underlying town-survival and dependent-care constraints are investigated; the implemented lifecycle remains available to deterministic tests and explicit headless configurations.

The same accepted run includes public haulage re-entry after its finite cooldown. This reduces the final failed-firm count in several seeds, but does not change births, survival, dependent care, schooling, or workforce outcomes: restarted transport still lacks sufficiently reliable attended capacity to restore the late farm-to-apothecary pipeline before extinction.
