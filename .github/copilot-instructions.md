# Copilot Instructions — POS UMKM

## Start of Session — Required Reading

**Before responding to any prompt in this repository, read these documents in order:**

1. **`docs/PRD.md`** — understand what the product does, for whom, and why. Check personas, user stories, and functional requirements before making decisions.
2. **`docs/TRD.md`** — understand how it is built. Stack, architecture, data model (Google Sheets), auth flow, testing strategy, and module structure.
3. **`docs/TASKS.md`** — find the current implementation status. Pick tasks with status ⬜ `todo` whose `depends_on` tasks are all ✅ `done`. Update task status before starting (`🔄 in-progress`) and after finishing (`✅ done`).
4. **`docs/COMMITS.md`** — read before every `git commit`. Follow the Conventional Commits format, scope list, atomic commit rule, and required Copilot co-author trailer defined there.

Do not start implementing until you have read all three. If a decision you are about to make contradicts something in PRD, TRD, or TASKS, flag the conflict before proceeding.

---

## What This Repository Is

This is a **product and planning repository** for **POS UMKM** — a web-based Point of Sale system targeting Indonesian small businesses (UMKM: Usaha Mikro, Kecil, dan Menengah). There is no application code yet. The repository uses three documents:

- **`docs/PRD.md`** (v1.3) — Product Requirements Document. Business/product-focused: what the product does, for whom, and why. No implementation specifics.
- **`docs/TRD.md`** (v2.1) — Technical Requirements Document. How the product is built: stack, protocols, APIs, infrastructure, offline architecture, security implementation.
- **`docs/TASKS.md`** — Implementation task list for AI coding agents. 47 tasks across 8 phases with TDD test cases, Playwright E2E specs, depends_on fields, and status tracking.
- **`docs/COMMITS.md`** — Git commit message guide. Conventional Commits format, scope list, anti-patterns, TDD commit sequence, and required trailers.

Keep these concerns separated — product decisions go in PRD, implementation decisions go in TRD, and execution tracking goes in TASKS.

## PRD Structure

`docs/PRD.md` is organized into 11 sections. When editing it, maintain this order:

1. Executive Summary
2. Product Vision
3. Market Context
4. Target Users & Personas
5. Goals & Success Metrics
6. User Stories & Use Cases
7. Functional Requirements
8. Non-Functional Requirements
9. Out of Scope (v1)
10. Assumptions & Constraints
11. Glossary

## TRD Structure

`docs/TRD.md` is organized into 13 sections reflecting the **MVP stack (Google Sheets as database)**:

1. Platform & Architecture (static SPA + Google Sheets API — no custom backend)
2. Frontend (React/TypeScript/Vite/Tailwind — no PWA/service worker in MVP; module structure in §2.5)
3. Authentication — Google Login (GIS; owner `drive.file` scope; members `spreadsheets` scope; family invite via Store Link)
4. Data Layer — Google Sheets (Master Sheet for reference data + Monthly Sheets for transactions; ER in §5)
5. Entity Relationship Diagram (Mermaid ER diagram)
6. Data Security (user data in owner's Google Drive; bcrypt PIN; no secrets in bundle)
7. Testing Strategy (TDD with Vitest + Testing Library; E2E with Playwright covering all business flows)
8. Browser & Device Compatibility
9. Peripheral Integration (post-MVP — not in MVP)
10. Hosting & Infrastructure (GitHub Pages / Netlify / Vercel — all free)
11. Data Capacity & API Quotas (Google Sheets limits, Sheets API rate limits)
12. Offline Mode (not in MVP)
13. Glossary

## TASKS Structure

`docs/TASKS.md` is the implementation task list for AI coding agents. It contains **47 tasks across 8 phases**.

### Task Format

Each task contains:
- **Status** — ⬜ `todo` / 🔄 `in-progress` / ✅ `done` / 🚫 `blocked`
- **Phase** — which phase it belongs to
- **Depends on** — task IDs that must be `done` before this task can start
- **Test type** — `none` (scaffold) / `unit` / `unit + e2e`
- **Architecture note** — why this approach was chosen over alternatives
- **Test cases** — named ✅ positive and ❌ negative cases to implement (TDD)
- **E2E spec** — Playwright file path and test name (for business flow tasks)

### Phase Summary

| Phase | Tasks | Description |
|---|---|---|
| 0 — Scaffold | T001–T009 | Project init, tooling, CI, folder structure (no tests) |
| 1 — Core Lib | T010–T013 | Sheets API client, UUID, IDR formatter, validators |
| 2 — Auth | T014–T020 | Google Login, master sheet setup, member invite, PIN lock |
| 3 — Catalog | T021–T024 | Categories, products, variants, CSV import |
| 4 — Cashier | T025–T033 | Cart, search, payments, discounts, receipt |
| 5 — Inventory | T034–T035 | Stock opname, purchase orders |
| 6 — Customers | T036–T037 | Customer management, refunds |
| 7 — Reports | T038–T042 | Sales summary, date-range, profit, reconciliation, export |
| 8 — Settings | T043–T044 | Business profile, QRIS config |

### Agent Workflow

1. Read `docs/TASKS.md` to find all ⬜ `todo` tasks
2. Check `depends_on` — only start tasks whose dependencies are all ✅ `done`
3. Change status to 🔄 `in-progress` before writing any code
4. Write failing tests first (TDD), then implement, then verify tests pass
5. Change status to ✅ `done` after all tests pass

Phases 3–7 are independent of each other and can be worked on in parallel by different agents once Phase 2 is complete.



### Requirement IDs
Functional requirements use structured IDs: `F-{MODULE}-{NN}`. Existing modules:
- `F-AUTH` — Authentication & Onboarding
- `F-CAT` — Product Catalog
- `F-POS` — Point of Sale / Cashiering
- `F-REC` — Receipts
- `F-INV` — Inventory Management
- `F-REP` — Reporting & Analytics
- `F-CUS` — Customer Management
- `F-SET` — Settings & Configuration

When adding new requirements, continue the sequential numbering within the module. Do not reuse or skip IDs.

### User Story Format
User stories follow: `As a [role], I want to [action] so that [outcome].`
IDs are sequential: `US-01`, `US-02`, etc.

### Indonesia-Specific Context
This product is built for the Indonesian market. Keep these in mind when adding or editing content:
- Currency: **IDR (Rp)** — no decimals, thousands separator is a period (e.g., Rp 15.000); stored in Google Sheets as plain integers (no decimals) to avoid floating-point issues
- Tax: **PPN 11%** (Indonesian VAT)
- Payment: **QRIS** is the primary digital payment standard (Bank Indonesia mandate); v1 uses manual cashier confirmation
- Language: UI is **Bahasa Indonesia** first, English second
- Data residency: data lives in user's own Google Drive (globally distributed); UU No. 27/2022 compliance is a known MVP trade-off to revisit post-MVP
- Time zones: WIB (UTC+7), WITA (UTC+8), WIT (UTC+9); timestamps stored as UTC ISO 8601 strings in sheets

### Glossary
Each document has its own glossary:
- **PRD Glossary** (Section 11) — domain/business terms: UMKM, QRIS, PPN, Struk, Warung, IDR, Stock Opname, EDC, PJSP, WIB/WITA/WIT, SKU, Cash Reconciliation, BukuWarung, Moka POS, UU No. 27/2022
- **TRD Glossary** (Section 13) — technical terms: SPA, GIS, OAuth 2.0, Access Token, Google Sheets API v4, drive.file scope, values.append, values.update, spreadsheetId, Store Link, Master Sheet, Monthly Sheet, UUID v4, Soft delete, bcrypt, TDD, Vitest, MSW, Playwright, ESC/POS, HID, Vite, GitHub Actions, PouchDB, IDR integers

When adding a new term, place it in the appropriate glossary based on whether it is a domain concept or a technical concept.

### Out of Scope
`docs/PRD.md` Section 9 lists features explicitly deferred to v2+. Before adding a new feature requirement, check this list. If a feature is listed there, do not add it to the functional requirements without first removing it from Out of Scope and noting the version change.

### Commit Convention

All commits must follow the rules in **`docs/COMMITS.md`**. Key points:

- Format: `type(scope): subject` (Conventional Commits)
- Scopes match the module structure: `auth`, `catalog`, `cashier`, `inventory`, `customers`, `reports`, `settings`, `adapters`, `sheets`, `lib`, `store`, `router`, `e2e`, `ci`, `docs`
- Always include `Implements: T0NN` in the footer when a TASKS.md task is completed
- Always include the Copilot co-author trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- One logical change per commit — test + implementation together, never mix unrelated changes

### Versioning
Each document tracks its version in the metadata table at the top. Increment the version number when making substantive changes to requirements (not typo fixes). PRD and TRD version numbers are independent.

