import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance.
 *
 * staleTime: 30 s  — data is considered fresh for 30 seconds; no refetch on
 *                    window focus within that window. Suits a POS app where
 *                    catalog / store data doesn't change every few seconds.
 * retry: 5         — five automatic retries on network error (Sheets API blip).
 * retryDelay: see below — exponential backoff with a max delay of 10 seconds.
 * gcTime: 5 min    — unused cache entries are garbage-collected after 5 minutes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 5,

      // Retry delay function with exponential backoff and a maximum delay of 10 seconds.
      // The delay increases exponentially with each retry attempt, starting at 100ms and doubling each time,
      //  but it will not exceed 10 seconds to prevent excessively long wait times between retries.
      retryDelay: (attemptIndex) => Math.min(100 * 2 ** attemptIndex, 10_000),
    },
  },
});
