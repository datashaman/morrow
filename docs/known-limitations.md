# Known limitations and open questions

These items distinguish intentional simplifications from completed realism. A future agent should not assume that an implemented rule has been calibrated merely because it has a precise number.

## Highest-priority gaps

### Relationship support remains narrow

Friendships gain strength through café contact and decay after periods without contact, but the model does not implement conflict, non-commercial contact, maintenance costs, or practical support. Friendship affects belonging and stress only; friends cannot yet share food or housing, lend money, provide care, or refer one another for work.

### Stress recovery is narrow

Stress falls through financial runway, stable employment, food, housing, friendship strength, recent contact, a small immediate comfort purchase, bounded free rest, and a coarse sleep-debt term. Apothecary and clinic purchases restore health rather than stress. There is no recovery from resolving arrears, subjective schedule predictability, time safely housed, autonomy model, or longer treatment course.

### No saved or shareable run

The seed is fixed in the browser and interactive runs still cannot be exported, imported, or bookmarked. Policies can now be compared reproducibly across configurable seeds through the headless evaluator, but there is no interactive side-by-side run viewer or saved report store.

## Economic simplifications

- Owners adjust prices through one bounded weekly heuristic. There is no inflation, bargaining, competitor forecasting, promotion, product differentiation, price discrimination, explicit demand curve, or wage competition. Food quality, productivity, wages, and health-recovery multipliers remain fixed and uncalibrated.
- Firms have fixed opening weekdays, public-service windows, deterministic five-shift rotas, and one-primary-per-block citizen activity budgets. Owners cannot alter hours and workers cannot negotiate schedules. Brief essential transactions coexist with one primary, but there are no modeled durations, travel time, split shifts, overtime, paid leave, sick leave, holidays, shift swaps, multiple jobs, commuting, childcare, or claims that the configured week is empirically correct.
- There is no banking, saving account, debt, credit, interest, insurance, or negative balance. Insolvency is an administrative cash-runway rule rather than a legal bankruptcy process.
- All money is inside one closed town. There is no external trade, remittance, investment, monetary creation, or destruction.
- A “shock” moves firm cash to the treasury. It behaves more like a fine or emergency levy than a destructive loss.
- Food retailers and the café now record expiry waste, but they, the apothecary, materials yard, and builder still use one-to-one abstract conversions with no recipe loss, grades, energy, equipment, storage cost, or processing delay. The materials yard and builder retain explicit input stock and require attending labor, but each attending worker has the same scalar one-unit capacity before maintenance readiness and no construction knowledge effect. One Makers Guild kit remains enough for one construction bundle, and one bundle remains enough for one project; this is traceable accounting, not a realistic bill of materials or calibrated productivity claim. Agriculture itself consumes no seed, land, water, fertilizer, energy, maintenance, or capital.
- Physical supply contracts now contend for paid staffed haulage using abstract map distance and product-load weights, but there are no vehicles, roads, fuel, depots, routes, travel time, queued consignments, damage, cold chains, driver occupations, or carrier choice. Maintenance and on-site construction service remain transport-exempt. Contract priority is fixed by configuration rather than urgency or bidding.
- Supply and haulage settle immediately and exactly in cash at fixed quantities; prices inherit the supplier's proportional owner adjustment. Perishable goods expire by fixed product shelf life, but there is no refrigeration, preservation, cold-chain effect, bilateral negotiation, alternate supplier, trade credit, invoice, debt, title document, insurance, or damages for under-delivery.
- Maintenance is one generic kit every three days for every firm other than Makers Guild. There are no distinct machines, tools, repair skills, depreciation curves, preventive schedules, breakdown types, or capital investment choices; the 65% capacity penalty is a gameplay hypothesis.
- Housing has a town-wide finite dwelling count, vacancy checks, exact expansion and repair projects, and deterministic deterioration when repairs remain overdue. It still has no individual buildings, dwelling quality, rent variation, location, land, permitting, project duration, alternate landlord, demolition choice, or household occupancy. Its receivership and repair rules use fixed grace periods, thresholds, and deterministic displacement rather than modeling property ownership, administrators, courts, lenders, tenant protections, or construction scheduling.
- Initially housed people receive housing without an initial payment or provider record.
- Every person consumes at most one food unit per day regardless of body, work, or household.
- Sleep uses one bounded debt scalar and a fixed quality penalty for homelessness, hunger, and stress. There are no sleep durations, chronotypes, insomnia, illness-specific disruption, housing quality, bedding, noise, safety, naps, recovery lag, dreams, or empirical claims about healthy sleep. Late study is the only sleep-sacrificing alternative.
- Citizens use stable one-to-three-meal normal reserve targets and a capped three-meal temporary target that looks only as far as the next configured active-seller opening. Motivation scoring sees current prices, quality, age, and transaction capacity but does not forecast insolvency, future rent, attendance, congestion, spoilage beyond visible shelf life, or income; there are no refrigeration or storage costs.
- Harvest Foods alone scales its two-day stock target and ordinary one-day procurement ceiling to the living population, up to a fixed 40-unit-per-coverage-day contract. Before its weekly closure the ceiling expands only through the next opening. This does not model measured consumption forecasts, safety stock beyond that closure, supplier lead time, seasonal demand, waste, or demographic nutrition needs.
- Daily access to finite food stock and retail capacity uses hunger, health, and a rotating identifier tie-break. There is no physical queue, arrival time, reservation, delivery, ration entitlement, household shopping, or priority chosen by a food retailer.
- Treasury support uses a four-day essential-runway means test, current vulnerability priority, and a daily budget, but has no eligibility history, application process, delay, fraud, stigma, administrative cost, household assessment, or empirical calibration.
- Vital-business classification is fixed in configuration. A vital firm can receive one cash rescue based only on next-day operating need; missing housing, agriculture, and food operators can later receive fixed-cost public re-entry funding when cash, workers, cooldown, and supply dependencies permit. There is no public-interest assessment, conditionality, political process, repayment, equity stake, creditor review, or performance monitoring.
- Owners are the first six people and can also be employees. Their wage, financing, continuation, bounded pricing, and distribution choices now use the shared inspectable motivation policy, but option features and scores remain uncalibrated gameplay hypotheses. Owners cannot set arbitrary salary, vary working hours, replace management, negotiate prices, lend to the firm, recover contributed equity, sell or transfer ownership, share ownership, or create formal distribution policies. Ownership is not inherited; a firm with a dead owner retains surplus.
- Owner equity has no shares, valuation, dilution, return calculation, repayment, tax treatment, documentation, or distinction between sole proprietorships and limited companies. Emergency distributions preserve one operating day but do not model directors' duties, creditor protection, fraudulent conveyance, clawbacks, or unlawful distributions.
- A deceased person's cash transfers immediately to the treasury as an intestate estate. There are no wills, heirs, probate delays, creditor claims, inheritance taxes, or non-cash estate assets.
- Insolvent firms do not liquidate inventory or other assets, distribute proceeds, or reorganize. Only configured essential housing, agriculture, and food operators can reopen under a treasury-appointed public operator; other firms do not gain a replacement owner or reopen.
- Essential-sector re-entry reuses the closed firm's inventory, product, and name, and uses fixed funding, staffing, cooldown, and upstream rules rather than modeling incorporation, capital procurement, licensing, management selection, capacity planning, or competing entrants.
- Endogenous private formation and replacement are limited to Common Café, Green Basket, Morrow Apothecary, Morrow School, Morrow Materials, Morrow Clinic, and Morrow Builders. Their two-viable-days-in-three opportunity window, capture assumptions, 8% margin buffer, 40 startup capital, protected six-day founder runway, deterministic founder ranking, 21-day post-failure cooldown, permanent exclusion of prior owners, and immediate staffing/contracts are gameplay hypotheses. The disabled employment control preserves the prior seven-day/ten-day rule only for paired diagnosis. Apothecary demand uses an uncalibrated 68% health threshold and two-day reserve; clinic demand uses 38% and one day; school demand uses a 72% skill threshold and three-day reserve; materials and builder demand use a simplified one-project cadence. Other archetypes cannot form privately, and there is no reputation, lender confidence, incorporation, acquisition, asset sale, or variable startup plan.
- The interactive minimal start assumes one operating firm in each essential production, food, housing, maintenance, and haulage role. It does not model how those initial institutions were founded. Historical diagnostics may disable transport and explicitly restrict which newer latent archetypes may form, so evaluation results must identify their starting composition and feature set before being compared.
- The reversible town-stage label compresses essential reliability, employment, ten-day reserves, discretionary demand, optional-sector persistence, and active archetypes into fixed thresholds. It is descriptive UI, not a validated development index, welfare measure, causal state, or firm unlock mechanism.

## Labour simplifications

- Each person can have at most one employer and either works the whole planned shift or spends that Workday primary on clinic, school, rest, or self-study.
- Each attending worker contributes a fixed sector-specific number of transactions regardless of health, transaction complexity, or coworker coordination. The everyday grocer alone has a bounded retail/inventory knowledge bonus as an explicit tracer; other sectors still ignore domain knowledge.
- There are no occupations, worked-hour durations, employment contracts, tenure, credentials, discrimination, commuting cost, care work, informal work, or self-employment.
- Candidate ranking uses skill and reliability. The richer social referral effect from an earlier version is not present.
- Workday planning is routed through the motivation policy using health, hunger, stress, runway, reliability, skill, service availability, and stable motivation weights. It remains an all-or-nothing primary with no partial capacity, paid leave, illness categories, transport, care obligations, or employer attendance policy. The older seeded attendance draw remains only in schedule-disabled compatibility runs.
- Job seeking is a brief Morning choice among mature approved vacancies, and each firm makes at most one offer to its highest-ranked applicant. Offered wage, reservation wage, reliability, safety, runway, stress, firm trouble, seeded acceptance evidence, and stable motivation weights affect the two decisions, but there are no applications in progress, interviews, credentials, occupations, benefits, commuting costs, discrimination, negotiation, competing offers, referrals, search costs, employer preferences beyond skill and reliability, or memory of earlier rejection.
- Investment hiring attributes only shortfalls the current transaction and contract model can identify. Its two-of-three window, 50% capture, one-worker cap, 8% contribution buffer, six-wage reserve, three-day recruitment commitment, and seven-day evaluation are uncalibrated design hypotheses. The gate does not forecast demand, price response, worker attendance, supplier recovery, or broader spillovers. A funded vacancy can still receive no applicant or accepted offer, and an evaluated worker can still miss work, be laid off, or lose the job through insolvency.
- The paired employment evaluator is a deterministic falsification harness, not evidence that employment alone causes mortality or that the intervention is realistic, fair, or sufficient. Its funded-job measure combines actual founder-funded formation jobs with investment slots that survive their evidence period, while excluding starting jobs. Its day-7, day-30, and day-60 distribution thresholds are gameplay hypotheses. It reports application, wage, support, hardship, business, and death trajectories so one aggregate cannot hide a broadly inactive or harmful mechanism.
- After dated spoilage was introduced, the employment evaluator's locked six-seed control baseline changed and the existing first-wage gate no longer passes, while its funded-opportunity and mortality gates still pass. The versioned schedule-disabled evaluator retains that failure rather than weakening its threshold. The separate schedule evaluator now exposes calendar, activity, sleep, access, work, food, population, and business deltas without imposing a directional gate.
- Housing employees constrain rent transactions but do not directly produce or repair dwellings; those physical changes are abstract builder projects.
- Missed shifts create events but no distinct wage-ledger entry because no money moves.
- Citizens now carry general, retail, and inventory knowledge, but only grocery workplace experience and the single retail-operations course update the vocational fields, and only grocery transaction capacity reads them. Generic skill still drives unrelated production, hiring, reservation wages, esteem, and education eligibility. Construction processing is labor-gated but deliberately uses zero vocational knowledge in its scalar baseline. Agriculture, construction knowledge and learning, health, teaching, transport, forgetting, task errors, and knowledge-based job matching remain unmodeled.
- The paired knowledge evaluator can falsify whether learning records, a gross grocery capacity contribution, and accumulated whole transaction slots occur in fixed seeded runs. The firm-level fractional carry is a discretization device, not a literal model of storing labor across days; unused whole slots still expire. The default evidence produces whole capacity without changing completed transactions because the grocer was not capacity-constrained. The evaluator does not calibrate learning rates or establish that any observed survival, employment, hunger, housing, or insolvency difference was beneficial or realistic.
- Education remains a repeatable paid lesson: the one available retail-operations course adds a fixed 0.01 generic skill plus bounded retail and inventory gains. There are not yet multiple subjects, credentials, prerequisites, course length, teaching quality, assessment, dropout, scholarships, public education, or proof that either scalar skill or vocational knowledge predicts real employability. Teachers produce abstract lesson capacity directly, and education never guarantees work.

## Social and demographic simplifications

- People are isolated individuals rather than households or families.
- There is no age, disability, gender, caregiving, migration, birth, or demographic replacement.
- Friendships are symmetric, strength-weighted, and capped by a fixed capacity.
- Social contact occurs through paid café visits and free Common Park visits, but there are no home, workplace, neighborhood, online, family, or organized-group encounters.
- Friends do not lend money, share food or housing, refer one another for jobs, transmit stress, or provide care.
- There are no institutions beyond firms and the treasury.

## Health and psychology simplifications

- Health is a single scalar. Three consecutive settlement phases at the critical floor cause death, regardless of diagnosis or individual physiology.
- Hunger immediately reduces the same general health score for everyone.
- Health setbacks remain generic random events with no diagnosis, duration, differentiated severity, contraindication, or condition-specific recovery. One exact apothecary dose costs 3.6 and adds 0.08 health up to 0.92; one clinic appointment costs 7.5, consumes one medicine dose, and adds 0.18 up to 0.96. These are gameplay recovery paths, not clinical models. There is no professional triage, prescription, clinician skill, insurance, inpatient care, side effect, referral, or proof that a treatment matches a setback.
- Stress is a single scalar and is updated twice during settlement, which makes it converge quickly toward pressure.
- Any hunger applies the same stress contribution regardless of duration.
- Scarcity errors are generic and probabilistic; they should not be interpreted as a clinical claim about people in poverty.
- Short-term comfort spending can occur during unemployment or homelessness, but this is a gameplay hypothesis rather than a calibrated claim about how people experiencing hardship behave.
- The Maslow-inspired hierarchy uses hard thresholds and weighted sums. It is a gameplay heuristic, not validated psychology.
- Current focus selects one need category. Stable seed-derived motivation weights now vary attendance, food, housing, health care, education, personal time, and firm-owner decisions, but citizens still do not plan across days or learn from outcomes. The weights and scoring equations are gameplay hypotheses, not a validated personality model.
- One shared neural network has bundled offline-trained schema-v1 weights migrated to schema v2 with zero-weight general, retail, and inventory inputs. It can optionally control discretionary personal-time choices after a checked technical gate; it remains shadow-only for the older supported domains and starts disabled. Self-care, clinical-care, and education decisions remain entirely under `motivation-v3` because they are outside that gate. The held-out gate covered five seeds for 30 days and matched the motivation fallback on all controlled personal-time choices, producing zero measured outcome deltas. That proves only replay, domain containment, invariant preservation, fallback wiring, and compatibility for those runs. The knowledge inputs currently have no neural influence, and the reward proxies, imitation objective, bounds, seed set, and apparent agreement remain uncalibrated hypotheses rather than evidence of useful learning, generalization, realism, safety, fairness, or calibration.
- Research-only four-value learned embeddings and bounded online adaptation were compared with profile-only behavior across the same five held-out seeds. They produced identical measured diversity, actions, and outcomes while adding training, mutable-state, replay, and audit cost, so ADR 0002 retains stable motivation profiles only. This result does not show that the existing profiles capture real personality; it rejects these particular additions until a falsifiable held-out benefit is demonstrated.

## Simulation and interface limitations

- The canvas moves living people toward the landmark for their current domain-owned primary activity, otherwise toward home or Common Park, and deceased people toward the cemetery. Movement is continuous rather than a duration or route simulation. The map never creates work, care, study, social contact, sleep, or transactions; the cemetery remains illustrative. Park social effects come from explicit personal-time decisions rather than map position, and the park provides no shelter, food, or services.
- Person positions are mutated by rendering and live on domain entities, weakening separation between simulation and view state.
- The UI shows complete citizen and firm histories, owner-decision traces, and current firm pipelines, but no town-wide distributions, inequality measures, network graph, cross-entity trace query, or aggregate supply-chain history.
- Economic slider changes and neural-control toggles have a town-level before/after run history, and individual decision traces identify the controller, fallback, schema, gate, and weights used at decision time. Runs still cannot be exported or compared interactively.
- There is no visible seed control or reset confirmation.
- Browser behaviour is not covered by automated tests.
- Directly opening `index.html` through `file://` may fail; Vite must serve the modules.

## Calibration and validation

No parameter has been calibrated against real data. A deterministic multi-seed development sensitivity harness now compares selected gameplay policy ranges, but there are no uncertainty intervals, external datasets, independently calibrated formation constants, or empirical validation suites. Before drawing substantive conclusions:

1. Define the claim being investigated.
2. Identify which parameters materially affect it.
3. Run many seeds rather than one story.
4. Test sensitivity across plausible ranges.
5. Compare outputs to appropriate external evidence.
6. Document what would falsify the model’s mechanism.

## Open design questions

- Should the economy remain strictly closed, or gain explicit external sectors?
- Should the current daily-work/weekly-rent cadence gain weekends, months, or other explicit calendar structure?
- Should people belong to households that share income, food, and housing?
- What mechanisms should allow recovery from chronic stress and homelessness?
- Should friendship support expand beyond the current emotional effect into economic or practical help?
- Should the model prioritize interpretability or richer behavioural complexity when those goals conflict?
- Which outputs would make policy comparisons credible without encouraging overinterpretation?
