// Push notification service worker for iOS compatibility
self.addEventListener("push", function (event) {
  console.log("[Push SW] Push event received");

  if (!event.data) {
    console.log("[Push SW] No data in push event");
    return;
  }

  try {
    const data = event.data.json();
    console.log("[Push SW] Push data:", data);

    const options = {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/",
      },
      tag: data.tag || "supercane-notification",
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error("[Push SW] Error showing notification:", error);
  }
});

self.addEventListener("notificationclick", function (event) {
  console.log("[Push SW] Notification clicked");
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";
  console.log("[Push SW] URL to open:", urlToOpen);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // If there's any existing window, navigate it to the URL (better for PWA)
      if (clientList.length > 0) {
        const client = clientList[0];
        if ("navigate" in client) {
          return client.navigate(urlToOpen).then(function (c) {
            return c && c.focus();
          });
        }
        // Fallback: focus and hope the app handles it
        return client.focus();
      }
      // No existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
