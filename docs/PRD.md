# Product Requirements Document (PRD)
# POS UMKM — Point of Sale for Indonesian Small Businesses

| Field       | Detail                            |
|-------------|-----------------------------------|
| Version     | 1.3                               |
| Status      | Draft                             |
| Date        | April 2026                        |
| Platform    | Web Application (Browser-based)   |
| Target      | Indonesian UMKM (General)         |
| Related     | docs/TRD.md (Technical Requirements)   |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Market Context](#3-market-context)
4. [Target Users & Personas](#4-target-users--personas)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [User Stories & Use Cases](#6-user-stories--use-cases)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Out of Scope (v1)](#9-out-of-scope-v1)
10. [Assumptions & Constraints](#10-assumptions--constraints)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

Indonesia has over **65 million UMKM** (small and micro businesses) that collectively contribute roughly 61% of the national GDP. Despite this scale, the vast majority still rely on manual cashiering — handwritten notes, pocket calculators, and cash-only transactions. This leaves them with no real-time inventory visibility, no sales analytics, and no digital payment integration.

**POS UMKM** is a web-based Point of Sale application designed specifically for Indonesian small businesses. It provides an affordable, easy-to-use, and offline-capable sales and inventory management system tailored to local payment methods (including QRIS), the Indonesian Rupiah (IDR), Bahasa Indonesia UI, and local tax regulations (PPN).

The product targets the full spectrum of general UMKM: food stalls (warung), retail shops, minimarkets, and fashion/clothing stores — any small business that sells goods and needs a faster, smarter way to operate at the counter.

---

## 2. Product Vision

> **"Empowering every Indonesian small business with the tools of a modern retailer — simple enough for a warung, powerful enough for a growing shop."**

### 2.1 Problem Statement

| Pain Point | Current Reality |
|---|---|
| Manual cashiering errors | Cashiers miscalculate change, especially during busy hours |
| No inventory tracking | Business owners discover stockouts only when a customer asks |
| No sales reporting | Profit/loss is estimated at best; decisions are made by gut |
| Cash-only limitation | Owners miss sales from customers who prefer digital payments |
| Paper-based records | Receipts and ledgers are easily lost, damaged, or falsified |
| High cost of enterprise POS | Solutions like Moka POS or iSeller are expensive for micro businesses |

### 2.2 Product Positioning

POS UMKM is positioned as a **100% free, locally-aware, web-based POS** that runs on any device with a browser — including low-cost Android tablets and laptops. No subscription, no server fees, and no app store installation required.

---

## 3. Market Context

### 3.1 Indonesia UMKM Landscape

- **65.4 million** UMKM businesses as of 2023 (BPS data)
- Contribute **~61%** of Indonesia's GDP
- Employ **~97%** of the Indonesian workforce
- Only **~20%** have adopted any form of digital financial tools
- Government target: digitize **30 million UMKM** by 2024 (Kemendag program)

### 3.2 Digital Payment Adoption

- **QRIS** (Quick Response Code Indonesian Standard) was mandated by Bank Indonesia in 2019 and has over **30 million merchant registrations** as of 2024
- QRIS allows customers to pay from any e-wallet (GoPay, OVO, Dana, ShopeePay, LinkAja, BCA Mobile, etc.) via a single QR code
- Cash remains dominant but digital payments are growing rapidly, especially post-COVID
- Common payment methods in UMKM context: Cash, QRIS, Bank Transfer, EDC (debit/credit card)

### 3.3 Technology Access

- Smartphone penetration: **~70%** of Indonesia's 270 million population
- Most UMKM owners use **Android smartphones** or low-cost tablets
- Internet connectivity is improving but can be unreliable outside Java
- Preference for **low data usage** and **offline-first** apps

### 3.4 Competitive Landscape

| Product | Strengths | Weaknesses vs. POS UMKM |
|---|---|---|
| Moka POS | Feature-rich, established | Expensive subscription, complex |
| iSeller | Omnichannel, strong ecosystem | Costly, over-featured for micro |
| Kasir Pintar | Indonesian-focused | Mobile-only, limited web support |
| BukuKas / BukuWarung | Free bookkeeping | Not a true POS, no inventory |
| Excel/manual | Free | No real-time data, error-prone |

**POS UMKM differentiators:**
- Free and 100% accessible — no subscription, no app store, runs on any browser
- Built for Indonesian context (QRIS, IDR, PPN, Struk)
- Simple onboarding — usable in under 10 minutes

---

## 4. Target Users & Personas

### Persona 1 — Ibu Sari (Warung Owner)

| Attribute | Detail |
|---|---|
| Age | 42 |
| Location | Surabaya, East Java |
| Business | Warung sembako (grocery stall) |
| Tech literacy | Low — uses WhatsApp, rarely installs new apps |
| Device | Shared Android tablet, intermittent WiFi |
| Pain points | Miscounting change, doesn't know which items sell most, forgets to restock |
| Goal | Serve customers faster, know when to reorder stock |

**Key needs:** Fast cashiering, simple UI with large buttons, basic inventory alerts, Bahasa Indonesia

---

### Persona 2 — Budi (Retail Shop Owner)

| Attribute | Detail |
|---|---|
| Age | 31 |
| Location | Bandung, West Java |
| Business | Small retail shop selling household goods |
| Tech literacy | Medium — uses GoPay, Instagram for promotion |
| Device | Laptop + Android phone |
| Pain points | Cashier errors, no daily sales summary, can't track which staff sold what |
| Goal | Daily sales report, multi-cashier support, digital receipts |

**Key needs:** Sales reports, multi-user/cashier accounts, QRIS integration, discount management

---

### Persona 3 — Citra (Fashion Store Owner)

| Attribute | Detail |
|---|---|
| Age | 27 |
| Location | Yogyakarta |
| Business | Clothing boutique (offline + Instagram) |
| Tech literacy | High — uses Shopee, Tokopedia |
| Pain points | Tracking product variants (size/color), slow checkout, managing returns |
| Goal | Product variant management, receipt sharing via WhatsApp, return/refund tracking |

**Key needs:** Product variants (size, color), refund/return, WhatsApp receipt, product search by name

---

### Persona 4 — Pak Hendra (Minimarket Owner)

| Attribute | Detail |
|---|---|
| Age | 50 |
| Location | Medan, North Sumatra |
| Business | Small neighborhood minimarket, 2 employees |
| Tech literacy | Low-medium |
| Pain points | Employee theft, expired products, no profit visibility |
| Goal | Secure cashier login, stock expiry tracking, daily profit report |

**Key needs:** Role-based access, expiry date tracking, end-of-day cash reconciliation, profit/loss report

---

### Persona 5 — Keluarga Santoso (Family-Owned Warung)

| Attribute | Detail |
|---|---|
| Business | Warung kelontong (mixed grocery), family-run |
| Owner | Pak Santoso, 55, father — sets up the store, manages finances |
| Staff | Bu Santoso (wife, 50) — handles cashiering during the day |
| | Reza (son, 23) — helps with evening shifts and stock restocking |
| Tech literacy | Pak Santoso: Low. Bu Santoso: Low. Reza: Medium. |
| Devices | One shared Android tablet at the counter; Pak Santoso uses his own phone |
| Pain points | No visibility into what staff are doing; everyone uses the same device and "account"; Pak Santoso can't check sales while away from the store |
| Goal | Each family member logs in with their own account; Pak Santoso can view reports from his phone; wife and son can only operate the cashier; data stays in the family |

**Key needs:** Multi-member access with individual logins; role-based permissions (owner vs. cashier); owner can invite family members; data stays in the owner's Google account

---

## 5. Goals & Success Metrics

### 5.1 Business Goals

| Goal | Description |
|---|---|
| Adoption | Acquire 10,000 registered UMKM businesses within 6 months of launch |
| Retention | Achieve 60% monthly active user retention at 3 months post-onboarding |
| Revenue | Convert 15% of free users to a paid plan within 12 months |
| Impact | Help users process at least 50 transactions/month on the platform |

### 5.2 User Goals

| User Goal | Metric |
|---|---|
| Faster checkout | Average transaction time < 30 seconds |
| Inventory awareness | ≥80% of users set up at least 5 products with stock levels |
| Digital payment adoption | ≥40% of transactions use non-cash payment methods |
| Reporting usage | ≥60% of active users view sales report weekly |

### 5.3 Product Quality Metrics

| Metric | Target |
|---|---|
| Page load time (initial) | < 3 seconds on 3G connection |
| Uptime | ≥ 99.5% monthly |
| Onboarding completion rate | ≥ 70% complete setup within first session |
| Support ticket rate | < 5% of active users submit a ticket per month |

---

## 6. User Stories & Use Cases

### 6.1 Core Transaction Flow

**US-01** — As a cashier, I want to add products to a cart by searching by name or barcode so that I can quickly build a customer's order.

**US-02** — As a cashier, I want to apply a discount (percentage or fixed amount) to a transaction so that I can honor promotions.

**US-03** — As a cashier, I want to accept multiple payment methods (cash, QRIS, bank transfer) so that customers can pay however they prefer.

**US-04** — As a cashier, I want the system to calculate change automatically when cash payment is entered so that I avoid manual calculation errors.

**US-05** — As a cashier, I want to print or share a receipt (thermal print or WhatsApp link) so that the customer has a proof of purchase.

**US-06** — As a cashier, I want to hold a transaction (park it) and start a new one so that I can serve multiple queues simultaneously.

**US-07** — As a cashier, I want the POS to work offline so that I can keep serving customers even when the internet is down.

---

### 6.2 Product & Inventory Management

**US-08** — As a business owner, I want to add products with name, price, SKU, category, and stock quantity so that I can manage my catalog.

**US-09** — As a business owner, I want to set product variants (e.g., size S/M/L, color Red/Blue) each with their own price and stock so that I can sell variable products.

**US-10** — As a business owner, I want to receive a low-stock alert when a product falls below a minimum threshold so that I can reorder in time.

**US-11** — As a business owner, I want to do a stock opname (stock count) and adjust quantities so that my records match physical stock.

**US-12** — As a business owner, I want to set an expiry date on perishable products and see an expiry alert so that I can remove expired stock before selling.

---

### 6.3 Reporting & Analytics

**US-13** — As a business owner, I want to see a daily sales summary (total revenue, number of transactions, top products) so that I understand my business performance.

**US-14** — As a business owner, I want to filter reports by date range, product category, or cashier so that I can drill down into specific data.

**US-15** — As a business owner, I want to see a profit/loss report based on cost of goods vs. selling price so that I know my actual margin.

**US-16** — As a business owner, I want to export reports to PDF or Excel so that I can share them with my accountant or bank.

**US-17** — As a business owner, I want to do an end-of-day cash reconciliation (expected cash vs. actual cash in drawer) so that I can detect discrepancies.

---

### 6.4 User & Access Management

**US-18** — As an owner, I want to create cashier accounts with limited access so that my employees can only process sales, not view reports or change prices.

**US-19** — As an owner, I want to view a log of all transactions including which cashier processed them so that I can audit for errors or theft.

**US-20** — As an owner, I want to set a PIN or password for the POS session so that an idle terminal cannot be misused.

---

### 6.5 Customer & Loyalty (v1 Basic)

**US-21** — As a business owner, I want to add a customer name/phone to a transaction so that I can track purchases by customer.

**US-22** — As a business owner, I want to process a refund or return for a specific transaction so that I can manage customer complaints properly.

---

### 6.6 Family & Member Access

**US-23** — As an owner, I want to invite a family member or staff by email so that they can log in with their own Google account and access the store's data.

**US-24** — As an owner, I want to assign a role (Manager or Cashier) to each member so that they only see the features relevant to their job.

**US-25** — As a family member invited to a store, I want to open a Store Link and sign in with my own Google account so that I can access the shared store without needing to know any passwords or database credentials.

**US-26** — As an owner, I want to view the store's sales report from my phone while I am away from the store so that I can monitor the business remotely.

**US-27** — As an owner, I want to remove a member's access when they no longer work at the store so that they can no longer view or modify data.

---

## 7. Functional Requirements

### 7.1 Authentication & Onboarding

| ID | Requirement |
|---|---|
| F-AUTH-01 | Users sign in with their Google account (no separate username/password) |
| F-AUTH-02 | During onboarding, users set their business name, type, address, and logo |
| F-AUTH-03 | Owner creates the first product and sets up payment methods during onboarding wizard |
| F-AUTH-04 | Session-based POS lock with PIN code per user for terminal security |
| F-AUTH-05 | Role-based access: Owner (full access), Manager (reports + inventory), Cashier (POS only) |
| F-AUTH-06 | Owner can invite family members or staff by email; invitees receive a Store Link to join |
| F-AUTH-07 | Owner can change a member's role or revoke their access at any time |

### 7.2 Product Catalog

| ID | Requirement |
|---|---|
| F-CAT-01 | Create, edit, delete products with: name, SKU, category, selling price, cost price, stock qty, image |
| F-CAT-02 | Support product variants (e.g., size, color) with individual price and stock per variant |
| F-CAT-03 | Bulk product import via CSV template |
| F-CAT-04 | Product categories: create, rename, delete |
| F-CAT-05 | Low-stock threshold per product with configurable alert |
| F-CAT-06 | Optional expiry date field per product with expiry alert |

### 7.3 Point of Sale — Cashiering

| ID | Requirement |
|---|---|
| F-POS-01 | Product search by name or category browse |
| F-POS-02 | Add/remove items from cart, adjust quantities |
| F-POS-03 | Apply item-level or transaction-level discounts (flat IDR or percentage) |
| F-POS-04 | Apply a promo code to a transaction |
| F-POS-05 | Select payment method: Cash, QRIS (display QR), Bank Transfer, EDC (manual mark) |
| F-POS-06 | Cash payment: enter received amount, auto-calculate change |
| F-POS-07 | QRIS: display business QRIS QR code for customer to scan; cashier manually confirms payment |
| F-POS-08 | Split payment: pay part cash, part QRIS |
| F-POS-09 | Hold / park a transaction and retrieve it later |
| F-POS-10 | Offline mode: transactions are saved locally and synced automatically when connectivity is restored |
| F-POS-11 | PPN (Value Added Tax) toggle: optional 11% PPN applied per transaction |
| F-POS-12 | Service charge: optional configurable percentage |

### 7.4 Receipts

| ID | Requirement |
|---|---|
| F-REC-01 | Generate a digital receipt per transaction with: business name, logo, date/time, items, subtotal, discount, tax, total, payment method, cashier name |
| F-REC-02 | Share receipt as a WhatsApp message link (pre-filled wa.me link with receipt text) |
| F-REC-03 | Receipt numbering: auto-incremented, configurable prefix (e.g., INV/2024/001) |
| F-REC-04 | Reprint or resend any past receipt |

### 7.5 Inventory Management

| ID | Requirement |
|---|---|
| F-INV-01 | Stock is automatically decremented when a transaction is completed |
| F-INV-02 | Stock opname: owner can input actual physical count; system calculates discrepancy |
| F-INV-03 | Stock adjustment history log (who changed, when, from what to what) |
| F-INV-04 | Purchase order (incoming stock): record supplier, items, quantities, cost; update stock on receipt |
| F-INV-05 | Low-stock dashboard: list all products below their threshold |

### 7.6 Reporting & Analytics

| ID | Requirement |
|---|---|
| F-REP-01 | Daily sales summary: total revenue, transaction count, average basket size |
| F-REP-02 | Sales report filterable by: date range, cashier, product category, payment method |
| F-REP-03 | Top-selling products report (by quantity and by revenue) |
| F-REP-04 | Gross profit report: revenue minus cost of goods sold |
| F-REP-05 | Tax (PPN) collected report for a period |
| F-REP-06 | End-of-day cash reconciliation: expected cash (opening balance + cash sales) vs. actual declared cash |
| F-REP-07 | Transaction log with search and filter; shows cashier, items, total, payment method |
| F-REP-08 | Export report to PDF and Excel (.xlsx) |

### 7.7 Customer Management

| ID | Requirement |
|---|---|
| F-CUS-01 | Add a customer (name, phone, optional email) to a transaction |
| F-CUS-02 | View a customer's purchase history |
| F-CUS-03 | Process a return/refund: select original transaction, select items to return, restock inventory, record refund amount |

### 7.8 Settings & Configuration

| ID | Requirement |
|---|---|
| F-SET-01 | Business profile: name, logo, address, phone number — shown on receipts |
| F-SET-02 | Currency: Indonesian Rupiah (IDR) with no decimal display (rounded to nearest 100 IDR) |
| F-SET-03 | Tax configuration: enable/disable PPN, set rate (default 11%) |
| F-SET-04 | Receipt footer custom text (e.g., "Thank you, come again!") |
| F-SET-05 | Opening balance for cash drawer per shift |
| F-SET-06 | Multiple cashier/user management: invite, assign role, deactivate accounts |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Target |
|---|---|
| Initial page load (slow mobile connection) | < 3 seconds |
| Product search response time | < 300ms |
| Transaction completion | < 1 second |
| Offline transaction (no internet) | Instant |
| Report generation (30-day range) | < 5 seconds |

### 8.2 Offline Capability

> **Not in MVP.** The MVP requires an active internet connection for all operations. Offline mode is planned for a future release. Users should be clearly informed that internet access is required.

### 8.3 Security

| Requirement | Detail |
|---|---|
| Authentication | Secure session management with token-based authentication |
| Data in transit | All data encrypted between client and server |
| Data at rest | Sensitive business and customer data encrypted in storage |
| Role enforcement | Access control enforced on all data operations |
| Audit log | All critical actions (price changes, stock adjustments, refunds) are logged with user and timestamp |
| Session timeout | POS terminal auto-locks after configurable idle period (default 5 minutes) |

### 8.4 Localization & Accessibility

| Requirement | Detail |
|---|---|
| Language | UI available in Bahasa Indonesia (default) and English |
| Currency | IDR displayed with Rp prefix, no decimal, thousands separator (e.g., Rp 15.000) |
| Date format | `dd/MM/yyyy HH:mm` (Indonesian standard, date-fns tokens) |
| Number format | Period as thousands separator (e.g., 1.000) |
| Time zone | Displayed in user's browser-local timezone by default |
| Accessibility | Large touch targets suitable for tablet use; keyboard navigable |

### 8.5 Device Compatibility

| Device Type | Support |
|---|---|
| Desktop (laptop/PC) | Full feature support |
| Tablet (Android/iPad) | Primary cashiering target |
| Mobile (smartphone) | Supported for owner management and light cashiering |

### 8.6 Reliability & Data Integrity

- Uptime target: 99.5% monthly
- Data is stored in the owner's Google Drive; Google handles replication and availability
- All completed transactions are immutable; corrections must be made via refund/adjustment

---

## 9. Out of Scope (v1)

The following features are intentionally excluded from the first version to maintain focus and speed of delivery:

| Out of Scope | Notes |
|---|---|
| Offline / PWA mode | Requires custom backend or complex sync infrastructure; deferred post-MVP |
| Thermal printer integration | Hardware peripheral support deferred post-MVP; WhatsApp receipt sharing covers MVP need |
| Barcode scanner integration | Deferred post-MVP; manual product name search used in MVP |
| Full e-commerce / online store | Integration with Tokopedia/Shopee is a v2 consideration |
| Automated QRIS payment confirmation | v1 uses manual confirmation; real-time QRIS webhook requires BI licensing |
| Accounting / bookkeeping (jurnal) | Integration with Accurate/Jurnal.id is post-v1 |
| Employee payroll | Out of scope; recommend integration with Gadjian |
| Supply chain / supplier portal | Supplier management is basic (purchase orders only); no supplier-facing portal |
| Multi-outlet / multi-branch | Single outlet per account in v1; multi-outlet planned for v2 |
| Customer loyalty points program | v2 feature |
| Dynamic pricing / pricing rules | Manual discounts only in v1 |
| Advanced CRM / marketing campaigns | Basic customer records only in v1 |
| Native iOS or Android app | PWA covers mobile use cases in v1 |

---

## 10. Assumptions & Constraints

### 10.1 Assumptions

1. The target user has access to at least one of: a low-cost Android tablet, a laptop, or a smartphone with a modern browser (Chrome or Samsung Internet)
2. QRIS payment is confirmed manually by the cashier (no real-time payment gateway integration in v1)
3. The business operates with Indonesian Rupiah (IDR) only; no multi-currency
4. Internet connectivity is required at all times; offline mode is not supported in MVP
5. The business has a single physical outlet in v1
6. PPN (VAT) is the only tax applicable; no PPh, luxury tax, or import duty management
8. The app uses Google Login exclusively; a Google account is required for all users (owner, family members, and staff)

### 10.2 Constraints

| Constraint | Detail |
|---|---|
| Regulatory | Payment gateway integration must comply with Bank Indonesia regulations (PBI No. 23/6/PBI/2021) |
| QRIS | QRIS code must be registered through an approved PJSP; v1 uses a static merchant QR |
| Data residency | User data must be stored on servers located in Indonesia (PDIP compliance, UU No. 27/2022) |
| Free tier limitations | Free tier limited to: 1 user, 100 products, 500 transactions/month |
| Offline scope | Offline mode covers cashiering only; reports and settings require connectivity |

---

## 11. Glossary

| Term | Definition |
|---|---|
| **UMKM** | Usaha Mikro, Kecil, dan Menengah — Indonesian government classification for Micro, Small, and Medium Enterprises |
| **QRIS** | Quick Response Code Indonesian Standard — a unified QR code payment standard mandated by Bank Indonesia, accepted by all major e-wallets (GoPay, OVO, Dana, ShopeePay, etc.) |
| **PPN** | Pajak Pertambahan Nilai — Indonesian Value Added Tax (VAT), currently 11% |
| **Struk** | Indonesian term for a sales receipt or till slip |
| **Warung** | A small family-run shop or food stall, the most common form of micro business in Indonesia |
| **IDR / Rp** | Indonesian Rupiah — the national currency |
| **Stock Opname** | Physical stock count performed to verify inventory records against actual stock |
| **EDC** | Electronic Data Capture — a card payment terminal (debit/credit swipe machine) |
| **PJSP** | Penyelenggara Jasa Sistem Pembayaran — Bank Indonesia-licensed payment system service provider |
| **WIB / WITA / WIT** | Waktu Indonesia Barat/Tengah/Timur — Indonesia's three time zones (UTC+7, +8, +9) |
| **SKU** | Stock Keeping Unit — a unique identifier for each distinct product or variant |
| **Cash Reconciliation** | The process of comparing the expected cash in a drawer (based on recorded sales) against the actual physical cash counted at end of shift |
| **BukuWarung / BukuKas** | Popular Indonesian bookkeeping apps for UMKM; used here as competitive reference |
| **Moka POS / iSeller** | Enterprise-grade POS solutions for Indonesian merchants; competitive reference |
| **UU No. 27/2022** | Indonesia's Personal Data Protection Law (Undang-Undang Perlindungan Data Pribadi) |

---

*End of Document — POS UMKM PRD v1.3*
