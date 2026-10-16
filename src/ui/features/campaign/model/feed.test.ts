import { describe, expect, it } from 'vitest';
import { debriefView, entriesSince, eventLabel, groupFeed, lastCommand } from './feed';
import { startGemini } from './__fixtures__/gemini';

describe('feed grouping', () => {
  const run = () => {
    const { engine, campaign } = startGemini();
    engine.dispatch({ type: 'resolveAar', aar: { mission: 'first-light', outcome: 'success', operators: { acheron: { kills: 1 } } } });
    return { engine, campaign };
  };

  it('one group per command, newest first, AAR labels its begin+resolve pair', () => {
    const { engine } = run();
    const groups = groupFeed(engine.state.feed, engine.events);
    expect(groups.map((g) => g.label)).toEqual(['After-action report', 'Campaign started']);
    const aar = groups[0]!;
    expect(aar.entries[0]!.text).toMatch(/^Mission begun/); // reading order inside a group
    expect(aar.entries.some((e) => e.source.type === 'debrief')).toBe(true);
  });

  it('filters by entry kind and drops empty groups', () => {
    const { engine } = run();
    const traffic = groupFeed(engine.state.feed, engine.events, 'traffic');
    expect(traffic.flatMap((g) => g.entries).every((e) => e.kind === 'narrative' || e.kind === 'filtered')).toBe(true);
    expect(groupFeed(engine.state.feed, engine.events, 'log').flatMap((g) => g.entries).every((e) => e.kind === 'system')).toBe(true);
    expect(groupFeed(engine.state.feed, engine.events, 'alerts')).toEqual([]);
  });

  it('legacy events without cmd group per seq', () => {
    const { engine } = run();
    const legacy = engine.events.map((e) => ({ seq: e.seq, type: e.type }));
    expect(groupFeed(engine.state.feed, legacy).map((g) => g.cmd)).toEqual([3, 2, 1]);
  });

  it('entriesSince and lastCommand', () => {
    const { engine, campaign } = run();
    expect(entriesSince(engine.state.feed, 3).every((e) => e.seq >= 3)).toBe(true);
    expect(lastCommand(campaign, engine.events)).toEqual({ cmd: 2, label: 'After-action report', detail: 'FIRST LIGHT — Void Clearance' });
    expect(lastCommand(campaign, engine.events.slice(0, 1))).toBeNull();
    expect(lastCommand(campaign, [])).toBeNull();
    expect(lastCommand(campaign, [...engine.events, { seq: 9, cmd: 9, type: 'ManualAdjustmentApplied', payload: { note: 'fix' } }])?.detail).toBe('fix');
    expect(eventLabel('Nope')).toBe('Nope');
  });

  it('debriefView: one command only, briefing excluded, kind from first event', () => {
    const { engine } = run();
    engine.dispatch({ type: 'rollRandomEvent', table: 'sector-7-events' });
    const d = debriefView(engine.state.feed, engine.events, 2);
    expect(d.kind).toBe('debrief');
    expect(d.traffic.some((e) => e.source.type === 'briefing')).toBe(false);
    expect(d.traffic.some((e) => e.source.type === 'debrief')).toBe(true);
    expect([...d.traffic, ...d.log].every((e) => e.seq === 2 || e.seq === 3)).toBe(true);
    expect(d.log.length).toBeGreaterThan(0);
    expect(debriefView(engine.state.feed, engine.events, 1).kind).toBe('opening');
    expect(debriefView(engine.state.feed, [...engine.events, { seq: 9, cmd: 9, type: 'StageAdvanced' }], 9)).toEqual({ kind: 'stage', traffic: [], log: [] });
  });
});
