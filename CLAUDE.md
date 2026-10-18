# Agent Conventions — BLKOUT: TOC

Read `docs/DESIGN.md` before any work. It is the source of truth; if code and doc disagree, stop and ask.

## Rules
- **Layering:** `domain/` and `packs/` are pure TS — no Svelte, DOM, storage, network, `Math.random` (lint-enforced). Use `domain/rng`.
- **Schemas first:** Zod schemas in `src/packs/schema` define types (`z.infer`). Never hand-write a duplicate type.
- **Ids:** always `packId:localId`. Never compare bare local ids across packs.
- **SOLID/DRY:** one module, one reason to change. Small ports. Shared card renderer. No copy-paste logic — extract.
- **No ESS content:** never commit official card stats, rules text, or art. Test fixtures use invented units.
- **Tests:** every domain module ships `*.test.ts`. Engine changes need a golden test (seed + inputs → state).
- **Fallible returns:** discriminated `{ok:true,…}|{ok:false,error}`; new code uses `Result<T,E>` from `src/domain/result.ts`.
- **UI → services:** pass plain data, never Svelte `$state` proxies (they can't be stored in IndexedDB). Use `$state.raw` for parsed files and `$state.snapshot()` at dispatch/save boundaries.
- **Done =** `npm run ci` green.
- **Brevity:** terse code comments (why, not what), terse reports.

## Check-in protocol (sub-agents)
Stop and report to the architect instead of guessing when you hit: a schema/DSL/event-shape change, an ambiguity in DESIGN.md, a new dependency, or a cross-module interface change. Report format:
`STATUS: done|blocked|partial` · `CHANGED:` files · `DECISIONS:` made · `QUESTIONS:` open · `RISKS:` for the next gateway.

## Pause protocol
At a pause, write `docs/HANDOFF.md`: branch, last green commit, WP status, next steps, open questions.

## Toolchain notes
- TypeScript pinned to 6.0.x (TS 7 not yet supported by typescript-eslint / svelte-check).
- `.npmrc` sets legacy-peer-deps (vitest 5 peer ranges lag vite 8).
- Deploy: GitHub Actions → Pages on push to `main`. Base path `/blackout-toc/`.
