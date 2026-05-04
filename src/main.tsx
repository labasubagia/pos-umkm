import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import "./i18n/i18n";
import { AuthInitializer } from "./components/AuthInitializer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { queryClient } from "./hooks/queryClient";
import { router } from "./router";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

async function prepare(): Promise<void> {
  if ((window as unknown as Record<string, unknown>).__MSW_ENABLED__) {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  }
}

prepare().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer>
            <RouterProvider router={router} />
          </AuthInitializer>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
