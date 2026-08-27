# Bounded neural activation

Morrow can let its bundled shared neural network control one reversible domain: personal-time choices. The browser starts with this control disabled. The user can enable or disable it during a run; the next decision changes controller without resetting people, firms, money, time, or randomness.

Food, housing, attendance, job search, job offers, and owner choices always remain under `motivation-v3`. `TownSimulation` still creates the concrete legal actions, rejects an action outside that set, and alone applies transactions and consequences. The network cannot invent a purchase, counterparty, price, job, or transfer.

Workday-plan choices and Overnight sleep versus late study also remain under `motivation-v3`. They are not schema-v2 personal-time actions and are excluded from the activation certificate's controlled-decision counts.

## Bundled candidate

The schema-v1 artifact `python-reward-weighted-active-policy-imitation-v1-390ffbfc893def94` was trained with the standard-library Python workflow on 8,760 synthetic decisions from seeds 11, 22, 33, 44, and 55 over 15 days. Runtime loading migrates it to schema v2 as `python-reward-weighted-active-policy-imitation-v1-390ffbfc893def94-schema2-zero-knowledge` by adding zero weights for the three knowledge inputs. Its objective is reward-weighted imitation of the active motivation policy; the migration does not retrain it or give knowledge causal influence. The model, rewards, and training set are hypotheses, not empirical behavioral evidence.

## Gate v1

Run the fixed held-out gate with:

```sh
npm run evaluate:activation
```

The checked certificate uses seeds 101, 202, 303, 404, and 505 for 30 days and requires:

- zero failed runs, invariant violations, illegal applied actions, or cash differences;
- byte-for-byte stable replay of the complete evaluation report;
- at least one neural-controlled decision in every candidate run and zero neural control outside personal time;
- absolute deltas versus `motivation-v3` no greater than 5 percentage points survival, 5 percentage points employment, 2 hungry citizens, 2 unhoused citizens, and 1 insolvent firm.

The schema-v2 gate re-evaluation passed every check. The candidate controlled 1,200 personal-time decisions per run and chose the same action as the motivation fallback in every one, so all five bounded outcome deltas were exactly zero. This is a deliberately narrow tracer bullet: it establishes that a migrated learned artifact can pass through the control path without changing these held-out runs, not that it improves decisions or will generalize.

## Runtime refusal and fallback

`GatedNeuralCitizenPolicy` rejects a certificate that is failed, incomplete, over-broad, bound to another schema, weights version, or fallback policy, or contains a failed outcome bound. The UI and snapshots identify mode, controlled domain, fallback, schema, gate, and weights. Each controlled decision retains the observation, legal alternatives, raw scores, normalized probabilities, chosen action, mask diagnostics, controller, and fallback comparison.

Turning the switch off immediately returns subsequent choices to `motivation-v3`. It does not rewind neural consequences already applied. There is no automatic online fallback based on later drift, no browser-side re-evaluation of the full gate, and no claim that five seeds or the chosen bounds establish real safety, fairness, psychology, or calibration.

Per-citizen embeddings and bounded adaptation remain research-only. [ADR 0002](./decisions/0002-retain-profile-only-personalization.md) retains the existing stable motivation profiles because the tested variants added state and audit cost without changing held-out behavior or outcomes.
