# BLKOUT: TOC — Pack Format Reference

Format `blkout-pack`, **formatVersion 1** (frozen at G1, DESIGN D13). Authoritative machine schema: [`docs/schema/pack.schema.json`](schema/pack.schema.json) (JSON Schema 2020-12, generated from `src/packs/schema` by `npm run schema`). This document explains it; when they disagree, the schema wins. Field tables below were generated from that file.

For writing campaigns, see [`CAMPAIGN_AUTHORING_GUIDE.md`](CAMPAIGN_AUTHORING_GUIDE.md). Worked example: [`packs/blackfall-gemini.json`](../packs/blackfall-gemini.json).

Contents: [1 Envelope](#1-envelope) · [2 Ids](#2-ids-and-namespacing) · [3 Dependencies](#3-dependencies-and-semver) · [4 Errata](#4-errata) · [5 Content kinds](#5-content-kinds) · [6 Campaigns](#6-campaigns) · [7 DSL](#7-effect--condition-dsl) · [8 Runtime semantics](#8-runtime-semantics) · [9 Validation errors](#9-validation-errors)

## Conventions

- **Strict objects.** Unknown properties are errors everywhere (typos fail loudly).
- **Defaults.** Fields with a default may be omitted. "Req ✓" = must be present.
- **Lists** default to `[]` unless marked `≥n`. Items with a `key` (or `id`) must be unique within their list.
- **Text limits:** name 80 · short 280 · text 4 000 · long 20 000 characters. Lists ≤ 64 unless stated; tags ≤ 32; each content array ≤ 2 000.
- **Scalar** = boolean | number | string ≤ 280.
- **No official content.** Packs in this repo never contain Enemy Spotted Studios card stats, rules text or art (D3/D15).

## 1. Envelope

```json
{
  "$schema": "https://…/docs/schema/pack.schema.json",
  "format": "blkout-pack",
  "formatVersion": 1,
  "id": "my-pack",
  "version": "1.0.0",
  "title": "My Pack",
  "author": "Me",
  "license": "Fan-created. BLKOUT IP belongs to Enemy Spotted Studios.",
  "requires": [{ "id": "core-house", "range": "^1" }],
  "contentTags": ["military"],
  "content": { "keywords": [], "factions": [], "forces": [], "units": [], "rulesets": [],
               "calibrations": [], "scenarios": [], "tables": [], "campaigns": [], "errata": [] }
}
```

<!-- Pack -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `$schema` | string ≤512 |  |  |
| `format` | `"blkout-pack"` | ✓ |  |
| `formatVersion` | `1` | ✓ |  |
| `id` | slug | ✓ |  |
| `version` | semver | ✓ |  |
| `title` | string ≤80 | ✓ |  |
| `author` | string ≤80 | ✓ |  |
| `license` | string ≤280 |  |  |
| `description` | string ≤4000 |  |  |
| `requires` | PackDependency[] (≤32) |  | `[]` |
| `contentTags` | slug[] (≤32) |  | `[]` |
| `content` | PackContent |  | `{}` |

`content` keys (all optional): `keywords`, `factions`, `forces`, `units`, `rulesets`, `calibrations`, `scenarios`, `tables`, `campaigns`, `errata`. `contentTags` describe the pack as a whole (informational); per-item `tags` drive the content filter (§8).

Import is **all-or-nothing**: a pack set either loads completely or not at all, with every error reported (§9). One JSON file per pack.

## 2. Ids and namespacing

| Term | Shape | Where | Namespaced? |
|---|---|---|---|
| **slug** | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–64 chars | pack `id`, content `id`, every `key`, tags | — |
| **local id** | slug | `id` of keywords, factions, forces, units, rulesets, calibrations, scenarios, tables, campaigns | yes, becomes `packId:localId` |
| **ref** | local id *or* `packId:localId` | fields typed `ref` (`faction`, `unit`, `scenario`, `table`, `nameTable`, `rulesets`, keyword `key`, `byRuleset` keys, errata `target`) | yes |
| **key** | slug | campaign-, card- and list-scoped names (missions, stages, ladders, states, operators, weapons …) | **never** |

- The loader prefixes every local id and every bare ref with the owning pack id. `"faction": "rust-choir"` in pack `demo` means `demo:rust-choir`.
- A **cross-pack ref must be qualified** (`other-pack:thing`) and that pack must be in `requires` (directly or transitively).
- Refs are typed by field: `faction` → faction, `unit` → unit, `scenario` → scenario, `table`/`nameTable` → table, `rulesets` → ruleset, keyword `key`/`keywords` → keyword. A ref to an id of the wrong kind is `unresolved_ref`.
- Keys are only unique inside their scope; two campaigns may both have a mission `ambush`.
- Pack id `user` is reserved for Unit Forge output.

### D14 — official card ids (`blkout`)

Official card data never ships in this repo. Players type it into their own pack with id **`blkout`**, using the **printed card code, lowercased**, as the local id: card `TFB-9861` → `blkout:tfb-9861`, handler `HNDL-224` → `blkout:hndl-224`. Independently typed `blkout` packs therefore agree on ids, and other packs can reference cards (`"unit": "blkout:tfb-9861"`) by declaring `{ "id": "blkout", "range": "*" }` in `requires`. Packs meant for public sharing should not hard-depend on `blkout`; put card names in display text instead (see the GEMINI pack's operator `card` field).

## 3. Dependencies and semver

<!-- PackDependency -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `range` | npm-style range ≤64 | ✓ |  |

- `version` is semver `MAJOR.MINOR.PATCH[-pre][+build]`. Bump MAJOR when you rename or remove ids/keys other packs or saves rely on.
- `range` supports: exact `1.2.3`, `=`, `<`, `<=`, `>`, `>=`, caret `^1.2`, tilde `~1.2`, wildcards `1.x` / `*` / `""`, hyphen `1.0.0 - 1.2`, AND by space, OR by `||`. Prerelease versions match only comparators on the same `x.y.z` (npm rule). **Ranges may not contain letters** other than `x`/`X`, so prerelease tags cannot appear in a range.
- Packs load in dependency order (ties keep input order). Cycles are rejected.
- Refs resolve against the pack itself plus its **transitive** dependency closure; referencing a loaded-but-undeclared pack is `undeclared_dependency`.

## 4. Errata

Typed, shallow patches against another pack's content, applied in load order.

```json
{ "kind": "unit", "target": "blkout:tfb-9861", "note": "Grunt count fix", "set": { "grunts": 2 } }
```

| Field | Type | Req | Notes |
|---|---|:-:|---|
| `kind` | `keyword` \| `faction` \| `force` \| `unit` \| `ruleset` \| `calibration` \| `scenario` \| `table` \| `campaign` | ✓ | selects the patch schema |
| `target` | ref | ✓ | usually qualified; the target's pack must be in `requires` |
| `note` | string ≤280 |  | shown in the UI |
| `set` | partial item | ✓ | any top-level fields of that kind except `id`; ≥1 field |

- **Shallow:** each field in `set` replaces the target's field wholesale (patching `weapons` replaces the whole list).
- `set` injects no defaults; the merged item is re-validated against the full kind schema (`errata_invalid` on failure).
- Later packs' errata see earlier packs' patches. Refs inside `set` are validated in the *errata pack's* dependency context.

## 5. Content kinds

### keyword

<!-- Keyword -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `appliesTo` | `weapon` \| `model` | ✓ |  |
| `param` | `"X"` |  |  |
| `gist` | string ≤280 | ✓ |  |
| `byRuleset` | map ruleset ref → string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

`gist` is the fallback text; `byRuleset` holds per-ruleset wording (D9). A `KeywordRef` is `{ "key": ref, "x"?: int 0..99 }` (`"Blast (1)"` → `{"key":"core:blast","x":1}`).

### faction

<!-- Faction -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `code` | string ≤16 |  |  |
| `side` | slug |  |  |
| `text` | string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

### force

<!-- ForceCard -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `faction` | ref | ✓ |  |
| `forceRule` | string ≤4000 | ✓ |  |
| `battleDrills` | Ability[] (≤8) |  | `[]` |
| `armory` | ArmoryItem[] (≤12) |  | `[]` |
| `dusterArmory` | ArmoryItem[] (≤12) |  | `[]` |
| `tags` | slug[] (≤32) |  | `[]` |

`ArmoryItem` = `{ "kind": "weapon", "weapon": Weapon }` | `{ "kind": "ability", "ability": Ability }`.

<!-- Ability -->
| Ability | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `cpCost` | int 0..9 |  |  |
| `usesMax` | int 1..9 |  |  |
| `text` | string ≤4000 | ✓ |  |

### unit

<!-- UnitCard -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `faction` | ref | ✓ |  |
| `type` | `infantry` \| `handler` \| `duster` \| `vehicle` \| `hostile` | ✓ |  |
| `code` | string ≤32 |  |  |
| `skill` | int 2..10 | ✓ |  |
| `move` | int 0..24 | ✓ |  |
| `armor` | `{dice: int 1..3, target: int 2..10}` | ✓ |  |
| `grunts` | int 0..9 | ✓ |  |
| `modelCount` | int 1..20 |  |  |
| `combatLoads` | int 0..9 | ✓ |  |
| `weapons` | Weapon[] (≤8) |  | `[]` |
| `specialists` | Specialist[] (≤8) |  | `[]` |
| `rules` | UnitRule[] (≤8) |  | `[]` |
| `keywords` | KeywordRef[] (≤16) |  | `[]` |
| `damageTracks` | `{key, name, size: int 1..12}`[] (≤4) |  | absent = destroyed on first damage |
| `behavior` | slug[] (≤16) |  | `[]` |
| `source` | `{edition?: string ≤32, custom?: bool}` |  |  |
| `text` | string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

Schema bounds are sanity caps; real rules limits live in `ruleset.unitLimits`, style warnings in calibrations. Armor `"2/6"` → `{"dice":2,"target":6}`.

<!-- Weapon -->
| Weapon | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `minRange` | int 0..96 |  | ≤ `maxRange` |
| `maxRange` | int 1..96 |  |  |
| `damage` | int 0..10 |  |  |
| `keywords` | KeywordRef[] (≤16) |  | `[]` |
| `usesMax` | int 1..9 |  |  |
| `text` | string ≤4000 |  | ability-style weapons |

<!-- Specialist / UnitRule -->
| Specialist | Type | Req | Default |
|---|---|:-:|---|
| `key`, `name` | slug, string ≤80 | ✓ |  |
| `skill` / `move` / `armor` |  as unit |  | inherit from unit |
| `weapons` | Weapon[] (≤4) |  | `[]` |
| `rules` | UnitRule[] (≤4) |  | `[]` |
| `keywords` | KeywordRef[] (≤16) |  | `[]` |

`UnitRule` = `{ key, name, usesMax?: int 1..9 (boxes), text ≤4000 }`.

### ruleset

<!-- RulesetProfile -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `startingCp` | int 0..20 | ✓ |  |
| `cpCaps` | map key → int 0..99 |  | `{}` |
| `roundLimit` | int 1..12 | ✓ |  |
| `dusterRules` | `core` \| `impact-frontline` \| `impact-chart` | ✓ |  |
| `coverModel` | `binary` \| `full-partial` | ✓ |  |
| `unitLimits` | FieldCheck[] (≤64) |  | `[]` (Forge errors) |
| `rosterModes` | RosterMode[] (≤3, one per mode) |  | `[]` |
| `text` | string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

<!-- FieldCheck -->
| FieldCheck | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `field` | `skill` \| `move` \| `armor.dice` \| `armor.target` \| `grunts` \| `combatLoads` \| `specialists` \| `weapons` \| `rules` \| `keywords` \| `weapon.maxRange` \| `weapon.damage` | ✓ | list fields count items |
| `when` | UnitSelector |  | every unit |
| `min` / `max` | number |  | at least one of min/max/in/notIn |
| `in` / `notIn` | number[] (≤64) |  |  |
| `message` | string ≤280 | ✓ |  |

`UnitSelector` = `{ types?: UnitType[], exceptTypes?: UnitType[], tags?: slug[], keywords?: ref[] }`; empty = all units. `Count` = `{ min?: int 0..999, max?: int 0..999 }` with min ≤ max.

<!-- RosterMode -->
| RosterMode | Type | Req | Default |
|---|---|:-:|---|
| `mode` | `core` \| `matched` \| `skirmish` | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `groups` / `forceCardsPerGroup` / `unitsPerGroup` / `handlersPerGroup` | Count | ✓ |  |
| `distinctUnitsPerGroup` | bool |  | `false` |
| `dusters` | `{max: int 0..9, replacesUnit: bool = true}` |  | `{"max":0}` |
| `allowedUnitTypes` | UnitType[] |  |  |
| `limits` | `{key, select: UnitSelector, scope: group\|roster, count: Count, message}`[] (≤16) |  | `[]` |
| `text` | string ≤4000 |  |  |

### calibration

<!-- CalibrationProfile -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `rulesets` | ref[] (≤8) |  | `[]` = any ruleset |
| `checks` | FieldCheck[] (≤64) |  | `[]` (Forge warnings) |
| `outliers` | `{fields: UnitField[] ≥1, percentile: int 1..49}` |  |  |
| `text` | string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

### scenario

A `Mission.scenario` may instead be an **inline scenario**: the same object without `id`.

<!-- Scenario -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ (not inline) |  |
| `name` | string ≤80 | ✓ |  |
| `lore` | string ≤20000 |  |  |
| `tableSize` | `{width: int 6..120, depth: int 6..120, unit: in\|cm = in}` | ✓ |  |
| `roundLimit` | int 1..12 | ✓ |  |
| `hardpoints` | int 0..12 |  | `0` |
| `pois` | `{key, name, text?}`[] (≤16) |  | `[]` |
| `forces` | `{symmetric: bool = true, sides: ScenarioSide[] ≤4}` | ✓ |  |
| `deployment` | `{text ≤4000, zones: {side: key, text ≤280}[] ≤8}` | ✓ |  |
| `specialRules` | `{key, name, text?}`[] (≤16) |  | `[]` |
| `scoring` | ScoringRule[] (≤32) |  | `[]` |
| `endConditions` | `{key, text ≤280}`[] (≤8) |  | `[]` |
| `scoreLabel` | string ≤80 |  | `"VP"` |
| `campaignReward` | string ≤4000 |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

<!-- ScenarioSide -->
| ScenarioSide | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `text` | string ≤4000 |  |  |
| `rosterMode` | `core` \| `matched` \| `skirmish` |  |  |
| `units` | `{unit: ref, count: int 1..20 = 1}`[] (≤16) |  | `[]` (needs the unit's pack) |
| `behavior` | slug[] (≤16) |  | `[]` |

<!-- ScoringRule -->
| ScoringRule | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `event` | slug | ✓ | label the dashboard logs |
| `label` | string ≤80 | ✓ |  |
| `points` | int -99..99 | ✓ |  |
| `timing` | `{when: immediate\|end-of-round\|end-of-game, rounds?: int 1..12[]}` |  | `{"when":"immediate"}` |
| `max` | int 1..99 |  |  |
| `side` | slug |  |  |
| `text` | string ≤4000 |  |  |

### table

Weighted random table, shared by campaigns and scenarios (seeded RNG).

<!-- Table -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `text` | string ≤4000 |  |  |
| `entries` | TableEntry[] (**≥1**, ≤200) | ✓ |  |
| `tags` | slug[] (≤32) |  | `[]` (an excluded tag filters the whole table) |

<!-- TableEntry -->
| TableEntry | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `weight` | int 1..1000 | ✓ |  |
| `label` | string ≤80 | ✓ | logged; also the rolled name in a name table |
| `narrative` | `{title?, text, speaker?, tags}` |  | needs `effects` and/or `narrative` |
| `effects` | Effect[] (≤64) |  | `[]` |
| `when` | Condition |  | entry eligible only when true |
| `tags` | slug[] (≤32) |  | `[]` |

### campaign

See §6.

## 6. Campaigns

Seven primitives (DESIGN §6): **Timeline**, **Roster**, **Ladder**, **Pool**, **Track**, **Table**, **Narrative**, plus missions and triggers.

<!-- Campaign -->
| Field | Type | Req | Default |
|---|---|:-:|---|
| `id` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `summary` | string ≤4000 |  |  |
| `intro` | string ≤20000 |  | shown at start, untagged |
| `rulesets` | ref[] (≤8) |  | `[]` |
| `personas` | Persona[] (≤16) |  | `[]` |
| `roster` | RosterDef | ✓ |  |
| `timeline` | Timeline | ✓ |  |
| `missions` | Mission[] (≤200) |  | `[]` |
| `ladders` | Ladder[] (≤16) |  | `[]` |
| `pools` | Pool[] (≤16) |  | `[]` |
| `tracks` | Track[] (≤16) |  | `[]` |
| `narratives` | NarrativeBlock[] (≤500) |  | `[]` |
| `triggers` | Trigger[] (≤200) |  | `[]` |
| `assets` | `{key, name, text?}`[] (≤64) |  | `[]` |
| `tags` | slug[] (≤32) |  | `[]` |

| Persona | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ | referenced by `speaker` |
| `name` | string ≤80 | ✓ |  |
| `callsign` | string ≤80 |  |  |
| `role` | string ≤280 |  |  |
| `text` | string ≤280 |  | voice notes |

### Roster

<!-- RosterDef -->
| RosterDef | Type | Req | Default |
|---|---|:-:|---|
| `startingTeams` | TeamDef[] (≤16) |  | `[]` |
| `pick` | Count |  | `{"min":1,"max":1}` teams chosen at start |
| `teamsMax` | int 1..32 |  |  |
| `operatorsPerTeam` | Count |  | full team → recruit becomes a pending choice |
| `stats` | StatDef[] (≤16) |  | `[]`; built-ins `xp`, `kills`, `missions` always exist |
| `operatorFields` | FieldDef[] (≤16) |  | `[]` sheet data |
| `ranks` | RankDef[] (≤16) |  | `[]`; first = starting rank |
| `nameTable` | ref (table) |  | entry `label` = rolled name |

| TeamDef | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `callsign` | string ≤80 |  |  |
| `text` | string ≤280 |  |  |
| `operators` | OperatorSeed[] (≤24) |  | `[]` |
| `tags` | slug[] (≤32) |  | `[]` |

<!-- OperatorSeed -->
| OperatorSeed | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug |  | needed to target `operator:<key>` |
| `name` | string ≤80 |  | absent = roll `nameTable` |
| `callsign` | string ≤80 |  |  |
| `unit` | ref (unit) |  | creates a pack dependency |
| `stats` | map stat key → int |  |  |
| `fields` | map field key → Scalar |  |  |
| `tags` | slug[] (≤32) |  | `[]` |

| StatDef / RankDef / FieldDef | Fields |
|---|---|
| StatDef | `key`, `name`, `initial` = 0, `min?`, `max?` (clamped) |
| RankDef | `key`, `name`, `xp?` (auto-promote when xp ≥ value; never demotes; xp-less ranks are promote-only) |
| FieldDef | `key`, `label`, `kind: boolean\|number\|choice\|text`, `options?: {value: slug, label}[]` (required for `choice`), `min?`, `max?`, `default?`, `help? ≤280` |

### Timeline

| Timeline | Type | Req | Default |
|---|---|:-:|---|
| `topology` | `linear` \| `nodes` \| `map` |  | `"linear"` (only `linear` implemented) |
| `stages` | Stage[] (**≥1**, ≤32) | ✓ |  |

<!-- Stage -->
| Stage | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `briefing` | NarrativeRef |  |  |
| `slots` | MissionSlot[] (≤16) |  | `[]` |
| `allowCustomMissions` | bool |  | `true` |
| `endWhen` | Condition |  | completes early when true |

<!-- MissionSlot -->
| MissionSlot | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `label` | string ≤80 |  |  |
| `missions` | mission key[] (≥1, ≤16) | ✓ | player picks one |
| `optional` | bool |  | `false` |

### Missions

<!-- Mission -->
| Mission | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `scenario` | ref \| inline scenario |  |  |
| `briefing` | NarrativeRef |  | shown on begin |
| `debrief` | NarrativeRef |  | shown after the outcome narrative |
| `objectives` | Objective[] (≤16) |  | `[]` |
| `aar` | `{fields: AarField[] ≤24}` |  | `{}` |
| `outcomes` | MissionOutcome[] (**≥1**, ≤8) | ✓ |  |
| `locked` | bool |  | `false` (needs `unlockMission`) |
| `repeatable` | bool |  | `false` |
| `tags` | slug[] (≤32) |  | `[]` |

`Objective` = `{ key, text ≤280, primary = false, points?: int -99..99 }`. `MissionOutcome` = `{ key, name, effects = [], narrative?: NarrativeRef }`.

<!-- AarField -->
| AarField | Type | Req | Default |
|---|---|:-:|---|
| `key`, `label`, `kind`, `options`, `min`, `max`, `default`, `help` | as FieldDef | | |
| `scope` | `mission` \| `operator` | ✓ | operator = asked per participating operator |
| `onValue` | `{value: Scalar, effects}`[] (≤16) |  | `[]`; value must match `kind` / an option |
| `perUnit` | Effect[] (≤64) |  | `[]`; `number` fields only, applied once per unit |

The engine always records outcome, notes, and per operator `participated` (default true), `kills`, `notes`. An **operator-scope field keyed `kills` or `participated` reads the engine value** instead of asking again.

### Ladder

<!-- Ladder -->
| Ladder | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `scope` | `operator` \| `team` \| `campaign` |  | `"operator"` |
| `states` | `{key, name, text? ≤280, onEnter: Effect[], tags}`[] (**≥2**, ≤16) | ✓ | ordered |
| `initial` | state key | ✓ |  |
| `transitions` | `{from: state\|"*", to: state, when?, effects}`[] (≤32) |  | `[]` |

### Pool

<!-- Pool -->
| Pool | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `initial` | int |  | `0` |
| `min` | int |  | `0` |
| `max` | int |  |  |
| `refresh` | `{on: TriggerEvent, mode: set\|add, amount: int, when?}`[] (≤8) |  | `[]` |

### Track

<!-- Track -->
| Track | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `name` | string ≤80 | ✓ |  |
| `min` | int -999..999 |  | `0` |
| `max` | int -999..999 | ✓ |  |
| `initial` | int |  | `0`; must be within min..max |
| `milestones` | Milestone[] (≤32) |  | `[]`; `at` within min..max |

<!-- Milestone -->
| Milestone | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `at` | int | ✓ |  |
| `once` | bool |  | `true` (false = every upward crossing) |
| `effects` | Effect[] (≤64) |  | `[]` |
| `narrative` | NarrativeRef |  |  |

### Narrative

<!-- NarrativeBlock -->
| NarrativeBlock | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `title` | string ≤80 |  |  |
| `text` | template ≤20000 | ✓ | `{{var}}` placeholders |
| `speaker` | persona key |  |  |
| `tags` | slug[] (≤32) |  | `[]` |
| `when` | Condition |  | skipped silently when false |

`NarrativeRef` = a narrative block key **or** an inline `{title?, text, speaker?, tags}` (no `when`). Template variables: §8.

### Trigger

<!-- Trigger -->
| Trigger | Type | Req | Default |
|---|---|:-:|---|
| `key` | slug | ✓ |  |
| `on` | `onCampaignStart` \| `onStageStart` \| `onMissionStart` \| `onMissionResolved` \| `onStageEnd` \| `onTrackMilestone` \| `onOperatorKia` | ✓ |  |
| `filter` | `{stage?, mission?, track?, milestone?}` |  | narrows the event |
| `when` | Condition |  |  |
| `once` | bool |  | `false` |
| `effects` | Effect[] (≤64) |  | `[]` |
| `narrative` | NarrativeRef |  | shown before effects |

## 7. Effect / Condition DSL

Closed DSLs: every op is data. Unknown ops are schema errors. Full shapes: `$defs.Effect` / `$defs.Condition` in the JSON Schema.

**Target** (operator selector): `participants` (operators marked participated in the AAR being resolved) · `roster` (all active operators) · `subject` (the operator in context: per-operator AAR field, operator ladder `onEnter`/transition, `onOperatorKia`, manual adjustment subject) · `operator:<key>` · `team:<key>`.

| Effect `op` | Fields |
|---|---|
| `addXp` | `target`, `amount` (auto-promotes by rank `xp`) |
| `adjustStat` | `target`, `stat`, `amount` (clamped to StatDef) |
| `stepLadder` | `ladder`, `target?`, `steps` int -16..16 (clamps at ends; + = toward last state) |
| `setLadder` | `ladder`, `target?`, `state` |
| `adjustPool` | `pool`, `amount` |
| `adjustTrack` | `track`, `amount` (clamped; fires milestones crossed upward) |
| `setFlag` | `flag`, `value` Scalar = `true` |
| `addOperator` | `team`, `operator`: OperatorSeed (team full/missing → player choice) |
| `removeOperator` | `target`, `reason`: `kia`\|`mia`\|`captured`\|`retired`\|`transferred` |
| `addTeam` | `team`: TeamDef |
| `unlockMission` | `mission`, `stage?` (pins the mission to that stage) |
| `lockMission` | `mission` (only affects `available` missions) |
| `rollTable` | `table` ref, `times` int 1..5 = 1 |
| `showNarrative` | `narrative`: NarrativeRef |
| `grantAsset` | `asset`, `team?` (absent = campaign-level), `count` int 1..99 = 1 |
| `promote` | `target`, `rank?` (absent = next rank) |
| `if` | `cond`: Condition, `then`: Effect[], `else?`: Effect[] |

| Condition `op` | Fields |
|---|---|
| `flag` | `flag`, `equals?` Scalar (absent = truthy) |
| `trackGte` | `track`, `value` (must be within the track's range) |
| `poolGte` | `pool`, `value` |
| `missionOutcome` | `mission?` (absent = mission being resolved), `outcomes`: key[] 1..8 |
| `ladderIs` | `ladder`, `target?`, `states`: key[] 1..16, `match` = `any` |
| `operatorStat` | `target`, `stat`, `cmp`: `gte`\|`lte`\|`eq` = `gte`, `value`, `match` = `any` |
| `stageIs` | `stage` |
| `roll` | `sides` int 2..100, `gte` int 1..100 (seeded; passes when 1d`sides` ≥ `gte`) |
| `all` / `any` | `of`: Condition[] 1..64 |
| `not` | `cond`: Condition |

`match` (quantifier): `any` (default) · `all` (false on an empty selection) · `none`.

## 8. Runtime semantics

- **Ladder targets.** `target` absent → `subject` when bound, else `participants`. Team-scope ladders resolve operator targets to their teams (with no target and nobody selected: all teams). Campaign-scope ladders ignore `target`. `onEnter` runs on *every* entry, including `stepLadder` moves.
- **AAR resolution order:** engine stats (`missions`, `kills`) → outcome `effects` → mission-scope fields (declaration order) → for each participant, operator-scope fields (declaration order; stops if the operator is removed) → outcome narrative → `debrief` → `onMissionResolved` triggers.
- **Triggers** fire in declaration order; pool `refresh` rules for the event run first. `narrative` renders before `effects`.
- **Stage completion** is sticky: all non-optional slots resolved, or `endWhen` true. A stage with no slots completes on entry. The player then advances; advancing past the last stage completes the campaign.
- **Slots.** A slotted mission belongs to the **first** stage whose slot lists it; resolving any candidate closes the slot. Unslotted missions float (available in any stage) unless `unlockMission.stage` pins them. `repeatable` missions stay beginnable after resolution.
- **Custom missions** (player-added) get outcomes `success` (with the player's reward effects) and `failure`, and no AAR fields.
- **Milestones** fire when a track crosses `at` upward, lowest first; downward moves never fire.
- **Caps:** 32 nested effect levels, 5 000 effects per event; exceeding either halts that event with an error entry.
- **Content filter.** Narrative blocks, table entries and whole tables carry `tags`. Excluded narrative becomes a "withheld" placeholder; excluded table entries are not rolled.
- **Template variables** (`{{var}}`): `operator.{key,name,callsign,rank,team,unit,status}`, `operator.<stat>`, `operator.field.<key>`, `operator.ladder.<key>` · `team.{key,name,callsign,size}`, `team.ladder.<key>`, `team.asset.<key>` · `mission.{key,name,outcome,status}` · `campaign.{name,stage,stageKey}`, `campaign.ladder.<key>`, `campaign.asset.<key>`, `campaign.flag.<key>` · `track.<key>`, `track.<key>.{name,max}` · `pool.<key>`, `pool.<key>.name` · `persona.<key>`, `persona.<key>.{name,callsign,role}`. Unknown or out-of-scope variables render as `[?var]`.

## 9. Validation errors

Every error is `{ code, path, message, packId? }`; `path` is an RFC 6901 JSON pointer into the pack file (`/content/campaigns/0/missions/2/outcomes`). Pipeline: parse → schema → namespace → dependencies → refs → errata → campaign keys → registry. Parse/schema errors stop the run early.

| Code | Means | Fix |
|---|---|---|
| `json_syntax` | Not valid JSON. | Fix trailing commas, quotes, comments (JSON has none). |
| `schema` | Shape violation: unknown property, wrong type, missing required field, bad slug, limit exceeded, duplicate `key`/`id` in a list, `choice` without `options`, ladder `initial`/transition state unknown, track `initial`/milestone outside range, malformed `{{var}}`. | Read `message` at `path`; compare with the tables above. |
| `duplicate_pack` | Same pack `id` supplied twice. | Load one copy, or rename. |
| `missing_dependency` | A `requires` entry isn't loaded. | Load that pack or remove the requirement. |
| `dependency_version` | Loaded version outside `range`. | Update the dependency or widen the range. |
| `invalid_range` | Range passed the character check but can't be parsed. | Use a supported form (§3). |
| `dependency_cycle` | A requires B requires … A. | Break the cycle; move shared content to a third pack. |
| `undeclared_dependency` | A ref points into a loaded pack not in `requires` (transitively). | Add it to `requires`. |
| `errata_target_missing` | Errata `target` doesn't exist (or its pack isn't loaded/declared). | Fix the qualified id; add the pack to `requires`. |
| `errata_invalid` | Target + `set` fails the kind schema. | Fix the patched fields (path is under `/set`). |
| `duplicate_id` | The same qualified id registered twice for a kind. | Rename one item. |
| `unresolved_ref` | A ref names no item of the expected kind. | Check spelling, kind, and pack prefix. |
| `unresolved_key` | Campaign key not defined: mission, stage, ladder or ladder state, pool, track, milestone, stat, persona (`speaker`), narrative key, rank, team, operator, asset, mission outcome. Shared tables are checked in the context of every campaign that rolls them. | Define the key, or fix the typo. Teams/operators may also be introduced by `addTeam`/`addOperator`. |
| `invalid_value` | `trackGte.value` outside the track's range; `perUnit` on a non-number field; `onValue.value` of the wrong type or not an option. | Align values with the field/track definition. |
