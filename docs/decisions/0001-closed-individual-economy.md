# 0001: Model a closed economy through individual counterparties

- Status: accepted
- Date: 2026-08-23

## Context

Earlier versions gave people cash and allowed consumption without clearly identifying employers, buyers, sellers, landlords, or funding sources. That made the apparent social outcomes impossible to trust.

The project’s main purpose is to observe individual stories and emergent feedback loops. Aggregate income generation or unexplained periodic cash grants would undermine that purpose.

## Decision

Model people, firms, and the town treasury as separate entities with cash balances. All implemented cash movement must be a transfer between two entities inside this boundary.

- Firms pay wages.
- People pay firms for food, housing, goods, and services.
- Firms pay employer tax to the treasury.
- The treasury pays targeted support to vulnerable people.
- Profitable firms may pay dividends to owners.
- Economic shocks currently transfer firm cash to the treasury.

Essential purchases use exact transfers. If the buyer cannot cover the full price, no payment or purchase occurs. Individual ledger records include day, direction, amount, purpose, and balance before and after.

Random decisions use a seeded generator so the same initial seed and policies can be replayed.

## Consequences

- Money conservation becomes a testable invariant.
- Individual transactions become auditable.
- Firm liquidity affects payroll and employment.
- Consumption supports the firms that produce and employ.
- Treasury support has a visible funding source and a finite budget.
- Introducing outside trade, money creation, credit, or destruction will require an explicit change to the system boundary and its invariant.

## Deliberate limitations

The current boundary does not imply that a real town is a closed economy. It is a simplifying device for understanding feedback loops and eliminating unexplained money creation.
