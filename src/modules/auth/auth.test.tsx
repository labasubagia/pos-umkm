/**
 * T014 — Auth Store + ProtectedRoute unit tests
 *
 * Tests the Zustand auth store and the ProtectedRoute component.
 * Uses MockAuthAdapter so no OAuth network calls are made.
 */

import { render, screen } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { ProtectedRoute } from "./ProtectedRoute";

function resetAuthStore() {
  useAuthStore.getState().clearAuth();
}

describe("Auth Store", () => {
  beforeEach(resetAuthStore);

  it("isAuthenticated is false on initial state", () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("login sets user, role in store", () => {
    act(() => {
      useAuthStore
        .getState()
        .setUser(
          { id: "u1", email: "owner@test.com", name: "Owner", role: "owner" },
          "owner",
        );
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe("owner@test.com");
    expect(state.role).toBe("owner");
  });

  it("logout clears user, role from store", () => {
    act(() => {
      useAuthStore
        .getState()
        .setUser(
          { id: "u1", email: "owner@test.com", name: "Owner", role: "owner" },
          "owner",
        );
      useAuthStore.getState().clearAuth();
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it("login does not store accessToken in localStorage via Zustand persist", () => {
    act(() => {
      useAuthStore
        .getState()
        .setUser(
          { id: "u1", email: "owner@test.com", name: "Owner", role: "owner" },
          "owner",
        );
    });
    // Access token must NOT appear in the persisted Zustand key
    const raw = localStorage.getItem("pos-umkm-auth");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("accessToken");
  });
});

describe("ProtectedRoute", () => {
  beforeEach(resetAuthStore);

  it("redirects to / when not authenticated", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/cashier"]}>
        <Routes>
          <Route path="/" element={<div>Login</div>} />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute>
                <div>Cashier</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("Login");
    expect(container.textContent).not.toContain("Cashier");
  });

  it("renders children when authenticated", () => {
    act(() => {
      useAuthStore
        .getState()
        .setUser(
          { id: "u1", email: "owner@test.com", name: "Owner", role: "owner" },
          "owner",
        );
    });
    render(
      <MemoryRouter initialEntries={["/cashier"]}>
        <Routes>
          <Route path="/" element={<div>Login</div>} />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute>
                <div>Cashier</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Cashier")).toBeTruthy();
  });
});
