import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// POST /api/push/clear - Clear all subscriptions for current user
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await db.pushSubscription.deleteMany({
      where: { clerkId: userId },
    });

    console.log(`[Push] Cleared ${result.count} subscriptions for user ${userId}`);

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error("[Push] Clear subscriptions error:", error);
    return NextResponse.json(
      { error: "Failed to clear subscriptions" },
      { status: 500 }
    );
  }
}
