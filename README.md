# POS UMKM

A web-based Point of Sale (POS) application for Indonesian micro, small, and medium businesses (UMKM: Usaha Mikro, Kecil, dan Menengah).

## Prerequisites

- Node.js 18 or later
- A Google account (for authentication and data storage in Google Sheets)

## Setup & Installation

```bash
# Clone the repository
git clone https://github.com/<your-org>/pos-umkm.git
cd pos-umkm

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173/pos-umkm/](http://localhost:5173/pos-umkm/) in your browser.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server (Vite HMR) |
| `npm run build` | Production build to the `dist/` folder |
| `npm run preview` | Preview the production build locally |
| `biome check` | Run Biome format & lint checks |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Environment Configuration

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

The `.env.local` file is not committed to the repository.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Google Sheets API v4 (data stored in the user's Google Drive)
- **Auth**: Google Identity Services (OAuth 2.0)
- **Testing**: Vitest + Testing Library (unit), Playwright (E2E)
- **Hosting**: GitHub Pages / Netlify / Vercel

## Deployment

The app is built as a static SPA with base path `/pos-umkm/` for GitHub Pages:

```bash
npm run build
# Output is in the dist/ folder
```

## GitHub Actions Secrets

No secrets are required for the CI pipeline. All spreadsheet operations in E2E tests are fully mocked — Playwright tests never make real Google Sheets API calls.

## Documents

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document
- [`docs/TRD.md`](docs/TRD.md) — Technical Requirements Document
- [`docs/TASKS.md`](docs/TASKS.md) — Implementation Task List
- [`.github/skills/git-commit/SKILL.md`](.github/skills/git-commit/SKILL.md) — Git Commit Convention

