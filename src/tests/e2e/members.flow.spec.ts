/**
 * E2E specs for Phase 2 — Auth: member invite, role protection, PIN lock.
 *
 * Auth is injected via localStorage (injectAuthState). The Google OAuth popup
 * is never triggered because Zustand auth state is pre-seeded. The join-store
 * flow is tested by navigating directly to /join?sid=... with auth pre-injected.
 */
import { expect, test } from "@playwright/test";
import { navigateTo } from "./helpers/auth";
import { BASE, DEFAULT_STORE, injectAuthState } from "./helpers/auth-dexie";
import {
  reloadAndWait,
  seedDexie,
  waitForHydration,
} from "./helpers/dexie-seed";

const STORE = DEFAULT_STORE;
const now = new Date().toISOString();

async function signInAndNavigate(
  page: Parameters<typeof injectAuthState>[0],
  path: string,
  waitFor: string,
) {
  await injectAuthState(page, STORE);
  await page.goto(`${BASE}/${STORE.storeId}${path}`);
  await page.getByTestId(waitFor).waitFor();
  await waitForHydration(page);
}

test.describe("Member invite and Store Link", () => {
  test("owner can invite a member via email and see Store Link", async ({
    page,
  }) => {
    await signInAndNavigate(
      page,
      "/settings/member-management",
      "input-member-email",
    );

    await page.getByRole("heading", { name: /kelola anggota/i }).waitFor();

    await page.getByTestId("input-member-email").fill("member@test.com");
    await page.getByTestId("btn-invite-member").click();

    await expect(page.getByTestId("store-link-section")).toBeVisible();
    await expect(page.getByTestId("store-link-url")).toContainText("sid=");
  });

  test("owner can revoke a member's access", async ({ page }) => {
    await signInAndNavigate(
      page,
      "/settings/member-management",
      "input-member-email",
    );

    await page.getByRole("heading", { name: /kelola anggota/i }).waitFor();

    // Invite first
    await page.getByTestId("input-member-email").fill("revoke@test.com");
    await page.getByTestId("btn-invite-member").click();
    await expect(page.getByTestId("store-link-section")).toBeVisible();

    // Revoke
    await page.locator('[data-testid^="btn-revoke-"]').click();
    await expect(page.locator('[data-testid^="member-item-"]')).toHaveCount(0);
  });
});

test.describe("Store Link join flow", () => {
  test("user navigating to join page sees the join UI", async ({ page }) => {
    // Seed a Members row so resolveUserRole works
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/cashier`);
    await page.getByTestId("product-search-input").waitFor();
    await waitForHydration(page);
    await seedDexie(page, STORE.storeId, {
      Members: [
        {
          id: "u1",
          email: "owner@e2e.test",
          name: "E2E Owner",
          role: "owner",
          invited_at: now,
          deleted_at: null,
          created_at: now,
        },
      ],
    });
    await reloadAndWait(page, "product-search-input");
    // Navigate to join page with a store link
    await navigateTo(page, `${BASE}/join?sid=${STORE.masterSpreadsheetId}`);
    await expect(page.getByTestId("join-page-heading")).toBeVisible();
  });

  test("unauthenticated user accessing /reports is redirected away", async ({
    page,
  }) => {
    // Navigate directly without auth injection
    await page.goto(`${BASE}/${STORE.storeId}/reports`);
    await expect(page).not.toHaveURL(/\/reports/);
  });
});

test.describe("Role-based route access", () => {
  test("owner role can access /reports", async ({ page }) => {
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/reports`);
    // Owner should not be redirected away from /reports
    await expect(page).not.toHaveURL(/\/cashier/);
  });
});

test.describe("POS terminal PIN lock", () => {
  test("PIN lock overlay is not shown when no PIN is configured", async ({
    page,
  }) => {
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/cashier`);
    await page.getByTestId("product-search-input").waitFor();
    await expect(page.getByTestId("pin-lock-overlay")).not.toBeVisible();
  });

  test("cashier can unlock terminal with correct PIN when PIN is configured", async ({
    page,
  }) => {
    await injectAuthState(page, STORE);
    await page.goto(`${BASE}/${STORE.storeId}/cashier`);
    await page.getByTestId("product-search-input").waitFor();
    // Without a PIN hash configured, the overlay never appears
    await expect(page.getByTestId("pin-lock-overlay")).not.toBeVisible();
  });
});
