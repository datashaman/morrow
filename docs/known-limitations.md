# Known limitations and open questions

These items distinguish intentional simplifications from completed realism. A future agent should not assume that an implemented rule has been calibrated merely because it has a precise number.

## Highest-priority gaps

### Relationship support remains narrow

Friendships gain strength through café contact and decay after periods without contact, but the model does not implement conflict, non-commercial contact, maintenance costs, or practical support. Friendship affects belonging and stress only; friends cannot yet share food or housing, lend money, provide care, or refer one another for work.

### Stress recovery is narrow

Stress falls through financial runway, stable employment, food, housing, friendship strength, recent contact, a small immediate comfort purchase, and a bounded free-rest action. There is no distinct sleep schedule, health care, recovery from resolving arrears, predictable schedules, time safely housed, autonomy model, or treatment.

### No saved or shareable run

The seed is fixed in the browser and interactive runs still cannot be exported, imported, or bookmarked. Policies can now be compared reproducibly across configurable seeds through the headless evaluator, but there is no interactive side-by-side run viewer or saved report store.

## Economic simplifications

- Owners adjust prices through one bounded weekly heuristic. There is no inflation, bargaining, competitor forecasting, promotion, product differentiation, price discrimination, explicit demand curve, or wage competition. Food quality, productivity, wages, and health-recovery multipliers remain fixed and uncalibrated.
- Wages and food operate daily while rent is billed every seven days. This is an internally balanced gameplay calendar, not a claim about real payment schedules.
- There is no banking, saving account, debt, credit, interest, insurance, or negative balance. Insolvency is an administrative cash-runway rule rather than a legal bankruptcy process.
- All money is inside one closed town. There is no external trade, remittance, investment, monetary creation, or destruction.
- A “shock” moves firm cash to the treasury. It behaves more like a fine or emergency levy than a destructive loss.
- Food retailers and the café buy a single abstract produce input from Morrow Fields, but the one-to-one conversion has no waste, recipes, grades, energy, equipment, transport, storage cost, or handling delay. Agriculture itself consumes no seed, land, water, fertilizer, energy, maintenance, or capital.
- Supply contracts settle immediately in cash at fixed quantities; prices inherit the supplier's proportional owner adjustment. There is no bilateral negotiation, expiry, priority, alternate supplier, trade credit, invoice, debt, or damages for under-delivery.
- Maintenance is one generic kit every three days for every firm other than Makers Guild. There are no distinct machines, tools, repair skills, depreciation curves, preventive schedules, breakdown types, or capital investment choices; the 65% capacity penalty is a gameplay hypothesis.
- Housing has transaction-processing capacity but no dwelling stock, vacancy, construction, maintenance, quality, or location. HomeWorks can house everyone indefinitely while operating. Its receivership preserves all tenancies for seven days, then uses a fixed restart threshold or deterministic displacement rate rather than modeling property ownership, administrators, courts, lenders, tenant protections, or alternate landlords.
- Initially housed people receive housing without an initial payment or provider record.
- Every person consumes at most one food unit per day regardless of body, work, or household.
- Citizens use fixed one-to-three-meal reserve targets. Motivation scoring sees current prices, quality, age, and transaction capacity but does not forecast future rent, attendance, congestion, spoilage, or income; there are no refrigeration or storage costs.
- Treasury support uses a four-day essential-runway means test, current vulnerability priority, and a daily budget, but has no eligibility history, application process, delay, fraud, stigma, administrative cost, household assessment, or empirical calibration.
- Vital-business classification is fixed in configuration. A vital firm can receive one cash rescue based only on next-day operating need; missing housing, agriculture, and food operators can later receive fixed-cost public re-entry funding when cash, workers, cooldown, and supply dependencies permit. There is no public-interest assessment, conditionality, political process, repayment, equity stake, creditor review, or performance monitoring.
- Owners are the first six people and can also be employees. Their wage, financing, continuation, bounded pricing, and distribution choices now use the shared inspectable motivation policy, but option features and scores remain uncalibrated gameplay hypotheses. Owners cannot set arbitrary salary, vary working hours, replace management, negotiate prices, lend to the firm, recover contributed equity, sell or transfer ownership, share ownership, or create formal distribution policies. Ownership is not inherited; a firm with a dead owner retains surplus.
- Owner equity has no shares, valuation, dilution, return calculation, repayment, tax treatment, documentation, or distinction between sole proprietorships and limited companies. Emergency distributions preserve one operating day but do not model directors' duties, creditor protection, fraudulent conveyance, clawbacks, or unlawful distributions.
- A deceased person's cash transfers immediately to the treasury as an intestate estate. There are no wills, heirs, probate delays, creditor claims, inheritance taxes, or non-cash estate assets.
- Insolvent firms do not liquidate inventory or other assets, distribute proceeds, or reorganize. Only configured essential housing, agriculture, and food operators can reopen under a treasury-appointed public operator; other firms do not gain a replacement owner or reopen.
- Essential-sector re-entry reuses the closed firm's inventory, product, and name, and uses fixed funding, staffing, cooldown, and upstream rules rather than modeling incorporation, capital procurement, licensing, management selection, capacity planning, or competing entrants.
- Endogenous private formation is limited to the first Common Café or Green Basket instance in a town explicitly initialized without that firm. Its seven-day opportunity window, 50% demand capture, 8% margin buffer, 40 startup capital, protected ten-day founder runway, deterministic founder ranking, and immediate staffing/contracts are gameplay hypotheses. Other archetypes cannot yet form privately, and a failed private firm cannot yet attract a replacement entrant.

## Labour simplifications

- Each person can have at most one employer and either attends the whole shift or misses it.
- Each attending worker contributes a fixed sector-specific number of transactions regardless of skill, health, transaction complexity, or coworker coordination.
- There are no occupations, schedules, hours, contracts, tenure, credentials, discrimination, commuting cost, care work, informal work, or self-employment.
- Candidate ranking uses skill and reliability. The richer social referral effect from an earlier version is not present.
- Attendance is routed through the motivation policy using health, hunger, stress, runway, reliability, a baseline absence chance, and a seeded daily draw. It remains an all-or-nothing daily shift with no schedules, partial capacity, paid leave, illness categories, transport, care obligations, or employer attendance policy.
- Job seeking is a once-per-settlement choice among mature approved vacancies, and each firm makes at most one offer to its highest-ranked applicant. Offered wage, reservation wage, reliability, safety, runway, stress, firm trouble, seeded acceptance evidence, and stable motivation weights affect the two decisions, but there are no applications in progress, interviews, credentials, occupations, schedules, benefits, commuting costs, discrimination, negotiation, competing offers, referrals, search costs, employer preferences beyond skill and reliability, or memory of earlier rejection.
- Production by housing employees is not used to constrain housing supply.
- Missed shifts create events but no distinct wage-ledger entry because no money moves.

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
- Health setbacks are generic random events with no diagnosis, treatment, cost, duration, or recovery path.
- Stress is a single scalar and is updated twice during settlement, which makes it converge quickly toward pressure.
- Any hunger applies the same stress contribution regardless of duration.
- Scarcity errors are generic and probabilistic; they should not be interpreted as a clinical claim about people in poverty.
- Short-term comfort spending can occur during unemployment or homelessness, but this is a gameplay hypothesis rather than a calibrated claim about how people experiencing hardship behave.
- The Maslow-inspired hierarchy uses hard thresholds and weighted sums. It is a gameplay heuristic, not validated psychology.
- Current focus selects one need category. Stable seed-derived motivation weights now vary attendance, food, housing, personal time, and firm-owner decisions, but citizens still do not plan across days or learn from outcomes. The weights and scoring equations are gameplay hypotheses, not a validated personality model.
- One shared neural network has bundled offline-trained weights and can optionally control personal-time choices after a checked technical gate; it remains shadow-only for every other domain and starts disabled. Its held-out gate covered five seeds for 30 days and matched the motivation fallback on all controlled personal-time choices, producing zero measured outcome deltas. That proves only replay, domain containment, invariant preservation, fallback wiring, and compatibility for those runs. The reward proxies, imitation objective, bounds, seed set, and apparent agreement remain uncalibrated hypotheses and do not establish useful learning, generalization, realism, safety, fairness, or calibration.
- Research-only four-value learned embeddings and bounded online adaptation were compared with profile-only behavior across the same five held-out seeds. They produced identical measured diversity, actions, and outcomes while adding training, mutable-state, replay, and audit cost, so ADR 0002 retains stable motivation profiles only. This result does not show that the existing profiles capture real personality; it rejects these particular additions until a falsifiable held-out benefit is demonstrated.

## Simulation and interface limitations

- The canvas moves employees toward employers, current applicants toward the firm named by their domain application, other unemployed people toward the Common Park, and deceased people toward the cemetery continuously, not according to the seven economic phases. The map does not create applications or employment; the cemetery remains illustrative. Park social effects come from explicit personal-time decisions rather than map position, and the park provides no shelter, food, or services.
- Person positions are mutated by rendering and live on domain entities, weakening separation between simulation and view state.
- The UI shows complete citizen and firm histories, owner-decision traces, and current firm pipelines, but no town-wide distributions, inequality measures, network graph, cross-entity trace query, or aggregate supply-chain history.
- Economic slider changes and neural-control toggles have a town-level before/after run history, and individual decision traces identify the controller, fallback, schema, gate, and weights used at decision time. Runs still cannot be exported or compared interactively.
- There is no visible seed control or reset confirmation.
- Browser behaviour is not covered by automated tests.
- Directly opening `index.html` through `file://` may fail; Vite must serve the modules.

## Calibration and validation

No parameter has been calibrated against real data. There are no sensitivity analyses, ensemble runs, uncertainty intervals, or empirical validation suites. Before drawing substantive conclusions:

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
