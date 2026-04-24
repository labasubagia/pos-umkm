---
name: git-commit
description: 'Make a git commit following POS UMKM rules. Use when: committing code, writing commit messages, completing a TASKS.md task, asked to "commit", "git commit", or "save changes to git". Enforces Conventional Commits format, type/scope/subject rules, atomic commits, TDD commit sequence, author identity check, and required Copilot co-author footer.'
argument-hint: 'Optional: describe what changed (e.g. "fix active-store delete guard")'
---

# Git Commit — POS UMKM

## Procedure

### Step 1 — Verify author identity

```sh
git config user.name
git config user.email
```

If either value is **empty or unset**, stop immediately and ask the user to provide their name and email. Do NOT commit with a default or bot identity.

```sh
name=$(git config user.name)
email=$(git config user.email)
if [ -z "$name" ] || [ -z "$email" ]; then
  echo "Git author not configured. Please set user.name and user.email."
  exit 1
fi
```

---

### Step 2 — Review what changed

```sh
git status
git diff --staged
```

If nothing is staged, stage only the files belonging to this **one logical change**:

```sh
git add <files>
```

**Atomic rule:** one logical change per commit. Split unrelated changes into separate commits.

---

### Step 3 — Choose type

| Type | When to use |
|---|---|
| `feat` | A new user-facing feature or capability |
| `fix` | A bug fix (production code) |
| `test` | Adding or updating tests only — no production code change |
| `refactor` | Code restructuring that neither adds a feature nor fixes a bug |
| `docs` | Documentation changes only (`.md` files, inline comments) |
| `chore` | Maintenance: dependency bumps, config tweaks, build scripts |
| `ci` | Changes to GitHub Actions workflows or CI configuration |
| `style` | Formatting only — no logic change (Biome auto-fix) |
| `perf` | Performance improvement with measurable impact |
| `revert` | Reverts a previous commit (reference the reverted hash in body) |

> **Rule:** If production code changed, type **must** be `feat`, `fix`, `refactor`, or `perf`. Never use `chore` to hide a logic change.

---

### Step 4 — Choose scope

| Scope | Maps to |
|---|---|
| `auth` | `src/modules/auth/` — login, session, PIN lock |
| `catalog` | `src/modules/catalog/` — categories, products, variants |
| `cashier` | `src/modules/cashier/` — cart, payments, receipt |
| `inventory` | `src/modules/inventory/` — stock opname, purchase orders |
| `customers` | `src/modules/customers/` — customer management, refunds |
| `reports` | `src/modules/reports/` — sales, profit, reconciliation, export |
| `settings` | `src/modules/settings/` — business profile, QRIS config |
| `adapters` | `src/lib/adapters/` — DataAdapter/AuthAdapter interface + impls |
| `sheets` | `src/lib/sheets/` — Google Sheets API client (low-level HTTP) |
| `lib` | `src/lib/` — uuid, formatters, validators, i18n (shared utilities) |
| `store` | `src/store/` — Zustand global stores |
| `router` | `src/router/` — route definitions, ProtectedRoute |
| `e2e` | `tests/e2e/` — Playwright specs |
| `ci` | `.github/workflows/` — CI/CD pipeline |
| `docs` | `docs/` — PRD, TRD, TASKS |

Omit scope only when the change truly spans the entire project (e.g., a root config rename).

---

### Step 5 — Write the subject line

Format: `type(scope): subject`

Rules:
- **Imperative mood** — "add …", "fix …", "prevent …" — not "added" or "adds"
- **Lowercase** after the colon-space
- **≤ 72 characters** total (entire first line)
- **No trailing period**
- **Be specific** — mention the thing changed, not the filename

Quick reference patterns:
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

### Step 6 — Write the body (when needed)

Include a body when the *why* is not obvious from the subject line alone.

- Separate from subject with a **blank line**
- Wrap lines at **72 characters**
- Explain **why** the change was made, not what (the diff shows what)
- Mention trade-offs, alternatives considered, or constraints
- Reference task ID: `Implements: T0NN`
- Reference PRD requirement if relevant: `Satisfies: F-POS-06`

Do NOT put in the body:
- A description of what every changed function does
- Implementation details self-evident from the diff
- Filler phrases: "as per discussion", "updated as requested", "various fixes"

---

### Step 7 — Add required footers

**Always include** for every Copilot/AI-assisted commit:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**Include when a TASKS.md task is fully completed:**
```
Implements: T0NN
```

**Include for breaking interface changes** (pair with `!` in the type — e.g. `feat!(adapters): ...`):
```
BREAKING CHANGE: <what broke and what callers must do>
```

**Include when a GitHub issue is resolved:**
```
Closes #42
```

---

### Step 8 — Commit

```sh
git commit
```

Use `-m` flags or an editor. Example with all sections:

```
feat(cashier): add change calculation to cash payment flow

Previously the POS only validated that cash >= total. The cashier now
receives the calculated change amount displayed on the confirm screen.
This satisfies F-POS-06 and US-12 (customer change display).

Implements: T027
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## TDD Commit Sequence

When following TDD, use **two commits** per task:

**Commit 1 — red phase (failing tests):**
```
test(catalog): add failing tests for Category CRUD service

All tests intentionally red at this point. Satisfies TDD red phase.
Implements: T021 (test phase)
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**Commit 2 — green phase (implementation):**
```
feat(catalog): implement Category CRUD service

Tests from previous commit now pass. No new logic beyond what the
tests specify. Uses DataAdapter interface so mock and Google adapters
work without changes.
Implements: T021
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Optional refactor commit (no behavior change):
```
refactor(catalog): extract category validation to shared validator
```

---

## Atomic Commit Rule

**One logical change per commit.** The commit must leave the codebase in a working state.

✅ **Belongs in one commit:**
- A new feature + its unit tests
- A bug fix + its regression test
- A refactor + updated tests
- A docs-only change

❌ **Must NOT be in one commit:**
- Two unrelated features
- A feature + an unrelated bug fix
- Commented-out code left "for reference"
- Auto-generated files that don't need versioning (add to `.gitignore`)
- Secrets, API keys, tokens, or credentials

---

## Anti-patterns

| ❌ Anti-pattern | Why it's bad | ✅ Fix |
|---|---|---|
| `fix: fix stuff` | Zero information | `fix(cashier): prevent negative change when overpayment rounds down` |
| `WIP: halfway done` | Broken state committed | Finish the unit of work; use a branch |
| `feat: lots of changes` | Un-reviewable; can't bisect | Break into atomic commits |
| `chore: update files` | Hides logic changes | Use `feat` or `fix` with proper scope |
| `docs: typo` | Too vague | `docs(PRD): fix typo in F-POS-06 requirement text` |
| `test: add tests` | Doesn't say what was tested | `test(adapters): add MockDataAdapter unit tests for softDelete` |
| 3,000+ lines in one commit | Unreviewable mega-commit | Commit incrementally per task/sub-task |
| Body explaining *what* changed | Diff already shows that | Body explains *why* |

---

## Quality Checklist

Before finalising, verify:

- [ ] `git config user.name` and `user.email` are both set
- [ ] Only files for this logical change are staged
- [ ] Subject line ≤ 72 chars, imperative mood, lowercase, no trailing period
- [ ] Type is `feat`/`fix`/`refactor`/`perf` if any production code changed
- [ ] Scope matches the changed module/layer from the table above
- [ ] `Co-authored-by: Copilot` footer is present
- [ ] `Implements: T0NN` footer is present when a TASKS.md task is completed
- [ ] No secrets or credentials in the diff
- [ ] No commented-out code in the diff
