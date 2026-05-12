import { afterEach, describe, expect, it, vi } from "vitest";
import * as adapters from "../../api/adapters";
import { queryClient } from "../../hooks/queryClient";
import { useAuthStore } from "../../store/authStore";
import * as storeMapStore from "../../store/storeMapStore";
import { clearSessionState } from "./session.service";
import * as setupService from "./setup.service";

describe("clearSessionState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it("clears Dexie, auth, store maps, setup storage, and query cache", async () => {
    const resetDexieLayerSpy = vi
      .spyOn(adapters, "resetDexieLayer")
      .mockResolvedValue(undefined);
    const resetStoreMapStoreSpy = vi.spyOn(storeMapStore, "resetStoreMapStore");
    const clearSetupStorageSpy = vi.spyOn(setupService, "clearSetupStorage");
    const queryClientClearSpy = vi.spyOn(queryClient, "clear");

    useAuthStore.setState({
      user: {
        id: "owner-1",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
      },
      role: "owner",
      isAuthenticated: true,
      activeStoreId: "store-1",
      mainSpreadsheetId: "main-1",
    });

    await clearSessionState();

    expect(resetDexieLayerSpy).toHaveBeenCalledOnce();
    expect(resetStoreMapStoreSpy).toHaveBeenCalledOnce();
    expect(clearSetupStorageSpy).toHaveBeenCalledOnce();
    expect(queryClientClearSpy).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().activeStoreId).toBeNull();
  });
});
