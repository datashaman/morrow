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

**Mutual-aid gift**:
A voluntary citizen-to-citizen transfer of one existing resource without payment or debt. It changes ownership rather than creating supply, and may be constrained by the giver's protected reserve and the recipient's capacity.
_Avoid_: Treasury support, loan, charity income

**Close friendship**:
A reciprocal friendship whose current strength is at least 0.75. It may unlock trusted interpersonal actions, but does not itself require or guarantee that either citizen takes them.
_Avoid_: Any friendship, obligation, household

**Romantic partnership**:
An explicit, mutually accepted relationship between two adult citizens that is distinct from friendship and does not automatically create a household or birth. The initial lifecycle model permits at most one active romantic partnership per citizen.
_Avoid_: Close friendship, household, automatic birth

**Dependent citizen**:
A named citizen in the infant, child, or student lifecycle stage who has needs and a complete history but cannot perform adult economic or relationship actions. A dependent becomes an adult after 168 calendar days and must have an explicit guardian while dependent.
_Avoid_: Smaller adult, employee, household

**Guardian**:
A living adult citizen, or the treasury as a finite institutional fallback, authorized to make traced decisions and exact payments for a dependent citizen. Co-guardians retain separate finances, and guardianship continues independently of romantic partnership status.
_Avoid_: Owner, pooled wallet, guaranteed provider

**Parent**:
An adult citizen recorded as one of the two participants in the joint birth decision that produced a citizen. Parentage is immutable lineage; it does not guarantee continuing guardianship, residence, care, or romantic partnership.
_Avoid_: Guardian, household member, current partner

**Care-weighted runway**:
A guardian's cash divided by their own daily essential cost plus their allocated share of dependent food cost. Two living co-guardians each carry half of a shared dependent's modeled cost; a sole citizen guardian carries all of it. Costs covered by a dependent's restricted inheritance balance do not burden the guardian, but that balance never increases guardian cash or runway. This is a planning measure, not pooled cash or a split transaction.
_Avoid_: Household balance, shared wallet, guaranteed care

**Estate duty**:
A mandatory transfer of 10% of every deceased citizen's cash estate to the treasury before the remainder is distributed to eligible heirs. It has no exemption or threshold in the initial lifecycle model and is an explicit Morrow policy for recirculating money within the closed economy. Duty is rounded down to whole cents so it never exceeds 10%.
_Avoid_: Intestate estate, inheritance, empirically calibrated tax

**Intestate inheritance**:
Distribution of the cash estate that remains after estate duty. Eligible heirs are the active romantic partner at death and all living biological children, including adults and dependents; former partners, guardians who are not parents, parents, siblings, and friends are not heirs. With a partner and children, the partner receives half rounded down and the children divide the rest; a partner or children alone receive the full remainder; with neither, the treasury receives it. Child shares use whole cents and allocate leftover cents in ascending immutable citizen-ID order. Citizens dying in the same resolution phase cannot inherit from one another. A dependent child's share must remain their property rather than becoming guardian cash.
_Avoid_: Estate duty, guardian income, equal distribution among all citizens

**Restricted inheritance balance**:
Cash inherited by a dependent citizen that remains the dependent's property. It pays only that citizen's traceable food, medicine, clinical care, and education before guardian or treasury funds; it cannot fund gifts or become guardian cash. It contributes to that dependent's care capacity and removes covered costs from guardian burden without increasing guardian wealth. The remainder becomes ordinary personal cash at adulthood or enters the dependent's estate if they die.
_Avoid_: Guardian wallet, general household fund, treasury support

**Public social venue**:
A non-commercial town location where any living citizen may legally choose social contact regardless of hunger, housing, employment, or the availability of private firms. Scheduling and motivation may still prevent attendance; eligibility does not guarantee contact.
_Avoid_: Welfare service, guaranteed meeting, café

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
> **Developer:** Does giving a friend a stored meal create food or make the recipient owe repayment?
>
> **Domain expert:** No. A mutual-aid gift transfers an existing meal without payment or debt; its provenance and the town's total food supply remain intact.
>
> **Developer:** Does every friend qualify for a mutual-aid gift?
>
> **Domain expert:** No. The current food-gift tracer requires a close friendship at strength 0.75 or above, and either citizen may still choose not to participate.
>
> **Developer:** Is a close friendship automatically a romantic partnership?
>
> **Domain expert:** No. A romantic partnership is a distinct relationship that both adult citizens must choose; friendship alone creates neither partnership nor birth.
>
> **Developer:** Is a newborn just another adult citizen with lower skill?
>
> **Domain expert:** No. A newborn is a dependent citizen with stage-specific needs and no adult economic agency until maturation.
>
> **Developer:** Do co-guardians automatically share all their cash?
>
> **Domain expert:** No. Each guardian remains a separate economic actor; a specific guardian funds each exact dependent purchase, with treasury guardianship only as a finite fallback.
>
> **Developer:** If a parent dies or separates, does the citizen stop being their child?
>
> **Domain expert:** No. Parentage is immutable lineage; guardianship and partnership are separate roles that can change.
>
> **Developer:** Does counting a dependent in both guardians' planning create two meals of cost?
>
> **Domain expert:** No. Care-weighted runway allocates one modeled dependent food cost across living co-guardians while every real purchase still has one exact payer.
>
> **Developer:** Does the treasury receive an estate only when no heir survives?
>
> **Domain expert:** No. Every estate first pays 10% estate duty to the treasury; only the remaining 90% is available to heirs or, if none exist, to the treasury.
>
> **Developer:** Does a guardian receive a dependent child's inheritance as personal cash?
>
> **Domain expert:** No. The dependent owns their inherited share; guardians may only direct its use under the restricted-care rules.
>
> **Developer:** Can a dependent's inheritance quietly subsidize their guardian or sibling?
>
> **Domain expert:** No. A restricted inheritance balance may pay only for that dependent's actually delivered eligible care, and every payment remains traceable in the dependent's history.
>
> **Developer:** Does a dependent's inheritance make their guardian wealthier?
>
> **Domain expert:** No. It improves only that dependent's care coverage and reduces the guardian's modeled burden for covered costs.
>
> **Developer:** Does a former partner or guardian automatically inherit?
>
> **Domain expert:** No. Only the active romantic partner at death and living biological children are eligible in the initial intestacy model; guardianship alone creates no inheritance right.
>
> **Developer:** Can two citizens dying in the same phase inherit from one another according to resolution order?
>
> **Domain expert:** No. The whole death cohort is treated as deceased before any of its estates are distributed, so inheritance never depends on citizen processing order.
>
> **Developer:** Can estate rounding create or discard a cent?
>
> **Domain expert:** No. Duty and shares use deterministic whole-cent allocation, and every cent leaves the deceased estate exactly once.
>
> **Developer:** Can hunger or a failed café make social contact illegal?
>
> **Domain expert:** No. Common Park is a public social venue open to every living citizen; hardship can affect their choice and available time, but not their eligibility.
>
> **Developer:** Does a Sunday closure advance a firm's maintenance counter?
>
> **Domain expert:** No. Maintenance uses an open-day recurrence basis; food ageing still uses calendar days.

## Where to continue

Use [docs/README.md](./docs/README.md) as the documentation index. The most important unresolved work is listed in [docs/known-limitations.md](./docs/known-limitations.md).
