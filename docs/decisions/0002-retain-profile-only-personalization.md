# 0002: Retain profile-only citizen personalization

- Status: accepted
- Date: 2026-08-24

## Context

Morrow's shared neural policy already observes each citizen's seven stable motivation-profile values. After bounded personal-time activation, the next question was whether the model needed additional per-citizen learned embeddings or mutable online adaptation. A full neural network per person was explicitly out of scope.

The decision must preserve deterministic replay, legal-action enforcement, cash invariants, and individual auditability. Any extra identity state also creates serialization, reset, training, and interpretation obligations.

## Experiment

The versioned headless research harness compared three personal-time-only variants using the same shared bundled weights:

1. **Profile-only:** current observation and motivation profile; no extra citizen state.
2. **Learned embedding:** four immutable per-citizen action-preference offsets learned from synthetic training trajectories.
3. **Bounded adaptation:** four seeded per-citizen offsets updated online toward the inspectable `motivation-v3` fallback, clamped to ±0.18 and fully auditable.

The full report used training seeds 11, 22, 33, 44, and 55 for 15 days, then evaluated seeds 101, 202, 303, 404, and 505 for 30 days. It measured per-citizen personal-time entropy, between-citizen action variance, distinct action profiles, deterministic replay, fallback agreement, training samples, online updates, failures, illegal applied actions, cash conservation, outcomes, and interpretability state.

All variants passed replay and invariants. All produced the same held-out personal-time behavior and aggregate outcomes:

| Variant | Fallback agreement | Mean entropy | Between-citizen variance | Distinct profiles | Added state/cost |
|---|---:|---:|---:|---:|---|
| Profile-only | 100% | 0.1107 | 0.0103 | 10.0 | none |
| Learned embedding | 100% | 0.1107 | 0.0103 | 10.0 | 4 immutable scalars/citizen; 200–3,000 added samples in the learning curve |
| Bounded adaptation | 100% | 0.1107 | 0.0103 | 10.0 | 4 mutable scalars/citizen; mean 1,196.4 audited updates/run |

These are synthetic, uncalibrated measurements. Equality does not prove that profile-only behavior is realistic; it shows that the tested personalization mechanisms did not earn their added complexity.

## Decision

Retain profile-only personalization in the runtime. Do not activate learned per-citizen embeddings or bounded online adaptation.

Keep the research harness and state contract so this decision can be revisited if a future hypothesis and dataset demonstrate a measurable held-out benefit. Any reconsideration requires a new ADR and must continue to re-rank only simulation-provided legal actions.

## Adaptation-state contract evaluated but not adopted

The rejected bounded-adaptation prototype defines its state so the replay implications are explicit:

- Seed: fixed adaptation seed combined with the synthetic citizen slot.
- State: four finite offsets, update sequence, seed, step, and bound.
- Serialization: sorted citizen slots in versioned JSON.
- Reset: clear offsets, audit, and sequence; seeded lazy initialization reproduces the starting state.
- Audit: every update records sequence, citizen slot, teacher and chosen actions, and before/after values.
- Enforcement: personalization sees and ranks only legal personal-time actions; `TownSimulation` still validates and applies the result.

## Consequences

- Stable motivation profiles remain the only per-citizen policy personalization in production.
- The shared network and current replay model gain no mutable citizen-policy state.
- There is no new save/load requirement in the browser.
- The research variants cannot be selected or activated by the runtime UI.
- Future work should first identify a behavioral gap that profile features cannot express, then define a falsifiable held-out benefit before adding identity state.
