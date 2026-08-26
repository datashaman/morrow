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
3. **Scarcity has consequences.** Low resources must be capable of producing hunger, arrears, eviction, stress, health decline, lower productivity, unemployment, and death.
4. **Success is not guaranteed.** The system must allow persistent hardship, business trouble, and unequal outcomes.
5. **Needs compete.** Higher-order pursuits should generally yield to physiological and safety needs when those needs are insecure.
6. **Behaviour is bounded, not perfectly rational.** Stress can cause avoidance, missed work, delayed essentials, and short-term comfort spending.
7. **Outcomes must be auditable.** A surprising cash movement should show its day, counterparty, purpose, and balance before and after.
8. **Randomness must be replayable.** A fixed seed should reproduce the same run for diagnosis and comparison.
9. **Parameters are hypotheses.** Current thresholds and weights are hand-designed exploration values, not validated empirical estimates.

## Current status

- A Vite-based browser app runs the simulation.
- The simulation core is independent of the DOM and can be exercised from tests.
- One hundred and eighty-four deterministic regression tests pass.
- The production build passes.
- Simulation changes are tracked as tested vertical-slice commits and GitHub Issues.
- Historical single-file previews remain in `work/` and are ignored by Git.

## Product name

The confirmed product name is “Morrow.” The repository lives at `/Users/marlinf/Projects/datashaman/morrow`.

## Language

**Funded employment opportunity**:
A real vacancy backed by an explicit paying counterparty and available through the town's job market. It provides a credible path to earned income without guaranteeing that a particular citizen applies, receives an offer, accepts, or remains employed.
_Avoid_: Employment target, guaranteed job

**Trade knowledge domain**:
A transferable area of vocational capability that can be learned at more than one relevant workplace and may contribute to a bounded operational effect. It is not a credential, occupation, employer affiliation, or firm-specific badge.
_Avoid_: Firm skill, job title, profession

**Civil-time block**:
One of the town's named morning, workday, evening, or overnight periods. It represents when scheduled activity is legal, not a claim that a simulation processing phase lasts a particular number of hours.
_Avoid_: Hour, simulation phase

**Processing phase**:
A deterministic causal stage that applies simulation rules in a stable order. Multiple processing phases may occur within one civil-time block.
_Avoid_: Clock hour, time block

**Primary activity**:
A substantial commitment that occupies a citizen's available activity capacity within a civil-time block, such as a scheduled shift, lesson, clinical appointment, or leisure activity. A citizen can perform at most one primary activity in the same block.
_Avoid_: Transaction, processing phase

**Brief transaction**:
A short exchange, such as buying food or paying rent, that may coexist with one primary activity when its counterparty is available. It moves resources but does not consume the block's primary-activity capacity.
_Avoid_: Primary activity, free action

**Recurrence basis**:
The declared clock that advances a timer: calendar day, firm open day, employee scheduled shift, or a named weekly recurrence. A closed day is not an operating failure unless the rule explicitly uses calendar days.
_Avoid_: Raw day counter, implicit interval

### Example dialogue

> **Developer:** Should the early economy hold employment above a fixed percentage?
>
> **Domain expert:** No. It should provide funded employment opportunities; hiring outcomes may still vary and unemployment must remain possible.
>
> **Developer:** Does knowledge learned at one grocer belong only to that firm?
>
> **Domain expert:** No. Retail operations is a trade knowledge domain and may transfer to another relevant workplace.
>
> **Developer:** Is Payroll an hour of the day?
>
> **Domain expert:** No. Payroll is a processing phase; it occurs within a civil-time block but exists to preserve causal ordering.
>
> **Developer:** Does paying rent prevent someone from resting that evening?
>
> **Domain expert:** No. Rent is a brief transaction; rest is the evening's primary activity.
>
> **Developer:** Does a Sunday closure advance a firm's maintenance counter?
>
> **Domain expert:** No. Maintenance uses an open-day recurrence basis; food ageing still uses calendar days.

## Where to continue

Use [docs/README.md](./docs/README.md) as the documentation index. The most important unresolved work is listed in [docs/known-limitations.md](./docs/known-limitations.md).
