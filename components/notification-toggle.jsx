"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    checkSupport();
  }, []);

  async function checkSupport() {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      await checkSubscription();
    } else {
      setIsLoading(false);
    }
  }

  async function checkSubscription() {
    try {
      const res = await fetch("/api/push/subscribe");
      const data = await res.json();
      setIsSubscribed(data.subscribed);
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function subscribe() {
    setIsLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setIsLoading(false);
        return;
      }

      // Register push service worker
      const registration = await navigator.serviceWorker.register(
        "/push-sw.js",
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("Push notifications not configured");
        setIsLoading(false);
        return;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      const data = await res.json();
      if (data.success) {
        setIsSubscribed(true);
        toast.success("Notifications enabled");

        // Send test notification
        await fetch("/api/push/test", { method: "POST" });
      } else {
        toast.error(data.error || "Failed to enable notifications");
      }
    } catch (error) {
      console.error("Subscribe error:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);

    try {
      // Get current subscription
      const registration = await navigator.serviceWorker.getRegistration(
        "/push-sw.js"
      );
      if (registration) {
        const subscription =
          await registration.pushManager.getSubscription();
        if (subscription) {
          // Unsubscribe from push
          await subscription.unsubscribe();

          // Remove from server
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }
      }

      setIsSubscribed(false);
      toast.success("Notifications disabled");
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast.error("Failed to disable notifications");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
      title={isSubscribed ? "Disable notifications" : "Enable notifications"}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-5 w-5" />
      ) : (
        <BellOff className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
}
