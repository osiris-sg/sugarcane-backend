/**
 * Unsubscribe from push notifications
 * Call this when user logs out to prevent notifications going to wrong account
 */
export async function unsubscribePushNotifications() {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        console.log("[Push] Unsubscribed on logout");
      }
    }
  } catch (error) {
    console.error("[Push] Error unsubscribing:", error);
  }
}
