import { describe, expect, it } from 'vitest';
import { xpProgress } from './xp';
import { startGemini } from './__fixtures__/gemini';

describe('xpProgress (GEMINI ranks 0/8/18/33)', () => {
  const { engine, campaign } = startGemini();
  const op = (xp: number, rank: string | null) => ({ ...engine.state.operators['acheron']!, stats: { xp, kills: 0, missions: 0 }, rank });

  it('progress from the current threshold to the next', () => {
    expect(xpProgress(campaign, op(4, 'operator'))).toMatchObject({ rankName: 'Operator', next: { key: 'tier-1', xp: 8 }, ratio: 0.5, toNext: 4 });
    expect(xpProgress(campaign, op(13, 'tier-1'))).toMatchObject({ next: { key: 'tier-2', xp: 18 }, ratio: 0.5, toNext: 5 });
  });
  it('top rank is full; unknown rank starts from zero', () => {
    expect(xpProgress(campaign, op(40, 'tier-3'))).toMatchObject({ next: null, ratio: 1, toNext: 0 });
    expect(xpProgress(campaign, op(2, null))).toMatchObject({ rankName: null, next: { key: 'tier-1' } });
  });
});
