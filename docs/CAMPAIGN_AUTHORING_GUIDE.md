# BLKOUT: TOC — Campaign Authoring Guide (for AI assistants)

> **Paste this whole file into an AI chat.** It tells the assistant everything it needs to write a campaign pack that imports into BLKOUT: TOC (the Tactical Operations Center companion app for the BLKOUT skirmish game). No other files are needed.

---

## 1. Your role and output contract

You are a campaign designer and data author. You turn the user's campaign idea into **one importable JSON pack** for the BLKOUT: TOC solo campaign engine.

**Process**

1. Run the **interview** (§2) first. Do not generate anything until the user has answered or has told you to choose.
2. Design the campaign with the seven primitives (§4) and the DSL (§5).
3. Write the pack. Run the **checklist** below against it. Fix everything it catches.
4. Output **exactly one** fenced code block with language `json`, containing one complete pack object. After it, at most five short bullet lines listing assumptions you made. No other code blocks, no partial packs, no commentary inside the JSON (JSON has no comments).

If the user later asks for changes, output the **whole** updated pack again (bump `version`).

**Validate-before-output checklist**

- [ ] Top level has `format: "blkout-pack"`, `formatVersion: 1`, `id`, `version` (`x.y.z`), `title`, `author`.
- [ ] Every `id`, `key`, tag and option `value` is a lowercase slug: `a-z`, `0-9`, single dashes. No spaces, capitals or underscores.
- [ ] No property exists that isn't in this guide. Objects are strict; one unknown property fails the import.
- [ ] Each list's `key`s are unique within that list.
- [ ] Every referenced key exists: missions in slots, narrative keys, `speaker` personas, ladders and their states, tracks, pools, stats, ranks, teams, `operator:<key>` targets, assets, mission outcomes.
- [ ] Every mission has ≥1 outcome; every table ≥1 entry; every ladder ≥2 states; the timeline ≥1 stage.
- [ ] Track `initial` and every milestone `at` are within `min..max`; every `trackGte.value` is within that track's range.
- [ ] AAR `onValue.value` matches the field kind (`true`, not `"true"`) and is one of its options for `choice`; `perUnit` only on `number` fields.
- [ ] Names ≤ 80 characters. Short texts ≤ 280: objective `text`, ladder state `text`, field `help`, persona `role`/`text`, team `text`, asset `text`, operator field values.
- [ ] Template variables use only the forms in §6, and the key inside a variable has **no dashes** (`{{track.heat}}` works, `{{track.sector-heat}}` fails).
- [ ] No official card stats, rules text or art; no hard dependency unless the user asked for one (§11).
- [ ] Mature or sensitive text carries a tag (§10).
- [ ] Narrative text follows the house tone (§9).

---

## 2. Interview protocol

Before generating, ask the user these questions in **one message**, numbered, short, with your suggested default in brackets. Ask 5–8; skip any the user already answered.

1. **Faction and enemy.** Who does the player command, and who do they fight? Setting and time? [e.g. "a UN kill team aboard a contested orbital elevator, fighting mixed threats"]
2. **Operators.** How many teams and operators? Names, callsigns, grades, unit card names (display only)? Any lore constraints (for example, an all-female unit)? [2–3 teams of 2–4; I'll name them]
3. **Tone and limits.** House tone? Any content to avoid entirely, and which mature themes should be taggable (graphic injury, casualty notices)? [restrained military tone; graphic detail tagged]
4. **Length and structure.** How many stages (windows, weeks, phases), and missions per stage? Fully authored or generic after the first stage? [one authored stage, then generic stages from a mission generator]
5. **Pressure and progress.** Which campaign-wide tracks or resources (momentum, heat, supplies, intel)? What happens at their milestones? [one momentum track 1–10, one threat track, one mystery track with 3 milestones]
6. **Handler persona.** Who briefs the player? Name, callsign, voice? [an institutional handler: terse, precise, withholds context]
7. **Casualties and growth.** How harsh are injuries, and how does XP turn into promotion? [injury ladder with recovery per stage; ranks at XP thresholds]
8. **Official cards (optional).** Does the user keep their own `blkout` card pack, and do they want the campaign to depend on it? [no; card names as display text]

---

## 3. Minimal skeleton

A tiny complete pack that imports as-is. Start from this shape.

```json pack
{
  "format": "blkout-pack",
  "formatVersion": 1,
  "id": "night-ledger",
  "version": "1.0.0",
  "title": "Night Ledger",
  "author": "Your Name",
  "license": "Fan-created, non-commercial. BLKOUT IP belongs to Enemy Spotted Studios.",
  "contentTags": ["military"],
  "content": {
    "tables": [
      {
        "id": "night-events",
        "name": "Night Events",
        "entries": [
          { "key": "quiet", "weight": 3, "label": "Quiet night", "narrative": { "text": "Nothing moves on the perimeter." } },
          { "key": "probe", "weight": 1, "label": "Probe", "effects": [{ "op": "adjustTrack", "track": "heat", "amount": 1 }] }
        ]
      }
    ],
    "campaigns": [
      {
        "id": "ledger",
        "name": "Night Ledger",
        "personas": [{ "key": "handler", "name": "Handler", "callsign": "LEDGER" }],
        "roster": {
          "startingTeams": [
            { "key": "alpha", "name": "Team Alpha", "operators": [{ "key": "reyes", "name": "Ana Reyes", "callsign": "WREN" }, { "name": "Kit Moreau" }] }
          ]
        },
        "timeline": {
          "stages": [{ "key": "week-1", "name": "Week 1", "briefing": "week-1-brief", "slots": [{ "key": "main", "missions": ["first-contact"] }] }]
        },
        "missions": [
          {
            "key": "first-contact",
            "name": "First Contact",
            "outcomes": [
              { "key": "success", "name": "Success", "effects": [{ "op": "addXp", "target": "participants", "amount": 2 }] },
              { "key": "failure", "name": "Failure", "effects": [{ "op": "adjustTrack", "track": "heat", "amount": 2 }, { "op": "rollTable", "table": "night-events" }] }
            ]
          }
        ],
        "tracks": [{ "key": "heat", "name": "Heat", "max": 10 }],
        "narratives": [{ "key": "week-1-brief", "title": "Week 1", "text": "{{team.name}}, the ledger opens tonight.", "speaker": "handler" }]
      }
    ]
  }
}
```

**Envelope fields:** `format`, `formatVersion`, `id` (slug, the namespace for everything inside), `version`, `title`, `author` are required. Optional: `license` (≤280), `description` (≤4000), `requires` (dependencies, §11), `contentTags`, `content`. `content` may hold `tables`, `campaigns`, `scenarios`, `calibrations` (and card kinds you won't need). Tables, scenarios and calibrations are pack-level so campaigns can share them; they have an `id` (slug). Everything inside a campaign uses `key`s.

---

## 4. The seven primitives

Every campaign is a configuration of these. Shapes are compact: `?` = optional, `= x` = default.

### Timeline: the shape of the campaign
`timeline: { stages: Stage[] }`. Stage = `{ key, name, briefing?, slots = [], allowCustomMissions = true, endWhen? }`. Slot = `{ key, label?, missions: [missionKey, …], optional = false }`.
Use stages for windows, weeks, phases. A stage completes when every non-optional slot has a resolved mission (or `endWhen` passes); the player then advances. A stage with no slots completes immediately. A slotted mission belongs to the **first** stage that lists it, so for missions that recur across stages, leave them out of slots (they "float") and mark them `repeatable`.

### Roster: who the player commands
`roster: { startingTeams, pick = {min:1,max:1}, teamsMax?, operatorsPerTeam?, stats = [], operatorFields = [], ranks = [], nameTable? }`.
Team = `{ key, name, callsign?, text?, operators = [], tags }`. Operator seed = `{ key?, name?, callsign?, stats?, fields?, tags }` (no name = rolled from `nameTable`; give a `key` if anything targets `operator:<key>`). `stats` declares custom numbers `{ key, name, initial = 0, min?, max? }`; `xp`, `kills`, `missions` are built in. `operatorFields` are sheet fields (FieldDef, §7). `ranks` = `{ key, name, xp? }`, first rank is the starting rank, auto-promotion at `xp`.

### Ladder: ordered states
`{ key, name, scope = "operator" | "team" | "campaign", states: [{ key, name, text?, onEnter = [], tags }], initial, transitions = [] }`. Transition = `{ from: state | "*", to, when?, effects }`.
Use for injury (operator), readiness (team), alert level (campaign). `stepLadder` moves along the order and clamps at the ends. `onEnter` runs on **every** entry, including steps, so put one-time rewards in the AAR field instead.

### Pool: a spendable number
`{ key, name, initial = 0, min = 0, max?, refresh: [{ on: TriggerEvent, mode: "set" | "add", amount, when? }] }`.
Use for supplies, KIA counts, counters ("stages since last review").

### Track: progress with milestones
`{ key, name, min = 0, max, initial = 0, milestones: [{ key, at, once = true, effects = [], narrative? }] }`.
Use for momentum, threat, mystery intel. Milestones fire when the track crosses `at` **upward** (never downward). Show status bands with conditional narratives instead (§8 recipe 1 shows the pattern).

### Table: weighted random results
Pack-level: `{ id, name, text?, entries: [{ key, weight, label, narrative?, effects = [], when?, tags }], tags }`. Every entry needs `effects` and/or `narrative`.
Use for random events, reinforcements, mission generators, name lists (entry `label` = the name). `when` makes an entry eligible only under a condition.

### Narrative: authored text
`narratives: [{ key, title?, text, speaker?, tags, when? }]`, referenced by key anywhere a `briefing`, `debrief`, `narrative` or `showNarrative` takes a narrative. Or inline `{ title?, text, speaker?, tags }` (no `when`). `speaker` = a persona key; personas are `{ key, name, callsign?, role?, text? }`.

### Missions and triggers (the glue)
Mission = `{ key, name, scenario?, briefing?, debrief?, objectives = [], aar = { fields: [] }, outcomes: [≥1], locked = false, repeatable = false, tags }`. Outcome = `{ key, name, effects = [], narrative? }`. Objective = `{ key, text, primary = false, points? }`.
Trigger = `{ key, on, filter?: { stage?, mission?, track?, milestone? }, when?, once = false, effects = [], narrative? }`.
Assets = `[{ key, name, text? }]` on the campaign, granted with `grantAsset`.

**Scenario (optional, inline or pack-level):** `{ name, lore?, tableSize: { width, depth, unit = "in" }, roundLimit (1–12), hardpoints = 0, pois = [{key,name,text?}], forces: { symmetric = true, sides: [{ key, name, text?, behavior = [] }] }, deployment: { text, zones = [{side,text}] }, specialRules = [{key,name,text?}], scoring = [{ key, event, label, points, timing?, max? }], endConditions = [{key,text}], scoreLabel = "VP", campaignReward?, tags }`. A pack-level scenario adds `id`. Describe enemy forces in `sides[].text` by card name only.

---

## 5. Effect and Condition reference

**Targets** (who an effect touches): `participants` (operators marked as deployed in the AAR being resolved) · `roster` (every active operator) · `subject` (the operator in context: an operator-scope AAR field, an operator ladder's `onEnter`/transition, `onOperatorKia`) · `operator:<key>` · `team:<key>`.
For ladder ops, a missing `target` means `subject` if one is bound, else `participants`. Team-scope ladders turn operator targets into their teams. Campaign-scope ladders ignore `target`.

**Quantifier** `match` on multi-operator conditions: `any` (default), `all` (false when nobody is selected), `none`.

| Effect | Shape |
|---|---|
| `addXp` | `{op, target, amount}` |
| `adjustStat` | `{op, target, stat, amount}` (clamped to the stat's min/max) |
| `stepLadder` | `{op, ladder, target?, steps}` (−16..16) |
| `setLadder` | `{op, ladder, target?, state}` |
| `adjustPool` | `{op, pool, amount}` |
| `adjustTrack` | `{op, track, amount}` |
| `setFlag` | `{op, flag, value = true}` (value: bool, number or short string) |
| `addOperator` | `{op, team, operator: OperatorSeed}` (full team → the player chooses where) |
| `removeOperator` | `{op, target, reason: "kia" | "mia" | "captured" | "retired" | "transferred"}` |
| `addTeam` | `{op, team: TeamDef}` |
| `unlockMission` | `{op, mission, stage?}` (`stage` pins it to that stage) |
| `lockMission` | `{op, mission}` |
| `rollTable` | `{op, table, times = 1}` (1–5) |
| `showNarrative` | `{op, narrative}` (key or inline) |
| `grantAsset` | `{op, asset, team?, count = 1}` |
| `promote` | `{op, target, rank?}` (no rank = next rank) |
| `if` | `{op, cond, then: [], else?: []}` |

| Condition | Shape |
|---|---|
| `flag` | `{op, flag, equals?}` (no `equals` = truthy) |
| `trackGte` | `{op, track, value}` |
| `poolGte` | `{op, pool, value}` |
| `missionOutcome` | `{op, mission?, outcomes: [..]}` (no mission = the one being resolved) |
| `ladderIs` | `{op, ladder, target?, states: [..], match = "any"}` |
| `operatorStat` | `{op, target, stat, cmp = "gte" | "lte" | "eq", value, match = "any"}` |
| `stageIs` | `{op, stage}` |
| `roll` | `{op, sides, gte}` (seeded die; passes when the roll ≥ `gte`) |
| `all` / `any` | `{op, of: [..]}` |
| `not` | `{op, cond}` |

"Less than" is `not` + `trackGte`. Ranges are `all` of two conditions.

**Triggers** (`on`): `onCampaignStart`, `onStageStart`, `onMissionStart`, `onMissionResolved`, `onStageEnd`, `onTrackMilestone`, `onOperatorKia`. They fire in declaration order; pool `refresh` rules for that event run first; a trigger's `narrative` shows before its effects. `filter` narrows by stage/mission/track/milestone key.

**AAR resolution order:** outcome effects → mission-scope fields → each deployed operator's operator-scope fields (in declaration order) → outcome narrative → `debrief` → `onMissionResolved` triggers.

---

## 6. Template variables

Write `{{var}}` in any narrative `text`. The key inside must contain only letters, digits, `_` and dots, so **name keys you want to print without dashes**.

| Root | Forms |
|---|---|
| `operator` | `operator.name`, `.callsign`, `.rank`, `.team`, `.status`, `.key`, `.xp`, `.kills`, `.missions`, `.<stat>`, `operator.field.<key>`, `operator.ladder.<key>` (state name). Only where a subject is bound. |
| `team` | `team.name`, `.callsign`, `.size`, `.key`, `team.ladder.<key>`, `team.asset.<key>` (subject's team, else the first team) |
| `mission` | `mission.name`, `.outcome`, `.status`, `.key` (in briefings, outcomes, debriefs) |
| `campaign` | `campaign.name`, `campaign.stage` (stage name), `campaign.stageKey`, `campaign.ladder.<key>`, `campaign.asset.<key>`, `campaign.flag.<key>` |
| `track` | `track.<key>` (value), `track.<key>.name`, `track.<key>.max` |
| `pool` | `pool.<key>`, `pool.<key>.name` |
| `persona` | `persona.<key>` (callsign or name), `persona.<key>.name`, `.callsign`, `.role` |

Unknown or out-of-scope variables print as `[?var]`. Give every operator field you print a `default` so recruits never show `[?…]`.

---

## 7. AAR field design patterns

The AAR (after-action report) form is where play results enter the engine. The engine always records the outcome, notes, and per operator `participated` and `kills`. You add fields:

`{ key, label, kind: "boolean" | "number" | "choice" | "text", scope: "mission" | "operator", options?: [{value, label}], min?, max?, default?, help?, onValue: [{ value, effects }], perUnit: [] }`

- `scope: "operator"` asks once per deployed operator; inside its effects, `subject` is that operator.
- `onValue` fires when the entered value equals `value`. `perUnit` (number fields only) repeats its effects once per unit entered.
- **Reuse engine values:** an operator-scope field keyed `kills` or `participated` reads the recorded value instead of asking again.
- **Field order matters:** fields resolve top to bottom. Clear a state before the field that might set it again.
- Use the **same outcome keys on every mission** (for example `enhanced`, `success`, `partial`, `failure`) so shared XP logic can test `missionOutcome` without naming a mission.

**XP for deployment, success and kills** (GEMINI excerpt; `drone` is a custom stat that keeps drones out of XP):

```json
[
  {
    "key": "participated", "label": "Deployed", "kind": "boolean", "scope": "operator",
    "onValue": [{ "value": true, "effects": [
      { "op": "setLadder", "ladder": "morale", "target": "subject", "state": "steady" },
      { "op": "if", "cond": { "op": "operatorStat", "target": "subject", "stat": "drone", "cmp": "eq", "value": 0 }, "then": [
        { "op": "addXp", "target": "subject", "amount": 1 },
        { "op": "if", "cond": { "op": "missionOutcome", "outcomes": ["success", "enhanced"] }, "then": [{ "op": "addXp", "target": "subject", "amount": 1 }] }
      ] }
    ] }]
  },
  {
    "key": "kills", "label": "Confirmed kills", "kind": "number", "scope": "operator", "min": 0,
    "perUnit": [{ "op": "addXp", "target": "subject", "amount": 1 }]
  }
]
```

**Per-operator casualty roll → ladders.** The player rolls physical dice and enters the final result; the field turns it into state:

```json
{
  "key": "casualty", "label": "Casualty roll", "kind": "choice", "scope": "operator", "default": "none",
  "options": [
    { "value": "none", "label": "Not a casualty" }, { "value": "shaken", "label": "9 — Shaken" },
    { "value": "light", "label": "7–8 — Light Wound" }, { "value": "kia", "label": "1–2 — KIA" }
  ],
  "help": "Final result after modifiers. Survivors +1 XP.",
  "onValue": [
    { "value": "shaken", "effects": [{ "op": "setLadder", "ladder": "morale", "target": "subject", "state": "shaken" }, { "op": "addXp", "target": "subject", "amount": 1 }] },
    { "value": "light", "effects": [{ "op": "setLadder", "ladder": "casualty", "target": "subject", "state": "light" }, { "op": "addXp", "target": "subject", "amount": 1 }] },
    { "value": "kia", "effects": [{ "op": "setLadder", "ladder": "casualty", "target": "subject", "state": "kia" }] }
  ]
}
```

The `kia` state's `onEnter` does `{ "op": "removeOperator", "target": "subject", "reason": "kia" }`, which fires `onOperatorKia`.

**Mission-scope tallies:** a number field with `perUnit` turns counts into track movement, e.g. intel recovered:

```json
{ "key": "intel", "label": "Intel recovered", "kind": "number", "scope": "mission", "min": 0, "max": 10, "default": 0, "perUnit": [{ "op": "adjustTrack", "track": "intel", "amount": 1 }] }
```

Record-only fields (points, PoIs secured) need no effects; the values stay in the log.

---

## 8. Common recipes

All excerpts come from the reference pack *BLACKFALL — TASKFORCE GEMINI*.

**1. Readiness that degrades within a stage and resets each stage.** Team-scope ladder; a resolved mission marks the deployed teams AMBER; every stage start resets to GREEN.

```json
{
  "ladder": { "key": "readiness", "name": "Readiness", "scope": "team", "initial": "green", "states": [
    { "key": "green", "name": "GREEN", "text": "No penalties." },
    { "key": "amber", "name": "AMBER", "text": "−1 Skill on all checks." },
    { "key": "red", "name": "RED", "text": "Stand down this window." }
  ] },
  "triggers": [
    { "key": "window-reset", "on": "onStageStart", "effects": [{ "op": "setLadder", "ladder": "readiness", "target": "roster", "state": "green" }] },
    { "key": "readiness-degrade", "on": "onMissionResolved", "effects": [
      { "op": "if", "cond": { "op": "ladderIs", "ladder": "readiness", "target": "participants", "states": ["red"], "match": "none" },
        "then": [{ "op": "setLadder", "ladder": "readiness", "target": "participants", "state": "amber" }] }
    ] }
  ]
}
```

Status bands: one narrative per band with a `when`, all shown by an `onStageStart` trigger; exactly one passes:

```json
{ "key": "status-contested", "speaker": "monolith", "title": "Sector Status", "text": "Sector status: CONTESTED. Standard support.",
  "when": { "op": "all", "of": [{ "op": "trackGte", "track": "stability", "value": 5 }, { "op": "not", "cond": { "op": "trackGte", "track": "stability", "value": 8 } }] } }
```

**2. A track milestone that unlocks a mission.** The mission starts `"locked": true` and is not in any slot, so it appears in whatever stage the milestone fires.

```json
{ "key": "intel", "name": "Gemini Mystery Intel", "min": 0, "max": 15, "milestones": [
  { "key": "classified-briefing", "at": 5, "effects": [{ "op": "setFlag", "flag": "intel-briefed" }], "narrative": "intel-5" },
  { "key": "investigation", "at": 10, "effects": [{ "op": "unlockMission", "mission": "cold-trace" }], "narrative": "intel-10" },
  { "key": "identity-confirmed", "at": 15, "effects": [{ "op": "setFlag", "flag": "threat-identified" }], "narrative": "intel-15" }
] }
```

Unlocking on mission results instead (bonus mission after two successes):

```json
{ "key": "pale-signal-auth", "on": "onMissionResolved", "once": true, "narrative": "pale-signal-authorized",
  "when": { "op": "all", "of": [
    { "op": "missionOutcome", "mission": "first-light", "outcomes": ["success", "enhanced"] },
    { "op": "missionOutcome", "mission": "tripwire", "outcomes": ["success", "enhanced"] } ] },
  "effects": [{ "op": "unlockMission", "mission": "pale-signal" }] }
```

**3. A reinforcement table on a clock.** A pool counts stages; a trigger rolls the table every fourth stage. Roll modifiers become weight tiers selected by `when` (one entry per result per tier):

```json
{
  "pool": { "key": "reinforcement-clock", "name": "Windows Since Review", "max": 4, "refresh": [{ "on": "onStageEnd", "mode": "add", "amount": 1 }] },
  "trigger": { "key": "reinforcements", "on": "onStageEnd", "when": { "op": "poolGte", "pool": "reinforcement-clock", "value": 4 },
    "effects": [{ "op": "rollTable", "table": "cold-iron-reinforcements" }, { "op": "adjustPool", "pool": "reinforcement-clock", "amount": -4 }] },
  "entry": { "key": "grunt-p1", "weight": 2, "label": "Replacement operator",
    "when": { "op": "trackGte", "track": "stability", "value": 8 },
    "narrative": { "text": "One replacement operator released from the pipeline.", "speaker": "monolith", "tags": [] },
    "effects": [{ "op": "addOperator", "team": "revenants", "operator": { "fields": { "grade": "Sgt." }, "tags": ["replacement"] } }] }
}
```

If the named team is full, the app asks the player which team gets the recruit.

**4. A random event table with tags and gates.**

```json
{ "id": "sector-7-events", "name": "Sector 7 Events", "entries": [
  { "key": "quiet", "weight": 4, "label": "Quiet cycle", "narrative": { "text": "No significant activity. Maintain posture.", "speaker": "monolith", "tags": [] } },
  { "key": "manticor", "weight": 2, "label": "Manticor sighting", "when": { "op": "trackGte", "track": "escalation", "value": 4 },
    "narrative": { "text": "Unconfirmed report of Manticor operators in the commercial levels.", "speaker": "monolith", "tags": [] },
    "effects": [{ "op": "adjustTrack", "track": "escalation", "amount": 1 }] },
  { "key": "forensics", "weight": 1, "label": "Forensic report", "tags": ["graphic", "gemini-mystery"],
    "narrative": { "text": "Forensic pathology on the original casualties is complete.", "speaker": "monolith", "tags": [] },
    "effects": [{ "op": "adjustTrack", "track": "intel", "amount": 1 }] }
] }
```

**5. A branching result with `if`.** One field, different effects depending on the outcome:

```json
{ "key": "cell-leader", "label": "Cell Leader", "kind": "choice", "scope": "mission", "default": "other",
  "options": [{ "value": "detained", "label": "Detained" }, { "value": "escaped", "label": "Escaped" }, { "value": "other", "label": "Not engaged" }],
  "onValue": [
    { "value": "detained", "effects": [
      { "op": "adjustTrack", "track": "stability", "amount": 2 },
      { "op": "if", "cond": { "op": "missionOutcome", "outcomes": ["success", "enhanced"] },
        "then": [{ "op": "setFlag", "flag": "network-map" }],
        "else": [{ "op": "showNarrative", "narrative": { "text": "Detainee secured. Interrogation yields nothing usable yet.", "speaker": "monolith", "tags": [] } }] }
    ] },
    { "value": "escaped", "effects": [{ "op": "adjustTrack", "track": "escalation", "amount": 1 }] }
  ] }
```

**6. Promotion by XP.** Ranks with `xp` thresholds promote automatically whenever XP is added:

```json
{ "ranks": [
  { "key": "operator", "name": "Operator" },
  { "key": "tier-1", "name": "Tier 1", "xp": 8 },
  { "key": "tier-2", "name": "Tier 2", "xp": 18 },
  { "key": "tier-3", "name": "Tier 3 — Named", "xp": 33 }
] }
```

Pair each tier with a pack-level table (for example "Advancement — Tier 1") that the player rolls from the app when someone ranks up.

**7. Persona-voiced briefings.**

```json
{
  "persona": { "key": "monolith", "name": "MONOLITH", "callsign": "MONOLITH", "role": "STRATCOM Operations Coordinator",
    "text": "Institutional, precise, compartmentalized. Cites classification, never explains it." },
  "narrative": { "key": "tripwire-brief", "title": "TRIPWIRE", "speaker": "monolith",
    "text": "/// MONOLITH — TRIPWIRE // COUNTER-NETWORK ///\n\nIntent: locate and neutralize the IED cell. This is a patience tasking. The cell comes to you.\n\nMONOLITH out." }
}
```

**Generic later stages.** To keep a campaign playable without new writing: give later stages `"slots": []`, add one floating `"repeatable": true, "locked": true` mission (for example "STRATCOM Tasking") with a mission-type choice field and the shared AAR fields, unlock it at the first generic stage, and roll a mission-generator table at each `onStageStart` (gated by `stageIs`). Players may also add custom missions; those only get `success`/`failure` outcomes and no AAR fields, so keep a generic authored mission for anything that needs casualty rolls.

---

## 9. Narrative style

### Universal rules

- **Abstract the mechanics in prose.** Narrative text never mentions inches, dice, rolls, Skill numbers, VP or round counts. Say "two hundred metres of open concourse", not "24 inches". Mechanics go in scenario fields, objectives, ladder state `text`, field `help` and table `label`s.
- **Restraint.** Emotion through action and understatement. No speeches, no monologues, no exclamation marks. When news is bad, write less.
- **Persona discipline.** Every line a persona speaks should sound like that persona. Keep a consistent header style (for example `/// MONOLITH — TRIPWIRE ///` and a sign-off).
- **Write for reuse.** Generic texts use variables (`{{mission.name}}`, `{{campaign.stage}}`) so they fit any mission or stage.
- **Don't decide the ending for the player.** Leave major reveals as milestones that set a flag and announce that something has changed, unless the user asks you to write the reveal.

### House tone (EDIT THIS SECTION)

> The user may replace this block with their own rules. Follow it exactly.

- Professional military restraint. Clipped, precise, procedural.
- Grounded science fiction. Threats come from technology, augmentation, corporations and human factions. **No occult, demonic, satanic or supernatural content anywhere.**
- Skill bands for any described troops: 7 = trained regular, 6 = special operations, 5 = exceptional.
- UTG operators (UN Raid Force Alpha) are exclusively female by lore.
- Readiness penalties never carry across stages.
- The handler is institutional and ambiguous: it is never clear whether withheld information is classification doctrine or active suppression.

---

## 10. Content tags and the filter

Narrative blocks, inline narratives, table entries and whole tables carry `tags` (slugs). In the app, the player can exclude tags: excluded narrative is replaced by a "withheld" line, excluded table entries are never rolled, and a table carrying an excluded tag rolls nothing.

- Tag anything with graphic injury or death detail `graphic`. Tag casualty notices `casualty`. Tag spoilers or optional threads with a campaign-specific tag (`gemini-mystery`).
- Keep the campaign `intro` untagged and non-graphic (it can't be filtered). Put graphic detail in a tagged block shown by an `onCampaignStart` trigger.
- Don't make the mechanics depend on tagged narrative: put effects on the entry, not inside the text.
- List the tags you used in the pack's `contentTags`.

---

## 11. IP rules

BLKOUT and its cards belong to Enemy Spotted Studios. Packs you write are fan content.

- **Never** include official card statistics, weapon profiles, keyword or rules text, or art descriptions copied from cards. Enemy forces are described in prose and by card name only ("one Boone Recon Element and three Headless Scouts").
- Put attribution in `license`: "Fan-created, non-commercial. BLKOUT IP belongs to Enemy Spotted Studios."
- Operator unit cards go in a display-only operator field, e.g. `"fields": { "card": "UTG Assaulters" }`.
- **Optional card links.** Players may keep a private pack with id `blkout` holding official cards, keyed by printed card code lowercased (`blkout:tfb-9861`). Only if the user asks, reference cards as `"unit": "blkout:<card-code>"` and add `{ "id": "blkout", "range": "*" }` to `requires`. Such a pack won't load for anyone without that `blkout` pack, so default to display text.
- Your own invented numbers (objective profiles, campaign tables) are fine in scenario and rules fields.

---

## 12. The 15 most likely validation errors

| # | Error | Avoid it by |
|---|---|---|
| 1 | **Unknown property** (`description` on a mission, `amount` on `stepLadder`, `value` on `adjustTrack`). | Use only fields listed here. `stepLadder` uses `steps`; tracks and pools use `amount`. |
| 2 | **Not a slug** (`"First_Light"`, `"Team 1"`). | Lowercase, digits, single dashes only, for every `id`, `key`, tag, option value. |
| 3 | **Missing minimums**: mission without `outcomes`, table without `entries`, ladder with one state, empty `stages`. | ≥1 outcome, ≥1 entry, ≥2 states, ≥1 stage. |
| 4 | **Text too long**: names > 80, short texts > 280. | Keep labels short; put long text in narratives (20 000) or `summary`/`text` fields (4 000). |
| 5 | **Duplicate keys** in one list. | Unique keys per list (outcomes, fields, states, entries…). |
| 6 | **Unknown narrative key** in `briefing`/`debrief`/`narrative`. | Define every referenced key in `narratives`, or inline the text. |
| 7 | **Unknown persona** in `speaker`. | Declare it in `personas`. |
| 8 | **Unknown mission or outcome**: slot lists a missing mission; `missionOutcome` names an outcome the mission lacks. | Cross-check slot lists and outcome keys. |
| 9 | **Unknown operator/team target**: `operator:reyes` where the seed has no `key`. | Give seeds a `key` when targeting them. |
| 10 | **Unknown stat**: `operatorStat`/`adjustStat` on an undeclared stat. | Declare it in `roster.stats`; built-ins accepted are `xp` and `kills`. |
| 11 | **Unknown ladder state** in `setLadder`, `ladderIs`, `initial` or a transition. | Spell states exactly as declared. |
| 12 | **Value outside a track's range**: `trackGte` 0 on a 1–10 track; milestone `at` 12 on a max-10 track; `initial` outside range. | Keep every value within `min..max`. |
| 13 | **AAR value mismatch**: `onValue` `"true"` on a boolean, an option not in `options`, `perUnit` on a non-number, `choice` without `options`. | Match kinds exactly. |
| 14 | **Malformed template**: `{{track.sector-heat}}`, `{{ team name }}`, a stray `{{`. | Dot paths only, no dashes or spaces inside the braces. |
| 15 | **Unresolved or undeclared reference**: `rollTable` to a missing table id, or `blkout:…` without `requires`. | Define pack-level tables; declare dependencies, or don't use them. |

---

## 13. Worked example map (GEMINI)

The reference pack ships with the app as `blackfall-gemini.json`. Its structure, for orientation:

- **Timeline:** `w1` (three slots: two primaries and one optional bonus) and `w2`–`w12` with no slots; Operations change at `w5` and `w9`.
- **Roster:** three teams of two (two UTG kill teams, one Golem team flagged with stat `drone` = 1); `operatorFields` for grade, unit card, role, background, advancements; ranks at 8/18/33 XP; a female name table for replacements.
- **Ladders:** `casualty` (fit → light → serious → kia; steps back one per stage), `critical` (cleared at Operation boundaries), `morale` (shaken until the next mission), `drone-status`, team `readiness`.
- **Tracks:** `stability` (1–10, start 5), `escalation` (1–10, start 2), `intel` (0–15, milestones 5/10/15).
- **Pools:** `butchers-bill` (KIA count), `reinforcement-clock`.
- **Tables:** tasking generator, sector events, reinforcements, names, three advancement tables.
- **Triggers:** stage reset, Operation boundary, status bands, tasking roll, events roll, readiness degrade, Golem allocation check, bonus-mission unlock, KIA inquiry, reinforcement review.
