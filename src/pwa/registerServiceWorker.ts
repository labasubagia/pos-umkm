type MaybeWindow = Window & {
  __MSW_ENABLED__?: boolean;
};

/**
 * Registers only the production app-shell worker so dev/test flows can keep
 * using Vite HMR and MSW without service-worker contention.
 */
export async function registerAppServiceWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return undefined;
  }

  if (import.meta.env.MODE !== "production") {
    return undefined;
  }

  if (!("serviceWorker" in navigator)) {
    return undefined;
  }

  if ((window as MaybeWindow).__MSW_ENABLED__) {
    return undefined;
  }

  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
