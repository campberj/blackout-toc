import { describe, expect, it } from 'vitest';
import { operatorEdit } from './operator-edit';
import { startGemini } from './__fixtures__/gemini';

describe('operatorEdit', () => {
  const { engine } = startGemini();
  const op = engine.state.operators['voss']!;
  const draft = { name: op.name, callsign: op.callsign ?? '', fields: { ...op.fields } };

  it('no change → no command', () => expect(operatorEdit(op, draft)).toEqual({ command: null, problem: null }));

  it('only changed parts; blank callsign clears it; engine accepts', () => {
    const r = operatorEdit(op, { ...draft, name: ' Elara Voss-Kade ', callsign: '', fields: { ...draft.fields, advancements: 'Steady Aim' } });
    expect(r).toEqual({
      command: { type: 'updateOperator', operator: 'voss', name: 'Elara Voss-Kade', callsign: null, fields: { advancements: 'Steady Aim' } },
      problem: null,
    });
    expect(engine.dispatch(r.command!).ok).toBe(true);
    expect(engine.state.operators['voss']).toMatchObject({ name: 'Elara Voss-Kade', callsign: null });
  });

  it('blank name is a problem', () => expect(operatorEdit(op, { ...draft, name: ' ' }).problem).toMatch(/Name/));
});
