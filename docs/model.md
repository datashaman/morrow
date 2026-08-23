# Simulation model

This document describes the implementation in `src/simulation.js`. It is descriptive, not a claim that the rules are empirically correct.

## Time

One simulated day has seven phases. `step()` executes the current phase and advances to the next.

1. Production
2. Supply and procurement
3. Payroll
4. Food shopping
5. Housing and bills
6. Personal time
7. Settlement

The day counter increments during settlement. A full day therefore requires seven calls to `step()`.

## Entities

### People

There are 40 named people. Each person carries:

- Economic state: cash, employer, seller references, food reserve, housing status, rent arrears, and transaction ledger
- Capacity and mortality: skill, reliability, attendance, missed work, health, living status, critical-health duration, and death day
- Psychology: stress, current scarcity error, Maslow-inspired needs, and current focus
- Social state: symmetric relationships with strength and last-contact state, social capacity, and last social contact day
- Personal differences: randomized starting values, a persistent esteem baseline, a stable 15–31% comfortable-owner dividend preference, and a stable 0.60–0.84 minimum recovery ratio for personal firm funding
- Narrative state: recent life events
- Display state: home and current map positions

Starting cash is uniformly sampled from 18 to 80. Starting health ranges from 0.58 to 0.94; stress ranges from 0.12 to 0.37. These are design values, not calibrated distributions.

### Firms

Six firms are configured in `src/config.js`. The product catalog gives every traded thing a stable identifier, label, and unit; each firm declares the product it sells, its input when it has one, its source, and how its output is obtained.

| Firm | Sells | Made or supplied by | Retail/contract price | Base wage | Starting staff |
|---|---|---|---:|---:|---:|
| Harvest Foods | Everyday food | Morrow Fields produce, handled by retail staff | 1.8 | 6.2 | 3 |
| Green Basket | High-quality food | Higher-grade Morrow Fields produce, selected by retail staff | 2.0 | 6.5 | 2 |
| HomeWorks | Weekly housing service | Existing dwelling service operated by its staff | 6.0 weekly | 7.2 | 4 |
| Makers Guild | Learning tools | Made directly by guild workers | 6.0 | 7.8 | 3 |
| Common Café | Prepared café service | Morrow Fields produce, prepared by café staff | 2.2 | 6.4 | 2 |
| Morrow Fields | Farm produce | Grown directly by farm workers | 1.10–1.25 wholesale | 5.8 | 7 |

Every firm begins with 150 cash. Firms track employees, inventory, consumer and contract sales, input costs, smoothed net income, vacancies, staffing targets, trouble, distress duration, rescue history, and lifecycle status. The first six people are assigned as owners, one per firm; ownership and employment are separate concepts. Harvest Foods, HomeWorks, and Morrow Fields are currently marked vital because they provide the lowest-priced food, the only housing service, and the sole agricultural input respectively.

The current prices target internal cash-flow plausibility rather than a real currency. At default tax and a representative reliability of 0.8, the lowest configured wage produces about 4.85 net per attended day. Cheapest food plus one-seventh of weekly rent costs about 2.66 per day, so that representative worker earns roughly 1.82 times daily-equivalent essentials before optional purchases. Missed work, unemployment, payroll trouble, and seller capacity can still break that balance.

### Transaction capacity

An active firm can complete a limited number of transactions each day:

`attending workers × configured transactions per worker`

Only a customer who can cover the exact price and reaches an active firm with the required inventory, where applicable, creates an attempted transaction. A transaction beyond the firm's daily capacity is recorded as turned away, moves no cash or inventory, and creates a life event for that customer. Transaction counts measure workload and congestion only. Completed transactions consume inventory and produce realized income; turned-away transactions do neither. Daily transaction counters reset during settlement.

### Treasury

The town treasury begins with 120 cash. It receives employer taxes, intestate estates, and shock transfers, then pays targeted citizen support and eligible one-time vital-business rescues during settlement.

## Money and accounting

The current economy contains only the cash held by people, firms, and the treasury.

`transfer(from, to, requested)` moves no more than the sender possesses. With `{ exact: true }`, it moves nothing unless the sender can cover the complete requested amount. Food, goods, services, rent, and rehousing deposits use exact transfers.

Money is rounded to cents when transferred. After every phase, `assertInvariants()` verifies that:

- Every cash balance is finite and non-negative.
- Total current cash differs from initial cash by no more than 0.1.

Individual ledger records store the day, per-person activity sequence, direction, amount, purpose, and cash balance before and after. Life events carry the same sequence so the interface can combine both record types into one newest-first activity stream. The stream defaults to all activity and can be filtered to transactions or life events. The model retains the complete history for the current in-memory run; the interface renders all matching entries inside a scrollable region and preserves the reader's position while new activity arrives.

Firms and the treasury use the same sequenced ledger and event shape. The firm pipeline panel itemizes every firm's output, production or sourcing method, upstream producer, cash, inventory, staffing, smoothed net income, vital status, rescue history, and current lifecycle state. Supply buyers also show today's requested and delivered contract quantities. Selecting a firm exposes its complete combined transaction and lifecycle-event stream with the same filters and scrolling behavior as a citizen.

When a person dies without a modeled will, their full cash balance transfers immediately to the town treasury as an intestate estate. The deceased person's ledger records the before and after balances, their remaining cash becomes zero, and the transfer does not change total cash inside the accounting boundary. This is a deliberately simple default, not a probate model: there are no heirs, creditor claims, inheritance taxes, delays, or non-cash assets yet.

## Initial social and employment network

The model attempts 52 random friendship links. A link is mutual, begins at strength 0.60, cannot duplicate an existing link, and cannot exceed either person's social capacity. Because rejected attempts are not retried, the final number may be lower than 52.

Firms receive their configured starting staff. Candidates are chosen from unemployed people in descending skill order. A person can have only one employer.

## Phase rules

### 1. Production

Each person receives a temporary scarcity-error flag with probability:

`stress² × 0.24`

An employed person misses work with probability:

`0.015 + stress × 0.10 + (1 − health) × 0.22 + hungryPenalty`

where `hungryPenalty` is 0.10 if the person has any hungry days. Missing work increases `missedWork`, reduces reliability by 0.018, and produces a life event. Attendance reduces the accumulated missed-work count by one.

For direct producers, each attending employee adds inventory according to:

`(0.42 + skill × 0.75) × firmProductivity × health × (1 − stress × 0.32)`

Morrow Fields applies this rule to farm produce and Makers Guild applies it to learning tools. Food retailers and the café do not create saleable stock during production; they acquire their input in the next phase. These multipliers and the one-input-unit-to-one-output-unit conversion are balance hypotheses, not empirical yields. Lower health, stress, absence, layoffs, and uneven access can still reduce available goods.

HomeWorks operates a fixed service and does not produce or consume housing inventory.

### 2. Supply and procurement

Morrow Fields has immediate-settlement supply contracts with Harvest Foods, Green Basket, and Common Café. Each buyer requests enough produce to restore two configured days of target stock, up to its daily contract quantity. Delivery is limited to whole units by the farm's inventory and the buyer's available cash.

The buyer pays at the contract unit price at delivery; no accounts payable, debt, or partial cash claim is created. Delivered farm inventory becomes the buyer's saleable inventory one for one. Both firms receive before/after ledger entries, the supplier records contract sales, and the buyer records input costs. An under-delivery records the requested and delivered quantities on the buyer. Contracts currently have fixed counterparties, quantities, prices, and output mappings.

### 3. Payroll

The applicable wage is the greater of the policy minimum wage and the firm’s configured wage.

If a firm cannot cover all attending workers at that wage, a payroll ratio scales gross pay. Individual gross pay is further adjusted by reliability:

`wage × payrollRatio × (0.75 + reliability × 0.25)`

The firm transfers net wage to the person and employer tax to the treasury. If the payroll ratio is below 0.65, the firm gains trouble and the worker receives a payroll-failure event.

An owner who is also an attending employee makes an explicit wage choice. When firm cash is below its next-day operating need and the owner personally has at least ten days of runway, the owner waives that day's wage to preserve cash for other workers and inputs. An owner below that personal runway still draws pay for attended work. A waiver produces life events for the owner and firm; resuming or drawing a wage remains visible through firm state and the ordinary wage ledger. The owner is excluded from the payroll denominator when waiving, so the choice can improve coworkers' payroll coverage.

Workers who missed production receive no wage in that payroll phase.

### 4. Food shopping

Food firms with inventory are sorted by price. A person normally buys one unit from the cheapest affordable seller.

A citizen has a deterministic reserve target of one, two, or three meals. When their reserve is empty, they attempt to buy enough portions to reach that target in one transaction, limited by cash and seller inventory. They eat one portion immediately and store the remainder. On later days they consume the oldest stored portion without visiting a seller, which reduces synchronized daily shopping demand.

Stored food loses 0.12 quality per day between purchase and consumption, to a minimum quality of 0.20. Health recovery is based on effective quality at consumption, not quality at purchase. The citizen profile reports the most recent meal's effective quality and age plus the number of stored meals.

A scarcity error can cause either:

- choosing the more expensive affordable food seller, or
- delaying food despite available cash when stress exceeds 0.62 and runway is below five days; this additional delay has a 0.32 probability.

A shopper tries another affordable food firm when the preferred seller lacks transaction capacity. Consuming a meal reduces `hungryDays` by one and restores health by its effective quality multiplied by 0.006. Harvest Foods is cheaper and has fresh quality 0.55; Green Basket is dearer and has fresh quality 0.85. These values are gameplay hypotheses, not calibrated nutritional measures. Failure to buy or consume food adds one hungry day and reduces health by 0.045.

### 5. Housing and bills

HomeWorks is the only current housing provider.

- A housed person owes one rent of 6.0 every seven days, beginning on day 1 and recurring on days 8, 15, and so on.
- An unhoused person may attempt rehousing on any day and needs three rents, 18.0, to secure housing again. This represents a deposit plus rent.
- Both are exact payments; insufficient cash causes no transfer.
- A payable housing transaction can still fail when HomeWorks has exhausted its attending workers’ transaction capacity.
- A housed person who misses three rents is evicted once; eviction clears the missed-rent counter because post-eviction debt is not modeled.
- A successful rent resets arrears to zero.

A housed person under scarcity pressure may defer rent despite being able to pay. This requires stress above 0.60, runway below five days, and a 0.38 random result after the scarcity-error flag has been set.

An unhoused person owes no recurring rent and does not accumulate arrears. Rehousing still requires the separate deposit-and-rent payment described above. The citizen summary shows whether rent is due today or how many days remain until the next billing day.

### 6. Personal time

The current focus is reassessed before choosing an activity. The discretionary-demand policy is the probability that an otherwise eligible optional purchase proceeds: 0% suppresses café and goods purchases, while 100% permits every eligible purchase. It does not affect food or housing.

- A highly stressed person experiencing a scarcity error may buy short-term comfort at the café. This immediately reduces stress by 0.035 but also lowers cash reserves. Employment and housing status do not block an affordable purchase: an unemployed or unhoused citizen with cash retains the same bounded agency, and the resulting life event names those circumstances.
- A person focused on belonging may buy a social visit if they retain more than seven cash after its price.
- A person focused on esteem or growth may buy learning tools if they retain more than ten cash after the price. This increases skill by 0.02 and growth by 0.04.

Social visitors are shuffled and paired. Contact refreshes the pair's contact date and increases an existing friendship's strength by 0.18, capped at 1. If they are not already friends and both have capacity, a mutual friendship begins at strength 0.60.

After five days without contact, friendship strength declines by 0.015 per day. A friendship below 0.20 ends symmetrically and both people receive a life event. Friendship strength affects belonging and the social-isolation component of stress; friendships do not yet transfer money, food, housing, care, or job referrals. These decay values are gameplay hypotheses selected to allow visible turnover without erasing the initial network immediately.

### 7. Settlement

#### Treasury support

The daily support budget is:

`treasury cash × supportRate × 0.18`

People are sorted by hunger, housing status, and then cash. A person qualifies when cash is below 12, they are hungry, or they are unhoused. Payments are capped at 5 per person and stop when the budget or treasury is exhausted.

#### Firm settlement

Each non-housing firm updates its smoothed realized daily net income, where the current day's input purchases are deducted from consumer and contract sales:

`previous income × 0.72 + realized income × 0.28`

Housing receipts are divided by seven to produce a daily-equivalent income sample. HomeWorks updates its smoothed income only when it receives revenue, so its income does not decay merely because no housed citizen owes rent between bills.

Income-supported staff is the bounded floor of smoothed income divided by 108% of the configured wage. Active firms retain a minimum of one worker, or two for housing. A firm approves at most one additional position per settlement when income supports it, the firm holds at least six wages in cash, and it remains below maximum staff.

Vacancies must persist for two settlement phases before recruitment. Candidates are ranked by skill and reliability and must accept the offered wage relative to a skill-based reservation wage. Transaction capacity still limits how many customers attending staff can serve, but transaction count does not determine whether a firm is financially successful.

The Employment card reports positions available as approved vacancies across active firms: the sum of `targetStaff − current employees`, bounded at zero for each firm. Because `targetStaff` reflects smoothed income, payroll coverage, cash reserves, and current staffing, a layoff or closure does not automatically create an available position. Vacancies must still persist for two settlement phases before recruitment, and a candidate may decline or fail to accept the offered wage.

The map visualizes this employment state without changing it. Living employees gather around their employer. Unemployed citizens are distributed deterministically among firms with approved vacancies to depict job applications; when there are no approved vacancies, they mill slowly inside the central Common Park. The display does not affect candidate ranking, vacancy age, acceptance, hiring, housing, or any need.

Overstaffing or sustained cash trouble can produce layoffs after three settlement phases. This staffing response is separate from the solvency test.

The next-day operating need is the configured wage for at least one worker, or all current workers when there are more, plus the full daily value of active input contracts. Cash below that need adds one distress day and moves the firm to `distressed`; recovery above the need resets the counter and returns it to `operating`.

Before formal distress assessment, a living owner considers personal equity financing whenever company cash is below one next-day operating need. Ten days of personal essential-cost runway is protected. The owner contributes only when cash above that reserve can close the immediate gap and the firm's smoothed net income divided by operating need meets the owner's stable 0.60–0.84 recovery threshold; vital firms receive a 0.15 reduction to that threshold. A contribution aims to leave the firm with two operating needs, limited by available owner cash. It is a permanent equity contribution with no automatic repayment, and both ledgers record it.

If the owner cannot or does not find recovery attractive, the choice is initially recorded as waiting. Once the firm already has two distress days, the owner chooses voluntary insolvency rather than further personal funding. This preserves all remaining personal cash while using the normal insolvency consequences for the firm, employees, and supply contracts. A vital firm voluntarily closed this way does not proceed to the later treasury-rescue assessment.

After three consecutive distress days, an eligible vital firm may receive its only treasury rescue. The target is three next-day operating needs, but the transfer is capped at 90 and by the treasury's actual cash. The transfer is recorded on both ledgers and conserves total money. A sufficient rescue moves the firm to `rescued` and resets distress; it returns to ordinary operating status after subsequently covering its need. Rescue does not guarantee survival.

After six consecutive distress days, a firm becomes `insolvent`. All employees lose their jobs, staffing targets become zero, and every supply contract involving the firm terminates. Non-vital firms receive no rescue; a vital firm that has already received one cannot receive another. The current rule is administrative closure, not legal bankruptcy: there are no creditor classes, asset sales, claims, liquidation distributions, or reorganization.

At the current shock setting, a firm has `shockRisk / 100 × 0.025` probability of transferring a random 12–34 cash to the treasury and gaining trouble.

Owner dividends are choices made only after the solvency assessment. The firm first retains the greater of 210 cash or four complete next-day operating needs. No dividend is allowed when the owner is dead, the firm is inactive or non-operating, an approved vacancy is being funded, or a treasury rescue occurred within the previous 14 days.

An owner below three personal runway days first considers an emergency distribution even when company cash is below the ordinary four-day/210 dividend buffer. The amount is limited to what raises the owner toward five runway days and must leave the firm with one complete next-day operating need. It remains blocked by non-operating status, approved expansion, and a treasury rescue in the previous 14 days. Because it reduces company protection to one day, it can contribute to later distress or insolvency.

Otherwise, the living owner's personal runway determines the share of ordinary surplus selected: 55% below five days, 35% from five to below 15 days, and the owner's stable 15–31% preference when more secure. Every dividend or emergency distribution is recorded on both firm and owner ledgers. The firm pipeline card shows the latest wage, capital, continuation/insolvency, and distribution choices with their days, amounts, and reasons. These thresholds are behavioral hypotheses designed to produce distinct retention, investment, failure, and extraction choices, not claims about observed owner behavior.

#### Health and stress

Stress is updated twice during settlement. If stress exceeds 0.55, health declines by:

`0.002 + (stress − 0.55) × 0.018`

and reliability declines by 0.002. Otherwise, a housed and fed person below 0.92 health recovers by 0.0035.

An additional health setback occurs with probability:

`0.006 + stress × 0.018 + (1 − health) × 0.008`

The setback reduces health by a random 0.04–0.13. Settlement health is bounded between 0.08 and 1. A person who remains at the 0.08 critical floor for three consecutive settlement phases dies. Recovery above the floor resets the critical-health counter.

Death is a terminal, recorded life event. The person leaves employment, their reciprocal friendships are removed, and their cash estate transfers to the treasury. They no longer work, receive wages or support, buy food or services, pay rent, socialize, recover, enter hiring pools, or receive owner dividends. Their profile switches to historical wording, hides active needs, and retains the completed ledger and life history without adding later entries. The Citizens card reports living, dead, and total citizens; employment and hardship metrics count only living people. The canvas moves deceased citizens to a display-only cemetery and shows its interred count.

## Stress

### Financial runway

Essential daily cost is the cheapest active food price plus one-seventh of the active weekly housing price. Runway is current cash divided by that daily-equivalent cost. It is a liquidity measure, not a forecast of actual spending.

### Underlying pressure

Stress pressure is the bounded sum of:

| Source | Maximum contribution |
|---|---:|
| Runway below 12 days | 0.42 |
| Unemployment or firm trouble | 0.16 |
| Any hunger | 0.18 |
| Being unhoused | 0.17 |
| Isolation or stale social contact | 0.07 |

Runway pressure falls linearly to zero at twelve days. Firm risk is maximal when unemployed and rises with employer trouble. Social pressure is maximal without friends. With friends, it combines the quality gap of the strongest friendship with contact staleness, which begins rising after three days without contact and reaches its maximum ten days later.

Each update moves stress 30% toward underlying pressure, retains 70% of existing stress, and adds random noise from −0.0125 to +0.0125.

What currently reduces stress is therefore adequate runway, stable employment, food, housing, recent social contact, and the café’s immediate comfort effect. Health recovery does not directly reduce stress.

## Maslow-inspired needs

Needs are scores from zero to one. The hierarchy is inspired by Maslow but is not a clinical or validated implementation.

- **Physiological:** 52% health and 48% fed status.
- **Safety:** housing, employment, employer stability, and up to twelve days of runway.
- **Belonging:** a baseline, capacity-weighted total friendship strength, and recent contact.
- **Esteem:** a common baseline, skill, employment, ownership, and a randomized personal esteem baseline from 0.05 to 0.17.
- **Growth:** the person’s accumulated growth state.

The person focuses on the first of physiological, safety, belonging, or esteem below 0.75. If all four are at least 0.75, they focus on growth only when stress is below 0.45; otherwise they return to safety.

## Policy controls

| Control | Default | Implemented effect |
|---|---:|---|
| Minimum wage | 5 | Floors the wage used in payroll and staffing decisions |
| Employer tax | 12% | Moves part of gross payroll from firms to the treasury |
| Support budget | 35% | Scales the treasury’s daily support budget |
| Discretionary demand | 50% | Probability that an eligible optional café or goods purchase proceeds |
| Economic shocks | 20% | Scales firm-to-treasury shock probability |

Changing a control affects future phases; it does not rewind or recompute past state.

## Randomness and replay

`src/random.js` supplies a seeded Mulberry32-style pseudorandom generator. The default seed is `20260823`. Two simulations with the same seed, policies, and sequence of method calls should produce the same state.

Rendering animation uses no simulation randomness, but it does mutate display positions. Workplace, application, Common Park, and cemetery destinations have no effect on economic rules.
