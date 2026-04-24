/**
 * T043 + T044 — settings.service unit tests
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapters from "../../lib/adapters";
import {
  getQRISImage,
  getSettings,
  SettingsError,
  saveQRISImage,
  saveSettings,
} from "./settings.service";

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: "test-id",
    sheetName: "mock",
    getAll: vi.fn().mockResolvedValue([]),
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    batchUpsert: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockRepos = {
    categories: mockRepo(),
    products: mockRepo(),
    variants: mockRepo(),
    members: mockRepo(),
    customers: mockRepo(),
    settings: mockRepo(),
    stockLog: mockRepo(),
    purchaseOrders: mockRepo(),
    purchaseOrderItems: mockRepo(),
    transactions: mockRepo(),
    transactionItems: mockRepo(),
    refunds: mockRepo(),
    stores: mockRepo(),
    monthlySheets: mockRepo(),
    auditLog: mockRepo(),
  };
  vi.spyOn(adapters, "getRepos").mockReturnValue(
    mockRepos as ReturnType<typeof adapters.getRepos>,
  );
});

// ── T043 ──────────────────────────────────────────────────────────────────────

describe("getSettings", () => {
  it("correctly maps all key-value rows to typed BusinessSettings object", async () => {
    mockRepos.settings.getAll.mockResolvedValue([
      {
        id: "1",
        key: "business_name",
        value: "Warung Pak Santoso",
        updated_at: "",
      },
      { id: "2", key: "timezone", value: "Asia/Makassar", updated_at: "" },
      { id: "3", key: "tax_rate", value: "11", updated_at: "" },
      {
        id: "4",
        key: "receipt_footer",
        value: "Terima kasih!",
        updated_at: "",
      },
      {
        id: "5",
        key: "qris_image_url",
        value: "https://example.com/qr.png",
        updated_at: "",
      },
    ]);

    const settings = await getSettings();

    expect(settings.business_name).toBe("Warung Pak Santoso");
    expect(settings.timezone).toBe("Asia/Makassar");
    expect(settings.tax_rate).toBe(11);
    expect(settings.receipt_footer).toBe("Terima kasih!");
    expect(settings.qris_image_url).toBe("https://example.com/qr.png");
  });

  it("returns default values when Settings tab is empty", async () => {
    mockRepos.settings.getAll.mockResolvedValue([]);

    const settings = await getSettings();

    expect(settings.business_name).toBe("POS UMKM");
    expect(settings.timezone).toBe("Asia/Jakarta");
    expect(settings.tax_rate).toBe(11);
    expect(settings.receipt_footer).toBe("Terima kasih sudah berbelanja!");
    expect(settings.qris_image_url).toBe("");
  });
});

describe("saveSettings", () => {
  it("calls batchUpsert with rows containing all changed fields", async () => {
    mockRepos.settings.getAll.mockResolvedValue([]);

    await saveSettings({ business_name: "New Name", tax_rate: 5 });

    expect(mockRepos.settings.batchUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: "business_name", value: "New Name" }),
        expect.objectContaining({ key: "tax_rate", value: "5" }),
      ]),
    );
    expect(mockRepos.settings.batchUpsert).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no fields provided", async () => {
    await saveSettings({});

    expect(mockRepos.settings.batchUpsert).not.toHaveBeenCalled();
  });
});

// ── T044 ──────────────────────────────────────────────────────────────────────

describe("saveQRISImage", () => {
  it("stores a data URL in the Settings tab", async () => {
    mockRepos.settings.getAll.mockResolvedValue([]);

    const dataUrl = "data:image/png;base64,abc123";
    await saveQRISImage(dataUrl);

    expect(mockRepos.settings.batchUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: "qris_image_url", value: dataUrl }),
      ]),
    );
  });

  it("stores an https URL in the Settings tab", async () => {
    mockRepos.settings.getAll.mockResolvedValue([]);

    await saveQRISImage("https://example.com/qris.png");

    expect(mockRepos.settings.batchUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: "qris_image_url",
          value: "https://example.com/qris.png",
        }),
      ]),
    );
  });

  it("updates existing row if qris_image_url key already exists", async () => {
    mockRepos.settings.getAll.mockResolvedValue([
      { id: "row-1", key: "qris_image_url", value: "old-url", updated_at: "" },
    ]);

    await saveQRISImage("https://new.com/qr.png");

    expect(mockRepos.settings.batchUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "row-1",
          key: "qris_image_url",
          value: "https://new.com/qr.png",
        }),
      ]),
    );
  });

  it("throws SettingsError if value is not a valid URL or data URL", async () => {
    await expect(saveQRISImage("not-a-url")).rejects.toThrow(SettingsError);
    await expect(
      saveQRISImage("ftp://old-protocol.com/img.png"),
    ).rejects.toThrow(SettingsError);
    await expect(saveQRISImage("")).rejects.toThrow(SettingsError);
  });
});

describe("getQRISImage", () => {
  it("returns stored QRIS image value", async () => {
    mockRepos.settings.getAll.mockResolvedValue([
      {
        id: "1",
        key: "qris_image_url",
        value: "https://cdn.example.com/qr.png",
        updated_at: "",
      },
    ]);

    const url = await getQRISImage();

    expect(url).toBe("https://cdn.example.com/qr.png");
  });

  it("returns empty string when not configured", async () => {
    mockRepos.settings.getAll.mockResolvedValue([]);

    const url = await getQRISImage();

    expect(url).toBe("");
  });
});
