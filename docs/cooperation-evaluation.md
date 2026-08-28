# Cooperation evaluation

`npm run evaluate:cooperation` runs seeds `20260823, 101, 202, 303, 404, 505` for 56 days in three isolated modes:

- `legacy`: historical park eligibility, seed-random social pairing, and no gifts;
- `public-social`: universal Common Park eligibility and friend-first pairing, with no gifts;
- `mutual-aid`: public-social rules plus batched stored-meal gifts.

Use `--json` for the complete serializable report, or override the diagnostic horizon with `--seeds` and `--days`.

The report includes park and café attendance and contacts; new and close friendships; concrete eligible offer options, offers, keeps, refusals, accepted gifts, later eating, spoilage, and re-gifting; protected-reserve and pantry revalidation failures; cumulative citizen hunger-days; food waste; treasury support; deaths and survivors; and giving/receiving participant counts, largest shares, and concentration indices.

Every seed/mode is replayed. Simulation invariants run after every completed day. The hard checks require zero illegal applied outcomes, protected reserve preservation, no pantry overflow, valid deterministic custody chains, no expired gift, reconciled meal ownership, and cash conservation. Existing exact purchase, employment, relationship, death, reset, and extinction invariants remain active through `TownSimulation`.

Hunger, support, survival, waste, friendship, and concentration directions are observations. They are not acceptance gates or tuning triggers. The comparison is deterministic gameplay evidence for these configured rules, not empirical calibration, a forecast, or evidence about real mutual aid, generosity, need, or social policy.
