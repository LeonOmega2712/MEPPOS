# Phase 2 Issues Dependency Tree

> Snapshot as of 2026-07-05. Regenerate from `gh issue list` when issues close or new ones are filed.

```mermaid
graph TD
    I46["#46 DB custom_extras (CLOSED)"]
    I47["#47 DB locations (CLOSED)"]
    I48["#48 DB orders core schema"]
    I38["#38 Phase 2 DB migrations (parent)"]
    I39["#39 Locations management"]
    I44["#44 Custom extras UI integration"]
    I40["#40 Open/manage orders + rounds"]
    I41["#41 Checkout + discounts"]
    I42["#42 Transfer order / reassign location"]
    I43["#43 Ticket printing"]
    I45["#45 Order history + reprint"]
    I53["#53 Inline extra creation from order view"]
    I49["#49 UX: surface backend validation errors (no deps)"]
    I50["#50 UX: unified refresh-button feedback (no deps)"]
    I16["#16 About page (no deps)"]

    I46 --> I48
    I47 --> I48
    I48 --> I38
    I38 --> I39
    I38 --> I44
    I38 --> I40
    I39 --> I40
    I40 --> I41
    I40 --> I42
    I40 --> I43
    I41 --> I43
    I41 --> I45
    I43 --> I45
    I40 --> I53
```

## Suggested resolution order

1. **#48** — DB orders schema (deps #46/#47 already closed, ready now)
2. **#38** — closes once #48 lands (parent checklist)
3. **#39** — Locations availability (needs #38)
4. **#40** — Core order/round flow (needs #38 + #39) — biggest unlock, most other issues wait on this
5. Parallel after #40: **#41** (checkout), **#42** (transfer), **#44** (extras UI), **#53** (inline extra)
6. **#43** — Ticket printing (needs #40 + #41)
7. **#45** — History + reprint (needs #41 + #43) — last in the Phase 2 chain

**Standalone, no dependencies:** #49, #50, #16 — can be done anytime, good filler between phases.
