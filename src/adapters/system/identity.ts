import type { Identity, Repository } from '../../ports';

export interface IdentityRecord {
  readonly id: string;
  readonly userId: string;
}

/** Settings key holding the anonymous identity (travels with backups, so a restore keeps the user). */
export const IDENTITY_KEY = 'identity';

/** Anonymous local identity, created on first use and persisted in `repo`. */
export function createLocalIdentity(
  repo: Repository<IdentityRecord>,
  newId: () => string = () => crypto.randomUUID(),
): Identity {
  let pending: Promise<string> | undefined;
  const load = async (): Promise<string> => {
    const existing = await repo.get(IDENTITY_KEY);
    if (typeof existing?.userId === 'string' && existing.userId) return existing.userId;
    const userId = newId();
    await repo.put({ id: IDENTITY_KEY, userId });
    return userId;
  };
  return {
    // Serialize so concurrent first calls don't mint two ids; re-read afterwards (a restore may change it).
    userId() {
      pending ??= load().finally(() => (pending = undefined));
      return pending;
    },
  };
}
