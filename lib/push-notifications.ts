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

/**
 * Send push notification to users with specific roles
 */
export async function sendPushNotificationToRoles(
  payload: NotificationPayload,
  roles: string[]
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured");
    return { success: false, sent: 0, failed: 0 };
  }

  try {
    // Get users with specified roles
    const users = await db.user.findMany({
      where: {
        role: { in: roles as any },
        isActive: true,
      },
      select: { clerkId: true },
    });

    if (users.length === 0) {
      console.log(`[Push] No users found with roles: ${roles.join(", ")}`);
      return { success: true, sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const user of users) {
      const result = await sendPushNotification(user.clerkId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    console.log(`[Push] Sent to roles ${roles.join(", ")}: ${totalSent} sent, ${totalFailed} failed`);
    return { success: true, sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error("[Push] Error sending to roles:", error);
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

    // Fetch device location for display (use location instead of deviceName)
    const deviceRecord = await db.device.findUnique({
      where: { deviceId: incident.deviceId },
      select: { location: true },
    });
    const displayName = deviceRecord?.location || incident.deviceName;

    // Find all assigned drivers for this device (many-to-many)
    const deviceDrivers = await db.deviceDriver.findMany({
      where: { deviceId: incident.deviceId },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    // Filter to only active drivers
    const assignedDrivers = deviceDrivers
      .map((dd) => dd.user)
      .filter((u) => u.isActive);

    // For backward compatibility, also check legacy driverId field
    if (assignedDrivers.length === 0) {
      const device = await db.device.findUnique({
        where: { deviceId: incident.deviceId },
        select: { driverId: true },
      });

      if (device?.driverId) {
        const legacyDriver = await db.user.findFirst({
          where: {
            OR: [{ id: device.driverId }, { clerkId: device.driverId }],
            isActive: true,
          },
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
          },
        });
        if (legacyDriver) {
          assignedDrivers.push({ ...legacyDriver, isActive: true });
        }
      }
    }

    // Use first driver's name for attribution (or "Unassigned")
    const firstDriver = assignedDrivers[0];
    const driverName = firstDriver
      ? `${firstDriver.firstName || ""} ${firstDriver.lastName || ""}`.trim() || "Driver"
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

    // For new, reminder, resolved: Notify all assigned drivers
    if (type === "new" || type === "reminder" || type === "resolved") {
      if (assignedDrivers.length > 0) {
        for (const driver of assignedDrivers) {
          const result = await sendPushNotification(driver.clerkId, driverPayload);
          totalSent += result.sent;
          totalFailed += result.failed;
        }
        console.log(`[Push] Sent ${type} notification to ${assignedDrivers.length} assigned driver(s)`);
      } else {
        console.log(`[Push] No assigned drivers for device ${incident.deviceId}, skipping ${type} notification`);
      }

      return { success: true, sent: totalSent, failed: totalFailed };
    }

    // For breach and escalation: Notify all drivers + their ops managers + admins
    // BUT only if there are assigned drivers (skip unassigned devices)
    if (type === "breach" || type === "escalation") {
      if (assignedDrivers.length === 0) {
        console.log(`[Push] No assigned drivers for device ${incident.deviceId}, skipping ${type} notification`);
        return { success: true, sent: totalSent, failed: totalFailed };
      }

      // Track who we've already notified to avoid duplicates
      const notifiedClerkIds = new Set<string>();

      // Get clerkIds of all drivers directly assigned to this device
      const assignedDriverClerkIds = new Set(assignedDrivers.map((d) => d.clerkId));

      // 1. Notify all assigned drivers (with fault details)
      for (const driver of assignedDrivers) {
        if (!notifiedClerkIds.has(driver.clerkId)) {
          const result = await sendPushNotification(driver.clerkId, driverPayload);
          totalSent += result.sent;
          totalFailed += result.failed;
          notifiedClerkIds.add(driver.clerkId);
        }
      }

      // 2. Find and notify ops managers (who manage these drivers but aren't assigned directly)
      const driverIds = assignedDrivers.map((d) => d.id);
      const opsManagerAssignments = await db.opsManagerDriver.findMany({
        where: { driverId: { in: driverIds } },
        include: {
          opsManager: {
            select: { id: true, clerkId: true, isActive: true },
          },
        },
      });

      // Get unique active ops managers
      const uniqueOpsManagers = new Map();
      for (const assignment of opsManagerAssignments) {
        if (assignment.opsManager?.isActive) {
          uniqueOpsManagers.set(assignment.opsManager.id, assignment.opsManager);
        }
      }

      let opsManagersNotified = 0;
      for (const opsManager of Array.from(uniqueOpsManagers.values())) {
        // Skip if already notified (they were a driver directly assigned to this device)
        if (notifiedClerkIds.has(opsManager.clerkId)) {
          continue;
        }
        // Ops manager not directly assigned - send ops manager notification with driver attribution
        const opsPayload: NotificationPayload = {
          ...driverPayload,
          title: type === "breach" ? "🚨 SLA Breach" : "⚠️ Escalation",
          body: `${displayName}: ${driverName} breached SLA`,
        };
        const result = await sendPushNotification(opsManager.clerkId, opsPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
        notifiedClerkIds.add(opsManager.clerkId);
        opsManagersNotified++;
      }
      console.log(`[Push] Sent ${type} notification to ${opsManagersNotified} ops manager(s)`);

      // 3. Notify all admins with attribution
      const admins = await db.user.findMany({
        where: {
          role: "ADMIN",
          isActive: true,
        },
        select: { clerkId: true },
      });

      let adminsNotified = 0;
      for (const admin of admins) {
        // Skip if already notified as driver or ops manager
        if (notifiedClerkIds.has(admin.clerkId)) {
          continue;
        }
        const adminPayload: NotificationPayload = {
          ...driverPayload,
          title: type === "breach" ? "🚨 SLA Breach" : "⚠️ Escalation",
          body: `${displayName}: ${driverName} breached SLA`,
        };
        const result = await sendPushNotification(admin.clerkId, adminPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
        notifiedClerkIds.add(admin.clerkId);
        adminsNotified++;
      }

      console.log(`[Push] Sent ${type} notification to ${adminsNotified} admins`);
    }

    // For post_breach_reminder: Notify all drivers + their ops managers (NO admin - they only get notified once at breach)
    // BUT only if there are assigned drivers (skip unassigned devices)
    if (type === "post_breach_reminder") {
      if (assignedDrivers.length === 0) {
        console.log(`[Push] No assigned drivers for device ${incident.deviceId}, skipping post_breach_reminder notification`);
        return { success: true, sent: totalSent, failed: totalFailed };
      }

      // 1. Notify all assigned drivers
      for (const driver of assignedDrivers) {
        const result = await sendPushNotification(driver.clerkId, driverPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }
      console.log(`[Push] Sent post-breach reminder to ${assignedDrivers.length} driver(s)`);

      // 2. Notify all unique ops managers (who manage these drivers) - NO admin
      const driverIdsForReminder = assignedDrivers.map((d) => d.id);
      const opsManagerAssignmentsForReminder = await db.opsManagerDriver.findMany({
        where: { driverId: { in: driverIdsForReminder } },
        include: {
          opsManager: {
            select: { id: true, clerkId: true, isActive: true },
          },
        },
      });

      // Get unique active ops managers
      const uniqueOpsManagersForReminder = new Map();
      for (const assignment of opsManagerAssignmentsForReminder) {
        if (assignment.opsManager?.isActive) {
          uniqueOpsManagersForReminder.set(assignment.opsManager.id, assignment.opsManager);
        }
      }

      for (const opsManager of Array.from(uniqueOpsManagersForReminder.values())) {
        const opsPayload: NotificationPayload = {
          ...driverPayload,
          title: "🔴 SLA BREACHED - Ongoing",
          body: `${displayName}: ${driverName} still unresolved`,
        };
        const result = await sendPushNotification(opsManager.clerkId, opsPayload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }
      console.log(`[Push] Sent post-breach reminder to ${uniqueOpsManagersForReminder.size} ops manager(s)`);
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
