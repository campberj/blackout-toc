# Handoff — BLKOUT: TOC

Updated: 2026-10-16 · Branch: `main` (format v2 merged)

## Done (on main)
WP0 scaffold/CI/Pages · WP1 schemas · WP2 loader · WP3 storage · WP4 campaign engine · WP5 UI shell · WPA app services · WP9 GEMINI pack v1.0 + PACK_FORMAT.md + CAMPAIGN_AUTHORING_GUIDE.md.

## Format v2 (merged)
- **Format v2 DSL** (done, tested): target filters `{from, where}`, `team` target, `hasTag`, `teamMissions`, `factionIs`, `forEachTeam`, `rollTable.byFaction`, `destroyed` reason, `onPromotion`, campaign `customMission` + `factions`, undo per command (events carry `cmd`).
- **One handler per group** (done): `groups[].handlerId`, rosters collection v2 migration.
- GEMINI pack v1.1.0 (formatVersion 2) with RJ rulings below; docs cover v2 (guide 5,321 words).

## GEMINI v1.1 — RJ rulings (authoritative)
1. 4 windows/Operation, 12 total. 2. Wound recovery as built. 3. Teams hold 2–3 operators.
4. d10 reinforcements vary by faction: `factions` (RFA playable) + `byFaction` RFA table + generic default table.
5. TRIPWIRE failure: −1 to Stability gains for the next window only (real effect).
6. All authored content approved. 7. Auto RED: team's 3rd mission in a window, or any operator Serious casualty that window; resets each window.
8. Threat Level: omitted.
Also: replace `drone` stat hack with Golem tags + `hasTag`; Golem loss = `destroyed`; custom missions get AAR fields.
Pack source: `tools/build-gemini.mjs` → `npm run pack:gemini`.

## Next
1. UI wave (parallel): WP6 roster builder + forge, WP7 dashboard, WP8 campaign UI (Library page needs disable-bad-pack recovery).
2. G4: validate authoring guide by generating a campaign in a fresh chat.

## Open questions (RJ)
- Critical/KIA also set RED (agent's reading of "Serious casualty") — confirm.
- Engine lacks a player-choice effect: replacements route to fixed teams; table results that offer a choice apply a fixed option. Candidate DSL v3 `choose` effect.
