# Known limitations and open questions

These items distinguish intentional simplifications from completed realism. A future agent should not assume that an implemented rule has been calibrated merely because it has a precise number.

## Highest-priority gaps

### Relationship support remains narrow

Friendships gain strength through café contact and decay after periods without contact, but the model does not implement conflict, non-commercial contact, maintenance costs, or practical support. Friendship affects belonging and stress only; friends cannot yet share food or housing, lend money, provide care, or refer one another for work.

### Stress recovery is narrow

Stress falls through financial runway, stable employment, food, housing, friendship strength, recent contact, and a small immediate comfort purchase. There is no direct recovery from rest, sleep, health care, resolving arrears, predictable schedules, time safely housed, autonomy, or treatment.

### No saved or shareable run

The seed is fixed in code, not visible or editable in the interface. Policy changes and runs cannot be exported, imported, bookmarked, or compared side by side.

## Economic simplifications

- Prices, food quality, productivity, and configured wages are fixed. There is no inflation, bargaining, price, quality, or productivity response, scarcity pricing, or wage competition. Food quality, productivity, and health-recovery multipliers are uncalibrated gameplay values.
- Wages and food operate daily while rent is billed every seven days. This is an internally balanced gameplay calendar, not a claim about real payment schedules.
- There is no banking, saving account, debt, credit, interest, insurance, or negative balance. Insolvency is an administrative cash-runway rule rather than a legal bankruptcy process.
- All money is inside one closed town. There is no external trade, remittance, investment, monetary creation, or destruction.
- A “shock” moves firm cash to the treasury. It behaves more like a fine or emergency levy than a destructive loss.
- Food retailers and the café buy a single abstract produce input from Morrow Fields, but the one-to-one conversion has no waste, recipes, grades, energy, equipment, transport, storage cost, or handling delay. Agriculture itself consumes no seed, land, water, fertilizer, energy, maintenance, or capital.
- Supply contracts settle immediately in cash at fixed prices and quantities. There is no negotiation, expiry, priority, alternate supplier, trade credit, invoice, debt, or damages for under-delivery.
- Housing has transaction-processing capacity but no dwelling stock, vacancy, construction, maintenance, quality, or location. HomeWorks can house everyone indefinitely if it can process their payments.
- Initially housed people receive housing without an initial payment or provider record.
- Every person consumes at most one food unit per day regardless of body, work, or household.
- Citizens use fixed one-to-three-meal reserve targets. They do not forecast rent, prices, attendance, congestion, spoilage, or future income when deciding how much food to store; there are no refrigeration or storage costs.
- Treasury support uses current vulnerability and a daily budget but has no eligibility history, application process, delay, fraud, stigma, or administrative cost.
- Vital-business classification is fixed in configuration. A vital firm can receive one cash rescue based only on next-day operating need; there is no public-interest assessment, conditionality, political process, alternative operator, repayment, equity stake, creditor review, or performance monitoring.
- Owners are the first six people and can also be employees. Working owners make simple runway-based wage-waiver, equity-contribution, voluntary-insolvency, ordinary-dividend, and emergency-distribution decisions. They cannot set arbitrary salary, vary working hours, replace management, lend to the firm, recover contributed equity, sell or transfer ownership, share ownership, or create formal distribution policies. Ownership is not inherited; a firm with a dead owner retains surplus.
- Owner equity has no shares, valuation, dilution, return calculation, repayment, tax treatment, documentation, or distinction between sole proprietorships and limited companies. Emergency distributions preserve one operating day but do not model directors' duties, creditor protection, fraudulent conveyance, clawbacks, or unlawful distributions.
- A deceased person's cash transfers immediately to the treasury as an intestate estate. There are no wills, heirs, probate delays, creditor claims, inheritance taxes, or non-cash estate assets.
- Insolvent firms do not liquidate inventory or other assets, distribute proceeds, reorganize, gain a replacement owner, or reopen.
- A closed housing or food firm can make essential services unavailable with no replacement-entry mechanism.

## Labour simplifications

- Each person can have at most one employer and either attends the whole shift or misses it.
- Each attending worker contributes a fixed sector-specific number of transactions regardless of skill, health, transaction complexity, or coworker coordination.
- There are no occupations, schedules, hours, contracts, tenure, credentials, discrimination, commuting cost, care work, informal work, or self-employment.
- Candidate ranking uses skill and reliability. The richer social referral effect from an earlier version is not present.
- Reservation wage is based only on skill. It does not reflect housing, dependants, transport, benefits, risk, or alternatives.
- Production by housing employees is not used to constrain housing supply.
- Missed shifts create events but no distinct wage-ledger entry because no money moves.

## Social and demographic simplifications

- People are isolated individuals rather than households or families.
- There is no age, disability, gender, caregiving, migration, birth, or demographic replacement.
- Friendships are symmetric, strength-weighted, and capped by a fixed capacity.
- Social contact occurs only through paid café visits.
- Friends do not lend money, share food or housing, refer one another for jobs, transmit stress, or provide care.
- There are no institutions beyond firms and the treasury.

## Health and psychology simplifications

- Health is a single scalar. Three consecutive settlement phases at the critical floor cause death, regardless of diagnosis or individual physiology.
- Hunger immediately reduces the same general health score for everyone.
- Health setbacks are generic random events with no diagnosis, treatment, cost, duration, or recovery path.
- Stress is a single scalar and is updated twice during settlement, which makes it converge quickly toward pressure.
- Any hunger applies the same stress contribution regardless of duration.
- Scarcity errors are generic and probabilistic; they should not be interpreted as a clinical claim about people in poverty.
- The Maslow-inspired hierarchy uses hard thresholds and weighted sums. It is a gameplay heuristic, not validated psychology.
- Current focus selects one need category but does not plan across days or learn from outcomes.

## Simulation and interface limitations

- The canvas moves living people toward employers and deceased people toward the cemetery continuously, not according to the seven economic phases. Movement and the cemetery are illustrative rather than causal.
- Person positions are mutated by rendering and live on domain entities, weakening separation between simulation and view state.
- The UI shows complete citizen and firm histories plus current firm pipelines, but no town-wide distributions, inequality measures, network graph, cross-entity trace query, or aggregate supply-chain history.
- Policy changes apply mid-run without being recorded in the event history.
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
