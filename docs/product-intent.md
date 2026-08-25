# Product intent

## Goal

Create an explorable simulated world in which social and economic patterns emerge from the constrained actions of individual people and organizations.

The experience should answer questions such as:

- Who employs this person, and where does the wage come from?
- Who sold the food or service they bought?
- Who received their rent?
- What happens when their money runs out?
- Can they become hungry, unhealthy, unemployed, or unhoused?
- Why did their stress rise or fall?
- Why are they pursuing a particular need?
- Which events and transactions led to their current condition?

## Desired user experience

The user watches the town run, selects a named person, and can understand that person’s situation without mentally reverse-engineering the model. Aggregate metrics establish the town-wide context, while the selected person’s needs, stress, health, employment, housing, sellers, ledger, and life events explain the individual story.

Policy controls should make causal exploration possible. Re-running the same seed should permit meaningful before/after comparisons.

## In scope

- Named individual agents with heterogeneous starting conditions
- Firms with sectors, workers, cash, inventory, products, input costs, prices, wages, and owners
- A treasury that receives taxes and redistributes support
- Agriculture, basic supply contracts and procurement, production, payroll, food, housing, discretionary activity, and settlement
- Employment, layoffs, vacancies, hiring, and firm closure
- Hunger, bounded self-care, health, stress, scarcity errors, arrears, eviction, rehousing, and death
- Paid, finite education that gradually changes skill without guaranteeing employment
- Friendships and social encounters
- Maslow-inspired needs and current behavioural focus
- Auditable cash transfers and deterministic replay

## Out of scope for now

- Predicting an actual city, population, or policy outcome
- Claiming psychological or economic calibration
- Real currencies, inflation, credit markets, banking, or interest
- Demographic reproduction, migration, households, or families
- Land, construction, housing capacity, or detailed physical logistics
- A server, database, accounts, multiplayer operation, or saved runs
- Formal validation against empirical datasets

## Success criteria

The project is succeeding when:

- Surprising outcomes can be traced to explicit rules and recorded events.
- Cash never appears from nowhere or vanishes inside the defined economy.
- A person cannot pay more cash than they possess.
- Lower-level insecurity materially changes behaviour and opportunity.
- Hardship and recovery are both possible, neither scripted nor impossible.
- The same seed and policies reproduce the same result.
- A change to a rule can be tested without using the browser.

## Interpretation warning

The model is generative fiction with explicit rules. It can reveal feedback loops, edge cases, and assumptions, but not establish factual conclusions about poverty, health, psychology, labour markets, or public policy. Parameter values should be treated as editable hypotheses.
