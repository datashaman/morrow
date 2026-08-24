# Shared neural shadow policy

Morrow includes one small shared multilayer perceptron as an architectural tracer bullet. It runs locally in TypeScript and observes every policy decision, but it does not control the simulation.

## Boundary

`ShadowCitizenPolicy` asks the active `motivation-v3` policy for the authoritative action, then asks one shared `SharedNeuralPolicy` instance what it would choose. `TownSimulation` applies only the active action. The neural comparison is stored beside the ordinary decision trace.

There is no network per citizen and no raw citizen ID input. Citizens differ through ordinary current-state and stable motivation-profile features. The fixed initial weights are deterministically generated from a versioned seed, so identical weights, observations, and legal actions reproduce identical inference in the browser and headless runtime. No Python process or service is required.

## Versioned schemas

Schema version 1 defines:

- observation features: decision kind, seven profile weights, stress, health, hunger, runway, reliability, safety, firm trouble, option count, and owner/firm runway where applicable;
- action features: one-hot action kind plus bounded numeric values such as price, amount, quality, age, capacity, wage, and owner-option consequences;
- a legal mask over 27 stable action kinds.

Dynamic actions such as applying to a particular firm or buying a particular food quantity share an action kind but retain their concrete numeric option features. Changing feature order, normalization, action kinds, or mask meaning requires a new schema version. Changing fixed or trained parameters requires a new weights version.

## Shadow inference

The shared network scores each concrete legal action. For diagnosis it also scores one synthetic representative of every illegal action kind. It records:

- the highest-scoring masked legal action;
- whether it diverged from the active policy;
- the highest unmasked action or synthetic action kind;
- whether that pre-mask preference was illegal;
- the complete legal mask and legal-action scores;
- schema, policy, and weights versions.

The interface shows this comparison in citizen and selected-firm decision streams. An illegal unmasked preference is diagnostic only; masking prevents it from reaching simulation consequences.

## Evaluation

The headless evaluator reports shadow divergence, illegal pre-mask preference rates, shadow action distributions, and three directional—not causal—projections: changes in missed shifts, essential skips, and accepted job offers if shadow choices had replaced active choices. Outcomes are not projected by mutating the same run because that would change future state and randomness. A later activation-gate slice will run bounded controlled-policy comparisons.

The default network is not trained and its weights have no behavioral meaning. Compatible offline-trained artifacts can be validated and loaded into a shadow network, but this does not authorize control. Shadow agreement is not a quality target by itself, and technical reproducibility is not evidence of realism, safety, fairness, or calibration. See [offline training](./offline-training.md).
