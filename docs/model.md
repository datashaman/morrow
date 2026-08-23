# Simulation model

This document describes the implementation in `src/simulation.js`. It is descriptive, not a claim that the rules are empirically correct.

## Time

One simulated day has six phases. `step()` executes the current phase and advances to the next.

1. Production
2. Payroll
3. Food shopping
4. Housing and bills
5. Personal time
6. Settlement

The day counter increments during settlement. A full day therefore requires six calls to `step()`.

## Entities

### People

There are 40 named people. Each person carries:

- Economic state: cash, employer, seller references, housing status, rent arrears, and transaction ledger
- Capacity: skill, reliability, attendance, missed work, and health
- Psychology: stress, current scarcity error, Maslow-inspired needs, and current focus
- Social state: friends, social capacity, and last social contact day
- Personal differences: risk tolerance and randomized starting values
- Narrative state: recent life events
- Display state: home and current map positions

Starting cash is uniformly sampled from 18 to 80. Starting health ranges from 0.58 to 0.94; stress ranges from 0.12 to 0.37. These are design values, not calibrated distributions.

### Firms

Five firms are configured in `src/config.js`:

| Firm | Sector | Price | Base wage | Transactions per worker | Starting staff | Maximum staff |
|---|---|---:|---:|---:|---:|---:|
| Harvest Foods | Food | 2.6 | 6.2 | 4 | 6 | 9 |
| Green Basket | Food | 2.8 | 6.5 | 4 | 6 | 9 |
| HomeWorks | Housing | 4.8 | 7.2 | 10 | 4 | 6 |
| Makers Guild | Goods | 8.5 | 7.8 | 3 | 4 | 6 |
| Common Café | Service | 4.4 | 6.4 | 4 | 4 | 6 |

Every firm begins with 150 cash. Firms track employees, inventory, sales, units sold, demand, vacancies, staffing targets, trouble, and operational status. The first five people are assigned as owners, one per firm; ownership and employment are separate concepts.

### Transaction capacity

An active firm can complete a limited number of transactions each day:

`attending workers × configured transactions per worker`

Only a customer who can cover the exact price and reaches an active firm with the required inventory, where applicable, creates attempted demand. A transaction beyond the firm’s daily capacity is recorded as turned away, moves no cash or inventory, and creates a life event for that customer. Completed and turned-away transactions both contribute to attempted demand, while only completed transactions consume inventory and produce revenue. Daily transaction counters reset during settlement.

### Treasury

The town treasury begins with 120 cash. It receives employer taxes and shock transfers, then pays targeted support during settlement.

## Money and accounting

The current economy contains only the cash held by people, firms, and the treasury.

`transfer(from, to, requested)` moves no more than the sender possesses. With `{ exact: true }`, it moves nothing unless the sender can cover the complete requested amount. Food, goods, services, rent, and rehousing deposits use exact transfers.

Money is rounded to cents when transferred. After every phase, `assertInvariants()` verifies that:

- Every cash balance is finite and non-negative.
- Total current cash differs from initial cash by no more than 0.1.

Individual ledger records store the day, direction, amount, purpose, and cash balance before and after. The interface displays the five most recent entries; the model retains twelve.

## Initial social and employment network

The model attempts 52 random friendship links. A link is mutual, cannot duplicate an existing link, and cannot exceed either person’s social capacity. Because rejected attempts are not retried, the final number may be lower than 52.

Firms receive their configured starting staff. Candidates are chosen from unemployed people in descending skill order. A person can have only one employer.

## Phase rules

### 1. Production

Each person receives a temporary scarcity-error flag with probability:

`stress² × 0.24`

An employed person misses work with probability:

`0.015 + stress × 0.10 + (1 − health) × 0.22 + hungryPenalty`

where `hungryPenalty` is 0.10 if the person has any hungry days. Missing work increases `missedWork`, reduces reliability by 0.018, and produces a life event. Attendance reduces the accumulated missed-work count by one.

For non-housing firms, each attending employee adds inventory according to:

`(0.42 + skill × 0.75) × firmProductivity × health × (1 − stress × 0.32)`

HomeWorks does not produce or consume housing inventory.

### 2. Payroll

The applicable wage is the greater of the policy minimum wage and the firm’s configured wage.

If a firm cannot cover all attending workers at that wage, a payroll ratio scales gross pay. Individual gross pay is further adjusted by reliability:

`wage × payrollRatio × (0.75 + reliability × 0.25)`

The firm transfers net wage to the person and employer tax to the treasury. If the payroll ratio is below 0.65, the firm gains trouble and the worker receives a payroll-failure event.

Workers who missed production receive no wage in that payroll phase.

### 3. Food shopping

Food firms with inventory are sorted by price. A person normally buys one unit from the cheapest affordable seller.

A scarcity error can cause either:

- choosing the more expensive affordable food seller, or
- delaying food despite available cash when stress exceeds 0.62 and runway is below five days; this additional delay has a 0.32 probability.

A shopper tries another affordable food firm when the preferred seller lacks transaction capacity. A successful purchase reduces `hungryDays` by one. If recovering from hunger, health rises by 0.004. Failure to buy food adds one hungry day and reduces health by 0.045.

### 4. Housing and bills

HomeWorks is the only current housing provider.

- A housed person owes one rent: 4.8.
- An unhoused person needs three rents, 14.4, to secure housing again. This represents a deposit plus rent.
- Both are exact payments; insufficient cash causes no transfer.
- A payable housing transaction can still fail when HomeWorks has exhausted its attending workers’ transaction capacity.
- A housed person who misses three rents is evicted.
- A successful rent resets arrears to zero.

A housed person under scarcity pressure may defer rent despite being able to pay. This requires stress above 0.60, runway below five days, and a 0.38 random result after the scarcity-error flag has been set.

An unhoused person does not accumulate additional arrears while unable to afford rehousing.

### 5. Personal time

The current focus is reassessed before choosing an activity.

- A highly stressed person experiencing a scarcity error may buy short-term comfort at the café. This immediately reduces stress by 0.035 but also lowers cash reserves.
- A person focused on belonging may buy a social visit if they retain more than seven cash after its price.
- A person focused on esteem or growth may buy learning tools if they retain more than ten cash after the price. This increases skill by 0.02 and growth by 0.04.

Social visitors are shuffled and paired. The pair’s contact dates are refreshed. If they are not already friends and both have capacity, a mutual friendship is created.

The `discretionaryDemand` policy is not currently used; see the limitations document.

### 6. Settlement

#### Treasury support

The daily support budget is:

`treasury cash × supportRate × 0.18`

People are sorted by hunger, housing status, and then cash. A person qualifies when cash is below 12, they are hungry, or they are unhoused. Payments are capped at 5 per person and stop when the budget or treasury is exhausted.

#### Firm settlement

Each firm updates its smoothed demand:

`previous demand × 0.72 + attempted transactions × 0.28`

Required staff is the bounded ceiling of smoothed demand divided by configured transactions per worker. The estimated revenue available to support one more worker is:

`min(transactions per worker, demand above current capacity) × price`

A firm approves at most one additional position per settlement when that marginal revenue is at least 108% of the wage, it holds at least six wages in cash, and it remains below maximum staff. Vacancies must persist for two settlement phases before recruitment. Candidates are ranked by skill and reliability and must accept the offered wage relative to a skill-based reservation wage.

The Employment card reports positions available as approved vacancies across active firms: the sum of `targetStaff − current employees`, bounded at zero for each firm. Because `targetStaff` reflects demand, profitability, cash reserves, and current staffing, a layoff or closure does not automatically create an available position. Vacancies must still persist for two settlement phases before recruitment, and a candidate may decline or fail to accept the offered wage.

Overstaffing or sustained cash trouble can produce layoffs after three settlement phases. A firm closes after cash falls below 0.5 while trouble exceeds five; all remaining workers lose their jobs.

At the current shock setting, a firm has `shockRisk / 100 × 0.025` probability of transferring a random 12–34 cash to the treasury and gaining trouble.

When firm cash exceeds 230, 35% of the amount above 210 is paid to its owner as a dividend.

#### Health and stress

Stress is updated twice during settlement. If stress exceeds 0.55, health declines by:

`0.002 + (stress − 0.55) × 0.018`

and reliability declines by 0.002. Otherwise, a housed and fed person below 0.92 health recovers by 0.0035.

An additional health setback occurs with probability:

`0.006 + stress × 0.018 + (1 − health) × 0.008`

The setback reduces health by a random 0.04–0.13. Health is bounded between 0.08 and 1.

## Stress

### Financial runway

Essential daily cost is the cheapest active food price plus the active housing price. Runway is current cash divided by that cost. It is a liquidity measure, not a forecast of actual spending.

### Underlying pressure

Stress pressure is the bounded sum of:

| Source | Maximum contribution |
|---|---:|
| Runway below 12 days | 0.42 |
| Unemployment or firm trouble | 0.16 |
| Any hunger | 0.18 |
| Being unhoused | 0.17 |
| Isolation or stale social contact | 0.07 |

Runway pressure falls linearly to zero at twelve days. Firm risk is maximal when unemployed and rises with employer trouble. Social pressure is maximal without friends; with friends it begins rising after three days without contact and reaches its maximum ten days later.

Each update moves stress 30% toward underlying pressure, retains 70% of existing stress, and adds random noise from −0.0125 to +0.0125.

What currently reduces stress is therefore adequate runway, stable employment, food, housing, recent social contact, and the café’s immediate comfort effect. Health recovery does not directly reduce stress.

## Maslow-inspired needs

Needs are scores from zero to one. The hierarchy is inspired by Maslow but is not a clinical or validated implementation.

- **Physiological:** 52% health and 48% fed status.
- **Safety:** housing, employment, employer stability, and up to twelve days of runway.
- **Belonging:** a baseline, friendship capacity filled, and recent contact.
- **Esteem:** a baseline, skill, employment, ownership, and esteem boost.
- **Growth:** the person’s accumulated growth state.

The person focuses on the first of physiological, safety, belonging, or esteem below 0.75. If all four are at least 0.75, they focus on growth only when stress is below 0.45; otherwise they return to safety.

## Policy controls

| Control | Default | Implemented effect |
|---|---:|---|
| Minimum wage | 5 | Floors the wage used in payroll and staffing decisions |
| Employer tax | 12% | Moves part of gross payroll from firms to the treasury |
| Support budget | 35% | Scales the treasury’s daily support budget |
| Discretionary demand | 50% | No effect yet |
| Economic shocks | 20% | Scales firm-to-treasury shock probability |

Changing a control affects future phases; it does not rewind or recompute past state.

## Randomness and replay

`src/random.js` supplies a seeded Mulberry32-style pseudorandom generator. The default seed is `20260823`. Two simulations with the same seed, policies, and sequence of method calls should produce the same state.

Rendering animation uses no simulation randomness, but it does mutate display positions. Those positions have no effect on economic rules.
