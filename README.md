# POS UMKM

Aplikasi Point of Sale (POS) berbasis web untuk usaha mikro, kecil, dan menengah (UMKM) Indonesia.

## Prasyarat

- Node.js 18 atau lebih baru
- Akun Google (untuk autentikasi dan penyimpanan data di Google Sheets)

## Setup & Instalasi

```bash
# Clone repositori
git clone https://github.com/<your-org>/pos-umkm.git
cd pos-umkm

# Install dependensi
npm install

# Jalankan server pengembangan
npm run dev
```

Buka [http://localhost:5173/pos-umkm/](http://localhost:5173/pos-umkm/) di browser Anda.

## Skrip yang Tersedia

| Skrip | Deskripsi |
|---|---|
| `npm run dev` | Jalankan server pengembangan (Vite HMR) |
| `npm run build` | Build produksi ke folder `dist/` |
| `npm run preview` | Preview build produksi secara lokal |
| `npm run lint` | Jalankan ESLint |
| `npm test` | Jalankan unit test (Vitest) |
| `npm run test:e2e` | Jalankan end-to-end test (Playwright) |

## Konfigurasi Environment

Salin `.env.example` ke `.env.local` dan isi nilai yang diperlukan:

```bash
cp .env.example .env.local
```

File `.env.local` tidak di-commit ke repositori.

## Teknologi

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Google Sheets API v4 (data tersimpan di Google Drive pengguna)
- **Auth**: Google Identity Services (OAuth 2.0)
- **Testing**: Vitest + Testing Library (unit), Playwright (E2E)
- **Hosting**: GitHub Pages / Netlify / Vercel

## Deployment

Aplikasi di-build sebagai SPA statis dengan base path `/pos-umkm/` untuk GitHub Pages:

```bash
npm run build
# Output ada di folder dist/
```

## GitHub Actions Secrets

The CI pipeline requires the following secrets to be configured in the repository settings
(**Settings → Secrets and variables → Actions**):

| Secret | Description |
|---|---|
| `GOOGLE_TEST_EMAIL` | Email address of the Google test account used by Playwright E2E tests |
| `GOOGLE_TEST_SPREADSHEET_ID` | Spreadsheet ID of the test Google Sheet pre-seeded for E2E tests |

These values are never committed to the repository. E2E tests skip Google API calls when these
secrets are absent (uses `MockAdapter` in CI by default).

## Dokumen

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document
- [`docs/TRD.md`](docs/TRD.md) — Technical Requirements Document
- [`docs/TASKS.md`](docs/TASKS.md) — Implementation Task List
- [`docs/COMMITS.md`](docs/COMMITS.md) — Git Commit Convention

