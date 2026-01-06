import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendPushNotification } from "@/lib/push-notifications";

// POST /api/push/test - Send a test notification
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendPushNotification(userId, {
      title: "Test Notification",
      body: "Push notifications are working! You'll receive alerts for stock levels and device issues.",
      url: "/dashboard",
      tag: "test-notification",
    });

    if (result.sent === 0 && result.failed === 0) {
      return NextResponse.json({
        success: false,
        message: "No devices subscribed to notifications",
      });
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error("[Push] Test notification error:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
