import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient instance.
 *
 * staleTime: 30 s  — data is considered fresh for 30 seconds; no refetch on
 *                    window focus within that window. Suits a POS app where
 *                    catalog / store data doesn't change every few seconds.
 * retry: 1         — one automatic retry on network error (Sheets API blip).
 * gcTime: 5 min    — unused cache entries are garbage-collected after 5 minutes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      gcTime: 5 * 60 * 1000,
    },
  },
})
