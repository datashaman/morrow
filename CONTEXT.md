# Project context

## What this is

Morrow is an exploratory, individual-level social and economic simulation. Its purpose is to make emergent outcomes observable through the lives of named people, not merely through aggregate charts.

The user wants to watch people make constrained decisions inside an economy where money, goods, jobs, housing, health, stress, relationships, and needs affect one another. The simulation should produce understandable stories such as unemployment leading to low reserves, stress-related mistakes, missed meals, deteriorating health, missed work, eviction, and difficulty recovering.

This is a thinking tool, not a forecast, policy model, or claim about real-world population behaviour.

## Why it exists

The project began as an in-conversation visualization. Each iteration responded to an observed implausibility:

- Individuals originally had too few consequences; hunger and homelessness were added.
- Friendships appeared automatically; social encounters, capacity, and recency were introduced.
- Cash appeared without a source; firms, payroll, buyers, sellers, taxes, and treasury support were introduced.
- Everyone appeared to be an employer; people and firms were separated, with explicit employment and ownership.
- Needs did not reflect precarity; a Maslow-inspired hierarchy was introduced.
- People with almost no runway pursued self-actualization; stress and lower-level need gating were introduced.
- Health stayed near 100% despite poverty; hunger, stress, illness, and work capacity were linked.
- A person appeared to pay rent without cash; exact transfers and before/after ledger balances were introduced.

The visualization became large enough that it was migrated into this repository.

## Product principles

1. **Follow a person.** Aggregate statistics are useful, but the primary unit of explanation is a named individual with a current state, ledger, and history.
2. **Every payment has two sides.** Wages come from firms, purchases go to sellers, rent goes to a housing provider, taxes go to the treasury, and support comes from it.
3. **Scarcity has consequences.** Low resources must be capable of producing hunger, arrears, eviction, stress, health decline, lower productivity, and unemployment.
4. **Success is not guaranteed.** The system must allow persistent hardship, business trouble, and unequal outcomes.
5. **Needs compete.** Higher-order pursuits should generally yield to physiological and safety needs when those needs are insecure.
6. **Behaviour is bounded, not perfectly rational.** Stress can cause avoidance, missed work, delayed essentials, and short-term comfort spending.
7. **Outcomes must be auditable.** A surprising cash movement should show its day, counterparty, purpose, and balance before and after.
8. **Randomness must be replayable.** A fixed seed should reproduce the same run for diagnosis and comparison.
9. **Parameters are hypotheses.** Current thresholds and weights are hand-designed exploration values, not validated empirical estimates.

## Current status

- A Vite-based browser app runs the simulation.
- The simulation core is independent of the DOM and can be exercised from tests.
- Thirteen deterministic regression tests pass.
- The production build passes.
- The repository has an initial commit.
- Historical single-file previews remain in `work/` and are ignored by Git.

## Product name

The confirmed product and repository name is “Morrow.” The repository lives at `/Users/marlinf/Projects/datashaman/morrow`.

## Where to continue

Use [docs/README.md](./docs/README.md) as the documentation index. The most important unresolved work is listed in [docs/known-limitations.md](./docs/known-limitations.md).
