/**
 * useCart.ts — Zustand store for the cashier cart.
 *
 * Covers T025 (cart state), T029 (discount), T031 (hold carts).
 *
 * Cart state persists across route changes (global store), but resets on
 * transaction completion or page refresh (in-memory only — not persisted
 * to localStorage). Held carts are also in-memory only.
 */

import { create } from "zustand";
import type { CartItem, DiscountType } from "./cashier.service";

export interface HeldCart {
  items: CartItem[];
  discount: DiscountType | null;
  heldAt: string;
}

interface CartState {
  items: CartItem[];
  discount: DiscountType | null;
  paymentMethod: "CASH" | "QRIS" | "SPLIT" | null;
  cashReceived: number;
  heldCarts: HeldCart[];

  /** Add a product to cart or increment its quantity if already present. */
  addItem: (item: Omit<CartItem, "quantity">) => void;

  /** Remove one unit of an item; removes the row entirely at quantity 0. */
  removeItem: (productId: string, variantId?: string) => void;

  /** Directly set quantity for an item (removes if qty <= 0). */
  setQuantity: (
    productId: string,
    quantity: number,
    variantId?: string,
  ) => void;

  /** Set the transaction-level discount. Pass null to clear. */
  setDiscount: (discount: DiscountType | null) => void;

  /** Set the selected payment method. */
  setPaymentMethod: (method: "CASH" | "QRIS" | "SPLIT") => void;

  /** Set the cash amount received from the customer. */
  setCashReceived: (amount: number) => void;

  /** Reset the cart to initial state (called after transaction commit). */
  resetCart: () => void;

  /** Hold the current cart and start a fresh one. Throws if cart is empty. */
  holdCart: () => void;

  /** Retrieve a held cart by index and make it the active cart. */
  retrieveCart: (index: number) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: null,
  paymentMethod: null,
  cashReceived: 0,
  heldCarts: [],

  addItem: (newItem) =>
    set((state) => {
      const existing = state.items.find(
        (i) =>
          i.productId === newItem.productId &&
          i.variantId === newItem.variantId,
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === newItem.productId &&
            i.variantId === newItem.variantId
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        };
      }
      return { items: [...state.items, { ...newItem, quantity: 1 }] };
    }),

  removeItem: (productId, variantId) =>
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === productId && i.variantId === variantId,
      );
      if (!existing) return {};
      if (existing.quantity <= 1) {
        return {
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          ),
        };
      }
      return {
        items: state.items.map((i) =>
          i.productId === productId && i.variantId === variantId
            ? { ...i, quantity: i.quantity - 1 }
            : i,
        ),
      };
    }),

  setQuantity: (productId, quantity, variantId) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          ),
        };
      }
      return {
        items: state.items.map((i) =>
          i.productId === productId && i.variantId === variantId
            ? { ...i, quantity }
            : i,
        ),
      };
    }),

  setDiscount: (discount) => set({ discount }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  setCashReceived: (amount) => set({ cashReceived: amount }),

  resetCart: () =>
    set({ items: [], discount: null, paymentMethod: null, cashReceived: 0 }),

  holdCart: () => {
    const { items, discount } = get();
    if (items.length === 0) {
      throw new Error("Tidak dapat menahan keranjang kosong");
    }
    set((state) => ({
      heldCarts: [
        ...state.heldCarts,
        { items, discount, heldAt: new Date().toISOString() },
      ],
      items: [],
      discount: null,
      paymentMethod: null,
      cashReceived: 0,
    }));
  },

  retrieveCart: (index) => {
    const { heldCarts } = get();
    if (index < 0 || index >= heldCarts.length) {
      throw new Error(`Index keranjang yang ditahan tidak valid: ${index}`);
    }
    const held = heldCarts[index];
    set((state) => ({
      items: held.items,
      discount: held.discount,
      paymentMethod: null,
      cashReceived: 0,
      heldCarts: state.heldCarts.filter((_, i) => i !== index),
    }));
  },
}));
