# Simulation model

This document describes the implementation in `src/simulation.js`. It is descriptive, not a claim that the rules are empirically correct.

## Time

The simulation has a deterministic civil calendar independent of wall-clock time. Day 1 is Monday of week 1, day 7 is Sunday, and day 8 is Monday of week 2. Each day has four civil-time blocks and eight processing phases. `step()` executes the current phase and advances to the next.

| Processing phase | Civil-time block |
|---|---|
| Planning | Morning |
| Production | Workday |
| Procurement | Workday |
| Payroll | Workday |
| Food | Evening |
| Housing | Evening |
| Personal time | Evening |
| Settlement | Overnight |

Planning is a deterministic start-of-day boundary. It expires perishable batches, opens any already-approved pending firm whose configured morning has arrived, and projects the day's firm openings and rota coverage without consuming seeded randomness merely to advance the clock. The day counter increments during settlement, so a full day requires eight calls to `step()`. Reset starts at week 1, Monday morning, Planning. Extinction remains terminal.

Transactions, life events, policy decisions, learning records, and firm-effect histories store the civil-time block, canonical processing phase, phase index, and an entity-local sequence alongside the day. Week and weekday are derived from the day instead of being duplicated in every record. Histories use day, phase order, and sequence for deterministic ordering and display timestamps such as `W2 Tue · Evening · Food`.

### Firm calendars and worker rotas

The browser enables schedules. Headless callers can disable them for calendar-only compatibility runs. Configuration fixes the opening weekdays and public-service window:

| Firms | Opening weekdays | Public/service window |
|---|---|---|
| HomeWorks, Makers Guild, Morrow School, Morrow Materials, Morrow Builders | Monday–Friday | Evening for housing; Workday otherwise |
| Harvest Foods, Green Basket, Morrow Apothecary, Morrow Haulage, Morrow Fields | Monday–Saturday | Evening for grocers and apothecary; Workday otherwise |
| Common Café | Wednesday–Sunday | Evening |
| Morrow Clinic | Every day | Workday |

Each employment spell receives an immutable five-weekday rota bounded by its firm's openings. Assignment chooses the least-covered opening days, then uses weekday and citizen identity as deterministic tie-breakers. Existing rotas never move when another worker joins. A dismissal, death, or closure removes that worker's coverage; rehiring creates a newly sequenced rota.

Only scheduled workers receive a shift option in their Workday plan. An unscheduled day creates no absence, reliability loss, wage, or workplace learning. One completed scheduled shift establishes staffed capacity for that firm's later same-day operations and service. The scheduled-shift base wage is `max(configured wage, policy minimum) × 7 / 5`; five fully completed shifts therefore preserve seven daily-equivalent base wages before ordinary reliability, payroll-ratio, tax, owner-waiver, and cent-rounding effects. Staffing and solvency use weekly-equivalent payroll per open day, while an investment reserve holds six full scheduled-shift wages.

Configured productivity and per-worker service, processing, and haulage capacities originated as seven-day daily values. Schedule-enabled completed shifts therefore also contribute `7 / 5` of those values. Five shifts preserve seven compatibility-day worker contributions over a week; the multiplier is a migration equivalence, not a claim about shorter-week productivity.

Income-supported staffing cannot fall below the headcount needed to place at least one five-shift rota across every configured opening weekday. This floor is two workers for a six- or seven-day firm and retains the existing two-worker housing floor; it preserves opening coverage without guaranteeing attendance, solvency, stock, or service.

### Citizen activity budgets

When schedules are enabled, Morning Planning gives every living citizen exactly one planned Workday primary. A scheduled shift competes in the same legal set as an available clinic appointment, an available school lesson, daytime rest, and self-study. The motivation policy scores the currently legal set from physical strain, security, runway, reliability, mastery, planning, and the citizen's stable weights. The chosen plan and every alternative are recorded in the ordinary decision history.

Production first resolves scheduled attendance from those plans. Choosing clinic, school, rest, or study instead of a scheduled shift consumes the Workday, creates an explicit missed-shift event naming the chosen activity, reduces reliability, and earns no wage. An unscheduled person choosing the same activity is not absent. Workplace learning and production then use only attending workers, after which planned care, education, rest, and study resolve once. A service that became unavailable still consumes the planned block and records whether closure, stock, staffed capacity, or exact affordability prevented completion. Daytime and Evening rest or study use the same bounded effects but remain separate temporally identified decisions.

Job applications are a brief Morning action and do not consume the Workday primary. Food, medicine, rent, and other essential payments are brief Evening actions; one separate personal-time primary remains available in that block. This is an activity-budget abstraction, not a literal duration model.

### Sleep and overnight activity

The browser enables sleep; headless callers can disable it independently for compatibility comparisons. Each living citizen begins with zero `sleepDebt`, bounded to `[0,1]`. Settlement resolves an Overnight primary before health, stress, critical-health, and mortality consequences. Each night first adds `0.25` debt. Sleep then repays `0.30 × sleepQuality`, where:

`sleepQuality = clamp(1 − (unhoused ? 0.35 : 0) − (hungry ? 0.15 : 0) − 0.25 × stress, 0.2, 1)`

Sleep is always legal. Late self-study is also legal only when the citizen is not hungry, health is at least 40%, pre-accrual sleep debt is below 60%, and current focus is esteem or growth. It applies the existing bounded self-study skill and growth gains but repays no debt. `motivation-v3` chooses when both actions are legal; the neural observation schema and personal-time activation gate do not control sleep.

Current sleep debt subtracts up to `0.30` from physiological need, contributes up to `0.14` to stress pressure, and removes up to `0.006` health per settlement day. It also appears in attendance and Workday-planning observations, but sleep itself never changes reliability; only an actual missed scheduled shift applies that penalty. Evening rest retains its ordinary stress and health effects and does not repay debt.

Every night records action, quality inputs, debt before accrual, debt after accrual, final debt, temporal identity, local sequence, and the versioned rule in newest-first sleep history. Ordinary successful sleep creates no life event. Late study and sleep poor enough to leave debt above the prior night do create concise events. Reset clears debt, quality, and history.

A closed firm retains its cash, inventory, contracts, and obligations but performs no production, procurement, delivery, public transaction, scheduled shift, payroll, workplace learning, or ordinary firm settlement. A blocked contract records the closed limiting firm and next shared opening rather than misclassifying closure as missing stock, staffing, or affordability. Latent-firm observations and formation occur only on that archetype's open days.

Recurrence bases are explicit. Perishable ageing, health, welfare, relationships, mortality, receivership, essential re-entry, and housing deterioration use calendar days. Demand and staffing evidence, vacancy maturity, recruitment, pricing evidence, distress, financing, distributions, and ordinary solvency advance only on firm open days. Worker evaluation advances by scheduled shifts. Rent remains due Monday evening, and owner price review occurs Sunday night. Maintenance wear advances only on an open day with attended capacity or a completed transaction or delivery.

Policy sliders commit on release, and neural personal-time control changes immediately. Every value change records the current day and phase, setting, and before/after value in a complete newest-first run history. Repeating the current value creates no duplicate. Reset begins a fresh history while retaining the currently selected policy configuration and controller mode as the new run's starting state.

## Entities

### People

There are 40 named people. Each person carries:

- Lifecycle foundation: an immutable citizen ID, one of `infant`, `child`, `student`, or `adult`, an optional birth day and calendar age, explicit dependent status, parent and guardian references, a residential guardian reference, a restricted-inheritance balance, and lifecycle history. The initial 40 citizens are adults with no modeled birth day or general adult ageing. The lifecycle gate is disabled while the remaining tracer slices are introduced, so this state alone changes no adult choices.
- Economic state: cash, employer, current job application, seller references, food reserve, housing status, rent arrears, and transaction ledger
- Capacity and mortality: skill, versioned general and canonical vocational knowledge, complete learning history, reliability, stable employment-spell rota, scheduled and attended shift counts, missed work, health, living status, critical-health duration, and death day
- Sleep: bounded debt, most recent sleep quality, complete newest-first sleep history, and current primary activity
- Psychology: stress, current scarcity error, Maslow-inspired needs, and current focus
- Motivation: seven stable, seed-derived weights for comfort, connection, mastery, security, food quality, planning, and avoidance plus a complete in-memory policy-decision history
- Social state: symmetric relationships with strength and last-contact state, social capacity, and last social contact day
- Personal differences: randomized starting values, a persistent esteem baseline, a stable 15–31% comfortable-owner dividend preference, and a stable 0.60–0.84 minimum recovery ratio for personal firm funding
- Narrative state: recent life events
- Display state: home and current map positions

Starting cash is uniformly sampled from 18 to 80. Starting health ranges from 0.58 to 0.94; stress ranges from 0.12 to 0.37. These are design values, not calibrated distributions.

Calendar-age stage boundaries are fixed gameplay hypotheses: infant from day 0 through 27, child from day 28 through 83, student from day 84 through 167, and adult from day 168. Existing adults keep `null` birth day and age because this tracer does not introduce general adult ageing. Citizen IDs remain append-only array references; the next available ID begins after the initial population. Planning updates born citizens from calendar age before partnerships and the same day's job market.

### Romantic partnerships

The browser enables lifecycle behavior; headless callers retain a disabled compatibility default. On Monday Planning, existing partnerships resolve before new proposals. A partnership is distinct from friendship, adds no pooled cash or household, and is legal only between two living adults with reciprocal friendship strength of at least `0.75`. Each citizen may have at most one active partner. Parent/descendant pairs, full or half siblings, and current or former guardian/dependent pairs are excluded.

Either partner may choose separation through `motivation-v3`; death and friendship strength below `0.20` also end the partnership. Ordinary separation preserves friendship and starts a 28-calendar-day re-partnering cooldown. A partner's death adds no new survivor cooldown. Separation scoring uses friendship strength and contact staleness, while proposal and acceptance scoring use closeness, material security, stress, and the stable connection, planning, security, and avoidance weights. Ties retain the current partnership, remain single, or decline.

Unpartnered eligible adults snapshot their legal close friends and may propose to one. Recipients snapshot the resulting proposals and may accept at most one. Formations apply afterward in immutable-ID order and revalidate exclusivity and every eligibility rule. A declined proposal does not alter friendship. Formation and ending produce paired structured lifecycle records; proposals, responses, and separation choices remain in the ordinary decision history. No partnership automatically causes a birth, shared residence, shared pantry, shared wallet, or inheritance in this slice.

### Birth attempts, gestation, and newborn identity

The birth tracer has a separate activation gate and remains disabled in the browser until every dependent lifecycle stage is operational. When explicitly enabled, every active partnership receives a Monday opportunity if neither partner has an active gestation and at least 84 days have passed since their last shared birth. Material hardship affects motivation rather than legality. Both adults independently choose through `motivation-v3`; ties wait. The care-capacity hypothesis combines shared material security, mean health, town housing availability, current food-sector reliability, and current dependent load.

Dual consent increments the pair's stable attempt sequence and applies a 25% conception chance from an isolated stream keyed by town seed, ordered parent IDs, and attempt sequence. It never consumes the main simulation random stream. Failed attempts create no gestation and may recur on later Mondays. A successful attempt creates one pair-owned gestation due after 28 calendar days. Separation does not cancel it and an active gestation blocks either participant from re-partnering. One surviving prospective guardian can complete it; if both die, it ends without a citizen.

Completion appends a citizen with the next immutable ID and a reproducible name selected from a fixed gender-neutral pool using an isolated seed-and-ID stream. Duplicate names receive deterministic ordinals. The newborn begins as an infant with zero cash and restricted inheritance, health `0.75`, stress and hunger zero, general skill `0.05`, zero vocational knowledge, reliability `0.75`, no work or adult relationship roles, no pantry stock, immutable parent references, and all living parents as guardians. A housed guardian is the initial residential reference without consuming another dwelling. Birth creates no cash, inventory, dwelling, firm, position, or job. Its first event and lifecycle record identify the birth, while both parents receive linked lifecycle records.

Dependents are excluded from employment, applications, autonomous purchases, adult care and education choices, mutual aid, firm founding, housing occupancy, and romantic relationships. Workforce and employment rates use living adults, while population totals include dependents and expose a dependency ratio. The town continues when only dependents remain. Guardian-managed residence, food, sleep, medicine, clinical care, schooling, stage progression, and age-based maturation are active when births are explicitly enabled. The browser birth gate remains off pending the lifecycle activation check rather than an unfinished dependent-care rule.

### Dependent residence and food care

Every living dependent retains immutable parents but only living adult citizen guardians. Planning removes a dead guardian, preserves that ID in `formerGuardianIds`, and chooses the lowest-ID housed guardian as the residential guardian, falling back to the lowest-ID living guardian. The dependent shares that guardian's housing state and home coordinates without occupying or renting another dwelling. With no citizen guardian, the dependent becomes unhoused under explicit treasury guardianship. Separation never changes guardianship.

Each dependent requires one indivisible meal per day and enters the same deterministic food-access order as adults: longer hunger, lower health, then the rotating immutable-ID tie-break. Existing dependent pantry stock is consumed oldest first. Otherwise the residential guardian decides first and each co-guardian is tried in ID order if the earlier guardian defers or cannot complete care. A guardian may transfer any owned unexpired meal, including their last meal, or choose one available seller. The dependent's restricted inheritance pays first, then the one named guardian's cash, then the finite exact Food Assistance shortfall. Cash is never pooled or split across co-guardians. With no citizen guardian, the treasury may provide the same finite everyday-food purchase directly; stock, opening, staffing, capacity, price, and welfare-envelope constraints still bind. An undelivered purchase moves no cash or food.

Care-weighted runway divides guardian cash by the guardian's own daily essentials plus one cheapest-meal cost for each sole dependent and half that cost for each dependent shared with another living guardian. It affects care motivation only; it neither pools money nor reserves food. `motivation-v3` compares deferral, concrete pantry transfers, and one-portion purchases. Dependent hunger and health, guardian hunger and health, care scarcity, connection, food quality, planning, security, avoidance, price pressure, spoilage, reserve coverage, and seller capacity contribute to the scores. Ties defer. A completed transfer or purchase moves the exact meal into the dependent's pantry before ordinary consumption records quality, provenance, hunger relief, and health recovery. Failure adds one hungry day and removes `0.045` health; three settlement days at critical health remain fatal.

Dependents sleep automatically every night when sleep simulation is enabled. They use the ordinary housing-, hunger-, and stress-sensitive sleep quality, accrue `0.25` debt, repay `0.30 × quality`, receive the ordinary bounded sleep-debt health consequence, and retain the same sleep history. Late study is never legal and the automatic sleep record does not consume the citizen-policy random stream.

When a dependent falls below the ordinary medicine or clinical threshold, the residential guardian decides first and living co-guardians follow after a deferral. The decision compares deferral, an available evening medicine dose, and an available Workday clinic appointment using dependent health and hunger, care scarcity, provider capacity, exact price pressure, and any scheduled guardian wage at risk. Restricted inheritance pays first, the deciding guardian pays next, and finite Child Health Assistance may exact-pay the remainder. The dependent cannot separately refuse care already chosen by a citizen guardian. With no living citizen guardian, treasury guardianship plans a clinic for severe need and otherwise medicine; the same finite assistance and provider constraints apply.

Medicine consumes no Workday. A chosen clinic visit replaces both a citizen guardian's and the dependent's Workday activity, including when stock, capacity, or funding disappears before service, and a scheduled guardian consequently earns no wage. Under treasury guardianship only the dependent's Workday is consumed. Delivered care uses the ordinary bounded medicine or clinic recovery and records provider, payer legs, before/after balances, motivation or treasury plan, activity, welfare, and failure evidence. An incomplete exact price moves no cash or stock.

Children and students seek a Morrow School lesson on each open weekday Workday. Guardian funding and dependent attendance are separate `motivation-v3` choices. Restricted inheritance pays first, one funding guardian may pay only from cash above three days of their own essentials and allocated dependent meals, and finite Child Education Assistance may exact-pay the remaining shortfall. Only a delivered lesson moves cash or stock. A voluntary miss records the scheduled outcome and wastes its reserved teaching slot without revenue or learning.

Dependent lessons share the school's attended-teacher transaction capacity with adult courses. Planning reserves that capacity using only teachers who have chosen their scheduled shift. Scarce reservations rank dependents by most missed outcomes among their latest five scheduled lessons, then students before children, then the existing week-rotating immutable-ID tie-break; adult courses receive only capacity left afterward. A child lesson moves general skill toward one by `0.004 × (1 − before)`. A student lesson applies `0.006 × (1 − before)` to general skill and `0.003 × (1 − before)` to one stable canonical vocational domain selected at student entry from funded vacancies, planning, mastery, and isolated deterministic affinity. Age, not attendance or a credential, controls maturation.

### Stage progression and maturation

Planning derives every born citizen's whole calendar age from the current day and immutable birth day. Crossing 28, 84, or 168 days creates a structured stage-change record. At day 168, the citizen becomes an adult before that Monday's partnership and scheduled job-market work. Adult employment, applications, autonomous purchases, housing, friendship capacity, and romantic eligibility activate without a cash, skill, reliability, or credential bonus.

Maturation ends guardianship, preserves every guardian as a former guardian, and releases the citizen's remaining restricted inheritance into their ordinary cash without changing total town money. If the former residential guardian remains alive and housed, the new adult shares that residence for 28 days without occupying another dwelling or owing rent. A housed former co-guardian is the deterministic fallback. Host death, host housing loss, or the day-28 boundary ends the transition immediately and makes the new adult unhoused. Transition residence never adds housing occupancy or rent. During the grace period the new adult may use the ordinary housing choice to exact-pay a deposit and first rent; successful delivery ends the transition early and adds one independent dwelling occupant.

#### Trade-knowledge tracer

Every citizen has a `knowledge-v2` profile bounded to `[0,1]`. `general` begins equal to the existing scalar skill and remains a migration mirror rather than a vocational domain. The canonical transferable vocational domains are `retailOperations`, `inventoryHandling`, `propertyOperations`, `fabrication`, `foodService`, `compounding`, `teaching`, `clinicalCare`, `construction`, `logistics`, and `agriculture`. Generic skill retains all of its existing cross-sector effects. The citizen panel always shows General, shows only nonzero vocational domains in canonical order, and states “No vocational knowledge yet” when appropriate.

Every archetype declares its domains, presentation labels, weights, workplace rates, operational effect, 15% ceiling, and versioned rules. Harvest Foods and Green Basket use retail operations and inventory handling at 50% each. HomeWorks uses property operations; Makers Guild and Morrow Materials use fabrication; Common Café uses food service; Morrow Apothecary uses compounding; Morrow School uses teaching; Morrow Clinic uses clinical care; Morrow Builders uses construction; Morrow Haulage uses logistics; and Morrow Fields uses agriculture.

Only a living worker who attends an active relevant workplace learns. Grocery preserves its existing rates: `0.004 × (1 − before)` for retail operations and `0.002 × (1 − before)` for inventory handling. Every new domain uses `0.003 × (1 − before)`. Values round to six decimals. Absence, death, unemployment, unrelated work, and inactive firms create no update. Every applied update records civil time, workplace identity, domain, source, before/after values, and rule. Personal knowledge survives employer changes and firm closure.

`knowledge-v1` migration preserves general, retail, and inventory values, maps the latter two to their canonical fields, initializes all other vocational domains to zero, is idempotent for v2, and rejects unsupported versions. Morrow School's finite paid retail-operations course remains behaviorally unchanged: generic skill gains `0.01` up to `0.95`, general mirrors it, retail operations gains `0.04 × (1 − before)`, and inventory handling gains `0.01 × (1 − before)`. No other formal course exists. All domains, rates, weights, and effects are gameplay hypotheses, not credentials or measured competence.

### Firms

Twelve firm archetypes are configured in `src/config.js`. The interactive town starts with the five-firm essential foundation—Harvest Foods, HomeWorks, Makers Guild, Morrow Haulage, and Morrow Fields—while Common Café, Green Basket, Morrow Apothecary, Morrow School, Morrow Materials, Morrow Clinic, and Morrow Builders begin as latent opportunities. Historical diagnostics can disable transport and explicitly restrict the formation set so earlier comparisons retain their scenario.

An archetype defines a repeatable kind of business, product pipeline, prices, staffing assumptions, and map location. A runtime firm is a distinct instance with its own numeric entity ID, stable archetype-and-sequence identity such as `cafe:1`, founding day, founder, cash, workers, contracts, and history. Closed instances remain in the town record rather than being rewritten as a new business.

The product catalog gives every traded thing a stable identifier, label, and unit; each archetype declares the product it sells, its input when it has one, its source, and how its output is obtained.

| Firm | Sells | Made or supplied by | Starting retail/contract price | Base wage | Starting staff |
|---|---|---|---:|---:|---:|
| Harvest Foods | Everyday food | Morrow Fields produce, handled by retail staff | 2.15 | 6.2 | 3 |
| Green Basket | High-quality food | Higher-grade Morrow Fields produce, selected by retail staff | 2.55 | 6.5 | 2 |
| HomeWorks | Weekly housing service | Existing dwelling service operated by its staff | 6.0 weekly | 7.2 | 4 |
| Makers Guild | Tools and repair kits | Made directly by guild workers | 6.0 | 7.8 | 3 |
| Common Café | Prepared café service | Morrow Fields produce, prepared by café staff | 2.2 | 6.4 | 2 |
| Morrow Apothecary | Self-care medicine | Morrow Fields produce, compounded by apothecary staff | 3.6 | 6.8 | 2 |
| Morrow School | Worker education | Finite lessons provided directly by teachers | 4.5 | 7.0 | 2 |
| Morrow Materials | Construction bundles | Makers Guild kits, assembled by yard workers | 16.0 | 7.4 | 2 |
| Morrow Clinic | Clinical treatment | Morrow Apothecary medicine, used by clinical staff | 7.5 | 8.0 | 2 |
| Morrow Builders | Building projects | Morrow Materials bundles, used by construction workers | 28.0 | 8.0 | 2 |
| Morrow Haulage | Freight delivery | Physical goods carried by transport workers | 0.45 per unit | 5.0 | 2 |
| Morrow Fields | Farm produce | Grown directly by farm workers | 1.10–1.65 wholesale | 5.8 | 7 |

Each operating starting instance begins with 150 cash. Firms track employees, saleable output inventory, explicit construction input inventory where applicable, consumer and contract sales, input costs, smoothed net income, vacancies, staffing targets, trouble, distress duration, rescue history, and lifecycle status. Produce, budget food, premium food, and café output are held as dated perishable batches while the public scalar total remains their reconciled quantity. Construction processors additionally retain today's scalar processing capacity, processed units, and labor-limited input shortfall. The first five people are assigned as owners in the interactive minimal start, one per starting firm; ownership and employment are separate concepts. Harvest Foods, HomeWorks, Morrow Haulage, and Morrow Fields are marked vital because they provide the lowest-priced food, the only housing service, freight needed by physical supply, and the sole agricultural input respectively. Five active contracts connect agriculture to essential food and Makers Guild maintenance to the food shop, housing provider, carrier, and farm from day one.

#### Private café, premium-food, apothecary, school, materials, clinic, and builder formation

Endogenous private formation applies when the Common Café, Green Basket, Morrow Apothecary, Morrow School, Morrow Materials, Morrow Clinic, or Morrow Builders archetype is absent at initialization. An absent archetype remains off the map and appears in the firm panel as an opportunity rather than an operating firm.

Every settlement records the number of living people who could legally consider a café purchase before the discretionary-demand draw: a person focused on belonging with the price plus 7 cash reserved, or an acutely stressed person eligible for short-term comfort spending. The normal intervention reads the latest three observations and requires the complete window plus at least two individually viable days. Expected daily revenue is:

`mean potential customers × café price × discretionaryDemand × 0.50 capture rate`

The premium-food opportunity counts portions sought by living people with an empty pantry who can retain six days of current essentials after paying the premium price. Expected sales capture 50% of those eligible portions, bounded by the produce contract. A founder-only opening is permitted because one attending grocer can handle the initial transaction load; income-supported staffing can expand it later.

The apothecary opportunity counts living people below 68% health who can retain two days of current essentials after buying one 3.6 medicine dose. Expected sales capture 50% of eligible patients, bounded by six daily produce inputs. A founder-only opening is permitted because one attending apothecary worker can compound and serve the initial load; realized income can later support up to four staff. The health threshold, two-day reserve, price, capture rate, and one-input-to-one-dose conversion are gameplay hypotheses rather than medical or market calibration.

The school opportunity counts living people below 72% skill who can retain three days of current essentials after buying one 4.5 lesson. Expected daily lessons capture 50% of eligible students and are bounded by the founding teacher's five-transaction capacity. A founder-only opening can later expand to five income-supported teaching jobs. Lessons are direct production: attending teachers create finite service inventory during production rather than consuming a material input.

The materials opportunity observes one recurring daily construction bundle whenever HomeWorks is active. A founder-only yard is viable only when the expected 16 revenue covers its 7.4 wage, one 5 Makers Guild fabrication kit per bundle, daily-equivalent maintenance, and the shared 8% margin buffer. One attending yard worker at full readiness can convert one guild kit into one stocked construction bundle; delivered kits otherwise remain explicit input stock. The yard can expand from one to four income-supported jobs. Its downstream contract becomes active when a builder forms.

The clinic opportunity counts living people below 38% health who could retain one current essential-cost day after a 7.5 appointment. Expected treatment captures 50% of those patients, bounded by four daily medicine inputs. Formation also requires an operating Morrow Apothecary. One founding clinician can serve four appointments and later expand to five income-supported jobs. The health threshold, reserve, price, one-dose-to-one-appointment conversion, recovery, and capacity are uncalibrated gameplay hypotheses.

The builder opportunity observes one project per day while HomeWorks is at or within two dwellings of full occupancy, or when a periodic repair is due. Formation requires an operating Morrow Materials. One attending founding builder at full readiness can turn one 16 material bundle into a stocked 28 project for HomeWorks; delivered bundles otherwise remain explicit input stock, while ordinary Makers Guild maintenance remains a separate input. Realized project income can later support up to five jobs. Demand can disappear after capacity expands, so construction insolvency remains possible.

Formation requires at least two viable days in the latest complete three-day window. Revenue must cover the minimum staffing route, demand-scaled produce, and daily-equivalent maintenance inputs with an 8% margin buffer. It also requires every configured supplier to be active, enough unemployed living workers, and an unemployed founder who is not already an active owner. The founder must hold the exact 40 startup capital above six days of current food-and-housing essentials. These periods, capture rate, buffer, capital, and minimum-staff rules are gameplay hypotheses rather than calibrated entrepreneurship behavior.

The headless `employmentInterventionEnabled` option controls this formation rule and investment hiring together. It defaults to enabled. Disabling it preserves the prior seven-observation formation gate and ten-day founder reserve for paired diagnosis; it is not a browser policy control.

The qualifying founder is selected deterministically by recovery preference, cash, then citizen ID. The 40 transfer is exact and creates the firm's only opening cash: the new instance starts with zero inventory and obtains configured inputs and maintenance through newly created contracts. The firm hires its configured formation staff: two people for a café and the founder alone for a premium grocer, apothecary, school, materials yard, clinic, or builder. Founder and firm retain the observation, legal alternatives, `entrepreneur-v1` decision, funding ledgers, and life events. The same seed and state therefore reproduce the founder and opening day without consuming simulation randomness.

When a café, premium grocer, apothecary, school, materials yard, clinic, or builder closes, its instance, owner, ledger, decisions, events, cash, and inactive contracts remain historical. Its opportunity window resets and a 21-day confidence cooldown begins. During the cooldown the panel continues to show current demand, supplier, worker, founder, revenue, and cost evidence, but formation is not legal. After the cooldown, two viable days in a complete latest-three window can create a new sequential instance such as `cafe:2`.

A replacement cannot reuse any prior owner of that archetype. It receives no cash, stock, contracts, or history from the failed business: a different qualifying founder transfers the same exact protected capital, workers are hired from current unemployment, and new contracts are appended against active suppliers. The old and new instances remain separately selectable in the firm panel; when a replacement is operating, the town map shows the current building rather than drawing overlapping historical landmarks. The 21-day confidence period and permanent exclusion of prior owners are gameplay hypotheses rather than calibrated re-entry behavior.

This private replacement path is distinct from essential-sector recovery. Essential housing, haulage, agricultural, and everyday-food operations reuse their configured instance through treasury-funded receivership or public re-entry; those events do not create an entrepreneur decision or a new private instance. Haulage re-entry applies only when physical transport is enabled.

#### Descriptive town stage

The interface summarizes current conditions as Collapsed, Subsistence, Stability, Convenience, Affluence, or Complexity. This is a pure, reversible projection calculated for display and snapshots; no production, opportunity, formation, pricing, staffing, or citizen decision reads it.

The projection exposes the current evidence rather than treating stage as stored progress:

- essential reliability averages the active operational readiness of agriculture, everyday food, housing, and maintenance;
- employment is the employed share of living citizens;
- household reserves are the share of living citizens holding at least ten current essential-cost days;
- discretionary demand is the current policy setting;
- sector persistence counts optional firms operating for at least seven days and reports the oldest optional age;
- active archetypes count distinct currently operating sectors.

Fewer than half of essential services operating reliably, or extinction, is Collapsed. Otherwise the town remains at Subsistence until essential reliability reaches 90%, employment 45%, and reserves 35%. A persistent optional sector plus at least 40% discretionary demand describes Convenience. Two optional sectors plus 65% employment and reserves describes Affluence. Six active archetypes, both optional sectors persistent, and an optional age of 30 days describes Complexity. Any lost condition moves the description backward immediately. These thresholds are gameplay summaries, not economic-development research or an unlock tree.

The current prices target internal cash-flow plausibility rather than a real currency. At default tax and a representative reliability of 0.8, the lowest configured wage produces about 4.85 net per attended day. Cheapest food plus one-seventh of weekly rent costs about 3.01 per day, so that representative worker earns roughly 1.61 times daily-equivalent essentials before optional purchases. Missed work, unemployment, payroll trouble, and seller capacity can still break that balance.

### Transaction capacity

An active firm can complete a limited number of transactions each day. The general rule is:

`attending workers × configured transactions per worker`

Transaction and appointment firms add a configured knowledge contribution after same-day learning. For each attending worker it is `scalar per-worker capacity × weighted vocational knowledge × 0.15`, including the same readiness and schedule multipliers as the scalar baseline. Per-worker rounded contributions are summed into an instance-local accumulator. Whole units become extra capacity that day; unused whole units expire, while only the fractional remainder below one persists. Harvest Foods and Green Basket use the 50/50 weighted retail mean; every single-domain service uses that domain directly. Zero relevant knowledge exactly preserves scalar capacity.

The same per-worker formula applies to processing throughput and haulage load capacity. Extra processing can be used only when input stock exists; extra haulage points can be used only by a funded physical delivery. Direct producers instead add `actual scalar worker output × weighted vocational knowledge × 0.15` continuously, after skill, health, stress, readiness, and schedule effects; fractional output is not accumulated or rounded away. Accrual runs once per production day and ordinary capacity reads are pure. A structured firm record is retained for every positive gross day with scalar baseline, gross contribution, released units, carry before/after, actual used amount, effect type, and rule. Knowledge cannot itself create demand, cash, inputs, jobs, legal actions, or completed constrained work.

Only a customer who can cover the exact price and reaches an active firm with the required inventory, where applicable, creates an attempted transaction. A transaction beyond the firm's daily capacity is recorded as turned away, moves no cash or inventory, and creates a life event for that customer. Transaction counts measure workload and congestion only. Completed transactions consume inventory and produce realized income; turned-away transactions do neither. Daily transaction counters reset during settlement.

### Treasury

The town treasury begins with 120 cash. It receives employer taxes, estate duty, heirless estate remainders, and shock transfers, then pays Food Assistance, Rent Assistance, Emergency Cash Relief, eligible one-time vital-business rescues, housing-receivership restarts, and essential-sector re-entry. These programmes spend ordinary treasury cash; there is no separate welfare fund.

## Money and accounting

The current economy contains only the cash held by people, firms, and the treasury.

`transfer(from, to, requested)` moves no more than the sender possesses. With `{ exact: true }`, it moves nothing unless the sender can cover the complete requested amount. Food, goods, services, rent, and rehousing deposits use exact transfers.

Money is rounded to cents when transferred. After every phase, `assertInvariants()` verifies that:

- Every cash balance is finite and non-negative.
- Total current cash differs from initial cash by no more than 0.1.

Individual ledger records store the day, per-person activity sequence, direction, amount, purpose, and cash balance before and after. Life events, lifecycle records, accepted mutual-aid gifts, and structured welfare evidence carry the same temporal identity so the interface can combine them into one newest-first activity stream. Firm streams also merge structured knowledge-effect and provider-side welfare records. The stream defaults to all activity and can be filtered to transactions, life events, lifecycle, mutual aid, welfare, or knowledge effects where applicable. Lifecycle rows retain their structured event type and the empty filtered state reads `No lifecycle activity yet.` Mutual-aid rows link giver and recipient and show original seller, current quality and age, and pantry before/after. The model retains the complete history for the current in-memory run; the interface renders all matching entries inside a scrollable region and preserves the reader's position while new activity arrives.

The citizen selector updates as births append citizens and labels every option by current lifecycle stage or death day. A dependent profile replaces adult work, runway, rent, and romantic wording with age and next transition, parents, guardians, residential guardian, housing, food and health care, restricted inheritance, latest school funding and attendance, recent missed lessons, selected study domain, and learning progress. An adult profile adds partner, children, current dependents, active gestation, and any re-partnering cooldown. A deceased profile itemizes the cash estate, duty, inherited amount, and total treasury receipt rather than describing the whole estate as a treasury transfer.

On the canvas, living adults remain filled circles while dependents use hollow living-colour rings sized by infant, child, or student stage. Hardship retains the danger colour and selection adds a separate outer ring. The legend names Adult, Dependent, and Deceased, and the canvas accessible label names the selected citizen and their current stage or death day.

Firms and the treasury use the same sequenced ledger and event shape. One selected-firm dossier itemizes the chosen firm's output, production or sourcing method, upstream producer, cash, inventory, staffing evidence, smoothed net income, vital status, rescue history, and current lifecycle state. It also shows configured knowledge domains, weights and rules, presentation-only workforce averages, and today's scalar, gross, released, carry, and used effect values. Its dropdown retains closed historical instances and stays synchronized with map selection. Construction processors additionally show awaiting input stock, stocked output, scalar processing capacity, units processed today, and labor-limited shortfall; their activity history records processed quantities and whether absence or exhausted capacity retained inputs. Supply buyers also show today's requested and delivered contract quantities. The dossier exposes complete combined transaction, lifecycle-event, and knowledge-effect history with retained filtering and scrolling.

Settlement marks every person in the same death cohort before distributing any estate, so members of that cohort cannot inherit from one another. A cash estate combines ordinary cash and any restricted inheritance. The treasury first receives a universal 10% estate duty rounded down to whole cents. The active romantic partner at the instant of death and every living biological child are eligible heirs. A partner with children receives half of the post-duty estate rounded down to cents; the children divide the remainder. A sole partner receives all of the remainder, children without a partner divide all of it, and the treasury receives an heirless remainder. Child shares use whole cents and allocate leftover cents by ascending immutable citizen ID.

Adult heirs receive ordinary cash. Dependent heirs receive restricted inheritance that can fund only their own delivered food, medicine, clinical care, and schooling before guardian or treasury funds; it becomes ordinary cash at adulthood and rejoins the dependent's estate if they die earlier. Every duty and inheritance leg has linked transaction IDs and before/after evidence for the deceased, treasury, and heir. Every cent leaves the deceased estate exactly once without changing total cash. This remains a deliberately compressed cash-only intestacy rule: there are no wills, probate delay, creditors, debts, non-cash assets, trusts, discretionary bequests, thresholds, or empirically claimed tax calibration.

## Initial social and employment network

The model attempts 52 random friendship links. A link is mutual, begins at strength 0.60, cannot duplicate an existing link, and cannot exceed either person's social capacity. Because rejected attempts are not retried, the final number may be lower than 52.

Firms receive their configured starting staff. Candidates are chosen from unemployed people in descending skill order. A person can have only one employer.

## Phase rules

### 1. Production

Each person receives a temporary scarcity-error flag with probability:

`stress² × 0.24`

For every living employee of an active firm, the simulation exposes exactly two legal actions to the citizen policy: attend the shift or miss it. The observation includes the employer, health, stress, hunger duration, current cash runway, reliability, previous missed work, the baseline miss chance, a seeded daily draw, and the citizen's stable motivation profile.

The baseline miss chance remains:

`0.015 + stress × 0.10 + (1 − health) × 0.22 + hungryPenalty`

where `hungryPenalty` is 0.10 if the person has any hungry days. This is now evidence for `motivation-v3`, not a direct random branch. Security, mastery, reliability, and low runway increase the relative attendance score. Avoidance, stress, poor health, hunger, and a seeded draw below the baseline increase the relative missed-shift score. The policy can therefore produce both attendance and absence from the same legal boundary while remaining reproducible. Each decision and its alternatives are retained in the citizen's decision history.

Missing work increases `missedWork`, reduces reliability by 0.018, and produces a life event. Attendance reduces the accumulated missed-work count by one. Only an attended shift can contribute production or earn wages.

For direct producers, each attending employee adds inventory according to:

`(0.42 + skill × 0.75) × firmProductivity × health × (1 − stress × 0.32)`

Morrow Fields applies this rule to farm produce, Makers Guild applies it to tools and repair kits, and teachers apply it to finite lesson capacity. Their configured agriculture, fabrication, or teaching knowledge can add at most 15% of each worker's resulting scalar output. Food retailers, the café, apothecary, materials yard, and builder do not create saleable stock during production. The construction firms acquire explicit inputs and labor-gate their conversion in the next phase. These multipliers and one-input-unit-to-one-output-unit conversions are balance hypotheses, not empirical yields. Lower health, stress, absence, layoffs, uneven access, and missed maintenance can still reduce available goods and services.

HomeWorks operates the town's finite dwelling capacity rather than producing saleable housing inventory.

### 2. Supply and procurement

In the interactive transport model, every non-maintenance contract for a physical product requires Morrow Haulage. Generic operating-kit deliveries are exempt as same-site or self-carried maintenance, and the builder-to-HomeWorks construction project is an on-site service rather than freight. Historical and focused tests may set `transportEnabled: false`; that documented migration mode preserves the earlier immediate local self-delivery boundary and does not instantiate the carrier.

A transport worker supplies 45 load-capacity points per attended compatibility day. Schedule-enabled transport uses a 60-point attended-shift basis before maintenance readiness and the ordinary `7 / 5` migration multiplier, so one fully ready shift supplies 84 points. Logistics knowledge contributes at most 15% of that same ready scalar basis through the whole-unit accumulator. Each delivered unit costs `ceil(product load × (1 + 2 × straight-line map distance))` capacity points. Produce has load 1, tools 1.5, medicine 0.5, and construction materials 4. Contracts contend for capacity in stable configured order, so a distant or heavy delivery can be partially filled or delayed while the supplier retains the undelivered stock. These coordinates, load weights, capacity, and priority order are deterministic gameplay hypotheses, not a road or vehicle model.

Title, goods payment, and the carrier fee move only when delivery succeeds. The old delivered contract price is split at migration: the supplier share is the current contract price less the carrier's configured starting rate, while Morrow Haulage charges its current rate. Initial buyer cost is therefore unchanged; later carrier price decisions can raise or lower delivered cost and affordability independently. Before mutation, the buyer must afford both complete shares. The exact supplier and carrier transfers then settle in the same operation, the supplier loses stock, and the buyer gains the configured output. Separate buyer, supplier, and carrier ledgers expose both payments. No carrier, no attending capacity, insufficient cash, or carrier insolvency leaves goods and cash with their current owners and records the shortfall. Haulage income supports staffing through the ordinary realized-income rule. Morrow Haulage is vital and may receive the existing bounded one-time rescue. If it later fails while physical transport is enabled, it follows the same 14-day, 90-cash, two-worker public re-entry gate as other missing essential sectors. Until those finite conditions are met, its failure stalls every hauled pipeline.

Morrow Fields has immediate-settlement supply contracts with Harvest Foods, Green Basket, and Common Café. Harvest Foods targets two meals per living citizen and requests at most one meal per living citizen each day, bounded by its 40-unit contract maximum. Its initial 40-meal stock and three workers' combined 42-transaction capacity cover the initial population once when everyone attends; they do not guarantee delivery or service. If schedule-enabled Harvest Foods is absent and Green Basket is operating, the remaining grocer temporarily uses the same population-scaled two-day target and may request up to that complete target instead of its ordinary 14-unit ceiling. This continuity rule does not change its price, quality, cash constraint, staffed service capacity, or perishable decay. The essential contract costs Harvest Foods 1.45 per meal delivered: at the configured starting freight price Morrow Fields receives 1.00 and Morrow Haulage receives 0.45. The 2.15 retail price leaves the grocer 0.70 before payroll and maintenance. At full 40-unit flow those three margins can support roughly six farm jobs, two haulage jobs, and four retail jobs under the ordinary realized-income staffing rule. Other buyers restore two configured days of target stock up to their daily contract quantity. Every delivery remains limited to whole units by farm inventory, buyer cash, and staffed haulage. Morrow Haulage starts with two workers and 90 compatibility-mode load points when both attend. Absence, maintenance, insolvency, weak farm output, cash pressure, and configured contract contention can still create shortages. These prices, population targets, and starting capacities are balance hypotheses, not nutrition or logistics calibration.

Makers Guild has immediate-settlement maintenance contracts with every other starting firm. Each buyer holds one operating kit separately from saleable inventory. Every three days it consumes a kit; procurement then replenishes toward one kit when stock and buyer cash permit. Missing a maintenance cycle reduces direct production and transaction capacity to 65% until a later kit is consumed. This makes locally produced tools an input to agriculture, retail, housing, and café operations while citizen learning-tool purchases remain a secondary market. Compatibility-mode contracts retain the historical price of 5; schedule-enabled starting and subsequently formed contracts use 8 so scheduled guild wages can be supported by recurring maintenance demand. The three-day interval, one-kit target, prices, and 65% constrained capacity are balance hypotheses.

When Morrow Materials forms, a separate Makers Guild fabrication contract can deliver one 5 kit into the yard's explicit input stock. The yard converts whole units one-for-one into stocked construction bundles, bounded each day by:

`floor(attending workers × 1 unit per worker × operational readiness)`

Morrow Builders applies the same scalar rule: a delivered 16 bundle remains explicit input until attending builders convert it one-for-one into a stocked project. Fabrication knowledge at Morrow Materials and construction knowledge at Morrow Builders can add at most 15% through their separate whole-unit accumulators. No attendance or input produces no output; partial readiness floors scalar capacity; unused released units expire; and every unprocessed input remains owned by the receiving firm. Processing moves no cash. The one-unit worker rates, learning rates, ceiling, and readiness multiplier are gameplay hypotheses rather than calibrated construction productivity.

A second exact contract sells a stocked 28 project to HomeWorks only when an expansion or repair is currently required. Procurement orders dependent contracts topologically, independent of their storage or presentation order. A kit delivered after workers have attended can therefore become a material bundle, then a builder input and completed project, then settle with HomeWorks in the same phase. Each delivery still requires available stocked output, and every successful transfer retains exact counterpart and carrier ledgers.

When Morrow Clinic forms, Morrow Apothecary can deliver up to four medicine doses per day at its current supplier-linked price. Each dose becomes one stocked clinical appointment. The clinic also needs the ordinary maintenance contract. Apothecary shortage, clinic cash, maintenance, attending clinicians, appointment inventory, and transaction capacity can all prevent care.

The buyer pays the current supplier share and, where required, the current carrier fee at delivery; no accounts payable, debt, or partial cash claim is created. Delivered farm inventory becomes the buyer's saleable inventory one for one. Firms receive before/after ledger entries, suppliers record contract sales, carriers record freight sales, and buyers record both input costs. An under-delivery records the requested and delivered quantities on the buyer. Contracts have fixed counterparties, quantities, and output mappings. Their prices move proportionally with the supplier owner's bounded price decision, while the carrier controls its own bounded fee.

### 3. Payroll

The applicable wage is the greater of the policy minimum wage and the firm’s configured wage.

If a firm cannot cover all attending workers at that wage, a payroll ratio scales gross pay. Individual gross pay is further adjusted by reliability:

`wage × payrollRatio × (0.75 + reliability × 0.25)`

The firm transfers net wage to the person and employer tax to the treasury. If the payroll ratio is below 0.65, the firm gains trouble and the worker receives a payroll-failure event.

An owner who is also an attending employee receives two legal policy actions: draw or waive that day's owner wage. `motivation-v3` scores personal safety and extraction against company continuity and worker protection using the owner's stable profile, personal runway, and the firm's next operating need. The simulation validates the choice and retains it on both the owner and firm. A waiver produces life events for the owner and firm; the owner is excluded from the payroll denominator, so the choice can improve coworkers' payroll coverage.

Workers who missed production receive no wage in that payroll phase.

### Perishable inventory

Produce, budget food, and premium food have a three-calendar-day shelf life. A batch made on day 1 is usable at ages 0, 1, and 2 and expires in day 4 Planning when its age reaches 3. Prepared café service expires at the next morning Planning phase. Medicine and non-food goods remain non-perishable.

Each batch stores its product, quantity, production or processing day, quality basis, shelf life, owner, and local sequence. Purchased meals additionally receive stable item identity and a custody trail. Morning Planning expires firm and citizen stock before any action. Every discard records the actor, product, quantity, batch day, age, reason, and full temporal identity in the actor's waste history. Spoilage moves no cash and does not count as a sale, staffing failure, or demand failure.

Production, processing, sale, and consumption use the oldest viable batch first. Transforming produce into food or café output assigns a new processing day. Checkout preserves that processing day rather than refreshing shelf life. A purchased meal stores its effective quality at checkout and remaining life; later quality decay and expiry continue from processing. Firm presentation exposes dated age buckets, next expiry, today's processed and sold quantities, and cumulative waste. These shelf lives and decay rates are gameplay hypotheses, not food-safety guidance.

### 4. Food shopping

In `mutual-aid` mode, one batched exchange runs immediately before ordinary Evening food choices. Its immutable starting snapshot exposes one concrete offer per owned unexpired surplus meal and living reciprocal close friend (strength at least 0.75) whose pantry is below three meals. Removing the named meal must leave the giver's closure-aware reserve edible on its intended consumption days. `motivation-v3` alone chooses `keep-meals` or one offer, then each recipient compares all received offers against `refuse-all-meal-gifts` and may accept at most one. Ties favor keeping and refusal.

All giver choices finish before recipient choices, and all recipient choices finish before application. Application revalidates life, friendship, exact ownership, reserve, pantry room, and daily limits. Acceptance moves the same meal object and appends offer, time, giver, and recipient custody evidence; seller, processing and purchase dates, quality, shelf life, and expiry do not reset. No cash, supply, health, housing, knowledge, employment, debt, obligation, or relationship strength changes. A received meal can enter the ordinary food choice that evening, spoil normally, or be re-gifted only on a later day. The 0.75 threshold, three-meal capacity, reserve rule, and motivation coefficients are deterministic gameplay hypotheses rather than claims about real friendship or generosity.

The bounded inputs are scarcity `1 - runway / 12`, pantry fill `viable meals / 3`, recipient need `0.45 × hunger + 0.25 × empty pantry + 0.20 × scarcity + 0.10 × unhoused`, reserve headroom `viable meals after gift / protected reserve - 1`, spoilage pressure `age / shelf life`, and remaining-life fraction `(shelf life - age) / shelf life`. Giver scores are:

```text
keep  = 0.25 + security × (0.45 + scarcity × 0.45) + planning × (1 - headroom) × 0.25
offer = connection × (0.25 + friendship × 0.35 + need × 0.55)
      + planning × (headroom × 0.20 + spoilage × 0.20)
      - security × scarcity × 0.15 - avoidance × stress × 0.10
```

Recipient scores are `accept = 0.20 + need × 0.90 + foodQuality × mealQuality × 0.40 + friendship × 0.15 + planning × remainingLife × 0.15` and `refuse = 0.18 + avoidance × stress × 0.25 + planning × pantryFill × 0.45 + foodQuality × (1 - mealQuality) × 0.40`.

A citizen has a stable normal reserve target of one, two, or three meals. With schedules enabled, the temporary target is the larger of that normal target and the meals required before any active food seller next opens, capped at three; an insolvent sector with no known reopening never creates an unbounded target. The simulation can offer exact top-up purchases even when the pantry is nonempty, alongside its oldest viable stored meal. Purchase quantities remain bounded by the temporary target, exact affordability, seller inventory, FIFO batch quality and shelf life, and staffed capacity. Skipping food is always legal.

Harvest Foods' produce order normally remains bounded by one living-population day. Before a configured closure, that ceiling expands through its next opening, while the existing two-population stock target still caps the request. This allows Saturday procurement to cover Sunday without inventing inventory or guaranteeing that the farm, carrier, grocer, or buyers can complete the transactions.

Citizens reach the food phase in a deterministic vulnerability order: more hungry days first, then lower health. Otherwise-equal citizens use a day-rotating identifier tie-break so finite stock or staffed capacity does not always exclude the same late identifiers. This is an allocation heuristic, not a shop queue or public rationing system; scarcity, congestion, unaffordability, and motivation-driven avoidance remain possible. A failed attempted purchase now states that the seller lacked staffed capacity, while a citizen facing active food shops with no remaining inventory receives a distinct no-stock event.

`motivation-v3` scores only those legal actions. Buying or eating becomes more attractive with hunger and declining health. Food-quality preference rewards effective quality, planning rewards reaching the reserve target and consuming aging stock, security and low runway penalize cost, unavailable transaction capacity carries a large penalty, and avoidance under a scarcity error can make skipping an available meal win. Different profiles can therefore prefer cheaper food, higher-quality food, different quantities, old or fresh stored meals, or occasionally no meal. These weights are narrative hypotheses, not calibrated consumer behavior.

The simulation validates the choice, then performs the purchase through the existing exact `buy` path. A seller attempt remains legal when its current capacity is exhausted because being turned away is a possible outcome; the policy sees that status and penalizes it but may still choose the attempt. The transaction then fails normally and creates a turned-away event. A successful purchase is one transaction regardless of portions. The citizen eats one portion immediately and stores the remainder, reducing synchronized daily shopping demand.

When every active food seller is closed, a citizen receives one concise closure event with the next known opening rather than one failure per firm. Closed housing service likewise defers the transaction without creating arrears for a payment that could not be attempted.

Stored food loses 0.12 quality per day between processing and consumption, to a minimum quality of 0.20. Health recovery is based on effective quality at consumption, not quality at purchase. The citizen profile reports the most recent meal's effective quality and age plus the number of stored meals.

Consuming a meal reduces `hungryDays` by one and restores health by its effective quality multiplied by 0.006. Harvest Foods costs 2.15 and has fresh quality 0.55; Green Basket costs 2.55 and has fresh quality 0.85. Their owners can later set different bounded prices. These values are gameplay hypotheses, not calibrated nutritional measures. Failure to buy or consume food adds one hungry day and reduces health by 0.045. Every food choice retains its observation, legal options, scores, reason, and selected action in the citizen decision history.

### 5. Housing and bills

HomeWorks is the only current housing provider.

The interactive town begins with 40 occupied dwellings. Rehousing is legal only when occupancy is below capacity; an affordable citizen cannot rent a nonexistent dwelling. When vacancies fall to two or fewer, HomeWorks demands an expansion project. An exact builder project consumes one stocked construction bundle and adds two dwellings. Once more spare capacity exists, the next project is a repair after fourteen days rather than another expansion. If no repair completes within a further seven-day grace period, capacity falls by one dwelling per day and the least-resourced housed citizens are displaced until occupancy fits. Each project, capacity loss, and displacement is recorded. These quantities and deterministic displacement ranking are gameplay hypotheses.

- A housed person owes one rent of 6.0 every seven days, beginning on day 1 and recurring on days 8, 15, and so on.
- An unhoused person may attempt rehousing on any day and needs three rents, 18.0, to secure housing again. This represents a deposit plus rent.
- Both are exact payments. A payment option exists only when the citizen can cover the whole amount; insufficient cash leaves only deferral or remaining unhoused and causes no transfer.
- A payable housing transaction can still fail when HomeWorks has exhausted its attending workers’ transaction capacity.
- A housed person who misses three rents is evicted once; eviction clears the missed-rent counter because post-eviction debt is not modeled.
- A successful rent resets arrears to zero.

For rent day or a rehousing opportunity, the simulation creates deferral or remaining-unhoused plus any exactly affordable HomeWorks option, including its amount and current transaction-capacity status. `motivation-v3` weighs payment or rehousing through the security preference, existing arrears, stress, and housing state. Avoidance, stress, low runway, and a scarcity error can make deferral win even when payment is possible. The simulation validates the choice and alone performs the exact transfer, arrears update, eviction, or rehousing consequence. Every considered housing choice is retained in the citizen decision history.

An unhoused person owes no recurring rent and does not accumulate arrears. Rehousing still requires the separate deposit-and-rent payment described above. The citizen summary shows whether rent is due today or how many days remain until the next billing day.

When HomeWorks becomes insolvent, ordinary rent and rehousing transactions stop and it enters a seven-day receivership. Existing tenants remain housed during this grace period because operator failure does not make dwellings disappear. At the end of the grace period, a treasury holding at least 90 can make an exact restart transfer, appoint two available workers, reactivate viable supply contracts, and resume HomeWorks under a treasury-appointed operator. A replacement that later fails can be restarted again only after a longer 14-day cooldown and under the same cash-and-worker constraints. If a restart cannot be funded and staffed, 20% of the remaining living housed population, rounded up, loses managed housing per day. Each displacement and restart is recorded. Deceased citizens are ignored. The grace period, cooldown, restart cost, staffing level, and displacement rate are gameplay hypotheses rather than claims about bankruptcy or housing law.

### 6. Personal time

Before the discretionary personal-time action, a living person below 68% health receives a separate health-care choice. If an operating apothecary has medicine, the person can afford one exact dose, and staffed transaction capacity remains, the legal set contains `defer-treatment` and that apothecary purchase. `motivation-v3` weighs the health gap and expected 0.08 recovery against stress, avoidance, cash runway, and the 3.6 price. A successful purchase transfers cash to the apothecary, consumes one dose, records the seller and day, and raises health by 0.08 up to a 0.92 self-care ceiling. A missing, unaffordable, unstocked, or congested seller leaves only deferral. The choice and every legal alternative remain in the citizen decision history.

This is deliberately bounded self-care, not clinical treatment. It has no diagnosis, duration, contraindication, insurance, professional triage, or guaranteed survival. Hunger, later setbacks, low access, insolvency, and death remain possible.

A person below 38% health considers the stronger clinic path first. A clinic appointment is legal only when stocked, staffed capacity remains, and the person can pay 7.5 exactly while retaining one essential-cost day. The motivation policy weighs severe need, expected 0.18 recovery, security, planning, stress, avoidance, and cash runway. A successful appointment raises health by 0.18 up to 0.96 and records the clinic, day, transaction, and life event. It suppresses a second self-care purchase in the same phase. Treatment remains bounded and cannot guarantee survival or prevent later hunger and setbacks.

A living person below 72% skill also receives a separate education choice when an operating school has lesson inventory. Purchasing is legal only when the person can pay 4.5 exactly and retain three current essential-cost days. `motivation-v3` weighs mastery, planning, the skill gap, safety, stress, avoidance, and runway. A lesson consumes one finite teaching slot, raises generic skill by 0.01 up to 0.95, raises growth by 0.015, and applies the retail-operations knowledge changes described above. Generic skill still changes reservation wages and employer ranking under the existing scalar rules. Vocational domains affect only their configured first-order firm operation; they do not affect hiring or course eligibility. A course never creates or guarantees a vacancy, application, offer, or job.

The current focus is reassessed before choosing an activity. The discretionary-demand policy determines whether optional purchases enter the legal-action set: 0% leaves only a free contextual activity, while 100% allows every otherwise eligible café or goods action to be considered. It does not affect food or housing.

Each citizen has stable comfort, connection, mastery, security, food-quality, planning, and avoidance weights between 0.70 and 1.30. They are generated from an isolated combination of the town seed and citizen ID, so they do not consume or disturb the main simulation random sequence. The values are hypotheses for producing heterogeneous stories, not measured personality traits.

The simulation constructs the currently legal personal-time actions from living status, focus, affordability, inventory, seller transaction capacity, and the discretionary-demand result. The schema-stable `do-nothing` action is always legal, but its recorded meaning and consequence are now contextual: rest, free park social time, or self-study. This retains compatibility with the gated neural action schema while removing the inert outcome. `motivation-v3` scores only the legal set:

- Free personal time rises with the security weight and a runway shortfall below twelve days.
- Short-term comfort rises with the comfort weight and stress.
- A social visit rises with the connection weight and unmet belonging.
- Learning tools rise with the mastery weight and unmet esteem and growth.

The highest-scoring legal action is selected deterministically. `TownSimulation` validates it, performs any exact purchase, and applies consequences. The citizen retains the observation, legal alternatives, scores, chosen action, reasons, and policy version as a decision trace. The selected-citizen panel shows the stable weights and the complete newest-first decision history.

Free time uses the current need assessment and stable motivation profile without spending or creating cash. Esteem or growth focus produces self-study, increasing skill by 0.003 and growth by 0.006. The Common Park is a legal public social context for every living citizen regardless of hunger, housing, employment, or café status when no scheduled primary conflicts; motivation may still choose rest or study. Park use itself supplies no food, housing, wages, or guaranteed contact.

Every default decision also passes through one shared, deterministic, schema-versioned neural network. The bundled weights were trained offline by reward-weighted imitation on 8,760 synthetic decisions from five fixed training seeds over 15 days. The network scores concrete legal alternatives plus synthetic illegal action kinds for mask diagnosis. The trace records its legal choice, probability-normalized legal scores, unmasked preference, any invalid pre-mask preference, legal mask, and weights/schema versions.

The browser starts with neural control disabled. A visible switch can enable it without resetting the town only because the matching artifact passed the versioned personal-time activation gate. When enabled, the neural choice controls the schema-v2 discretionary personal-time action only. Its unchanged observation slots read general plus canonical retail-operations and inventory-handling values; the migrated bundled artifact gives those inputs zero weight. The other nine vocational domains are deliberately absent, so the neural schema, artifact, and activation gate remain unchanged. `motivation-v3` still controls attendance, job search and offers, food, mutual-aid giver and recipient choices, housing, self-care, clinical care, education, and all owner decisions. Mutual aid never enters neural inference, shadowing, schemas, weights, or the activation gate. `TownSimulation` continues to generate and validate legal actions and apply consequences. Disabling the switch returns the next controlled decision to `motivation-v3` without changing town state. See [neural activation](./neural-activation.md) for the gate evidence and its limits.

The runtime does not add learned citizen embeddings or mutable online adaptation. Headless research found no held-out behavioral or outcome difference from the existing profile features, so [ADR 0002](./decisions/0002-retain-profile-only-personalization.md) retains profile-only personalization.

- A highly stressed person experiencing a scarcity error may buy short-term comfort at the café. This immediately reduces stress by 0.035 but also lowers cash reserves. Employment and housing status do not block an affordable purchase: an unemployed or unhoused citizen with cash retains the same bounded agency, and the resulting life event names those circumstances.
- A person focused on belonging may buy a social visit if they retain more than seven cash after its price.
- A person focused on esteem or growth may buy learning tools if they retain more than ten cash after the price. This increases skill by 0.02 and growth by 0.04.

Café and park visitors use the same deterministic friend-first matcher. Existing-friend edges sort by descending reciprocal strength and ascending citizen-ID pair; a greedy pass pairs available endpoints. The remaining attendees are seed-shuffled and paired as strangers. Contact refreshes the pair's date and increases an existing friendship by 0.18, capped at 1. If both strangers have capacity, a mutual friendship begins at 0.60. One renewed initial friendship therefore reaches 0.78 and crosses the close-friend threshold of 0.75.

After five days without contact, friendship strength declines by 0.015 per day. A friendship below 0.20 ends symmetrically and both people receive a life event. Friendship strength affects belonging, social stress, friend-first contact, and eligibility to offer a stored meal. Friends still do not transfer cash or housing, provide care, or guarantee aid or job referrals. These values are gameplay hypotheses selected to allow visible turnover without erasing the initial network immediately.

### 7. Settlement

#### Welfare programmes

The browser uses the combined welfare model. Headless tests and evaluators can explicitly select no welfare, legacy cash only, direct assistance only, or combined welfare. The Welfare budget control scales one daily spending ceiling:

`treasury cash × supportRate × 0.18`

The treasury cash value is snapshotted once on the day's first direct-assistance claim. This is ordinarily the start of Evening Food, after payroll and employer tax; a Workday Child Health Assistance claim can establish the snapshot earlier. The ceiling is not a reserved account and unused capacity does not roll over. Earlier delivered assistance leaves less for later programmes. Food Assistance and Child Health Assistance spend when their essential transaction is delivered, Rent Assistance follows in Housing, housing receivership and essential-sector re-entry then use ordinary treasury cash, Emergency Cash Relief uses the remaining ceiling and treasury cash, and eligible vital-business rescue remains later in firm settlement. A zero Welfare budget disables all four programmes.

Food Assistance is assessed only for a living citizen with no usable stored meal who cannot privately afford one complete cheapest everyday-food portion. The citizen contributes all available cash and the treasury may pay only the exact shortfall. Premium food and advance stockpiling are excluded. The ordinary seller price, lifecycle, opening, dated stock, attended staff, transaction capacity, quality, shelf life, delivery, and consumption rules remain binding. Scarce access sorts by hunger duration, health, cash runway, and a week-rotating citizen ID.

Rent Assistance is assessed only for a living, housed citizen facing the current Monday-evening rent who cannot pay its complete price. It cannot fund a new tenancy, rehousing deposit, historical debt, or an abstract arrears balance. Exact co-payment completes one ordinary housing transaction and resets current arrears; refusal or failed delivery retains ordinary rent consequences. Scarce access sorts by existing missed-rent count, cash runway, and weekly rotation.

Child Health Assistance covers only an actually planned dependent medicine dose or clinic appointment. Restricted inheritance contributes first and one deciding citizen guardian contributes next; under treasury guardianship the dependent's restricted balance is the only private leg. The programme pays only the exact remaining price and cannot bypass opening, inventory, attended staff, transaction capacity, or the shared Workday requirement. The guardian's care decision is the take-up decision, so the dependent does not receive a second welfare refusal choice.

All direct programmes use one atomic settlement. It validates the recipient, programme, purpose, provider, opening, resource, attendance, capacity, complete price, private cash, remaining ceiling, and treasury cash before moving anything. Every private contribution and treasury contribution then reaches the provider with the complete unit or rent payment. Any missing condition or cent moves no cash, inventory, service, or tenancy consequence. Provider sales equal the complete price.

Emergency Cash Relief remains an unrestricted fallback after direct programmes and structural recovery. A living adult below four days of current essential runway may receive at most 5, reduced dollar for dollar by treasury-funded direct aid received that day. Its amount is also bounded by the exact four-day shortfall, remaining welfare ceiling, and treasury cash. The citizen may later spend it on any otherwise legal action. Cash candidates sort by hunger, homelessness, runway, and weekly rotation.

Every eligible offer is an immediate `motivation-v3` accept/refuse choice. Security, planning, programme urgency, avoidance, and stress determine the documented scores; exact ties refuse. There is no application, waiting period, retained entitlement, random take-up, sanction, or neural control. Assessments, choices, failures, deliveries, contributions, balances, and linked transaction IDs are retained in citizen, provider, and treasury welfare histories. The Welfare ledger exposes today's ceiling and outcomes through one programme selector. All thresholds and weights are gameplay hypotheses, not descriptions of real eligibility or claimant behavior.

#### Firm settlement

Each non-housing firm updates its smoothed realized daily net income, where the current day's input purchases are deducted from consumer and contract sales:

`previous income × 0.72 + realized income × 0.28`

Housing receipts are divided by seven to produce a daily-equivalent income sample. HomeWorks updates its smoothed income only when it receives revenue, so its income does not decay merely because no housed citizen owes rent between bills.

#### Owner pricing

Each firm accumulates a seven-day pricing window containing units sold, revenue, input costs, affordability failures, and customers turned away by capacity. Every seventh settlement, a living owner chooses among the price movements that remain inside the configured bounds: hold, lower by at most 5%, or raise by at most 5%. The policy scores those legal alternatives using continuity, workers, growth, extraction, and the owner's profile. The observed signals shape those option features:

- at least two affordability failures and available inventory favor a price cut;
- at least two capacity turnaways favor a price increase;
- sales that fail to cover input costs favor an increase;
- available inventory with no sales favors a cut;
- otherwise the owner holds the price.

Prices remain between 70% and 140% of their configured starting value. When Morrow Fields or Makers Guild changes price, every outbound contract price moves by the same proportion from its configured starting price. The new price affects exact affordability, seller ordering, contract quantities, realized income, staffing, and solvency from subsequent phases onward. A firm card shows the current price and the latest decision, day, and reason; actual changes also create firm life events. These review periods, signals, step sizes, and bounds are gameplay hypotheses, not calibrated pricing behavior. Owners do not forecast competitor reactions or optimize a demand curve.

Income-supported staff is the bounded floor of smoothed income divided by 108% of the configured wage. Active firms retain a minimum of one worker, or two for housing. A firm approves at most one additional position per settlement when income supports it, the firm holds at least six wages in cash, and it remains below maximum staff.

The enabled employment intervention also permits one investment-funded headcount slot above the income-supported target. Eligibility reads only the latest three settlement records and requires staffing-limited demand on at least two days. Exact affordable consumer attempts rejected solely by attended transaction capacity qualify. Exact affordable contract or production shortfalls qualify only when the identified limiting actor lacks effective labor capacity. Missing stock, maintenance failure, buyer funding, unavailable upstream supply, and an unrelated or absent carrier do not qualify.

For each qualifying day, expected capture is 50% of attributed unserved units, capped by one worker's incremental capacity. Expected contribution uses the firm's current price less variable input and freight cost and must cover one wage with the existing 8% buffer. Approval additionally requires retained cash for six added wages plus the next operating need, including committed input and daily-equivalent maintenance. The protected amount cannot fund an owner distribution while the slot is active.

One stable slot identity is reused if an ended opportunity later reopens. A new approval keeps its vacancy available for a three-day recruitment commitment, unless funding failure, distress, insolvency, or closure explicitly withdraws it. A hire begins a seven-day planned evaluation; the firm cannot stack another investment slot during recruitment or evaluation. At the deadline, ordinary income-supported staffing and layoff rules resume. Applications, employer ranking, offer acceptance, attendance, payroll, and tenure remain motivation-driven rather than guaranteed.

Vacancies must persist for two settlement phases before recruitment. Once every active firm has approved its staffing target, each living unemployed citizen sees one legal application action per mature approved vacancy plus the option not to apply. `motivation-v3` scores only that common legal set. Low safety, short cash runway, the security weight, offered wage relative to the citizen's skill-based reservation wage, reliability, mastery, stress, avoidance, and firm trouble can change whether and where the citizen applies. The selected application is stored on the citizen and retained as a complete decision trace.

Each employer ranks only the people who actually applied to it, using the existing skill-plus-reliability ordering, and offers its vacancy to the highest-ranked applicant. The offer creates two legal actions, accept or decline. Acceptance scoring includes offered wage relative to `3.2 + skill × 4.5`, reliability, safety need, runway, stress, security and avoidance weights, plus the existing seeded acceptance evidence `0.5 + reliability × 0.35`. The simulation validates every chosen action and alone performs hiring. Declined offers remain visible in the decision history, while later settlement phases provide new application and recovery opportunities. The complete deterministic `rule-v2` policy remains available as the headless comparison baseline, but it is not the browser default.

Every job-search and offer decision retains its observation, legal alternatives, chosen action, policy identifier, scores, and reasons. Transaction capacity still limits how many customers attending staff can serve, but transaction count does not determine whether a firm is financially successful.

The Employment card reports positions available as approved vacancies across active firms: the sum of `targetStaff − current employees`, bounded at zero for each firm. Because `targetStaff` reflects smoothed income, payroll coverage, cash reserves, and current staffing, a layoff or closure does not automatically create an available position. Vacancies must still persist for two settlement phases before recruitment, and a candidate may decline or fail to accept the offered wage.

The map visualizes this employment state without changing it. Living employees gather around their employer. An unemployed citizen with a current domain application waits outside that employer; unemployed citizens who did not apply mill slowly inside the central Common Park. The renderer reads `jobApplicationFirm` but never creates an application or affects candidate ranking, vacancy age, acceptance, hiring, housing, or any need.

Overstaffing or sustained cash trouble can produce layoffs after three settlement phases. This staffing response is separate from the solvency test.

The next-day operating need is the configured wage for at least one worker, or all current workers when there are more, plus the input quantity the firm would actually procure next. Saleable or processable stock already on hand reduces that projected order toward the contract's stock target and daily ceiling; a stocked retailer is not treated as though it must buy the full contract quantity again. Periodic maintenance contracts contribute their daily-equivalent contract cost. Cash below that need adds one distress day and moves the firm to `distressed`; recovery above the need resets the counter and returns it to `operating`.

Before formal distress assessment, a living owner considers personal equity financing whenever company cash is below one next-day operating need. Ten days of personal essential-cost runway is protected. Contributing is a legal action only when cash above that reserve can close the immediate gap and the firm's smoothed net income divided by operating need meets the owner's stable 0.60–0.84 recovery threshold; vital firms receive a 0.15 reduction to that threshold. The exact bounded amount aims to leave the firm with two operating needs. Waiting is always legal, and voluntary insolvency becomes legal only after two distress days. The motivation policy weighs personal safety and avoidance against continuity, worker obligations, and credible growth; the simulation alone performs any exact contribution or closure.

Waiting preserves personal cash while distress develops. Voluntary insolvency preserves all remaining personal cash while using the normal insolvency consequences for the firm, employees, and supply contracts. A vital firm voluntarily closed this way does not proceed to the later treasury-rescue assessment.

After three consecutive distress days, an eligible vital firm may receive its only treasury rescue. The target is three next-day operating needs, but the transfer is capped at 90 and by the treasury's actual cash. The transfer is recorded on both ledgers and conserves total money. A sufficient rescue moves the firm to `rescued` and resets distress; it returns to ordinary operating status after subsequently covering its need. Rescue does not guarantee survival.

After six consecutive distress days, a firm becomes `insolvent`. All employees lose their jobs, staffing targets become zero, and every supply contract involving the firm terminates. Non-vital firms receive no rescue; a vital firm that has already received one cannot receive another. HomeWorks enters the housing receivership described above.

If an agriculture or food sector has no active firm for 14 days, the treasury may re-establish its configured vital firm as a public operator. A missing food sector enters an emergency one-day path once any living citizen is hungry; the ordinary 14-day wait still applies before that condition. Re-entry requires an exact 90 cash transfer and two living unemployed workers. Food retail additionally requires an active agriculture supplier. Viable contracts reactivate, and both sides of the funding transfer are recorded. Agriculture is considered before food when both are absent, so the initial 120 treasury cannot restore the whole chain at once. Re-entry can recur after later failure but is never guaranteed: insufficient cash, labour, time, or upstream supply leaves the sector closed. These values are recovery-path gameplay hypotheses, not a model of public enterprise or industrial policy.

The current rule is not legal bankruptcy: there are no creditor classes, asset sales, claims, liquidation distributions, or reorganization.

At the current shock setting, a firm has `shockRisk / 100 × 0.025` probability of transferring a random 12–34 cash to the treasury and gaining trouble.

Owner distributions are choices made only after the solvency assessment. Retaining cash is always legal for a living owner of an active firm. A distribution option exists only after the simulation enforces lifecycle state, the greater of 210 cash or four complete next-day operating needs, approved expansion, and the 14-day post-rescue restriction. The policy can choose only the exact amount offered by the simulation.

An owner below three personal runway days first considers an emergency distribution even when company cash is below the ordinary four-day/210 dividend buffer. The amount is limited to what raises the owner toward five runway days and must leave the firm with one complete next-day operating need. It remains blocked by non-operating status, approved expansion, and a treasury rescue in the previous 14 days. Because it reduces company protection to one day, it can contribute to later distress or insolvency.

Otherwise, personal runway determines the available ordinary-distribution amount: 55% of surplus below five days, 35% from five to below 15 days, and the owner's stable 15–31% preference when more secure. Motivation scoring can still prefer retention. Every paid distribution is recorded on both ledgers. The citizen motivation panel and selected-firm owner-decision stream show legal alternatives, scores, reasons, and evidence; the firm card summarizes the latest choices. These thresholds and scores are behavioral hypotheses, not claims about observed owner behavior.

#### Health and stress

Stress is updated twice during settlement. If stress exceeds 0.55, health declines by:

`0.002 + (stress − 0.55) × 0.018`

and reliability declines by 0.002. Otherwise, a housed and fed person below 0.92 health recovers by 0.0035.

An additional health setback occurs with probability:

`0.006 + stress × 0.018 + (1 − health) × 0.008`

The setback reduces health by a random 0.04–0.13. Settlement health is bounded between 0.08 and 1. A person who remains at the 0.08 critical floor for three consecutive settlement phases dies. Recovery above the floor resets the critical-health counter.

Death is a terminal, recorded life event. The person leaves employment, their reciprocal friendships are removed, and their cash estate pays duty before any eligible inheritance. They no longer work, receive wages or support, buy food or services, pay rent, socialize, recover, enter hiring pools, or receive owner dividends. Their profile switches to historical wording, hides active needs, and retains the completed ledger and life history without adding later entries. The Citizens card reports living, dead, and total citizens; employment and hardship metrics count only living people. The canvas moves deceased citizens to a display-only cemetery and shows its interred count.

When no living citizens remain, the town reaches a terminal extinction state. Further simulation steps return the unchanged snapshot without advancing the phase or day. Automatic playback pauses, playback and manual-step controls are disabled, and Reset remains available so the completed map, cemetery, firm records, estates, and citizen histories can still be reviewed.

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
| Welfare budget | 35% | Scales the shared daily ceiling for Food Assistance, Rent Assistance, and Emergency Cash Relief |
| Discretionary demand | 50% | Probability that an eligible optional café or goods purchase proceeds |
| Economic shocks | 20% | Scales firm-to-treasury shock probability |

Changing a control affects future phases; it does not rewind or recompute past state.

## Randomness and replay

`src/random.js` supplies a seeded Mulberry32-style pseudorandom generator. The default seed is `20260823`. Two simulations with the same seed, policies, and sequence of method calls should produce the same state.

Rendering animation uses no simulation randomness, but it does mutate display positions. Workplace, application, Common Park, and cemetery destinations have no effect on economic rules.
