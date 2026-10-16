// Source of truth for packs/blackfall-gemini.json (run: npm run pack:gemini). Shared AAR/XP blocks authored once, emitted inline.
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const M = 'monolith';

// ── DSL helpers ─────────────────────────────────────────────────────────
const tg = (amount, track) => ({ op: 'adjustTrack', track, amount });
const stab = (n) => tg(n, 'stability');
const esc = (n) => tg(n, 'escalation');
const intel = (n) => tg(n, 'intel');
const flag = (f, value = true) => ({ op: 'setFlag', flag: f, value });
const say = (text, tags = []) => ({ op: 'showNarrative', narrative: { text, speaker: M, tags } });
const iff = (cond, then, els) => (els ? { op: 'if', cond, then, else: els } : { op: 'if', cond, then });
const gte = (track, value) => ({ op: 'trackGte', track, value });
const not = (cond) => ({ op: 'not', cond });
const all = (...of) => ({ op: 'all', of });
const any = (...of) => ({ op: 'any', of });
const outcomeIs = (...outcomes) => ({ op: 'missionOutcome', outcomes });
const isUtg = { op: 'operatorStat', target: 'subject', stat: 'drone', cmp: 'eq', value: 0 };
const isGolem = { op: 'operatorStat', target: 'subject', stat: 'drone', cmp: 'eq', value: 1 };
const xp = (n = 1) => ({ op: 'addXp', target: 'subject', amount: n });
const opt = (value, label) => ({ value, label });

// ── Shared per-operator AAR fields (order matters: morale clears before a new casualty result) ──
const operatorFields = [
  {
    key: 'participated',
    label: 'Deployed',
    kind: 'boolean',
    scope: 'operator',
    help: 'Engine-recorded. UTG XP: +1 deployed, +1 on success or better, +1 more on enhanced. Clears Shaken. Golems earn no XP.',
    onValue: [
      {
        value: true,
        effects: [
          { op: 'setLadder', ladder: 'morale', target: 'subject', state: 'steady' },
          iff(isUtg, [xp(1), iff(outcomeIs('success', 'enhanced'), [xp(1)]), iff(outcomeIs('enhanced'), [xp(1)])]),
        ],
      },
    ],
  },
  {
    key: 'kills',
    label: 'Confirmed kills',
    kind: 'number',
    scope: 'operator',
    min: 0,
    help: 'Engine-recorded. +1 XP per confirmed kill (UTG only).',
    perUnit: [iff(isUtg, [xp(1)])],
  },
  {
    key: 'casualty',
    label: 'Casualty roll (UTG)',
    kind: 'choice',
    scope: 'operator',
    default: 'none',
    options: [
      opt('none', 'Not a casualty'),
      opt('close-call', '10 — Close Call'),
      opt('shaken', '9 — Shaken'),
      opt('light', '7–8 — Light Wound'),
      opt('serious', '5–6 — Serious Wound'),
      opt('critical', '3–4 — Critical Wound'),
      opt('kia', '1–2 — KIA'),
    ],
    help: 'Final result after modifiers (min 1, max 10): failure −1; isolated −1; TCCC +2 (medic +3); Golem cover +1; MEDEVAC (Harp) +1; base medic +2; Unkillable +2. Survivors +1 XP.',
    onValue: [
      { value: 'close-call', effects: [iff(isUtg, [xp(1)])] },
      { value: 'shaken', effects: [iff(isUtg, [{ op: 'setLadder', ladder: 'morale', target: 'subject', state: 'shaken' }, xp(1)])] },
      { value: 'light', effects: [iff(isUtg, [{ op: 'setLadder', ladder: 'casualty', target: 'subject', state: 'light' }, xp(1)])] },
      { value: 'serious', effects: [iff(isUtg, [{ op: 'setLadder', ladder: 'casualty', target: 'subject', state: 'serious' }, xp(1)])] },
      {
        value: 'critical',
        effects: [
          iff(isUtg, [
            { op: 'setLadder', ladder: 'critical', target: 'subject', state: 'critical' },
            { op: 'adjustStat', target: 'subject', stat: 'penalties', amount: 1 },
            xp(1),
          ]),
        ],
      },
      { value: 'kia', effects: [iff(isUtg, [{ op: 'setLadder', ladder: 'casualty', target: 'subject', state: 'kia' }])] },
    ],
  },
  {
    key: 'golem-damage',
    label: 'Golem status',
    kind: 'choice',
    scope: 'operator',
    default: 'none',
    options: [opt('none', 'Undamaged'), opt('damaged', 'Damaged'), opt('destroyed', 'Destroyed')],
    help: 'Golems only. Damaged: repaired after one window (immediately at Sector Stability 8+).',
    onValue: [
      { value: 'damaged', effects: [iff(isGolem, [{ op: 'setLadder', ladder: 'drone-status', target: 'subject', state: 'damaged' }])] },
      { value: 'destroyed', effects: [iff(isGolem, [{ op: 'setLadder', ladder: 'drone-status', target: 'subject', state: 'destroyed' }])] },
    ],
  },
];

const vpField = (max = 12) => ({ key: 'vp', label: 'Victory points', kind: 'number', scope: 'mission', min: -5, max, help: 'Record only. Pick the outcome from the VP thresholds.' });
const intelField = (max = 10) => ({
  key: 'intel',
  label: 'Gemini Mystery Intel recovered',
  kind: 'number',
  scope: 'mission',
  min: 0,
  max,
  default: 0,
  help: 'Total intel from this mission. Each point advances the Gemini Mystery track.',
  perUnit: [intel(1)],
});
const poisField = (label, max) => ({ key: 'pois', label, kind: 'number', scope: 'mission', min: 0, max, default: 0, help: 'Record only.' });

// Same four outcome keys everywhere so the shared XP fields work on every mission.
const outcomes = (o) => [
  { key: 'enhanced', name: o.enhanced[0], effects: o.enhanced[1], narrative: o.enhanced[2] },
  { key: 'success', name: o.success[0], effects: o.success[1], narrative: o.success[2] },
  { key: 'partial', name: o.partial[0], effects: o.partial[1], narrative: o.partial[2] },
  { key: 'failure', name: o.failure[0], effects: o.failure[1], narrative: o.failure[2] },
];
const n = (text, tags = []) => ({ text, speaker: M, tags });

// ── Window 1 missions ───────────────────────────────────────────────────
const firstLight = {
  key: 'first-light',
  name: 'FIRST LIGHT — Void Clearance',
  briefing: 'first-light-brief',
  debrief: 'debrief-standard',
  scenario: {
    name: 'FIRST LIGHT — Deck 58 Concourse',
    lore: 'Multi-level commercial concourse, roughly two hundred metres long: central atrium, upper and lower galleries, access corridors on every side. Boone recon uses it as a transit hub.',
    tableSize: { width: 36, depth: 36, unit: 'in' },
    roundLimit: 5,
    hardpoints: 2,
    pois: [
      {
        key: 'op-site',
        name: 'Observation Post',
        text: 'Centre of the table (atrium). Armor 3/6, damage track 2, counts as a vehicle. Claim: a friendly model in base contact spends an Action. Once claimed it gives Cover to friendly models within 4" and counts as a controlled objective.',
      },
    ],
    forces: {
      symmetric: false,
      sides: [
        { key: 'gemini', name: 'TASKFORCE GEMINI', text: 'Attacker. Kill team(s) of choice. Ironclad may attach (one tasking per window below Sector Stability 8).' },
        {
          key: 'opfor',
          name: 'Boone Recon Team',
          text: 'Defender, six models: one Boone Recon Element (two grunts and a data-spike specialist) and three Headless Scouts. Use your own Task Force Boone cards.',
          behavior: ['hold-hardpoints', 'fighting-withdrawal', 'flee-and-report'],
        },
      ],
    },
    deployment: {
      text: 'GEMINI deploys within 4" of one short edge (the elevator shaft corridor). OPFOR deploys within 4" of the opposite short edge. GEMINI activates first in round 1.',
      zones: [
        { side: 'gemini', text: 'Within 4" of a short edge' },
        { side: 'opfor', text: 'Within 4" of the opposite short edge' },
      ],
    },
    specialRules: [
      { key: 'terrain', name: 'Terrain', text: 'Dense interior. Open atrium (about 8" x 6") at centre, flanked by storefronts, kiosks and columns. Upper gallery as elevated platforms (3"+) along the long edges. Entry corridors on all four sides. Debris and abandoned stalls throughout.' },
      { key: 'hardpoints', name: 'Boone Hardpoints', text: 'Two sandbagged observation positions within 8" of the OPFOR edge, at least 6" apart, with clear sightlines down the concourse.' },
      {
        key: 'ai-recon',
        name: 'AI — Boone Recon',
        text: 'Rounds 1–2: hold at the Hardpoints, overwatch toward GEMINI approach corridors. Round 3+: if GEMINI claims the OP or destroys a Hardpoint, begin a fighting withdrawal toward their edge; survival over engagement. Reduced to one model: it Sprints for the nearest edge. If it exits, +1 Escalation.',
      },
      {
        key: 'ai-scouts',
        name: 'AI — Headless Scouts',
        text: 'Never initiate. Move toward the nearest edge using cover. If an enemy is within 8" with LOS: Skill Check — success Sprint toward the nearest edge, failure freeze (Pinned, no Action). A scout that exits causes no Escalation, but MONOLITH logs the leak.',
      },
    ],
    scoring: [
      { key: 'secure-op', event: 'poi-control', label: 'Secure the OP', points: 3, max: 1 },
      { key: 'hardpoint', event: 'hardpoint-destroyed', label: 'Destroy a Hardpoint', points: 1, max: 2 },
      { key: 'unit', event: 'unit-destroyed', label: 'Enemy unit destroyed', points: 1 },
      { key: 'no-leak', event: 'no-scouts-exit', label: 'Bonus: no Headless Scout exits', points: 1, max: 1, timing: { when: 'end-of-game' } },
      { key: 'no-cas', event: 'no-casualties', label: 'Bonus: zero GEMINI casualties', points: 1, max: 1, timing: { when: 'end-of-game' } },
    ],
    endConditions: [{ key: 'rounds', text: 'End of round 5.' }],
    campaignReward: '7+ Enhanced Success · 5–6 Success · 3–4 Partial Success · 0–2 Failure.',
    tags: ['void', 'cqb'],
  },
  objectives: [
    { key: 'secure-op', text: 'Secure the observation post in the atrium', primary: true, points: 3 },
    { key: 'hardpoints', text: 'Destroy the two Boone hardpoints (1 each)', points: 2 },
    { key: 'units', text: 'Destroy enemy units (1 each)', points: 1 },
    { key: 'no-leak', text: 'Bonus: no Headless Scout escapes', points: 1 },
    { key: 'no-cas', text: 'Bonus: zero GEMINI casualties', points: 1 },
  ],
  aar: {
    fields: [
      vpField(),
      { key: 'op-claimed', label: 'Observation post claimed', kind: 'boolean', scope: 'mission', default: false, help: 'Record only.' },
      {
        key: 'recon-reported',
        label: 'Last Boone recon model escaped',
        kind: 'boolean',
        scope: 'mission',
        default: false,
        help: '+1 Escalation.',
        onValue: [{ value: true, effects: [esc(1), say('Boone element broke contact and reported. Assume they know your composition.')] }],
      },
      {
        key: 'scouts-escaped',
        label: 'A Headless scout escaped',
        kind: 'boolean',
        scope: 'mission',
        default: false,
        help: 'No Escalation; noted in the debrief.',
        onValue: [{ value: true, effects: [say('Headless observer exfiltrated the concourse. Intelligence leak logged against this tasking.')] }],
      },
      ...operatorFields,
    ],
  },
  outcomes: outcomes({
    enhanced: [
      'Enhanced Success (7+ VP)',
      [stab(2), { op: 'grantAsset', asset: 'op-deck-58' }, flag('ambush-opportunity')],
      n('FIRST LIGHT confirmed. Deck 58 concourse secured. Observation post operational ahead of projected timeline.\n\nThe post has already resolved the Boone recon rotation. Expect an interdiction opportunity in your next tasking.\n\nPerformance is noted.'),
    ],
    success: [
      'Success (5–6 VP)',
      [stab(1), { op: 'grantAsset', asset: 'op-deck-58' }],
      n('FIRST LIGHT confirmed. Concourse secured. Observation post operational. SIGINT integration with Sector 7 coverage will complete within six hours.\n\nPerformance is noted.'),
    ],
    partial: [
      'Partial Success (3–4 VP)',
      [esc(1)],
      n('Observation post established. Boone awareness of the post is assessed as high. Expect it to be tested.'),
    ],
    failure: ['Failure (0–2 VP)', [stab(-1), flag('concourse-consolidated')], n('Concourse remains contested. Boone will consolidate. Logged.')],
  }),
  tags: ['window-1'],
};

const tripwire = {
  key: 'tripwire',
  name: 'TRIPWIRE — Counter-Network',
  briefing: 'tripwire-brief',
  debrief: 'debrief-standard',
  scenario: {
    name: 'TRIPWIRE — Corridor 7-Delta',
    lore: 'Industrial corridor on Decks 53–54. Maintenance alcoves, junction boxes, pipe runs and access hatches. Poor light.',
    tableSize: { width: 24, depth: 24, unit: 'in' },
    roundLimit: 6,
    hardpoints: 0,
    pois: [
      { key: 'site-a', name: 'Emplacement Site A', text: 'On the central corridor; sites at least 6" apart.' },
      { key: 'site-b', name: 'Emplacement Site B', text: 'On the central corridor.' },
      { key: 'site-c', name: 'Emplacement Site C', text: 'On the central corridor.' },
    ],
    forces: {
      symmetric: false,
      sides: [
        { key: 'gemini', name: 'TASKFORCE GEMINI', text: 'Ambush force. Stealth over firepower; Ironclad not recommended.' },
        {
          key: 'opfor',
          name: 'Headless IED Cell',
          text: 'Four models: a three-model Headless IED team (two grunts and a demolitions specialist) and a Cell Leader carrying a data spike. Use your own Headless cards; the specialist uses its charges only in self-defence.',
          behavior: ['emplace-devices', 'flee-when-exposed'],
        },
      ],
    },
    deployment: {
      text: 'GEMINI deploys first anywhere, all models in Cover and more than 6" from any PoI. OPFOR enters at the start of round 2 from a random edge (1D10: 1–5 north, 6–10 south; GEMINI picks which edge is north). GEMINI activates first in round 1; OPFOR activates first from round 2.',
      zones: [{ side: 'gemini', text: 'Anywhere, in Cover, more than 6" from any PoI' }],
    },
    specialRules: [
      { key: 'terrain', name: 'Terrain', text: 'A primary corridor about 4" wide runs the length of the table, with two T-junctions where side passages meet it.' },
      {
        key: 'ai-ied-team',
        name: 'AI — IED Team',
        text: 'Move to the nearest unarmed PoI; in base contact, one model spends an Action to arm it, then move on. Fired on before arming anything: all to Cover, Cell Leader Skill Check — success flee, failure return fire one round then flee. Fired on after arming: the specialist detonates an armed PoI within 12" and LOS (automatic); models within 3" take 2 Damage (armor checks allowed); then flee.',
      },
      { key: 'ai-leader', name: 'AI — Cell Leader', text: 'Stays within 4" of the IED team. If the team is destroyed, Sprints for the nearest edge. If the leader exits: +1 Escalation.' },
      { key: 'detain', name: 'Detain', text: 'In base contact with the Cell Leader, a GEMINI model may spend an Action instead of CQB: Skill Check. Success = captured (remove the model). Failure = the leader fights back with normal CQC.' },
      { key: 'disarm', name: 'Disarm', text: 'In base contact with an armed PoI: Action + Skill Check. Failure does not detonate.' },
    ],
    scoring: [
      { key: 'no-ieds', event: 'no-pois-armed', label: 'No IEDs emplaced', points: 3, max: 1, timing: { when: 'end-of-game' } },
      { key: 'unarmed', event: 'poi-unarmed', label: 'PoI not armed', points: 1, max: 3, timing: { when: 'end-of-game' } },
      { key: 'leader-killed', event: 'leader-killed', label: 'Cell Leader destroyed', points: 1, max: 1 },
      { key: 'leader-detained', event: 'leader-detained', label: 'Cell Leader detained (replaces destroyed)', points: 3, max: 1 },
      { key: 'kill', event: 'kill', label: 'Other enemy model destroyed', points: 1 },
      { key: 'no-cas', event: 'no-casualties', label: 'Bonus: no GEMINI casualties', points: 1, max: 1, timing: { when: 'end-of-game' } },
      { key: 'armed', event: 'poi-armed', label: 'PoI armed and not disarmed', points: -1, max: 3, timing: { when: 'end-of-game' } },
      { key: 'leader-escaped', event: 'leader-escaped', label: 'Cell Leader escapes', points: -1, max: 1 },
    ],
    endConditions: [{ key: 'rounds', text: 'Round 1 is setup only; play ends after round 6 (five rounds from OPFOR entry).' }],
    campaignReward: '7+ Enhanced Success · 4–6 Success · 2–3 Partial Success · 0–1 Failure.',
    tags: ['ambush'],
  },
  objectives: [
    { key: 'no-ieds', text: 'Prevent every emplacement', primary: true, points: 3 },
    { key: 'unarmed', text: 'Each PoI left unarmed (1 each)', points: 3 },
    { key: 'leader', text: 'Detain the Cell Leader (3) or destroy them (1)', points: 3 },
    { key: 'no-cas', text: 'Bonus: no GEMINI casualties', points: 1 },
  ],
  aar: {
    fields: [
      vpField(),
      poisField('PoIs armed and not disarmed', 3),
      {
        key: 'cell-leader',
        label: 'Cell Leader',
        kind: 'choice',
        scope: 'mission',
        default: 'other',
        options: [opt('detained', 'Detained'), opt('killed', 'Destroyed'), opt('escaped', 'Escaped'), opt('other', 'Not engaged')],
        help: 'Detained: +2 Sector Stability; with Success or better the network map unlocks. Escaped: +1 Escalation.',
        onValue: [
          {
            value: 'detained',
            effects: [
              stab(2),
              iff(outcomeIs('success', 'enhanced'), [flag('network-map'), say('Detainee interrogation has produced a partial network map. Counter-network tasking will follow.')]),
            ],
          },
          { value: 'escaped', effects: [esc(1), say('Cell leader evaded. Assume the network has been warned.')] },
        ],
      },
      ...operatorFields,
    ],
  },
  outcomes: outcomes({
    enhanced: [
      'Enhanced Success (7+ VP)',
      [stab(2), { op: 'grantAsset', asset: 'qrf-priority' }],
      n('TRIPWIRE confirmed. IED threat on Corridor 7-Delta neutralized. 3rd Battalion patrol routes are open and their response times will improve accordingly.\n\nPerformance is noted.'),
    ],
    success: ['Success (4–6 VP)', [stab(1)], n('TRIPWIRE confirmed. Cell disrupted. 3rd Battalion resumes patrols on Decks 52 to 55 under standing caution.')],
    partial: ['Partial Success (2–3 VP)', [esc(1)], n('Cell partially disrupted. Devices may remain on the route. Route clearance continues.')],
    failure: ['Failure (0–1 VP)', [stab(-1), esc(1), flag('ied-campaign')], n('Cell intact. 3rd Battalion casualties will continue. Logged.')],
  }),
  tags: ['window-1'],
};

const paleSignal = {
  key: 'pale-signal',
  name: 'PALE SIGNAL — Investigation',
  locked: true,
  briefing: 'pale-signal-brief',
  debrief: 'debrief-standard',
  scenario: {
    name: 'PALE SIGNAL — Deck 62 Maintenance Sublevel',
    lore: 'Pipe runs, machinery, access crawlways and electrical junction rooms. Sightlines short. One central room holds the transmission source.',
    tableSize: { width: 24, depth: 24, unit: 'in' },
    roundLimit: 12,
    hardpoints: 0,
    pois: [
      { key: 'equipment', name: 'Transmission Equipment', text: 'Inside the central room (about 4" x 4"). Search: base contact + Action, then roll Discovery.' },
      { key: 'materials', name: 'Associated Materials', text: 'Inside the central room. Search as above.' },
    ],
    forces: {
      symmetric: false,
      sides: [
        { key: 'gemini', name: 'TASKFORCE GEMINI', text: 'Collection only. No offensive action against unidentified contacts without STRATCOM clearance.' },
        { key: 'opfor', name: 'None', text: 'The sublevel is empty. There is no ambush. The tension is the absence of threat.' },
      ],
    },
    deployment: { text: 'GEMINI deploys within 4" of any table edge. No OPFOR at start.', zones: [{ side: 'gemini', text: 'Within 4" of any edge' }] },
    specialRules: [
      { key: 'terrain', name: 'Terrain', text: 'Dense, LOS-blocking terrain throughout; keep engagement ranges at 12" or less.' },
      {
        key: 'discovery',
        name: 'Discovery (1D10 per PoI searched)',
        text: '1–3 Cold trail: equipment removed, scorch marks; +1 Intel. 4–7 Warm trail: unit present but wiped; Hard Skill Check by a data-spike model — success +2 Intel and a partial encryption key, failure +1. 8–10 Hot trail: repeater live on a timer; Skill Check by any model — success +3 Intel, transmission log and a monitorable frequency, failure +2; then roll again, on 9–10 a model within 2" passes a Hard Skill Check or takes 1 Damage.',
      },
      {
        key: 'withdrawal',
        name: 'Withdrawal Check (1D10 after the last search)',
        text: '1–6 Clean extraction. 7–9 Shadows: movement at sensor range, nothing engages (narrative). 10 Contact: one unidentified model appears at the far edge, observes for one activation, then leaves. If GEMINI engages, use the Unknown Contact profile from your COLD IRON AI reference. Destroyed: +3 Intel and a STRATCOM priority investigation. Escaped: +1 Intel.',
      },
    ],
    scoring: [{ key: 'intel', event: 'intel', label: 'Gemini Mystery Intel', points: 1 }],
    endConditions: [{ key: 'withdraw', text: 'No round limit: ends when every GEMINI model has exited, or on abort.' }],
    scoreLabel: 'Intel',
    campaignReward: '4+ Intel Enhanced Success · 2–3 Success · 1 Partial · 0 Failure.',
    tags: ['investigation', 'gemini-mystery'],
  },
  objectives: [
    { key: 'search', text: 'Search both points of interest in the central room', primary: true },
    { key: 'withdraw', text: 'Withdraw without engaging unidentified contacts' },
  ],
  aar: {
    fields: [
      intelField(),
      poisField('PoIs searched', 2),
      {
        key: 'discovery',
        label: 'Best discovery result',
        kind: 'choice',
        scope: 'mission',
        default: 'cold',
        options: [
          opt('cold', 'Cold trail'),
          opt('warm-wiped', 'Warm trail — recovery failed'),
          opt('warm-recovered', 'Warm trail — data recovered'),
          opt('hot-partial', 'Hot trail — recovery failed'),
          opt('hot-recovered', 'Hot trail — data recovered'),
        ],
        onValue: [
          { value: 'warm-recovered', effects: [{ op: 'grantAsset', asset: 'encryption-key' }] },
          { value: 'hot-recovered', effects: [{ op: 'grantAsset', asset: 'monitored-frequency' }] },
        ],
      },
      {
        key: 'withdrawal',
        label: 'Withdrawal',
        kind: 'choice',
        scope: 'mission',
        default: 'clean',
        options: [opt('clean', 'Clean extraction'), opt('shadows', 'Shadows'), opt('contact-escaped', 'Contact — escaped'), opt('contact-destroyed', 'Contact — destroyed')],
        onValue: [
          { value: 'shadows', effects: [say('Your sensor logs show movement at the edge of coverage during withdrawal. STRATCOM has the logs. No further comment.', ['gemini-mystery'])] },
          { value: 'contact-escaped', effects: [flag('contact-sighted'), say('Unidentified contact observed and lost. Your imagery is now classified. Do not discuss it on any net.', ['gemini-mystery'])] },
          {
            value: 'contact-destroyed',
            effects: [
              flag('contact-recovered'),
              say('Recovery team inbound. The site is sealed under a STRATCOM priority investigation. GEMINI will not discuss the contact on any net, including internal.', ['gemini-mystery']),
            ],
          },
        ],
      },
      ...operatorFields,
    ],
  },
  outcomes: outcomes({
    enhanced: [
      'Enhanced Success (4+ Intel)',
      [stab(1)],
      n('PALE SIGNAL material received. Assessment is in progress and priority resources have been assigned. Further dissemination is restricted.', ['gemini-mystery']),
    ],
    success: ['Success (2–3 Intel)', [], n('Material received. The trail is warm. Continue to report.', ['gemini-mystery'])],
    partial: ['Partial (1 Intel)', [], n('Fragments received. Logged.', ['gemini-mystery'])],
    failure: ['Failure (0 Intel)', [], n('Nothing recovered. The file remains open.', ['gemini-mystery'])],
  }),
  tags: ['window-1', 'gemini-mystery'],
};

// ── Windows 2+ generic missions ─────────────────────────────────────────
const TYPES = [
  ['kill-capture', 'Kill/Capture'],
  ['void-clearance', 'Void Clearance'],
  ['crisis-response', 'Crisis Response'],
  ['personnel-recovery', 'Personnel Recovery'],
  ['facility-defense', 'Facility Defense'],
  ['counter-network', 'Counter-Network'],
  ['ewar-strike', 'EWAR Strike'],
  ['investigation', 'Investigation'],
  ['deep-strike', 'Deep Strike'],
  ['ambush', 'Ambush'],
];
const reportedField = {
  key: 'enemy-reported',
  label: 'Enemy models that escaped to report',
  kind: 'number',
  scope: 'mission',
  min: 0,
  max: 10,
  default: 0,
  help: '+1 Escalation each.',
  perUnit: [esc(1)],
};
const genericOutcomes = outcomes({
  enhanced: ['Enhanced Success', [stab(2)], n('{{mission.name}} confirmed, bonus objective achieved. Performance is noted.')],
  success: ['Success', [stab(1)], n('{{mission.name}} confirmed. Objective achieved.')],
  partial: ['Partial Success', [esc(1)], n('{{mission.name}}: objective partially achieved. Enemy awareness assessed as elevated.')],
  failure: ['Failure', [stab(-1), esc(1)], n('{{mission.name}}: objective not achieved. Logged.')],
});

const tasking = {
  key: 'tasking',
  name: 'STRATCOM Tasking',
  locked: true,
  repeatable: true,
  briefing: 'tasking-brief',
  debrief: 'debrief-standard',
  objectives: [
    { key: 'primary', text: 'Achieve the primary objective set at tasking', primary: true },
    { key: 'bonus', text: 'Achieve the bonus objective (Enhanced Success)' },
  ],
  aar: {
    fields: [
      {
        key: 'mission-type',
        label: 'Mission type',
        kind: 'choice',
        scope: 'mission',
        default: 'void-clearance',
        options: TYPES.map(([v, l]) => opt(v, l)),
        onValue: [{ value: 'ambush', effects: [flag('ambush-opportunity', false)] }],
      },
      vpField(20),
      poisField('PoIs secured', 6),
      reportedField,
      intelField(),
      ...operatorFields,
    ],
  },
  outcomes: genericOutcomes,
  tags: ['generic'],
};

const coldTrace = {
  key: 'cold-trace',
  name: 'COLD TRACE — Investigation',
  locked: true,
  briefing: 'cold-trace-brief',
  debrief: 'debrief-standard',
  objectives: [
    { key: 'collect', text: 'Collect and document; recover all available material', primary: true },
    { key: 'withdraw', text: 'Withdraw without unauthorized engagement' },
  ],
  aar: { fields: [intelField(), poisField('PoIs searched', 6), reportedField, ...operatorFields] },
  outcomes: outcomes({
    enhanced: ['Enhanced Success', [stab(1)], n('Material received. Priority 1 analysis has begun. Do not discuss.', ['gemini-mystery'])],
    success: ['Success', [], n('Material received. Assessment in progress.', ['gemini-mystery'])],
    partial: ['Partial', [], n('Fragments received. Logged.', ['gemini-mystery'])],
    failure: ['Failure', [], n('Nothing recovered. Logged.', ['gemini-mystery'])],
  }),
  tags: ['gemini-mystery'],
};

// ── Timeline ────────────────────────────────────────────────────────────
const OPS = ['I — CONTAINMENT', 'II — COUNTERSTRIKE', 'III — COLD IRON'];
const stages = [
  {
    key: 'w1',
    name: 'Window 1 — D+14',
    briefing: 'w1-warnord',
    allowCustomMissions: true,
    slots: [
      { key: 'primary-1', label: 'Primary', missions: ['first-light'] },
      { key: 'primary-2', label: 'Primary', missions: ['tripwire'] },
      { key: 'bonus', label: 'Bonus (conditional)', missions: ['pale-signal'], optional: true },
    ],
  },
];
for (let w = 2; w <= 12; w++) {
  const op = OPS[Math.floor((w - 1) / 4)];
  stages.push({
    key: `w${w}`,
    name: `Window ${w} — Op ${op.split(' — ')[0]}`,
    briefing: w === 5 ? 'op2-brief' : w === 9 ? 'op3-brief' : 'window-brief',
    slots: [],
    allowCustomMissions: true,
  });
}

// ── Reinforcements: 1D10 with modifiers, expressed as `when`-gated weight tiers ──
const BANDS = [
  ['none', 1, 4],
  ['grunt', 5, 6],
  ['specialist', 7, 7],
  ['golem', 8, 8],
  ['unit', 9, 9],
  ['upgrade', 10, 10],
];
const weightsFor = (m) => {
  const w = {};
  for (let r = 1; r <= 10; r++) {
    const v = Math.min(10, Math.max(1, r + m));
    const band = BANDS.find(([, lo, hi]) => v >= lo && v <= hi)[0];
    w[band] = (w[band] ?? 0) + 1;
  }
  return w;
};
const hi = gte('stability', 8);
const lo = not(gte('stability', 4));
const bill = { op: 'poolGte', pool: 'butchers-bill', value: 3 };
const TIERS = [
  [1, 'p1', all(hi, not(bill))],
  [0, 'z', any(all(not(hi), gte('stability', 4), not(bill)), all(hi, bill))],
  [-1, 'm1', all(not(hi), gte('stability', 4), bill)],
  [-2, 'm2', all(lo, not(bill))],
  [-3, 'm3', all(lo, bill)],
];
const utgRecruit = (card) => ({ fields: { grade: 'Sgt.', card }, tags: ['replacement'] });
const REINF = {
  none: ['No reinforcements', [], 'Request for replacement personnel denied. STRATCOM cannot allocate enhancement-pipeline assets at this time.'],
  grunt: ['Replacement operator', [{ op: 'addOperator', team: 'revenants', operator: utgRecruit('UTG replacement') }], 'One replacement operator released from the enhancement pipeline. Integrate at FOB BULWARK with an understrength kill team.'],
  specialist: ['Replacement specialist', [{ op: 'addOperator', team: 'pale-horse', operator: utgRecruit('UTG Specialist (replacement)') }], 'One replacement specialist released. Integrate at FOB BULWARK with an understrength kill team.'],
  golem: ['Golem replacement', [{ op: 'addOperator', team: 'ironclad', operator: { name: 'GOLEM-R', stats: { drone: 1 }, fields: { grade: '', card: 'Golems', role: 'Combat drone' }, tags: ['golem'] } }], 'Replacement Golem allocated to Ironclad.'],
  unit: [
    'Full replacement unit',
    [
      iff(
        { op: 'flag', flag: 'kill-team-4' },
        [{ op: 'addTeam', team: { key: 'kill-team-5', name: 'Kill Team 5', callsign: 'GEMINI 5', text: 'Replacement kill team.', operators: [utgRecruit('UTG replacement'), utgRecruit('UTG replacement')] } }],
        [{ op: 'addTeam', team: { key: 'kill-team-4', name: 'Kill Team 4', callsign: 'GEMINI 4', text: 'Replacement kill team.', operators: [utgRecruit('UTG replacement'), utgRecruit('UTG replacement')] } }, flag('kill-team-4')],
      ),
    ],
    'A complete kill team has been released to GEMINI. Integration at FOB BULWARK. Assign callsigns at your discretion.',
  ],
  upgrade: ['Golem upgrade (or a unit, by manual adjustment)', [{ op: 'grantAsset', asset: 'golem-upgrade', team: 'ironclad' }], 'Golem upgrade package authorized for Ironclad. Enhanced weapons and armour on existing frames.'],
};
const reinfEntries = [];
for (const [m, suffix, cond] of TIERS) {
  const w = weightsFor(m);
  for (const [band] of BANDS) {
    if (!w[band]) continue;
    const [label, effects, text] = REINF[band];
    reinfEntries.push({ key: `${band}-${suffix}`, weight: w[band], label, narrative: { text, speaker: M, tags: [] }, effects, when: cond });
  }
}

// ── Tasking generator ───────────────────────────────────────────────────
const genEntry = (key, weight, label, text, extra = {}) => ({ key, weight, label, narrative: { title: 'Tasking', text, speaker: M, tags: extra.tags ?? [] }, effects: extra.effects ?? [], ...(extra.when ? { when: extra.when } : {}) });
const generator = {
  id: 'cold-iron-taskings',
  name: 'COLD IRON Tasking Generator',
  text: 'Rolled at the start of each window from Window 2. Run the result as a STRATCOM Tasking and record the type in its AAR. Table sizes are recommendations.',
  entries: [
    genEntry('kill-capture', 2, 'Kill/Capture (2x2 or 3x3)', 'Kill/Capture. A high-value target has been fixed in the sector. Detention is preferred where feasible. Target package follows under separate cover.'),
    genEntry('void-clearance', 2, 'Void Clearance (2x2 or 3x3)', 'Void Clearance. Sweep and secure the designated deck section. Expect close-quarters resistance on every level.'),
    genEntry('crisis-response', 2, 'Crisis Response (3x3)', 'Crisis Response. A situation is developing faster than the line can contain it. Move now; detail will follow en route.'),
    genEntry('personnel-recovery', 1, 'Personnel Recovery (3x3)', 'Personnel Recovery. Friendly elements are cut off in a deteriorating position. Extract them. Their equipment is secondary.'),
    genEntry('facility-defense', 1, 'Facility Defense (3x3 or 4x4)', 'Facility Defense. A critical installation is assessed to be under imminent threat. Hold it.'),
    genEntry('facility-defense-priority', 3, 'Facility Defense — priority (3x3 or 4x4)', 'Facility Defense. Sector control is failing. GEMINI is re-tasked to hold a critical installation until relieved.', { when: not(gte('stability', 5)) }),
    genEntry('counter-network', 2, 'Counter-Network (2x2 or 3x3)', 'Counter-Network. Dismantle the identified enemy infrastructure: communications, caches, safe houses. Recover what you can.'),
    genEntry('counter-network-chain', 4, 'Counter-Network — network map (2x2 or 3x3)', 'Counter-Network. The detainee network map has been exploited. Next node identified. Proceed.', { when: { op: 'flag', flag: 'network-map' } }),
    genEntry('ewar-strike', 1, 'EWAR Strike (2x2)', 'EWAR Strike. Enemy electronic systems in the sector are to be exploited, jammed, or burned. Collection takes priority over destruction.'),
    genEntry('investigation', 1, 'Investigation (2x2 or 3x3)', 'Investigation. A collection opportunity related to your standing intelligence requirement has been identified. Collect, document, withdraw.', { tags: ['gemini-mystery'] }),
    genEntry('deep-strike', 1, 'Deep Strike (3x3 or 4x4)', 'Deep Strike. Penetrate enemy-held decks to a single objective. Support beyond the line will be limited.', { when: gte('escalation', 4) }),
    genEntry('ambush', 100, 'Ambush — Boone rotation (2x2 or 3x3)', 'Interdiction. The Deck 58 post has fixed the Boone recon rotation. Ambush the next relief on the transit route.', { when: { op: 'flag', flag: 'ambush-opportunity' } }),
  ],
  tags: [],
};

// ── Sector events ───────────────────────────────────────────────────────
const ev = (key, weight, label, text, effects = [], when, tags = []) => ({ key, weight, label, narrative: { title: 'Sector 7', text, speaker: M, tags: [] }, effects, ...(when ? { when } : {}), tags });
const events = {
  id: 'sector-7-events',
  name: 'Sector 7 Events',
  text: 'Rolled once at the start of each window from Window 2.',
  entries: [
    ev('quiet', 4, 'Quiet cycle', 'No significant activity across Sector 7 in the last cycle. Maintain posture.'),
    ev('boone-probe', 2, 'Boone probe', 'Boone recon probed 3rd Battalion positions on Deck 54 overnight. No casualties. Expect them to return with better information.', [esc(1)]),
    ev('ied-strike', 2, 'IED strike', 'A 3rd Battalion patrol struck an improvised device on Deck 53. Casualties evacuated. Route clearance resumes.', [stab(-1)]),
    ev('sigint', 2, 'SIGINT integration', 'SIGINT integration across Sector 7 is complete. Your threat picture improves accordingly.', [stab(1)]),
    ev('janus', 1, 'Janus request', 'Janus Security has requested GEMINI escort for a contractor movement. Request declined at STRATCOM level. Noted for your awareness.'),
    ev('hull-breach', 1, 'Pressure breach', 'Pressure breach on Deck 61, sealed by damage control. Cause under review. Avoid the affected section.'),
    ev('manticor', 2, 'Manticor sighting', 'Unconfirmed report of Manticor operators in the commercial levels. They are not working with Boone. They are not working with us.', [esc(1)], gte('escalation', 4)),
    ev('black-pact', 1, 'Black Pact activity', 'Black Pact liquidation team reported in Sector 7. Principal unknown. Treat as hostile.', [esc(1)], gte('escalation', 6)),
    ev('footage', 2, 'Recovered footage', 'Additional helmet-camera footage from the original Gemini has been recovered and processed. Your access is limited to a single still frame.', [intel(1)], gte('escalation', 7), ['gemini-mystery']),
    ev(
      'forensics',
      1,
      'Forensic report',
      'Forensic pathology on the original Gemini casualties is complete. Burn depth indicates sustained energy-weapon fire at close range. Edge wounds are consistent with nanoblades. Crush trauma is consistent with gravity mauls. No conventional munition matches.',
      [intel(1)],
      gte('escalation', 4),
      ['graphic', 'gemini-mystery'],
    ),
  ],
  tags: [],
};

// ── Advancement tables (BLACKFALL house rules; record results on the operator sheet) ──
const adv = (id, name, threshold, items) => ({
  id,
  name,
  text: `Roll when an operator reaches ${threshold} XP. Record the result in the operator's Advancements field.`,
  entries: items.map(([key, label, text]) => ({ key, weight: 2, label, narrative: { text } })),
  tags: ['rules'],
});
const advancement = [
  adv('advancement-tier-1', 'Advancement — Tier 1', 8, [
    ['steady', 'Steady', 'Ignores the AMBER readiness penalty. Does not negate Shaken.'],
    ['fast-mover', 'Fast Mover', '+1 Movement permanently.'],
    ['hard-target', 'Hard Target', 'Always counts as in Cover; does not stack with real Cover.'],
    ['aggressive', 'Aggressive', '+1 Damage on the first successful Shot each Activation (not CQC or Blast).'],
    ['calm-under-fire', 'Calm Under Fire', 'One Reaction per round without gaining an Engaged token.'],
  ]),
  adv('advancement-tier-2', 'Advancement — Tier 2', 18, [
    ['skill-improvement', 'Skill Improvement', 'Skill improves by 1 (minimum Skill 4, Legendary).'],
    ['cqc-specialist', 'CQC Specialist', '+1 success on all CQC Skill Checks.'],
    ['ironside', 'Ironside', '+1 to the first Armor value.'],
    ['fire-team-leader', 'Fire Team Leader', 'One grunt of the same unit nearby uses this operator\'s Skill for Shooting.'],
    ['tactical-awareness', 'Tactical Awareness', 'Overwatch once per mission without a Ready token.'],
  ]),
  adv('advancement-tier-3', 'Advancement — Tier 3', 33, [
    ['ace-operator', 'Ace Operator', 'Aces on 9 and 10.'],
    ['unkillable', 'Unkillable', 'Once per campaign, survive the first Destruction with 1 Damage. +2 to Casualty Rolls.'],
    ['weapon-master', 'Weapon Master', 'Fire two Weapons in one Shoot Action.'],
    ['ghost', 'Ghost', 'Does not trigger Overwatch Reactions.'],
    ['legend', 'Legend', 'Nearby friendly models gain +1 Skill. Name known across ABOL.'],
  ]),
];

const names = {
  id: 'utg-names',
  name: 'UTG Operator Names',
  text: 'Replacement operators. UTG operators are exclusively female by lore.',
  entries: ['Mira Kovac', 'Nadia Orlov', 'Tamsin Hale', 'Yuki Arendt', 'Leila Haddad', 'Ines Varga', 'Ruth Okonkwo', 'Sana Rahimi', 'Petra Lindqvist', 'Zara Mbeki', 'Hana Sato', 'Alma Reyes', 'Freya Dahl', 'Noor Siddiqui', 'Katya Morozova', 'Ada Nwosu'].map((label, i) => ({
    key: `n${i + 1}`,
    weight: 1,
    label,
    narrative: { text: label },
  })),
  tags: [],
};

// ── Narratives ──────────────────────────────────────────────────────────
const N = (key, text, extra = {}) => ({ key, text, speaker: M, ...extra });
const narratives = [
  N(
    'gemini-file',
    'STRATCOM file reference: KILL SQUAD GEMINI (ORIGINAL).\n\nRecovery teams reached the site after the last transmission. Energy-weapon burns. Edged wounds consistent with nanoblades. Crush injuries consistent with gravity mauls. Footage shows rounds striking the attackers and the attackers continuing.\n\nPhysical size suggests Chimera or Manticor augmentation. Equipment matches neither. The file remains open.',
    { title: 'File Reference — Gemini (Original)', tags: ['graphic', 'gemini-mystery'] },
  ),
  N(
    'w1-warnord',
    '/// MONOLITH — WARNORD // OPERATIONAL WINDOW 1 ///\nCLASSIFICATION: AUTHORITY — RESTRICTED. DTG D+14 / 0600Z.\n\nSector 7, Decks 50 to 65, remains contested. 3rd Battalion holds a tenuous line on Decks 50 to 54 and cannot push further at acceptable cost. At least two Boone recon teams operate on Decks 58 to 65 on a 48-hour rotation, using the Deck 58 commercial concourse as a transit hub. They are mapping our positions.\n\n3rd Battalion has taken three IED incidents in 96 hours on Decks 52 to 55. One killed, four wounded. Pattern analysis indicates Headless activity.\n\nAn anomalous intercept on Deck 62 is flagged for follow-up. The protocol matches no Boone, Headless, or Authority standard. Low priority pending primary tasking.\n\nPrimary tasking: FIRST LIGHT and TRIPWIRE. Rotate kill teams; a team tasked twice in one window operates degraded. Ironclad is authorized for one tasking this window.\n\nFOB BULWARK, Deck 45. MONOLITH out.',
    { title: 'WARNORD — Window 1' },
  ),
  N(
    'first-light-brief',
    '/// MONOLITH — FIRST LIGHT // VOID CLEARANCE ///\n\nIntent: sweep and secure the Deck 58 commercial concourse. Establish a forward observation post to deny Boone the concourse and give early warning deeper into Sector 7.\n\nConcept: insert via Elevator Shaft 7-Bravo from Deck 52. The concourse runs roughly two hundred metres: central atrium, upper and lower galleries, multiple access corridors. Expect at least one Boone recon team with Headless forward observers. Boone has sandbagged two positions overlooking the concourse.\n\nThe post goes in at the atrium. Observers who reach an exit will report. Recon elements that break contact will report your composition.\n\nMONOLITH out.',
    { title: 'FIRST LIGHT' },
  ),
  N(
    'tripwire-brief',
    '/// MONOLITH — TRIPWIRE // COUNTER-NETWORK ///\n\nIntent: locate and neutralize the IED cell in Sector 7. Protect 3rd Battalion patrol routes on Decks 52 to 55. Recover intelligence on the support network.\n\nConcept: all three devices were placed between 0200 and 0600Z along Corridor 7-Delta, Decks 53 and 54. Establish an ambush on the predicted emplacement route and intercept the cell on its next cycle. This is a patience tasking. The cell comes to you.\n\nThe cell leader carries the network. STRATCOM prefers the leader in custody.\n\nMONOLITH out.',
    { title: 'TRIPWIRE' },
  ),
  N(
    'pale-signal-brief',
    '/// MONOLITH — PALE SIGNAL // INVESTIGATION ///\n\nIntent: investigate the Deck 62 intercept. Identify the source. Recover any intelligence.\n\nConcept: a single burst transmission on an encryption protocol STRATCOM cannot identify. It matches no Boone, Headless, Manticor, Harlow, Janus, Black Pact, or Authority standard. Origin: a maintenance sublevel on Deck 62 that should be unoccupied.\n\nThis intercept is flagged for Priority 2 analysis. Your mission is to collect, not to engage. If you encounter anything that does not match known threat profiles: observe, document, withdraw. You are not authorized for offensive action against unidentified contacts without STRATCOM clearance. This restriction is not discretionary.\n\nMONOLITH out.',
    { title: 'PALE SIGNAL', tags: ['gemini-mystery'] },
  ),
  N('pale-signal-authorized', 'Both primary objectives confirmed. PALE SIGNAL is authorized for this window. Collection only.', { title: 'PALE SIGNAL Authorized', tags: ['gemini-mystery'] }),
  N('debrief-standard', '/// MONOLITH COPIES, GEMINI ///\n\nCasualty status required. Report any personnel or equipment degradation for STRATCOM tracking.\n\nMONOLITH out.'),
  N(
    'window-brief',
    '/// MONOLITH — WARNORD // {{campaign.stage}} ///\nCLASSIFICATION: AUTHORITY — RESTRICTED.\n\nTasking for this window follows. Rotate kill teams; a team tasked twice in one window operates degraded. Rules of engagement as standing.\n\nTaskings outside the standard portfolio will be issued as custom missions.\n\nMONOLITH out.',
    { title: 'WARNORD' },
  ),
  N(
    'op2-brief',
    '/// MONOLITH — OPERATION II: COUNTERSTRIKE ///\nCLASSIFICATION: AUTHORITY — RESTRICTED.\n\nContainment phase closed. STRATCOM is transferring GEMINI to offensive tasking. Boone positions, emerging threats, and your standing intelligence requirement are now in scope.\n\nOperators recovering from critical wounds are cleared to return to duty.\n\nMONOLITH out.',
    { title: 'Operation II — COUNTERSTRIKE' },
  ),
  N(
    'op3-brief',
    '/// MONOLITH — OPERATION III: COLD IRON ///\nCLASSIFICATION: AUTHORITY — RESTRICTED.\n\nThe situation in the contested decks is deteriorating. Multiple threats are converging. Full Raid Force Alpha assets are released to GEMINI.\n\nOperators recovering from critical wounds are cleared to return to duty.\n\nMONOLITH out.',
    { title: 'Operation III — COLD IRON' },
  ),
  N('tasking-brief', '/// MONOLITH — TASKING ORDER // {{mission.name}} ///\n\nExecute as issued at window start. Rules of engagement as standing. Report on completion.\n\nMONOLITH out.'),
  N(
    'cold-trace-brief',
    '/// MONOLITH — COLD TRACE // INVESTIGATION ///\n\nSTRATCOM has assigned GEMINI a dedicated investigation under your standing intelligence requirement. Site details follow under separate cover at Priority 1.\n\nYour tasking is collection. Observe, document, withdraw. Engagement of unidentified contacts requires STRATCOM clearance.\n\nMONOLITH out.',
    { title: 'COLD TRACE', tags: ['gemini-mystery'] },
  ),
  // Window status (shown at each window start; exactly one band per track passes).
  N('status-secure', 'Sector status: SECURE. Priority tasking. Choose your targets. Ironclad split allocation authorized. Golem repair at priority.', { title: 'Sector Status', when: gte('stability', 8) }),
  N('status-contested', 'Sector status: CONTESTED. Standard support. Select two taskings from the options issued. Ironclad: one tasking this window.', { title: 'Sector Status', when: all(gte('stability', 5), not(gte('stability', 8))) }),
  N('status-deteriorating', 'Sector status: DETERIORATING. Reduced support. Taskings are assigned, not offered. 3rd Battalion response will be delayed. Ironclad: one tasking this window.', { title: 'Sector Status', when: all(gte('stability', 3), not(gte('stability', 5))) }),
  N('status-collapse', 'Sector status: COLLAPSE. Emergency operations only. No 3rd Battalion response is available. GEMINI may be reassigned to defensive duties.', { title: 'Sector Status', when: not(gte('stability', 3)) }),
  N('threat-low', 'Threat assessment: Boone infantry and recon elements, occasional Headless activity.', { title: 'Threat Assessment', when: not(gte('escalation', 4)) }),
  N('threat-elevated', 'Threat assessment: Boone special operations elements active. Manticor sightings reported. Black Pact presence possible.', { title: 'Threat Assessment', when: all(gte('escalation', 4), not(gte('escalation', 7))) }),
  N('threat-high', 'Threat assessment: named enemy commanders and coordinated multi-faction operations.', { title: 'Threat Assessment', when: all(gte('escalation', 7), not(gte('escalation', 9))) }),
  N('threat-critical', 'Threat assessment: critical. Contacts outside catalogued profiles are expected. A campaign-defining confrontation is assessed as approaching.', { title: 'Threat Assessment', when: gte('escalation', 9) }),
  // Milestones.
  N('stability-secure', 'Sector Stability has reached SECURE. STRATCOM acknowledges. Additional support is released.', { title: 'Sector Secure' }),
  N('escalation-4', 'Threat environment revised. Boone has committed special operations elements to the contested decks. Manticor activity is reported.', { title: 'Escalation' }),
  N('escalation-6', 'Black Pact liquidation teams are now assessed as operating on The Harp. Principal unknown.', { title: 'Escalation' }),
  N('escalation-7', 'Coordinated multi-faction activity confirmed. Expect named enemy commanders.', { title: 'Escalation' }),
  N('escalation-9', 'Threat environment critical. Contact reports now include profiles outside every catalogued programme. Exercise extreme caution.', { title: 'Escalation', tags: ['gemini-mystery'] }),
  N(
    'intel-5',
    '/// MONOLITH — CLASSIFIED BRIEFING // PRIORITY 2 ///\n\nYour collection to date has been reviewed. The following is releasable.\n\nThe Deck 62 encryption shares structure with material recovered from the original Gemini site. Wound analysis indicates the attackers absorbed sustained fire through armour and augmentation beyond any catalogued Chimera or Manticor programme. Coordination between them was silent.\n\nThe scope of this is larger than one squad. That is all that is releasable.\n\nMONOLITH out.',
    { title: 'Classified Briefing', tags: ['gemini-mystery'] },
  ),
  N('intel-10', 'Collection threshold reached. STRATCOM is assigning GEMINI a dedicated investigation: COLD TRACE. Tasking follows.', { title: 'Investigation Assigned', tags: ['gemini-mystery'] }),
  N(
    'intel-15',
    '/// MONOLITH — PRIORITY 1 NOTICE ///\n\nThreat identification has been confirmed at Priority 1. Details are withheld below Priority 1 access.\n\nThe operation portfolio is under revision. Await amended tasking. Do not speculate on any net.\n\nMONOLITH out.',
    { title: 'Priority 1 Notice', tags: ['gemini-mystery'] },
  ),
  N('golem-over-allocation', 'Ironclad has been committed beyond this window\'s allocation. Authorization at current Sector Stability is one tasking. Logged for review.', { title: 'Allocation' }),
  N(
    'kia-inquiry',
    '/// MONOLITH COPIES ///\n\n{{operator.field.grade}} {{operator.name}}. Confirmed killed in action. STRATCOM inquiry opened as standard.\n\nRemaining GEMINI elements consolidate at FOB BULWARK and await tasking.\n\nMONOLITH out.',
    { title: 'Casualty Notification', tags: ['casualty'] },
  ),
  N('reinforcement-review', 'Quarterly personnel review complete. STRATCOM allocation follows.', { title: 'Personnel Review' }),
];

// ── Triggers ────────────────────────────────────────────────────────────
const notW1 = not({ op: 'stageIs', stage: 'w1' });
const triggers = [
  {
    key: 'standing-support',
    on: 'onCampaignStart',
    once: true,
    narrative: 'gemini-file',
    effects: ['stratcom-sigint', 'authority-qrf', 'medevac'].map((asset) => ({ op: 'grantAsset', asset })),
  },
  {
    key: 'window-reset',
    on: 'onStageStart',
    effects: [
      { op: 'setLadder', ladder: 'readiness', target: 'roster', state: 'green' },
      { op: 'stepLadder', ladder: 'casualty', target: 'roster', steps: -1 },
      { op: 'stepLadder', ladder: 'drone-status', target: 'roster', steps: -1 },
      flag('golems-committed', false),
    ],
  },
  {
    key: 'operation-boundary',
    on: 'onStageStart',
    when: any({ op: 'stageIs', stage: 'w5' }, { op: 'stageIs', stage: 'w9' }),
    effects: [{ op: 'setLadder', ladder: 'critical', target: 'roster', state: 'clear' }],
  },
  { key: 'open-taskings', on: 'onStageStart', when: notW1, once: true, effects: [{ op: 'unlockMission', mission: 'tasking' }] },
  {
    key: 'window-status',
    on: 'onStageStart',
    effects: ['status-secure', 'status-contested', 'status-deteriorating', 'status-collapse', 'threat-low', 'threat-elevated', 'threat-high', 'threat-critical'].map((k) => ({ op: 'showNarrative', narrative: k })),
  },
  {
    key: 'issue-taskings',
    on: 'onStageStart',
    when: notW1,
    effects: [
      iff(
        gte('stability', 8),
        [],
        [iff(gte('stability', 5), [{ op: 'rollTable', table: 'cold-iron-taskings', times: 3 }], [iff(gte('stability', 3), [{ op: 'rollTable', table: 'cold-iron-taskings', times: 2 }], [{ op: 'rollTable', table: 'cold-iron-taskings', times: 1 }])])],
      ),
    ],
  },
  { key: 'sector-events', on: 'onStageStart', when: notW1, effects: [{ op: 'rollTable', table: 'sector-7-events' }] },
  {
    key: 'readiness-degrade',
    on: 'onMissionResolved',
    effects: [iff({ op: 'ladderIs', ladder: 'readiness', target: 'participants', states: ['red'], match: 'none' }, [{ op: 'setLadder', ladder: 'readiness', target: 'participants', state: 'amber' }])],
  },
  {
    key: 'golem-allocation',
    on: 'onMissionResolved',
    effects: [
      iff({ op: 'operatorStat', target: 'participants', stat: 'drone', cmp: 'eq', value: 1, match: 'any' }, [
        iff(all({ op: 'flag', flag: 'golems-committed' }, not(gte('stability', 8))), [{ op: 'showNarrative', narrative: 'golem-over-allocation' }]),
        flag('golems-committed'),
      ]),
    ],
  },
  { key: 'priority-repair', on: 'onMissionResolved', when: gte('stability', 8), effects: [{ op: 'stepLadder', ladder: 'drone-status', target: 'roster', steps: -1 }] },
  {
    key: 'pale-signal-auth',
    on: 'onMissionResolved',
    once: true,
    when: all({ op: 'missionOutcome', mission: 'first-light', outcomes: ['success', 'enhanced'] }, { op: 'missionOutcome', mission: 'tripwire', outcomes: ['success', 'enhanced'] }),
    narrative: 'pale-signal-authorized',
    effects: [{ op: 'unlockMission', mission: 'pale-signal' }],
  },
  { key: 'kia-inquiry', on: 'onOperatorKia', narrative: 'kia-inquiry', effects: [{ op: 'adjustPool', pool: 'butchers-bill', amount: 1 }] },
  {
    key: 'reinforcements',
    on: 'onStageEnd',
    when: { op: 'poolGte', pool: 'reinforcement-clock', value: 4 },
    narrative: 'reinforcement-review',
    effects: [{ op: 'rollTable', table: 'cold-iron-reinforcements' }, { op: 'adjustPool', pool: 'reinforcement-clock', amount: -4 }],
  },
];

// ── Assembly ────────────────────────────────────────────────────────────
const op = (key, name, callsign, fields, extra = {}) => ({ key, name, ...(callsign ? { callsign } : {}), fields, ...extra });
const campaign = {
  id: 'cold-iron',
  name: 'BLACKFALL — TASKFORCE GEMINI / OPERATION COLD IRON',
  summary:
    'Solo BLACKFALL campaign for UN Raid Force Alpha aboard The Harp, D+14. Three kill teams (Revenants, Pale Horse, Ironclad Golems) under STRATCOM handler MONOLITH. Tracks: Sector Stability (start 5), Escalation (start 2), Gemini Mystery Intel (0–15; milestones at 5, 10, 15). Readiness degrades within a window and resets between windows. Casualties are harsher than APACHE (Critical Wounds carry permanent penalties) and XP thresholds are 50% higher (8 / 18 / 33). Window 1 is fully authored; Windows 2–12 run on the tasking generator, STRATCOM Taskings and custom missions. Advancement: when an operator reaches a new tier, roll the matching Advancement table. RED readiness (stand down one window after a kill team lost half its strength) is set by manual adjustment.',
  intro:
    'Kill Squad Gemini is dead.\n\nFour UTG operators and eight Golems answered a Janus Security distress call during the Battle for The Harp. None came back. Combat footage shows three unidentified combatants taking the squad apart. Authority intelligence has not identified them.\n\nSTRATCOM has reconstituted the designation. The new Gemini is drawn from what Raid Force Alpha had left: operators pulled from broken squads, from garrison postings, and from the last cohort out of the enhancement pipeline. They carry the name of the dead.\n\nD+14. The Boone assault has stalled. Boone holds the upper levels and the gun bays; the Authority anchors the lower decks and the elevator stalks. Between them, the middle decks are no-man\'s-land.\n\nGEMINI\'s mandate: go where the line troops cannot, kill what they cannot kill, and hold what cannot be allowed to fall.',
  rulesets: [],
  personas: [
    {
      key: M,
      name: 'MONOLITH',
      callsign: 'MONOLITH',
      role: 'STRATCOM Operations Coordinator — Raid Force Alpha',
      text: 'Institutional, precise, compartmentalized. Employer-to-asset. Cites classification, never explains it. When the news is bad, the transmissions get shorter. Protecting GEMINI, or protecting the Authority from GEMINI: deliberately unclear.',
    },
  ],
  roster: {
    startingTeams: [
      {
        key: 'revenants',
        name: 'Revenants',
        callsign: 'GEMINI 1',
        text: 'Kill Team 1. Close assault, breaching, CQB.',
        operators: [
          op('acheron', 'Sable Acheron', 'REVENANT', { grade: 'WO2', card: 'UTG Assaulters', role: 'Kill team lead', background: 'Former Kill Squad Fenris; sole survivor of a Boone barrage at D+3. Second-generation UTG, enhanced as a teenager. Quiet, methodical. Carries it without talking about it.' }),
          op('voss', 'Elara Voss', 'BREACH', { grade: 'Sgt.', card: 'UTG Assaulters', role: 'Breacher', background: 'Last cohort out of the enhancement pipeline before the invasion. Green, physically exceptional. Acheron asked for her by name. Her hands shake before a mission and stop at the first round fired.' }),
        ],
      },
      {
        key: 'pale-horse',
        name: 'Pale Horse',
        callsign: 'GEMINI 2',
        text: 'Kill Team 2. Precision fire, cloaking, overwatch, command and control.',
        operators: [
          op('skade', 'Irena Skade', 'SHROUD', { grade: 'WO1', card: 'UTG Specialists', role: 'Kill team lead', background: 'Intelligence background; two years as a singleton in Manticor-contested space. Pulled from a classified operation to fill the roster. She has not said which. STRATCOM has not asked.' }),
          op('adeyemi', 'Amara Adeyemi', 'LANCE', { grade: 'Sgt.', card: 'UTG Specialists', role: 'Anti-materiel', background: 'Former garrison kill squad on ABOL orbital infrastructure. Requested combat assignment after D-Day. Exceptional at range. Keeps a quiet faith to herself; a worn prayer bead on her rifle stock.' }),
        ],
      },
      {
        key: 'ironclad',
        name: 'Ironclad',
        callsign: 'GEMINI 3',
        text: 'Kill Team 3. Golem combat drones: equipment, not personnel. No XP, no advancement.',
        operators: [
          op('golem-7', 'GOLEM-7', null, { grade: '', card: 'Golems', role: 'Combat drone' }, { stats: { drone: 1 }, tags: ['golem'] }),
          op('golem-12', 'GOLEM-12', null, { grade: '', card: 'Golems', role: 'Combat drone' }, { stats: { drone: 1 }, tags: ['golem'] }),
        ],
      },
    ],
    pick: { min: 3, max: 3 },
    teamsMax: 5,
    operatorsPerTeam: { min: 1, max: 2 },
    stats: [
      { key: 'drone', name: 'Golem Asset (1 = drone)', initial: 0, min: 0, max: 1 },
      { key: 'penalties', name: 'Permanent Penalties', initial: 0, min: 0, max: 9 },
    ],
    operatorFields: [
      { key: 'grade', label: 'Grade', kind: 'text', default: 'Sgt.' },
      { key: 'card', label: 'Unit card (display only)', kind: 'text', default: '' },
      { key: 'role', label: 'Role', kind: 'text', default: '' },
      { key: 'background', label: 'Background', kind: 'text', default: '' },
      { key: 'advancements', label: 'Advancements', kind: 'text', default: '' },
      { key: 'penalty-notes', label: 'Permanent penalty detail', kind: 'text', default: '', help: 'Which stat took each Critical Wound penalty (Skill, Movement or first Armor value).' },
    ],
    ranks: [
      { key: 'operator', name: 'Operator' },
      { key: 'tier-1', name: 'Tier 1', xp: 8 },
      { key: 'tier-2', name: 'Tier 2', xp: 18 },
      { key: 'tier-3', name: 'Tier 3 — Named', xp: 33 },
    ],
    nameTable: 'utg-names',
  },
  timeline: { topology: 'linear', stages },
  missions: [firstLight, tripwire, paleSignal, tasking, coldTrace],
  ladders: [
    {
      key: 'casualty',
      name: 'Medical Status',
      scope: 'operator',
      states: [
        { key: 'fit', name: 'Fit for duty' },
        { key: 'light', name: 'Light Wound', text: 'Casualty roll 7–8. Out for the rest of this window; returns next window.' },
        { key: 'serious', name: 'Serious Wound', text: 'Casualty roll 5–6. Out for two windows.' },
        { key: 'kia', name: 'KIA', text: 'Casualty roll 1–2. Removed permanently. STRATCOM inquiry.', onEnter: [{ op: 'removeOperator', target: 'subject', reason: 'kia' }], tags: ['casualty'] },
      ],
      initial: 'fit',
    },
    {
      key: 'critical',
      name: 'Critical Wound',
      scope: 'operator',
      states: [
        { key: 'clear', name: 'None' },
        { key: 'critical', name: 'Critical Wound', text: 'Casualty roll 3–4. Out for the rest of the Operation. Returns at the next Operation with a permanent −1 to Skill, Movement or first Armor value (player\'s choice).' },
      ],
      initial: 'clear',
    },
    {
      key: 'morale',
      name: 'Morale',
      scope: 'operator',
      states: [
        { key: 'steady', name: 'Steady' },
        { key: 'shaken', name: 'Shaken', text: 'Casualty roll 9. Deploys next mission; morale check at the start of the first activation, failure = Reposition only. Clears after that mission.' },
      ],
      initial: 'steady',
    },
    {
      key: 'drone-status',
      name: 'Golem Status',
      scope: 'operator',
      states: [
        { key: 'operational', name: 'Operational' },
        { key: 'damaged', name: 'Damaged', text: '−1 to all stats until repaired. Repair takes one window (immediate at Sector Stability 8+).' },
        { key: 'destroyed', name: 'Destroyed', text: 'Written off (logged as retired: equipment, not personnel; no inquiry). Replace via reinforcements.', onEnter: [{ op: 'removeOperator', target: 'subject', reason: 'retired' }] },
      ],
      initial: 'operational',
    },
    {
      key: 'readiness',
      name: 'Readiness',
      scope: 'team',
      states: [
        { key: 'green', name: 'GREEN', text: 'No penalties.' },
        { key: 'amber', name: 'AMBER', text: '−1 Skill on all checks. Set after a kill team\'s first tasking in a window.' },
        { key: 'red', name: 'RED', text: 'Stand down this window. If forced: −2 Skill, no Reactions in round 1. Set by manual adjustment at window start when the team lost half or more of its strength last window.' },
      ],
      initial: 'green',
    },
  ],
  pools: [
    { key: 'butchers-bill', name: 'Butcher\'s Bill (KIA)', initial: 0, min: 0 },
    { key: 'reinforcement-clock', name: 'Windows Since Reinforcement Review', initial: 0, min: 0, max: 4, refresh: [{ on: 'onStageEnd', mode: 'add', amount: 1 }] },
  ],
  tracks: [
    {
      key: 'stability',
      name: 'Sector Stability',
      min: 1,
      max: 10,
      initial: 5,
      milestones: [{ key: 'secure', at: 8, once: false, effects: [], narrative: 'stability-secure' }],
    },
    {
      key: 'escalation',
      name: 'Escalation',
      min: 1,
      max: 10,
      initial: 2,
      milestones: [
        { key: 'special-operations', at: 4, effects: [], narrative: 'escalation-4' },
        { key: 'black-pact', at: 6, effects: [], narrative: 'escalation-6' },
        { key: 'coordinated', at: 7, effects: [], narrative: 'escalation-7' },
        { key: 'critical', at: 9, effects: [flag('escalation-critical')], narrative: 'escalation-9' },
      ],
    },
    {
      key: 'intel',
      name: 'Gemini Mystery Intel',
      min: 0,
      max: 15,
      initial: 0,
      milestones: [
        { key: 'classified-briefing', at: 5, effects: [flag('intel-briefed')], narrative: 'intel-5' },
        { key: 'investigation', at: 10, effects: [{ op: 'unlockMission', mission: 'cold-trace' }], narrative: 'intel-10' },
        { key: 'identity-confirmed', at: 15, effects: [flag('threat-identified')], narrative: 'intel-15' },
      ],
    },
  ],
  narratives,
  triggers,
  assets: [
    { key: 'stratcom-sigint', name: 'STRATCOM SIGINT', text: 'Standing. Every mission receives at least PARTIAL intel.' },
    { key: 'authority-qrf', name: 'Authority QRF', text: 'Standing. Call on 6+ (1D10), +1 per round after the first call; one Reserve Fireteam. Availability falls with Sector Stability.' },
    { key: 'medevac', name: 'Medical Evacuation', text: 'Standing. +1 to Casualty Rolls for missions within The Harp.' },
    { key: 'op-deck-58', name: 'Deck 58 Observation Post', text: '+1D10 Initiative on all Sector 7 missions (early warning).' },
    { key: 'qrf-priority', name: '3rd Battalion Priority', text: '+1 to Authority QRF availability rolls for the rest of Operation I.' },
    { key: 'encryption-key', name: 'Partial Encryption Key', text: 'Recovered at PALE SIGNAL.' },
    { key: 'monitored-frequency', name: 'Monitored Frequency', text: 'PALE SIGNAL transmission log and a frequency STRATCOM can monitor.' },
    { key: 'golem-upgrade', name: 'Golem Upgrade Package', text: 'Permanent weapon/armour improvement on one existing Golem.' },
  ],
  tags: ['military', 'solo'],
};

const pack = {
  $schema: '../docs/schema/pack.schema.json',
  format: 'blkout-pack',
  formatVersion: 1,
  id: 'blackfall-gemini',
  version: '1.0.0',
  title: 'BLACKFALL — TASKFORCE GEMINI / OPERATION COLD IRON',
  author: 'RJ (BLACKFALL)',
  license: 'Fan-created, non-commercial. BLKOUT and all BLKOUT IP belong to Enemy Spotted Studios; this pack is unofficial and not endorsed by them. Contains no official card stats, rules text or art.',
  description:
    'Reference campaign pack for BLKOUT: TOC. Narrative and campaign structure only: enemy forces are named by card, never statted, and no pack dependency is required. Operator unit cards are display text; enter official card data in your own `blkout` pack.',
  requires: [],
  contentTags: ['military', 'mature-themes', 'graphic', 'casualty', 'gemini-mystery'],
  content: {
    calibrations: [
      {
        id: 'blackfall-calibration',
        name: 'BLACKFALL Calibration',
        rulesets: [],
        checks: [
          { key: 'skill-legendary', field: 'skill', min: 5, message: 'Skill 4 is Legendary: campaign-earned through Tier 2 Skill Improvement only.' },
          { key: 'skill-militia', field: 'skill', max: 8, message: 'Skill 9+ is below militia standard.' },
          { key: 'two-dice-handlers', field: 'armor.dice', when: { exceptTypes: ['handler', 'duster'] }, notIn: [2, 3], message: 'Double-die armour (2/X) is reserved for Handler-tier models.' },
        ],
        text: 'BLACKFALL skill bands: 7 trained regular, 6 SOF-equivalent, 5 exceptional (UTG, Handlers, named characters), 4 legendary (earned in play).',
      },
    ],
    tables: [generator, events, { id: 'cold-iron-reinforcements', name: 'COLD IRON Reinforcements', text: 'Rolled after every 4th window. 1D10 bands: 1–4 none, 5–6 operator, 7 specialist, 8 Golem, 9 full unit, 10 Golem upgrade (or a unit). Modifiers (Stability 8+ +1, Stability 3 or less −2, Butcher\'s Bill 3+ −1) select the weight tier.', entries: reinfEntries, tags: [] }, names, ...advancement],
    campaigns: [campaign],
  },
};

writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
console.log('wrote', out, JSON.stringify(pack).length, 'bytes');
