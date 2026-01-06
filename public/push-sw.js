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

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
