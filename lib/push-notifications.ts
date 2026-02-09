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

// Check if current time is within day shift hours (8am to 10pm Singapore time)
function isDayShift(): boolean {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 8 && sgHour < 22;
}

export interface IncidentNotificationParams {
  type: "new" | "reminder" | "breach" | "escalation" | "resolved" | "post_breach_reminder";
  incident: {
    id: string;
    type: string;
    deviceId: string;
    deviceName: string;
    startTime?: Date;
    slaDeadline?: Date | null;
  };
  title: string;
  body: string;
}

/**
 * Send incident-specific push notifications to appropriate staff
 * - new/reminder: Only to the driver assigned to the device
 * - breach: Driver + their ops manager + all admins (with attribution for ops/admin)
 * - escalation: Ops manager + admins
 * - resolved: Assigned driver only
 * - post_breach_reminder: Driver + ops manager (NO admin - they only get notified once at breach)
 */
export async function sendIncidentNotification(
  params: IncidentNotificationParams
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  const { type, incident, title, body } = params;

  try {
    let totalSent = 0;
    let totalFailed = 0;

    // Find the device and its assigned driver
    const device = await db.device.findUnique({
      where: { deviceId: incident.deviceId },
      select: { driverId: true },
    });

    // Find the assigned driver
    let assignedDriver = null;
    if (device?.driverId) {
      assignedDriver = await db.user.findFirst({
        where: {
          OR: [
            { id: device.driverId },
            { clerkId: device.driverId },
          ],
          isActive: true,
        },
        select: {
          id: true,
          clerkId: true,
          firstName: true,
          lastName: true,
          opsManagerId: true,
        },
      });
    }

    const driverName = assignedDriver
      ? `${assignedDriver.firstName || ""} ${assignedDriver.lastName || ""}`.trim() || "Driver"
      : "Unassigned";

    // Base payload for driver
    const driverPayload: NotificationPayload = {
      title,
      body,
      tag: `incident-${incident.id}`,
      url: `/dashboard/operations/incidents?id=${incident.id}`,
      data: {
        incidentId: incident.id,
        incidentType: incident.type,
        deviceId: incident.deviceId,
        notificationType: type,
      },
      requireInteraction: type === "breach" || type === "escalation",
      renotify: type === "reminder" || type === "breach",
    };

    // For new, reminder, resolved: Only notify assigned driver
    if (type === "new" || type === "reminder" || type === "resolved") {
      if (assignedDriver) {
        const result = await sendPushNotification(assignedDriver.clerkId, driverPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
        console.log(`[Push] Sent ${type} notification to assigned driver: ${driverName}`);
      } else {
        console.log(`[Push] No assigned driver for device ${incident.deviceId}, skipping ${type} notification`);
      }

      return { success: true, sent: totalSent, failed: totalFailed };
    }

    // For breach and escalation: Notify driver + ops manager + admins
    if (type === "breach" || type === "escalation") {
      // 1. Notify the assigned driver (if exists)
      if (assignedDriver) {
        const result = await sendPushNotification(assignedDriver.clerkId, driverPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }

      // 2. Find and notify the ops manager (who manages this driver)
      if (assignedDriver?.opsManagerId) {
        const opsManager = await db.user.findUnique({
          where: { id: assignedDriver.opsManagerId },
          select: { clerkId: true, isActive: true },
        });

        if (opsManager?.isActive) {
          const opsPayload: NotificationPayload = {
            ...driverPayload,
            title: type === "breach" ? "🚨 SLA Breach" : "⚠️ Escalation",
            body: `${incident.deviceName}: ${driverName} breached SLA`,
          };
          const result = await sendPushNotification(opsManager.clerkId, opsPayload);
          totalSent += result.sent;
          totalFailed += result.failed;
          console.log(`[Push] Sent ${type} notification to ops manager`);
        }
      }

      // 3. Notify all admins with attribution
      const admins = await db.user.findMany({
        where: {
          role: "ADMIN",
          isActive: true,
        },
        select: { clerkId: true },
      });

      for (const admin of admins) {
        const adminPayload: NotificationPayload = {
          ...driverPayload,
          title: type === "breach" ? "🚨 SLA Breach" : "⚠️ Escalation",
          body: `${incident.deviceName}: ${driverName} breached SLA`,
        };
        const result = await sendPushNotification(admin.clerkId, adminPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }

      console.log(`[Push] Sent ${type} notification to ${admins.length} admins`);
    }

    // For post_breach_reminder: Notify driver + ops manager (NO admin - they only get notified once at breach)
    if (type === "post_breach_reminder") {
      // 1. Notify the assigned driver (if exists)
      if (assignedDriver) {
        const result = await sendPushNotification(assignedDriver.clerkId, driverPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
        console.log(`[Push] Sent post-breach reminder to driver: ${driverName}`);
      }

      // 2. Notify the ops manager (who manages this driver) - NO admin
      if (assignedDriver?.opsManagerId) {
        const opsManager = await db.user.findUnique({
          where: { id: assignedDriver.opsManagerId },
          select: { clerkId: true, isActive: true },
        });

        if (opsManager?.isActive) {
          const opsPayload: NotificationPayload = {
            ...driverPayload,
            title: "🔴 SLA BREACHED - Ongoing",
            body: `${incident.deviceName}: ${driverName} still unresolved`,
          };
          const result = await sendPushNotification(opsManager.clerkId, opsPayload);
          totalSent += result.sent;
          totalFailed += result.failed;
          console.log(`[Push] Sent post-breach reminder to ops manager`);
        }
      }
    }

    console.log(
      `[Push] Incident notification (${type}) sent: ${totalSent}, failed: ${totalFailed}`
    );

    return { success: true, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Push] Error sending incident notification:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}

/**
 * Send push notification to ops manager and admin only (for escalations)
 */
export async function sendEscalationNotification(
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    const users = await db.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        isActive: true,
      },
      select: { clerkId: true },
    });

    if (users.length === 0) {
      console.log("[Push] No admin/manager users found for escalation");
      return { success: true, sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const user of users) {
      const result = await sendPushNotification(user.clerkId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { success: true, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Push] Error sending escalation:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}
