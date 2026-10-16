import type { PackInput } from '$lib/packs/schema';

// Invented engine fixture ("Iron Test"): exercises every primitive, scope, and trigger type. No ESS content.
// A function so each test gets a fresh, mutable copy.

export const enginePack = (): PackInput => ({
  format: 'blkout-pack',
  formatVersion: 2,
  id: 'ops',
  version: '1.2.0',
  title: 'Engine test pack (invented)',
  author: 'TOC test suite',
  content: {
    tables: [
      {
        id: 'rumors',
        name: 'Rumors',
        entries: [
          { key: 'whisper', weight: 2, label: 'Whisper', narrative: { text: '{{persona.overwatch}}: chatter on {{campaign.stage}}.', speaker: 'overwatch' } },
          { key: 'stash', weight: 1, label: 'Stash', effects: [{ op: 'adjustPool', pool: 'supply', amount: 1 }] },
          { key: 'grim', weight: 5, label: 'Grim find', narrative: { text: 'Something grim.' }, tags: ['gore'] },
          { key: 'late', weight: 50, label: 'Late intel', effects: [{ op: 'adjustTrack', track: 'intel', amount: 1 }], when: { op: 'stageIs', stage: 'three' } },
        ],
      },
      { id: 'v-default', name: 'Default Intel', entries: [{ key: 'a', weight: 1, label: 'Default', effects: [{ op: 'setFlag', flag: 'table', value: 'default' }] }] },
      { id: 'v-shade', name: 'Shade Intel', entries: [{ key: 'a', weight: 1, label: 'Shade', effects: [{ op: 'setFlag', flag: 'table', value: 'shade' }] }] },
      { id: 'grim-only', name: 'Grim Only', entries: [{ key: 'a', weight: 1, label: 'Grim', narrative: { text: 'Grim.' }, tags: ['gore'] }] },
      {
        id: 'names',
        name: 'Names',
        entries: [
          { key: 'a', weight: 1, label: 'Fennick', narrative: { text: 'Fennick' } },
          { key: 'b', weight: 1, label: 'Osei', narrative: { text: 'Osei' } },
          { key: 'c', weight: 1, label: 'Marrow', narrative: { text: 'Marrow' } },
        ],
      },
    ],
    campaigns: [
      {
        id: 'iron-test',
        name: 'Iron Test',
        intro: 'Welcome to {{campaign.name}}, {{team.name}}.',
        personas: [
          { key: 'overwatch', name: 'Overwatch', callsign: 'OVERWATCH', role: 'Handler' },
          { key: 'actual', name: 'Major Rusk' },
        ],
        roster: {
          startingTeams: [
            {
              key: 'alpha',
              name: 'Team Alpha',
              callsign: 'ANVIL',
              operators: [
                { key: 'vale', name: 'Vale', callsign: 'KNIFE', unit: 'core:rifle-team', stats: { grit: 3 }, fields: { role: 'lead' } },
                { unit: 'rifle-team' },
              ],
            },
            { key: 'bravo', name: 'Team Bravo', operators: [{ key: 'brook', name: 'Brook', stats: { grit: 9, bogus: 1 } }] },
            { key: 'charlie', name: 'Team Charlie' },
          ],
          pick: { min: 1, max: 2 },
          teamsMax: 3,
          operatorsPerTeam: { max: 3 },
          stats: [{ key: 'grit', name: 'Grit', initial: 2, min: 0, max: 5 }],
          operatorFields: [
            { key: 'role', label: 'Role', kind: 'choice', options: [{ value: 'lead', label: 'Lead' }, { value: 'medic', label: 'Medic' }] },
            { key: 'kit', label: 'Kit', kind: 'text', default: 'standard' },
          ],
          ranks: [{ key: 'pvt', name: 'Private' }, { key: 'cpl', name: 'Corporal', xp: 5 }, { key: 'sgt', name: 'Sergeant', xp: 12 }, { key: 'lt', name: 'Lieutenant' }],
          nameTable: 'names',
        },
        timeline: {
          stages: [
            {
              key: 'one',
              name: 'Window One',
              briefing: { text: 'Stage {{campaign.stage}} opens. Supply {{pool.supply}}.', speaker: 'actual' },
              slots: [
                { key: 's1', missions: ['recon'] },
                { key: 's2', missions: ['raid-a', 'raid-b'] },
                { key: 'opt', missions: ['patrol'], optional: true },
              ],
            },
            { key: 'two', name: 'Window Two', slots: [{ key: 's3', missions: ['hunt'] }], endWhen: { op: 'trackGte', track: 'intel', value: 10 } },
            { key: 'three', name: 'Window Three', allowCustomMissions: false, slots: [{ key: 'fin', missions: ['finale'] }] },
          ],
        },
        missions: [
          {
            key: 'recon',
            name: 'Recon',
            briefing: { text: '{{mission.name}}: eyes only.', speaker: 'overwatch' },
            debrief: { text: '{{mission.name}} closed: {{mission.outcome}}.' },
            aar: {
              fields: [
                { key: 'intel-found', label: 'Intel found', kind: 'boolean', scope: 'mission', onValue: [{ value: true, effects: [{ op: 'adjustTrack', track: 'intel', amount: 2 }] }] },
                { key: 'civilians', label: 'Civilians lost', kind: 'number', scope: 'mission', min: 0, max: 5, perUnit: [{ op: 'adjustPool', pool: 'supply', amount: -1 }] },
                { key: 'kills', label: 'Kills', kind: 'number', scope: 'operator', min: 0, perUnit: [{ op: 'addXp', target: 'subject', amount: 1 }] },
                {
                  key: 'wound',
                  label: 'Wound',
                  kind: 'choice',
                  scope: 'operator',
                  default: 'none',
                  options: [{ value: 'none', label: 'None' }, { value: 'light', label: 'Light' }, { value: 'grave', label: 'Grave' }],
                  onValue: [
                    { value: 'light', effects: [{ op: 'stepLadder', ladder: 'wounds', steps: 1 }] },
                    { value: 'grave', effects: [{ op: 'stepLadder', ladder: 'wounds', target: 'subject', steps: 3 }] },
                  ],
                },
              ],
            },
            outcomes: [
              {
                key: 'success',
                name: 'Clean',
                effects: [
                  { op: 'addXp', target: 'participants', amount: 3 },
                  { op: 'adjustTrack', track: 'intel', amount: 2 },
                  { op: 'unlockMission', mission: 'bonus' },
                ],
                narrative: { text: 'Good work, {{team.callsign}}.', speaker: 'overwatch' },
              },
              {
                key: 'failure',
                name: 'Compromised',
                effects: [{ op: 'stepLadder', ladder: 'readiness', steps: 1 }, { op: 'setLadder', ladder: 'alert', state: 'alert' }],
              },
            ],
          },
          { key: 'raid-a', name: 'Raid A', outcomes: [{ key: 'success', name: 'Done', effects: [{ op: 'grantAsset', asset: 'uav' }] }] },
          { key: 'raid-b', name: 'Raid B', outcomes: [{ key: 'success', name: 'Done' }] },
          { key: 'patrol', name: 'Patrol', repeatable: true, outcomes: [{ key: 'success', name: 'Done', effects: [{ op: 'adjustPool', pool: 'supply', amount: 1 }] }] },
          { key: 'bonus', name: 'Bonus Op', locked: true, outcomes: [{ key: 'success', name: 'Done', effects: [{ op: 'adjustTrack', track: 'intel', amount: 5 }] }] },
          { key: 'hunt', name: 'Hunt', outcomes: [{ key: 'success', name: 'Done', effects: [{ op: 'adjustTrack', track: 'intel', amount: 10 }] }, { key: 'failure', name: 'Lost' }] },
          { key: 'finale', name: 'Finale', outcomes: [{ key: 'success', name: 'Victory', effects: [{ op: 'promote', target: 'roster' }] }] },
        ],
        ladders: [
          {
            key: 'wounds',
            name: 'Wounds',
            states: [
              { key: 'ok', name: 'OK' },
              { key: 'light', name: 'Lightly Wounded' },
              { key: 'grave', name: 'Gravely Wounded' },
              { key: 'dead', name: 'Dead', onEnter: [{ op: 'removeOperator', target: 'subject', reason: 'kia' }] },
            ],
            initial: 'ok',
            transitions: [
              { from: 'ok', to: 'light', effects: [{ op: 'adjustStat', target: 'subject', stat: 'grit', amount: -1 }] },
              { from: '*', to: 'dead', when: { op: 'poolGte', pool: 'supply', value: 0 }, effects: [{ op: 'adjustTrack', track: 'intel', amount: -1 }] },
            ],
          },
          {
            key: 'readiness',
            name: 'Readiness',
            scope: 'team',
            states: [{ key: 'green', name: 'Green' }, { key: 'amber', name: 'Amber' }, { key: 'red', name: 'Red', onEnter: [{ op: 'adjustPool', pool: 'supply', amount: -1 }] }],
            initial: 'green',
          },
          { key: 'alert', name: 'Alert', scope: 'campaign', states: [{ key: 'calm', name: 'Calm' }, { key: 'alert', name: 'Alert' }, { key: 'blackout', name: 'Blackout' }], initial: 'calm' },
        ],
        pools: [
          { key: 'supply', name: 'Supply', initial: 4, min: 0, max: 8, refresh: [{ on: 'onStageStart', mode: 'add', amount: 2 }] },
          { key: 'cp', name: 'Command Points', initial: 0, refresh: [{ on: 'onMissionStart', mode: 'set', amount: 2, when: { op: 'flag', flag: 'cp-cut', equals: false } }] },
        ],
        tracks: [
          {
            key: 'intel',
            name: 'Intel',
            max: 12,
            milestones: [
              { key: 'm3', at: 3, effects: [{ op: 'grantAsset', asset: 'uav', team: 'alpha' }], narrative: { text: 'Intel at {{track.intel}}/{{track.intel.max}}.', speaker: 'overwatch' } },
              { key: 'm6', at: 6, once: false, effects: [{ op: 'adjustPool', pool: 'supply', amount: 1 }] },
              { key: 'm10', at: 10, effects: [{ op: 'setFlag', flag: 'breakthrough' }] },
            ],
          },
        ],
        narratives: [
          { key: 'kia-note', text: '{{operator.name}} ({{operator.callsign}}) is gone. {{team.name}} has {{team.size}} left.', speaker: 'actual' },
          { key: 'gory', text: 'Graphic.', tags: ['gore'] },
          { key: 'gated', text: 'Only when flagged.', when: { op: 'flag', flag: 'show-gated' } },
        ],
        triggers: [
          { key: 'start', on: 'onCampaignStart', effects: [{ op: 'setFlag', flag: 'cp-cut', value: false }], narrative: { text: '{{persona.actual.name}} on the net.', speaker: 'actual' } },
          { key: 'two-alert', on: 'onStageStart', filter: { stage: 'two' }, effects: [{ op: 'setLadder', ladder: 'alert', state: 'alert' }] },
          { key: 'hunt-start', on: 'onMissionStart', filter: { mission: 'hunt' }, effects: [{ op: 'rollTable', table: 'rumors', times: 2 }] },
          { key: 'fail-tax', on: 'onMissionResolved', when: { op: 'missionOutcome', outcomes: ['failure'] }, effects: [{ op: 'adjustPool', pool: 'supply', amount: -1 }] },
          { key: 'one-end', on: 'onStageEnd', filter: { stage: 'one' }, effects: [{ op: 'addOperator', team: 'alpha', operator: { callsign: 'NEW' } }] },
          { key: 'm3-flag', on: 'onTrackMilestone', filter: { track: 'intel', milestone: 'm3' }, once: true, effects: [{ op: 'setFlag', flag: 'intel-3' }] },
          { key: 'kia', on: 'onOperatorKia', effects: [{ op: 'adjustPool', pool: 'supply', amount: -1 }], narrative: 'kia-note' },
        ],
        assets: [{ key: 'uav', name: 'UAV' }],
      },
      {
        id: 'loop',
        name: 'Loop',
        roster: { startingTeams: [{ key: 'solo', name: 'Solo', operators: [{ key: 'x', name: 'X' }] }] },
        timeline: { stages: [{ key: 'only', name: 'Only', slots: [{ key: 'a', missions: ['m'] }] }] },
        missions: [{ key: 'm', name: 'M', outcomes: [{ key: 'deep', name: 'Deep', effects: [{ op: 'setLadder', ladder: 'flip', target: 'subject', state: 'b' }] }] }],
        ladders: [
          {
            key: 'flip',
            name: 'Flip',
            scope: 'campaign',
            states: [
              { key: 'a', name: 'A', onEnter: [{ op: 'setLadder', ladder: 'flip', state: 'b' }] },
              { key: 'b', name: 'B', onEnter: [{ op: 'setLadder', ladder: 'flip', state: 'a' }] },
            ],
            initial: 'a',
          },
        ],
      },
      {
        // v2 features: factions, target filters, forEachTeam, teamMissions, onPromotion, destroyed, customMission.
        id: 'v2-test',
        name: 'V2 Test',
        factions: [
          { key: 'vanguard', name: 'Vanguard' },
          { key: 'shade', name: 'Shade Cell', tags: ['covert'] },
        ],
        roster: {
          startingTeams: [
            { key: 'alpha', name: 'Alpha', operators: [{ key: 'a1', name: 'Ash', tags: ['medic'] }, { key: 'a2', name: 'Bell' }] },
            { key: 'bravo', name: 'Bravo', operators: [{ key: 'b1', name: 'Crow', tags: ['heavy', 'vehicle'] }, { key: 'b2', name: 'Dune', tags: ['medic'] }] },
          ],
          pick: { min: 1, max: 2 },
          ranks: [{ key: 'pvt', name: 'Private' }, { key: 'cpl', name: 'Corporal', xp: 3 }, { key: 'sgt', name: 'Sergeant' }],
        },
        timeline: {
          stages: [
            { key: 'w1', name: 'Window 1', slots: [{ key: 'ops', missions: ['op'], optional: true }] },
            { key: 'w2', name: 'Window 2', slots: [{ key: 'ops', missions: ['op'], optional: true }] },
          ],
        },
        missions: [
          {
            key: 'op',
            name: 'Operation',
            repeatable: true,
            outcomes: [
              {
                key: 'success',
                name: 'Success',
                effects: [
                  { op: 'addXp', target: { from: 'participants', where: { op: 'hasTag', target: 'subject', tags: ['medic'] } }, amount: 3 },
                  { op: 'forEachTeam', where: { op: 'teamMissions', value: 3 }, effects: [{ op: 'setLadder', ladder: 'readiness', state: 'red' }] },
                  { op: 'rollTable', table: 'v-default', byFaction: [{ faction: 'shade', table: 'v-shade' }] },
                ],
              },
              { key: 'scrap', name: 'Vehicle lost', effects: [{ op: 'removeOperator', target: { from: 'roster', where: { op: 'hasTag', target: 'subject', tags: ['vehicle'] } }, reason: 'destroyed' }] },
              {
                key: 'rally',
                name: 'Rally',
                effects: [
                  {
                    op: 'forEachTeam',
                    effects: [
                      { op: 'stepLadder', ladder: 'readiness', target: 'team', steps: 1 },
                      { op: 'adjustStat', target: { from: 'team', where: { op: 'not', cond: { op: 'hasTag', target: 'subject', tags: ['medic'] } } }, stat: 'kills', amount: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        ladders: [
          { key: 'readiness', name: 'Readiness', scope: 'team', states: [{ key: 'green', name: 'Green' }, { key: 'amber', name: 'Amber' }, { key: 'red', name: 'Red' }], initial: 'green' },
        ],
        pools: [{ key: 'supply', name: 'Supply', initial: 5, max: 20 }],
        narratives: [{ key: 'faction-note', text: '{{campaign.factionName}} ({{campaign.faction}}) online.' }],
        triggers: [
          { key: 'hello', on: 'onCampaignStart', effects: [{ op: 'showNarrative', narrative: 'faction-note' }] },
          {
            key: 'promo',
            on: 'onPromotion',
            filter: { rank: 'cpl' },
            effects: [{ op: 'adjustPool', pool: 'supply', amount: 1 }],
            narrative: { text: '{{operator.name}} made {{operator.rank}}.' },
          },
          { key: 'kia', on: 'onOperatorKia', effects: [{ op: 'setFlag', flag: 'kia-fired' }] },
        ],
        customMission: {
          aar: { fields: [{ key: 'loot', label: 'Loot', kind: 'number', scope: 'mission', min: 0, perUnit: [{ op: 'adjustPool', pool: 'supply', amount: 1 }] }] },
          outcomes: [
            { key: 'win', name: 'Win' },
            { key: 'success', name: 'Clean', effects: [{ op: 'setFlag', flag: 'clean' }] },
            { key: 'loss', name: 'Loss' },
          ],
        },
      },
    ],
  },
});
