"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip on localhost (development)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      console.log("[SW] Skipping service worker registration on localhost");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("[SW] Service workers not supported");
      return;
    }

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log(
          "[SW] Service worker registered successfully:",
          registration.scope
        );

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[SW] New service worker installed and ready");
              }
            });
          }
        });
      } catch (error) {
        console.error("[SW] Service worker registration failed:", error);
      }
    }

    registerSW();
  }, []);

  return null;
}
