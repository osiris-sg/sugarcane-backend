/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  renotify?: boolean;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

// Handle push notifications
self.addEventListener("push", function (event) {
  if (!event.data) {
    console.log("[SW] Push event but no data");
    return;
  }

  try {
    const data = event.data.json();
    console.log("[SW] Push received:", data);

    const options: ExtendedNotificationOptions = {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/",
        ...data.data,
      },
      actions: data.actions || [],
      tag: data.tag || "supercane-notification",
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error("[SW] Error showing notification:", error);
  }
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
  console.log("[SW] Notification click received");

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";
  console.log("[SW] URL to open:", urlToOpen);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        // If there's any existing window, navigate it to the URL (better for PWA)
        if (windowClients.length > 0) {
          const client = windowClients[0];
          return client.navigate(urlToOpen).then((c) => c?.focus());
        }
        // No existing window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", function (event) {
  console.log("[SW] Notification closed:", event.notification.tag);
});

export {};
