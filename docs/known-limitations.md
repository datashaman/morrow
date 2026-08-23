# Known limitations and open questions

These items distinguish intentional simplifications from completed realism. A future agent should not assume that an implemented rule has been calibrated merely because it has a precise number.

## Highest-priority gaps

### The discretionary-demand control is inactive

The policy and UI expose `discretionaryDemand`, but no simulation rule reads it. Moving the slider currently has no effect. Either connect it to optional café/goods purchases or remove the control until implemented.

### Relationships only grow

People can form friendships at the café, but the repository version does not implement friendship decay, conflict, maintenance costs, practical support, or relationship quality. This can recreate the earlier problem in which everyone appears to keep making friends without meaningful loss or consequence.

### Stress recovery is narrow

Stress falls through financial runway, stable employment, food, housing, recent contact, and a small immediate comfort purchase. There is no direct recovery from rest, sleep, health care, resolving arrears, predictable schedules, time safely housed, supportive relationships, autonomy, or treatment.

### Some person fields are inactive

`risk`, `masteryDays`, and much of `esteemBoost` currently have no meaningful downstream effect. They are remnants or placeholders from earlier iterations. Remove them or reconnect them deliberately.

### No saved or shareable run

The seed is fixed in code, not visible or editable in the interface. Policy changes and runs cannot be exported, imported, bookmarked, or compared side by side.

## Economic simplifications

- Prices and configured wages are fixed. There is no inflation, bargaining, price response, scarcity pricing, or wage competition.
- There is no banking, saving account, debt, credit, interest, insurance, bankruptcy process, or negative balance.
- All money is inside one closed town. There is no external trade, remittance, investment, monetary creation, or destruction.
- A “shock” moves firm cash to the treasury. It behaves more like a fine or emergency levy than a destructive loss.
- Firms have no input costs beyond wages and taxes. Food and goods production consumes no raw materials, land, energy, maintenance, or capital.
- Housing has no capacity, vacancy, construction, maintenance, quality, location, or operating inventory. HomeWorks can house everyone indefinitely.
- Initially housed people receive housing without an initial payment or provider record.
- Every person consumes at most one food unit per day regardless of body, work, or household.
- Treasury support uses current vulnerability and a daily budget but has no eligibility history, application process, delay, fraud, stigma, or administrative cost.
- Owners are the first five people and can also be employees. Ownership cannot be sold or inherited.
- Firm reopening after closure existed in an earlier visualization but is not implemented in the repository version.
- A closed housing or food firm can make essential services unavailable with no replacement-entry mechanism.

## Labour simplifications

- Each person can have at most one employer and either attends the whole shift or misses it.
- There are no occupations, schedules, hours, contracts, tenure, credentials, discrimination, commuting cost, care work, informal work, or self-employment.
- Candidate ranking uses skill and reliability. The richer social referral effect from an earlier version is not present.
- Reservation wage is based only on skill. It does not reflect housing, dependants, transport, benefits, risk, or alternatives.
- Production by housing employees is not used to constrain housing supply.
- Missed shifts create events but no distinct wage-ledger entry because no money moves.

## Social and demographic simplifications

- People are isolated individuals rather than households or families.
- There is no age, disability, gender, caregiving, migration, birth, or death.
- Friendships are symmetric, binary, and capped by a fixed capacity.
- Social contact occurs only through paid café visits.
- Friends do not lend money, share food or housing, refer one another for jobs, transmit stress, or provide care.
- There are no institutions beyond firms and the treasury.

## Health and psychology simplifications

- Health is a single scalar bounded at 0.08; people cannot die.
- Hunger immediately reduces the same general health score for everyone.
- Health setbacks are generic random events with no diagnosis, treatment, cost, duration, or recovery path.
- Stress is a single scalar and is updated twice during settlement, which makes it converge quickly toward pressure.
- Any hunger applies the same stress contribution regardless of duration.
- Scarcity errors are generic and probabilistic; they should not be interpreted as a clinical claim about people in poverty.
- The Maslow-inspired hierarchy uses hard thresholds and weighted sums. It is a gameplay heuristic, not validated psychology.
- Current focus selects one need category but does not plan across days or learn from outcomes.

## Simulation and interface limitations

- The canvas moves people toward employers continuously, not according to the six economic phases. Movement is illustrative rather than causal.
- Person positions are mutated by rendering and live on domain entities, weakening separation between simulation and view state.
- Only recent ledger and life-event history is retained; long-run causal chains are discarded.
- The UI shows current state and recent events but no town-wide distributions, inequality measures, network graph, or causal trace.
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

- Should “Morrow” become the confirmed product and repository name?
- Should the economy remain strictly closed, or gain explicit external sectors?
- Is a day the right unit, given that wages and rent currently occur every day?
- Should rent be monthly and wages weekly or monthly, with an explicit calendar?
- Should people belong to households that share income, food, and housing?
- What mechanisms should allow recovery from chronic stress and homelessness?
- Should friendship support be economic, emotional, or both?
- Should the model prioritize interpretability or richer behavioural complexity when those goals conflict?
- Which outputs would make policy comparisons credible without encouraging overinterpretation?
