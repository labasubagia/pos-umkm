# AGENTS.md — POS UMKM

## Required Reading (in order)

1. **`docs/PRD.md`** — product requirements, user stories
2. **`docs/TRD.md`** — stack, architecture, data model
3. **`docs/TASKS.md`** — task status; pick `todo` tasks with all deps `done`

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173/pos-umkm/)
npm run build      # Production build
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
npm run check      # TypeScript check
npm run lint       # Biome lint
npm run lint:fix   # Biome auto-fix
```

Order: `lint` → `check` → `test` → `build`

## Project Structure

See `docs/TRD.md` §2.5 for full module structure.

## Data Model

See `docs/TRD.md` §4 — preset-driven Google Sheets schema (`src/config/presets/`).

## Testing Strategy

- TDD: write failing tests first, then implement
- Use `src/tests/e2e/` for Playwright E2E (all mocked, no real Google API)
- Unit tests use MSW for API mocking

## Environment

Copy `.env.example` to `.env` before running dev server.

## CI Pipeline

`.github/workflows/ci.yml` runs: check → lint → unit → build → e2e (on PR to main)

## Coding Guidelines

Follow these guidelines to reduce common mistakes:

### 1. Think Before Coding

- State assumptions explicitly. Ask if uncertain.
- If multiple interpretations exist, present them - don't pick silently.
- Push back when a simpler approach exists.
- If something is unclear, stop and ask.

### 2. Simplicity First

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes

- Touch only what you must. Don't "improve" adjacent code.
- Match existing style, even if you'd do it differently.
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

### 4. Goal-Driven Execution

- Define success criteria before implementing.
- Write tests first, then make them pass.
- For multi-step tasks, state a brief plan and verify each step.

## Commit Convention

See `.github/skills/git-commit/SKILL.md` — use `type(scope): subject` with `Implements: T0NN` footer.