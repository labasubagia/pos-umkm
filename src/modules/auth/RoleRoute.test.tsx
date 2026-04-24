/**
 * T019 — RoleRoute unit tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { RoleRoute } from "./RoleRoute";
import type { Role } from "../../lib/adapters/types";

function setRole(role: Role) {
  act(() => {
    useAuthStore
      .getState()
      .setUser(
        { id: "u1", email: "test@test.com", name: "Test", role },
        role,
        "tok",
      );
  });
}

function renderRoute(minRole: Role, content: string) {
  return render(
    <MemoryRouter initialEntries={["/target"]}>
      <Routes>
        <Route path="/cashier" element={<div>Cashier</div>} />
        <Route
          path="/target"
          element={
            <RoleRoute minRole={minRole}>
              <div>{content}</div>
            </RoleRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe("RoleRoute", () => {
  it("owner can access /settings (minRole=owner)", () => {
    setRole("owner");
    renderRoute("owner", "Settings");
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("manager can access /reports (minRole=manager)", () => {
    setRole("manager");
    renderRoute("manager", "Reports");
    expect(screen.getByText("Reports")).toBeTruthy();
  });

  it("cashier can access /cashier (minRole=cashier)", () => {
    setRole("cashier");
    renderRoute("cashier", "Cashier content");
    expect(screen.getByText("Cashier content")).toBeTruthy();
  });

  it("cashier redirected from /reports (minRole=manager) to /cashier", () => {
    setRole("cashier");
    const { container } = renderRoute("manager", "Reports");
    expect(container.textContent).toContain("Cashier");
    expect(container.textContent).not.toContain("Reports");
  });

  it("cashier redirected from /settings (minRole=owner) to /cashier", () => {
    setRole("cashier");
    const { container } = renderRoute("owner", "Settings");
    expect(container.textContent).toContain("Cashier");
    expect(container.textContent).not.toContain("Settings");
  });

  it("manager redirected from /settings (minRole=owner) to /cashier", () => {
    setRole("manager");
    const { container } = renderRoute("owner", "Settings");
    expect(container.textContent).toContain("Cashier");
    expect(container.textContent).not.toContain("Settings");
  });
});
