# Product intent

## Goal

Create an explorable simulated world in which social and economic patterns emerge from the constrained actions of individual people and organizations.

The experience should answer questions such as:

- Who employs this person, and where does the wage come from?
- Who sold the food or service they bought?
- Did a close friend give them this meal, and where did it originally come from?
- Who received their rent?
- What happens when their money runs out?
- Can they become hungry, unhealthy, unemployed, or unhoused?
- Why did their stress rise or fall?
- Why are they pursuing a particular need?
- Which events and transactions led to their current condition?
- What are they doing now, when do they next work or pay rent, and how is sleep affecting them?

## Desired user experience

The user watches the town run, selects a named person, and can understand that person’s situation without mentally reverse-engineering the model. Aggregate metrics establish the town-wide context, while the selected person’s needs, stress, health, employment, housing, sellers, ledger, and life events explain the individual story.

Policy controls should make causal exploration possible. Re-running the same seed should permit meaningful before/after comparisons.

## In scope

- Named individual agents with heterogeneous starting conditions
- Firms with sectors, workers, cash, inventory, products, input costs, prices, wages, and owners
- A treasury that receives taxes and redistributes support
- A deterministic civil calendar, configured business openings, stable five-shift worker rotas, one-primary-per-block activity budgets, overnight sleep debt, agriculture, paid finite haulage, supply contracts and procurement, production, payroll, food, housing, discretionary activity, and settlement
- Dated perishable produce and food with FIFO use, expiry, and attributable waste
- Employment, layoffs, vacancies, hiring, and firm closure
- Funded employment opportunities backed by attributable demand and retained firm cash, without an employment floor or guaranteed job
- Hunger, bounded self-care and clinical treatment, health, stress, scarcity errors, arrears, eviction, rehousing, and death
- Paid, finite retail education plus transferable workplace knowledge across every current trade, with bounded operation-specific effects that never guarantee employment, demand, or success
- Explicit labor-gated fabrication, construction-material supply, finite dwellings, and paid building projects
- Public and commercial social encounters, maintained friendships, and voluntary close-friend meal sharing with preserved provenance
- An explicitly staged citizen lifecycle with age, guardianship, family relationships, endogenous births, estate duty, and inheritance. Adult lifecycle state, romantic partnerships, deterministic conception, gestation, newborn identity, guardian residence, dependent food, sleep, finite health care, paid schooling, stage progression, maturation, cash-estate distribution, and lifecycle presentation are implemented; births remain deliberately gated because the multi-seed activation evaluation fails lifecycle-reach and dependent-essential criteria
- Maslow-inspired needs and current behavioural focus
- Auditable cash transfers and deterministic replay

## Out of scope for now

- Predicting an actual city, population, or policy outcome
- Claiming psychological or economic calibration
- Real currencies, inflation, credit markets, banking, or interest
- Migration and population exchange with an external world
- Land ownership, detailed buildings, vehicles, roads, or route planning
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
