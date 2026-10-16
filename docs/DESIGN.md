# BLKOUT: Tactical Operations Center — Design Document

Status: **v0.2 — Gateway 0 approved 2026-10-15** · Owner: RJ (APACHE ACTUAL) · Architect: Claude

Fan-made companion tool for BLKOUT (Enemy Spotted Studios). Unofficial; not affiliated with ESS.

---

## 1. Scope

| ID | Feature | Priority |
|---|---|---|
| F1 | Team builder: select units + handler, save, print, export | P1 |
| F2 | Unit Forge: custom units validated against rules constraints | P2 |
| F3 | Game dashboard: round, CP, armory, VP, objectives, special rules, per-unit/model status | P1 |
| F4 | Solo narrative campaign engine + pack import + AI authoring guide | **P0** |
| F5 | Multiplayer shared campaigns (map / linked nodes), login | Future — seams only |

Non-goals (v1): rules adjudication (app tracks state, player resolves dice), AI opponent move logic, hosting any ESS card text or stats.

## 2. Decision Log

| # | Decision | Rationale |
|---|---|---|
| D1 | TypeScript (strict) + Vite + Svelte 5 | Typed domain, small bundle, static build |
| D2 | Deploy: GitHub Pages via Actions | Static hosting, free |
| D3 | Repo ships **no ESS data**; schema + importable **data packs** | IP safety. One importer for cards, scenarios, campaigns (DRY) |
| D4 | Campaign engine = **declarative primitives**; BLACKFALL is pack #1 | Variable campaigns without code changes; ToD-style possible via import |
| D5 | Narrative = authored text + weighted random tables, seeded RNG | Offline, deterministic, reproducible |
| D6 | Unit Forge = constraint validation (errors + warnings), no point cost | BLKOUT has no points system |
| D7 | Port **one** live campaign as the reference pack | Proves the schema; worked example for the AI guide |
| D8 | Persistence = IndexedDB behind repository ports; JSON export/import | Backend swap later without feature changes |
| D9 | Rules versioned via **ruleset profiles** (Core / S8.1 / S2026 / custom) | Keyword text and CP caps differ across sources |
| D10 | Default ruleset = **Supplemental 2026** | Latest errata |
| D11 | Reference pack = **GEMINI / OPERATION COLD IRON** | Exercises tracks + milestones; one window in |
| D12 | Repo public; Pages source = GitHub Actions | Build output never committed |
| D13 | Schemas + DSL frozen at G1; changes need `formatVersion` bump + migration | Published packs must keep loading |
| D14 | Official card data lives in user-made pack id **`blkout`**; local id = printed card code lowercased (`blkout:tfb-9861`, `blkout:hndl-224`) | Independently typed packs agree on ids without sharing ESS data |
| D15 | GEMINI reference pack ships **public** in `packs/` — narrative only, fan-content attribution, no ESS stats/rules text | Worked example for authors and AI guide |
| D16 | Reference pack scope = full framework + Window 1 + generic later windows | Playable beyond W1 without inventing the Intel-15 reveal |

## 3. Architecture

Layered, dependencies point inward only. Domain is pure TS (no Svelte, no DOM, no IndexedDB).

```
ui (Svelte routes/components) ──► app (use-cases/services) ──► domain (types, rules, engine)
                                         │
                                         ▼
                                 ports (interfaces) ◄── adapters (IndexedDB, file I/O, print)
```

```
src/
  domain/
    cards/        Unit, Weapon, Keyword, ForceCard, Handler, Duster types + derivations
    rules/        RulesetProfile, constraint validators (Forge)
    roster/       Team list model + validation
    game/         GameSession state machine, reducers (pure)
    campaign/     primitives, effect interpreter, condition evaluator
    rng/          seeded PRNG (mulberry32), dice helpers
  packs/
    schema/       Zod schemas = single source of truth → JSON Schema emitted for docs/AI
    loader/       parse, validate, namespace, dependency-resolve, merge/errata
  app/            use-cases: buildRoster, startGame, applyAar, advanceCampaign…
  ports/          Repository<T>, PackStore, Exporter, Clock, Identity (F5)
  adapters/       idb/, file/, print/
  ui/             components/ (design system), features/{roster,forge,dashboard,campaign,library}
packs/            first-party packs (original content only) + reference campaign
docs/             DESIGN.md, PACK_FORMAT.md, CAMPAIGN_AUTHORING_GUIDE.md (AI handoff)
```

**Principles in practice**
- SRP: one module = one reason to change. Reducers don't persist; adapters don't validate.
- OCP: new campaign mechanics = new pack data or one new effect op, not edits across features.
- LSP/ISP: small ports (`Repository<T>` with get/put/list/delete), not one god-store.
- DIP: features receive ports through a context; tests inject in-memory fakes.
- DRY: Zod schemas generate TS types **and** JSON Schema **and** guide examples. Shared card renderer used by builder, forge, dashboard, print.

## 4. Domain Model (core)

Values are data from packs; types below are schema shape (abbreviated).

```ts
type Id = `${string}:${string}`            // packId:localId — namespacing prevents collisions
type Armor = { dice: 1|2|3; target: number }  // "2/6"
type KeywordRef = { key: Id; x?: number }      // "Blast (1)" → {key:"core:blast", x:1}

interface Weapon { id: Id; name: string; minRange?: number; maxRange?: number;
  damage?: number; keywords: KeywordRef[]; usesMax?: number; text?: string }

interface UnitCard { id: Id; name: string; faction: Id;
  type: 'infantry'|'handler'|'duster'|'vehicle'|'hostile';
  skill: number; move: number; armor: Armor; grunts: number; combatLoads: number;
  weapons: Weapon[]; specialists: Specialist[]; rules: UnitRule[];   // usesMax = boxes
  keywords: KeywordRef[];
  damageTracks?: { name: string; size: number }[];   // handler 2; duster chassis/mobility
  source: { pack: Id; edition?: string; custom?: boolean } }

interface ForceCard { id: Id; name: string; faction: Id; forceRule: string;
  battleDrills: Ability[]; armory: (Weapon|Ability)[] }

interface Keyword { id: Id; name: string; param?: 'X'; gist: string;
  byRuleset?: Record<Id, string> }       // text varies per ruleset (D9)

interface RulesetProfile { id: Id; startingCp: number; cpCaps: Record<string, number>;
  roundLimit: number; dusterRules: 'core'|'impact-frontline'|'impact-chart'; coverModel: 'binary'|'full-partial' }
```

**Roster (F1):** `{id, name, rulesetId, mode:'core'|'matched'|'skirmish', groups:[{forceCardId, unitIds[]}], handlerId?, dusterId?, notes}` validated by mode rules (e.g. Matched = 1 handler + 1 force + 3 distinct units).

**GameSession (F3):** event-sourced. `state = events.reduce(reducer, init(roster, scenario, ruleset))`. Events: `RoundAdvanced, CpSpent, LoadSpent, DamageMarked, TokenSet, ModelStatusChanged, RuleBoxTicked, ObjectiveScored, Note`. Gives free undo, history log, and AAR export to F4.

## 5. Pack Format (summary — full spec in PACK_FORMAT.md)

```json
{ "format": "blkout-pack", "formatVersion": 1,
  "id": "blackfall", "version": "1.0.0", "title": "...", "author": "...",
  "requires": [{ "id": "core-cards", "range": "^1" }],
  "contentTags": ["military", "mature-themes"],
  "content": { "keywords": [], "factions": [], "forces": [], "units": [],
               "rulesets": [], "scenarios": [], "tables": [], "campaigns": [],
               "errata": [] } }
```

- Validated by Zod on import; errors reported with JSON path. Never partial-import.
- Local ids auto-namespaced to `packId:`. Cross-pack refs must be fully qualified.
- `errata` = typed patches against another pack's ids (e.g. grunt count fix), applied in load order.
- Single JSON file, or `.zip` of JSON files for large packs.

## 6. Campaign Engine (F4)

Seven primitives. Every campaign is a configuration of these.

| Primitive | Purpose | BLACKFALL use | ToD use |
|---|---|---|---|
| **Timeline** | Ordered stages → mission slots | Operational Windows | 5 Phases × 2 Scenarios |
| **Roster** | Teams → named operators; per-operator stats | APACHE teams | SOG teams |
| **Ladder** | Ordered status states + transitions | Injury / readiness (AMBER) | Green→Black casualty track |
| **Pool** | Numeric resource + refresh rules | Supply, CP bonuses | Credits, Drill/Armory pts |
| **Track** | 0..N with milestone effects | Gemini Intel 0–15 | CENTCOM points |
| **Table** | Weighted random entries (seeded) | Random events, reinforcements | Hazards, WARNO/OPORD/FRAGO |
| **Narrative** | Authored text with `{{vars}}` + conditions | FAULTLINE/MONOLITH briefs | Mission intros |

**Behavior = closed Effect DSL + Condition DSL** (no scripting, so it's safe to import).

```
Effects:    addXp, adjustStat, stepLadder, setLadder, adjustPool, adjustTrack, setFlag,
            addOperator, removeOperator, addTeam, unlockMission, lockMission,
            rollTable, showNarrative, grantAsset, promote, if{cond,then,else}
Conditions: flag, trackGte, poolGte, missionOutcome, ladderIs, operatorStat,
            stageIs, roll, all/any/not
```

Targets: `participants | roster | subject | operator:<key> | team:<key>`. Schema extras accepted at G1: calibration profiles, `RulesetProfile.unitLimits/rosterModes`, campaign personas, assets, ranks, custom stats, name tables, ladder scope (operator/team/campaign), AAR fields with mission/operator scope. **Frozen at G1 (2026-10-15)** — see `src/packs/schema`.

Triggers: `onCampaignStart, onStageStart, onMissionStart, onMissionResolved, onStageEnd, onTrackMilestone, onOperatorKia`.

**Mission loop:** Brief (narrative) → Play (optional F3 session) → **AAR form** (outcome, per-operator: participated, kills, injury result, notes; prefilled from the F3 session) → rules apply effects → Debrief narrative → next mission or stage. The AAR is stored as an immutable event. Campaign state is replayable from `seed + AAR log` (reproducible, migration-friendly, F5-ready).

**Custom missions:** players can add ad-hoc missions to a stage, built from a scenario template + objectives + a reward effect list.

**Content filter:** table entries and narrative blocks carry `tags`; the user can exclude tags in settings and those entries are skipped.

## 7. Unit Forge (F2)

- Hard limits come from the active ruleset profile: Skill 4–8, Move 2–12, Armor dice 1 (infantry), 2 (handler), up to 3 (duster); grunts 0–4; specialists 0–2; combat loads 0–2; weapons 1–2; keywords must resolve to loaded definitions.
- Warnings come from a pack-supplied **calibration profile**. BLACKFALL's: Skill 7 regular, 6 SOF, 5 exceptional; no 2/X armor outside handlers. Outlier stats are flagged against loaded official cards (percentile).
- Output: a custom unit in a user pack (`user:…`), usable everywhere a card is.

## 8. Persistence & Export

- Ports: `Repository<T>` (rosters, sessions, campaigns, customUnits), `PackStore`, `Exporter`.
- IndexedDB adapter (`idb` lib). Every record has `schemaVersion`; migrations are a pure, ordered function list.
- Export: JSON (roster / campaign save / user pack), plus print via a dedicated print stylesheet (Letter + A4; card grid and roster sheet). Browser "Save as PDF" covers PDF output.
- Full backup: one-click export of everything.

## 9. F5 Seams (built now, used later)

- Event-sourced sessions and campaigns → sync = append events to a server.
- `Identity` port (local anonymous user now).
- Campaign `participants[]` and a `topology` field (`linear | nodes | map`), with `linear` implemented now.
- Backend candidates (decide at F5): Supabase (Postgres + auth + realtime) or Firebase.

## 10. Quality Gates

- Vitest unit tests: domain + pack loader ≥ 90% lines; engine golden tests (seed + AAR log → expected state).
- Playwright smoke: import pack → build roster → run session → resolve AAR.
- ESLint + svelte-check + `tsc --noEmit` in CI. Deploy only from `main` on green.
- Bundle budget: < 250 KB gzipped initial.

## 11. Work Breakdown (agents)

| WP | Scope | Depends | Agent |
|---|---|---|---|
| WP0 | Scaffold, CI, Pages deploy, lint/test harness | — | Architect |
| WP1 | Pack Zod schemas, domain types, JSON Schema emit | WP0 | Domain |
| WP2 | Pack loader: validate, namespace, deps, errata | WP1 | Domain |
| WP3 | Persistence ports + IndexedDB adapter + migrations | WP1 | Platform |
| WP4 | Campaign engine: primitives, effect/condition interpreters, RNG, replay | WP1 | Engine |
| WP5 | UI shell, design system, card renderer, print CSS | WP0 | UI |
| WPA | App services: pack library, roster/session/campaign services, card mapper, Svelte stores | WP2, WP3, WP4, WP5 | Platform |
| WP6 | F1 roster builder + F2 forge | WPA | UI |
| WP7 | F3 dashboard (event-sourced session) | WPA | UI |
| WP8 | F4 campaign UI (brief, AAR, roster, debrief, import) | WPA | UI |
| WP9 | Reference campaign pack + PACK_FORMAT.md + CAMPAIGN_AUTHORING_GUIDE.md | WP4 | Content |

Critical path: WP0 → WP1 → WP4 → WP8/WP9. Each WP ends with an architect review against this document.

**Gateways:** G0 design (now) · G1 schemas + engine API frozen (after WP1/WP4 interfaces) · G2 F1 + F3 usable · G3 F4 end-to-end with reference pack · G4 authoring guide validated by generating a test campaign in a fresh chat.

## 12. Gateway 0 — Risks & Assumptions

**High blast radius (changes ripple everywhere)**
1. Pack schema + id namespacing (WP1). Frozen at G1; afterwards, changes need a `formatVersion` bump + migration.
2. Effect/Condition DSL op set. Adding is cheap; renaming or removing breaks every published pack.
3. Event shapes for GameSession and Campaign. They're persisted, so changes need migrations.

**Assumptions**
- A1. Players can and will enter official card data themselves (or share packs privately). Without it, F1/F3 have only custom/user units. *Mitigation:* fast card-entry form + paste-import.
- A3. Single device per user until F5 (no sync conflicts).
- A4. The app tracks state; players roll physical dice. No automated hit/damage resolution.

**Likely error sources**
- Keyword text drift across rulesets (digest lists 9 conflicts) → store per-ruleset text, never one global string.
- Damage-track sizes are only visible on card art → manual entry; schema makes them explicit.
- Seeded replay determinism: any `Math.random()` in the engine breaks replay → lint rule bans it in `domain/`.
- IndexedDB unavailable (private browsing) → in-memory fallback + export warning.

**Infrastructure**
- Resolved: repo public, Pages via Actions (D12).
- TypeScript pinned 6.0.x until tooling supports TS 7.
