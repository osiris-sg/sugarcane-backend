import webpush from "web-push";
import { db } from "@/lib/db";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

function getVapidSubject(): string {
  if (process.env.VAPID_SUBJECT) {
    return process.env.VAPID_SUBJECT;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && appUrl.startsWith("https://")) {
    return appUrl;
  }
  return "mailto:push@supercane.app";
}

// Initialize VAPID details if keys are present
if (vapidPublicKey && vapidPrivateKey) {
  const vapidSubject = getVapidSubject();
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log("[Push] VAPID configured with subject:", vapidSubject);
} else {
  console.warn("[Push] VAPID keys not configured - push notifications disabled");
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
  renotify?: boolean;
}

/**
 * Send push notification to a specific user (all their devices)
 */
export async function sendPushNotification(
  clerkId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { clerkId },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found for user ${clerkId}`);
      return { success: true, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 3600, // 1 hour
            vapidDetails: {
              subject: getVapidSubject(),
              publicKey: vapidPublicKey,
              privateKey: vapidPrivateKey,
            },
          }
        );
        sent++;
      } catch (error: unknown) {
        const webPushError = error as { statusCode?: number };
        // Remove invalid subscriptions (404 or 410)
        if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
          console.log(`[Push] Removing invalid subscription: ${sub.endpoint}`);
          failedEndpoints.push(sub.endpoint);
        } else {
          console.error(`[Push] Error sending to ${sub.endpoint}:`, error);
        }
        failed++;
      }
    }

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: failedEndpoints } },
      });
    }

    return { success: true, sent, failed };
  } catch (error) {
    console.error("[Push] Error sending notifications:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to all admin users
 */
export async function sendPushNotificationToAdmins(
  payload: NotificationPayload,
  excludeClerkId?: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    // Get all admin users
    const adminUsers = await db.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        clerkId: excludeClerkId ? { not: excludeClerkId } : undefined,
      },
      select: { clerkId: true },
    });

    if (adminUsers.length === 0) {
      console.log("[Push] No admin users found");
      return { success: true, sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const user of adminUsers) {
      const result = await sendPushNotification(user.clerkId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { success: true, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Push] Error sending to admins:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to all ops staff (day/night shift based on current time)
 */
export async function sendPushNotificationToOps(
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    // Get ops users (admin, manager, driver)
    const opsUsers = await db.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER", "DRIVER"] },
      },
      select: { clerkId: true },
    });

    if (opsUsers.length === 0) {
      console.log("[Push] No ops users found");
      return { success: true, sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const user of opsUsers) {
      const result = await sendPushNotification(user.clerkId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { success: true, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Push] Error sending to ops:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}
