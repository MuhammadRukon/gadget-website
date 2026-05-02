import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { GuestCartLine } from '@/contracts/cart';

/**
 * Guest cart held in localStorage. The real (authoritative) cart for
 * logged-in users lives on the server; this store is *only* used while
 * the user is signed out, then merged via `/api/cart` (PUT) on login.
 *
 * Keeping this strictly client-only and storing only the minimal
 * `{ variantId, quantity }` shape means we never duplicate prices,
 * names or images locally - all hydrated from the catalog API.
 */
interface GuestCartState {
  lines: GuestCartLine[];
  add: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

export const useGuestCart = create<GuestCartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (variantId, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === variantId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.variantId === variantId
                  ? { ...l, quantity: Math.min(99, l.quantity + quantity) }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, { variantId, quantity }] };
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
        })),
      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'Cryptech.guestCart',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
