import type { FieldCheck, UnitCard, UnitField } from '$lib/packs/schema';

export interface FieldValue {
  readonly path: string;
  readonly value: number;
}

type ListField = 'specialists' | 'weapons' | 'rules' | 'keywords';
const LIST_FIELDS: ReadonlySet<UnitField> = new Set<ListField>(['specialists', 'weapons', 'rules', 'keywords']);

/** Values a UnitField addresses on a unit. Weapon fields yield one value per (unit-level) weapon that sets it. */
export function fieldValues(unit: UnitCard, field: UnitField): FieldValue[] {
  switch (field) {
    case 'armor.dice':
      return [{ path: field, value: unit.armor.dice }];
    case 'armor.target':
      return [{ path: field, value: unit.armor.target }];
    case 'weapon.maxRange':
    case 'weapon.damage': {
      const prop = field === 'weapon.maxRange' ? 'maxRange' : 'damage';
      return unit.weapons.flatMap((w, i) => (w[prop] === undefined ? [] : [{ path: `weapons.${i}.${prop}`, value: w[prop] }]));
    }
    default:
      if (LIST_FIELDS.has(field)) return [{ path: field, value: unit[field as ListField].length }];
      return [{ path: field, value: unit[field as 'skill' | 'move' | 'grunts' | 'combatLoads'] }];
  }
}

/** True when `value` breaks the check's min/max/in/notIn bounds. */
export function violates(check: Pick<FieldCheck, 'min' | 'max' | 'in' | 'notIn'>, value: number): boolean {
  if (check.min !== undefined && value < check.min) return true;
  if (check.max !== undefined && value > check.max) return true;
  if (check.in !== undefined && !check.in.includes(value)) return true;
  return check.notIn !== undefined && check.notIn.includes(value);
}
