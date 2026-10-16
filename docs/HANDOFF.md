# Handoff — BLKOUT: TOC

Updated: 2026-10-16 · Branch: `wip/format-v2` (main = last green: `af46a8f`)

## Done (on main)
WP0 scaffold/CI/Pages · WP1 schemas · WP2 loader · WP3 storage · WP4 campaign engine · WP5 UI shell · WPA app services · WP9 GEMINI pack v1.0 + PACK_FORMAT.md + CAMPAIGN_AUTHORING_GUIDE.md.

## In progress (this branch)
- **Format v2 DSL** (done, tested): target filters `{from, where}`, `team` target, `hasTag`, `teamMissions`, `factionIs`, `forEachTeam`, `rollTable.byFaction`, `destroyed` reason, `onPromotion`, campaign `customMission` + `factions`, undo per command (events carry `cmd`).
- **One handler per group** (done): `groups[].handlerId`, rosters collection v2 migration.
- **Remaining:** GEMINI pack → v1.1.0 / formatVersion 2 and docs update. `src/packs/docs.test.ts` fails until docs mention v2 names.

## GEMINI v1.1 — RJ rulings (authoritative)
1. 4 windows/Operation, 12 total. 2. Wound recovery as built. 3. Teams hold 2–3 operators.
4. d10 reinforcements vary by faction: `factions` (RFA playable) + `byFaction` RFA table + generic default table.
5. TRIPWIRE failure: −1 to Stability gains for the next window only (real effect).
6. All authored content approved. 7. Auto RED: team's 3rd mission in a window, or any operator Serious casualty that window; resets each window.
8. Threat Level: omitted.
Also: replace `drone` stat hack with Golem tags + `hasTag`; Golem loss = `destroyed`; custom missions get AAR fields.
Pack source: `tools/build-gemini.mjs` → `npm run pack:gemini`.

## Next
1. Finish GEMINI v1.1 + docs → CI green → merge to main.
2. UI wave (parallel): WP6 roster builder + forge, WP7 dashboard, WP8 campaign UI (Library page needs disable-bad-pack recovery).
3. G4: validate authoring guide by generating a campaign in a fresh chat.

## Open questions
None blocking.
