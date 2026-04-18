# COMMITS.md — Git Commit Message Guide

> **For AI agents:** Read this document before every `git commit`. Follow the format and rules
> below exactly. A well-structured commit history helps humans and agents understand *why* the
> codebase changed, not just *what* changed.

---

## 1. Format

Every commit message follows the **Conventional Commits** specification:

```
type(scope): subject

[optional body]

[optional footer(s)]
```

### Example

```
feat(cashier): add change calculation to cash payment flow

Previously the POS only validated that cash >= total. The cashier now
receives the calculated change amount displayed on the confirm screen.
This satisfies F-POS-06 and US-12 (customer change display).

Implements: T027
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 2. Types

Use exactly one of these types:

| Type | When to use |
|---|---|
| `feat` | A new user-facing feature or capability |
| `fix` | A bug fix (production code) |
| `test` | Adding or updating tests only — no production code change |
| `refactor` | Code restructuring that neither adds a feature nor fixes a bug |
| `docs` | Documentation changes only (`.md` files, inline comments) |
| `chore` | Maintenance: dependency bumps, config tweaks, build scripts |
| `ci` | Changes to GitHub Actions workflows or CI configuration |
| `style` | Formatting only — no logic change (Prettier, ESLint auto-fix) |
| `perf` | Performance improvement with measurable impact |
| `revert` | Reverts a previous commit (reference the reverted hash in body) |

**Rule:** If a commit changes production code, it must be `feat`, `fix`, `refactor`, or `perf`.
Do not use `chore` to hide a logic change.

---

## 3. Scopes

Scope identifies which module or layer changed. Use one of the established scopes:

| Scope | Maps to |
|---|---|
| `auth` | `src/modules/auth/` — login, session, PIN lock |
| `catalog` | `src/modules/catalog/` — categories, products, variants |
| `cashier` | `src/modules/cashier/` — cart, payments, receipt |
| `inventory` | `src/modules/inventory/` — stock opname, purchase orders |
| `customers` | `src/modules/customers/` — customer management, refunds |
| `reports` | `src/modules/reports/` — sales, profit, reconciliation, export |
| `settings` | `src/modules/settings/` — business profile, QRIS config |
| `adapters` | `src/lib/adapters/` — DataAdapter/AuthAdapter interface + Mock/Google impls |
| `sheets` | `src/lib/sheets/` — Google Sheets API client (low-level HTTP) |
| `lib` | `src/lib/` — uuid, formatters, validators, i18n (shared utilities) |
| `store` | `src/store/` — Zustand global stores |
| `router` | `src/router/` — route definitions, ProtectedRoute |
| `e2e` | `tests/e2e/` — Playwright specs |
| `ci` | `.github/workflows/` — CI/CD pipeline |
| `docs` | `docs/` — PRD, TRD, TASKS, COMMITS |

Omit scope only when the change truly spans the entire project (e.g., a root config rename).

---

## 4. Subject Line Rules

- **Imperative mood** — write as if completing the sentence "This commit will…"
  - ✅ `add change calculation to cash payment flow`
  - ❌ `added change calculation` / `adds change calculation`
- **Lowercase** — start with a lowercase letter after the colon-space
- **≤72 characters** — the entire `type(scope): subject` line must fit in 72 chars
- **No trailing period**
- **Be specific** — mention the thing being changed, not the file name

---

## 5. Body Rules

Include a body when the *why* is not obvious from the subject line alone.

- Separate from subject with a **blank line**
- Wrap lines at **72 characters**
- Explain **why** the change was made, not what was changed (the diff shows what)
- Mention any trade-offs, alternatives considered, or constraints
- Reference the relevant TASKS.md task ID: `Implements: T0NN`
- Reference any PRD requirement IDs if relevant: `Satisfies: F-POS-06`

**Do NOT put in the body:**
- A description of what every changed function does (put that in code comments)
- Implementation details that are self-evident from the diff
- Filler phrases: "as per discussion", "updated as requested", "various fixes"

---

## 6. Footer

Footers appear after the body, each on its own line.

### Required for every commit from a Copilot/AI agent

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Task reference (always include when a TASKS.md task is completed)

```
Implements: T045
```

### Breaking changes

If the commit changes a public interface (e.g., `DataAdapter` method signature, a shared
utility, a route path), add a `BREAKING CHANGE` footer:

```
BREAKING CHANGE: DataAdapter.getSheet now returns Record<string,unknown>[]
instead of string[][]. All callers must be updated.
```

A `BREAKING CHANGE` footer **must** be paired with a `!` in the type: `feat!(adapters): ...`

### Issue references (when GitHub issues exist)

```
Closes #42
```

---

## 7. Atomic Commit Rule

**One logical change per commit.** A commit should be a single, coherent unit of work that
leaves the codebase in a working state.

### ✅ What belongs in one commit

- A new feature + its unit tests (TDD: failing tests committed first is acceptable as a
  separate commit, but final commit must include both implementation and passing tests)
- A bug fix + its regression test
- A refactor + updated tests
- A docs-only change

### ❌ What must NOT be in one commit

- Two unrelated features (split into two commits)
- A feature + an unrelated bug fix discovered while working
- Commented-out code left "for reference"
- Auto-generated files that do not need to be versioned (add to `.gitignore` instead)
- Secrets, API keys, tokens, or credentials of any kind

---

## 8. Anti-Patterns (Never Do These)

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| `fix: fix stuff` | Zero information — what was fixed? | `fix(cashier): prevent negative change when overpayment rounds down` |
| `WIP: halfway done` | Broken state committed | Finish the unit of work; use a branch, not WIP commits |
| `feat: lots of changes` | Un-reviewable; can't bisect | Break into multiple atomic commits |
| `chore: update files` | Hides logic changes as maintenance | Use `feat` or `fix` with a proper scope |
| `docs: typo` | Too vague for a docs repo | `docs(PRD): fix typo in F-POS-06 requirement text` |
| `test: add tests` | Doesn't say what was tested | `test(adapters): add MockDataAdapter unit tests for softDelete` |
| Commit with 3,000+ lines changed | Unreviable mega-commit | Commit incrementally as each task/sub-task completes |
| Body explaining *what* changed | The diff already shows that | Use the body to explain *why* |

---

## 9. TDD Commit Sequence

When following TDD, commit in this sequence:

```
test(catalog): add failing tests for Category CRUD service

All tests intentionally red at this point. Satisfies TDD red phase.
Implements: T021 (test phase)
```

```
feat(catalog): implement Category CRUD service

Tests from previous commit now pass. No new logic beyond what the
tests specify. Uses DataAdapter interface so mock and Google adapters
work without changes.
Implements: T021
```

```
refactor(catalog): extract category validation to shared validator

Moved inline validation into lib/validators.ts to be reusable by
Products (T022). No behavior change.
```

---

## 10. Quick Reference Card

```
feat(scope): add [thing] to [where]
fix(scope): prevent [bad outcome] when [condition]
test(scope): add [positive/negative] tests for [component]
refactor(scope): extract [concept] from [source] to [destination]
docs(scope): [add|update|fix] [section] in [document]
chore(scope): bump [package] to [version]
ci: [add|update] [job name] step in [workflow]
```

---

*End of Document — POS UMKM COMMITS.md*
